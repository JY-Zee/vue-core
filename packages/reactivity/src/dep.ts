import { extend, isArray, isIntegerKey, isMap, isSymbol } from '@vue/shared'
import type { ComputedRefImpl } from './computed'
import { type TrackOpTypes, TriggerOpTypes } from './constants'
import {
  type DebuggerEventExtraInfo,
  EffectFlags,
  type Subscriber,
  activeSub,
  endBatch,
  shouldTrack,
  startBatch,
} from './effect'

/**
 * Incremented every time a reactive change happens
 * This is used to give computed a fast path to avoid re-compute when nothing
 * has changed.
 * 
 * 每当发生响应式变化时，该值会递增。
 * 这用于为计算属性提供快速路径，以避免在没有变化时重新计算。
 */
export let globalVersion = 0

/**
 * Represents a link between a source (Dep) and a subscriber (Effect or Computed).
 * Deps and subs have a many-to-many relationship - each link between a
 * dep and a sub is represented by a Link instance.
 * 
 * 表示源（Dep）与订阅者（Effect 或 Computed）之间的链接。
 * Dep 和 subs 之间存在多对多的关系 - 每个 dep 和 sub 之间的链接由一个 Link 实例表示。
 *
 * A Link is also a node in two doubly-linked lists - one for the associated
 * sub to track all its deps, and one for the associated dep to track all its
 * subs.
 * 
 * Link 也是两个双向链表中的一个节点 - 一个用于关联的 sub 跟踪其所有的 deps，另一个用于关联的 dep 跟踪其所有的 subs。
 *
 * @internal
 */
export class Link {
  /**
   * - Before each effect run, all previous dep links' version are reset to -1
   * - During the run, a link's version is synced with the source dep on access
   * - After the run, links with version -1 (that were never used) are cleaned
   *   up
   */
  version: number

  /**
   * Pointers for doubly-linked lists
   */
  nextDep?: Link
  prevDep?: Link
  nextSub?: Link
  prevSub?: Link
  prevActiveLink?: Link

  constructor(
    public sub: Subscriber,
    public dep: Dep,
  ) {
    this.version = dep.version
    this.nextDep =
      this.prevDep =
      this.nextSub =
      this.prevSub =
      this.prevActiveLink =
        undefined
  }
}

/**
 * @internal
 * 
 * Dep类用于管理依赖关系，表示一个源（Dep）与当前活动效果（Effect或Computed）之间的链接。
 * 它维护了一个双向链表，跟踪所有订阅该依赖的效果，并提供了跟踪和触发这些效果的机制。
 * 
 * 主要属性：
 * - version: 表示当前依赖的版本号，每次触发时递增。
 * - activeLink: 当前活动的链接，指向与当前效果相关的Link实例。
 * - subs: 订阅效果的双向链表（尾部）。
 * - subsHead: 订阅效果的双向链表（头部），用于在开发模式下按正确顺序调用onTrigger钩子。
 * - map: 用于对象属性依赖的清理。
 * - key: 依赖的键。
 * - sc: 订阅者计数器，记录当前有多少个订阅者。
 * 
 * 主要方法：
 * - constructor: 构造函数，初始化依赖的计算属性（如果有）。
 * - track: 跟踪当前活动效果对该依赖的访问。如果当前没有活动效果或不应跟踪，则返回undefined。
 *   - 如果当前活动效果与之前的链接不同，则创建一个新的Link实例，并将其添加到活动效果的依赖列表中。
 *   - 如果链接已经存在且版本为-1，则更新其版本并将其移动到尾部，以确保依赖列表的顺序。
 * - trigger: 触发依赖，增加版本号并调用notify方法，通知所有订阅者。
 * - notify: 通知所有订阅者，按逆序批量通知，并在批量结束时按原始顺序调用。
 *   - 在开发模式下，首先调用onTrigger钩子，然后调用每个订阅者的notify方法。
 */
export class Dep {
  version = 0
  /**
   * Link between this dep and the current active effect
   */
  activeLink?: Link = undefined

  /**
   * Doubly linked list representing the subscribing effects (tail)
   */
  subs?: Link = undefined

  /**
   * Doubly linked list representing the subscribing effects (head)
   * DEV only, for invoking onTrigger hooks in correct order
   */
  subsHead?: Link

  /**
   * For object property deps cleanup
   */
  map?: KeyToDepMap = undefined
  key?: unknown = undefined

  /**
   * Subscriber counter
   */
  sc: number = 0

  constructor(public computed?: ComputedRefImpl | undefined) {
    if (__DEV__) {
      this.subsHead = undefined
    }
  }

  track(debugInfo?: DebuggerEventExtraInfo): Link | undefined {
    // 目前不知道activeSub从哪里来
    if (!activeSub || !shouldTrack || activeSub === this.computed) {
      return
    }

    let link = this.activeLink // 获取当前活动链接，如果没有则为undefined
    if (link === undefined || link.sub !== activeSub) { // 检查当前链接是否未定义或与当前活动订阅者不同
      link = this.activeLink = new Link(activeSub, this) // 创建一个新的Link实例，并将其赋值给activeLink

      // add the link to the activeEffect as a dep (as tail)
      if (!activeSub.deps) { // 如果当前活动订阅者没有依赖列表
        activeSub.deps = activeSub.depsTail = link // 初始化依赖列表和尾部为当前链接
      } else {
        link.prevDep = activeSub.depsTail // 将当前链接的前一个依赖设置为活动订阅者的尾部
        activeSub.depsTail!.nextDep = link // 将活动订阅者的尾部的下一个依赖设置为当前链接
        activeSub.depsTail = link // 更新活动订阅者的尾部为当前链接
      }

      addSub(link) // 将当前链接添加到订阅者列表中
    } else if (link.version === -1) { // 如果链接已经存在且版本为-1
      // reused from last run - already a sub, just sync version
      link.version = this.version // 同步链接的版本为当前依赖的版本

      // If this dep has a next, it means it's not at the tail - move it to the
      // tail. This ensures the effect's dep list is in the order they are
      // accessed during evaluation.
      if (link.nextDep) { // 如果当前链接有下一个依赖
        const next = link.nextDep // 获取下一个依赖
        next.prevDep = link.prevDep // 将下一个依赖的前一个依赖设置为当前链接的前一个依赖
        if (link.prevDep) { // 如果当前链接有前一个依赖
          link.prevDep.nextDep = next // 将前一个依赖的下一个依赖设置为下一个依赖
        }

        link.prevDep = activeSub.depsTail // 将当前链接的前一个依赖设置为活动订阅者的尾部
        link.nextDep = undefined // 将当前链接的下一个依赖设置为undefined
        activeSub.depsTail!.nextDep = link // 将活动订阅者的尾部的下一个依赖设置为当前链接
        activeSub.depsTail = link // 更新活动订阅者的尾部为当前链接

        // this was the head - point to the new head
        if (activeSub.deps === link) { // 如果当前活动订阅者的依赖列表是当前链接
          activeSub.deps = next // 将依赖列表更新为下一个依赖
        }
      }
    }

    if (__DEV__ && activeSub.onTrack) {
      activeSub.onTrack(
        extend(
          {
            effect: activeSub,
          },
          debugInfo,
        ),
      )
    }

    return link
  }

  trigger(debugInfo?: DebuggerEventExtraInfo): void {
    this.version++
    globalVersion++
    this.notify(debugInfo)
  }

  notify(debugInfo?: DebuggerEventExtraInfo): void {
    startBatch()
    try {
      if (__DEV__) {
        // subs are notified and batched in reverse-order and then invoked in
        // original order at the end of the batch, but onTrigger hooks should
        // be invoked in original order here.
        for (let head = this.subsHead; head; head = head.nextSub) {
          if (head.sub.onTrigger && !(head.sub.flags & EffectFlags.NOTIFIED)) {
            head.sub.onTrigger(
              extend(
                {
                  effect: head.sub,
                },
                debugInfo,
              ),
            )
          }
        }
      }
      for (let link = this.subs; link; link = link.prevSub) {
        if (link.sub.notify()) {
          // if notify() returns `true`, this is a computed. Also call notify
          // on its dep - it's called here instead of inside computed's notify
          // in order to reduce call stack depth.
          ;(link.sub as ComputedRefImpl).dep.notify()
        }
      }
    } finally {
      endBatch()
    }
  }
}

/**
 * 添加订阅者到依赖项中。
 * 
 * @param link - 代表订阅者与依赖项之间链接的 Link 实例。
 * 
 * 该方法的主要功能是将一个新的订阅者（link）添加到其对应的依赖项（dep）中。
 * 
 * 具体步骤如下：
 * 1. 增加依赖项的订阅者计数（sc）。
 * 2. 检查当前订阅者（link.sub）是否处于跟踪状态（TRACKING）。
 * 3. 如果是，则获取与该依赖项相关的计算属性（computed）。
 *    - 如果这是计算属性的第一个订阅者，并且该依赖项还没有订阅者（subs），
 *      则启用跟踪并懒惰地订阅所有依赖项。
 * 4. 更新当前依赖项的尾部（currentTail），确保新订阅者（link）被正确链接到链表中。
 * 5. 在开发模式下，如果依赖项的头部（subsHead）未定义，则将其设置为当前链接（link）。
 * 6. 最后，将依赖项的订阅者（subs）更新为当前链接（link）。
 * 
 * 代码实现：
 * - 首先，增加依赖项的订阅者计数（sc），以反映新的订阅者。
 * - 然后，检查当前订阅者的状态，如果处于跟踪状态，则进行进一步处理。
 * - 如果存在计算属性并且当前依赖项没有订阅者，则启用计算属性的跟踪状态，并遍历其所有依赖项，递归调用 addSub 方法。
 * - 接着，更新当前依赖项的尾部，确保新订阅者被正确链接。
 * - 在开发模式下，确保头部指向当前链接。
 * - 最后，将依赖项的订阅者更新为当前链接，完成添加订阅者的过程。
 */
function addSub(link: Link) { // 定义一个函数 addSub，接受一个 Link 实例作为参数
  link.dep.sc++ // 增加依赖项的订阅者计数（sc），以反映新的订阅者
  if (link.sub.flags & EffectFlags.TRACKING) { // 检查当前订阅者是否处于跟踪状态
    const computed = link.dep.computed // 获取与该依赖项相关的计算属性
    // computed getting its first subscriber
    // enable tracking + lazily subscribe to all its deps
    if (computed && !link.dep.subs) { // 如果这是计算属性的第一个订阅者，并且该依赖项还没有订阅者
      computed.flags |= EffectFlags.TRACKING | EffectFlags.DIRTY // 启用计算属性的跟踪状态
      for (let l = computed.deps; l; l = l.nextDep) { // 遍历计算属性的所有依赖项
        addSub(l) // 递归调用 addSub 方法，添加每个依赖项的订阅者
      }
    }

    const currentTail = link.dep.subs // 获取当前依赖项的尾部
    if (currentTail !== link) { // 如果当前尾部不是新链接
      link.prevSub = currentTail // 将当前尾部设置为新链接的前一个订阅者
      if (currentTail) currentTail.nextSub = link // 更新当前尾部的下一个订阅者为新链接
    }

    if (__DEV__ && link.dep.subsHead === undefined) { // 在开发模式下，检查头部是否未定义
      link.dep.subsHead = link // 将头部设置为当前链接
    }

    link.dep.subs = link // 将依赖项的订阅者更新为当前链接
  }
}

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Maps to reduce memory overhead.
type KeyToDepMap = Map<any, Dep>

export const targetMap: WeakMap<object, KeyToDepMap> = new WeakMap()

export const ITERATE_KEY: unique symbol = Symbol(
  __DEV__ ? 'Object iterate' : '',
)
export const MAP_KEY_ITERATE_KEY: unique symbol = Symbol(
  __DEV__ ? 'Map keys iterate' : '',
)
export const ARRAY_ITERATE_KEY: unique symbol = Symbol(
  __DEV__ ? 'Array iterate' : '',
)

/**
 * Tracks access to a reactive property.
 *
 * This will check which effect is running at the moment and record it as dep
 * which records all effects that depend on the reactive property.
 *
 * @param target - Object holding the reactive property.
 * @param type - Defines the type of access to the reactive property.
 * @param key - Identifier of the reactive property to track.
 */
export function track(target: object, type: TrackOpTypes, key: unknown): void {
  if (shouldTrack && activeSub) {
    let depsMap = targetMap.get(target)
    if (!depsMap) {
      targetMap.set(target, (depsMap = new Map()))
    }
    let dep = depsMap.get(key)
    if (!dep) {
      depsMap.set(key, (dep = new Dep()))
      dep.map = depsMap
      dep.key = key
    }
    if (__DEV__) {
      dep.track({
        target,
        type,
        key,
      })
    } else {
      dep.track()
    }
  }
}

/**
 * Finds all deps associated with the target (or a specific property) and
 * triggers the effects stored within.
 *
 * @param target - The reactive object.
 * @param type - Defines the type of the operation that needs to trigger effects.
 * @param key - Can be used to target a specific reactive property in the target object.
 */
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>,
): void {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // never been tracked
    globalVersion++
    return
  }

  const run = (dep: Dep | undefined) => {
    if (dep) {
      if (__DEV__) {
        dep.trigger({
          target,
          type,
          key,
          newValue,
          oldValue,
          oldTarget,
        })
      } else {
        dep.trigger()
      }
    }
  }

  startBatch()

  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target
    depsMap.forEach(run)
  } else {
    const targetIsArray = isArray(target)
    const isArrayIndex = targetIsArray && isIntegerKey(key)

    if (targetIsArray && key === 'length') {
      const newLength = Number(newValue)
      depsMap.forEach((dep, key) => {
        if (
          key === 'length' ||
          key === ARRAY_ITERATE_KEY ||
          (!isSymbol(key) && key >= newLength)
        ) {
          run(dep)
        }
      })
    } else {
      // schedule runs for SET | ADD | DELETE
      if (key !== void 0 || depsMap.has(void 0)) {
        run(depsMap.get(key))
      }

      // schedule ARRAY_ITERATE for any numeric key change (length is handled above)
      if (isArrayIndex) {
        run(depsMap.get(ARRAY_ITERATE_KEY))
      }

      // also run for iteration key on ADD | DELETE | Map.SET
      switch (type) {
        case TriggerOpTypes.ADD:
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY))
            if (isMap(target)) {
              run(depsMap.get(MAP_KEY_ITERATE_KEY))
            }
          } else if (isArrayIndex) {
            // new index added to array -> length changes
            run(depsMap.get('length'))
          }
          break
        case TriggerOpTypes.DELETE:
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY))
            if (isMap(target)) {
              run(depsMap.get(MAP_KEY_ITERATE_KEY))
            }
          }
          break
        case TriggerOpTypes.SET:
          if (isMap(target)) {
            run(depsMap.get(ITERATE_KEY))
          }
          break
      }
    }
  }

  endBatch()
}

export function getDepFromReactive(
  object: any,
  key: string | number | symbol,
): Dep | undefined {
  const depMap = targetMap.get(object)
  return depMap && depMap.get(key)
}
