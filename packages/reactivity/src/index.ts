// 这块导出的内容是与引用（ref）相关的功能和类型。具体来说，以下是每个导出项的详细解释：
// 
// - `ref`: 创建一个响应式引用，允许你在 Vue 组件中使用基本数据类型。
// - `shallowRef`: 创建一个浅层响应式引用，只有引用的对象会被代理，而其内部的属性不会被代理。
// - `isRef`: 检查一个值是否是响应式引用。
// - `toRef`: 将一个对象的属性转换为响应式引用。
// - `toValue`: 获取响应式引用的值。
// - `toRefs`: 将一个响应式对象的所有属性转换为响应式引用。
// - `unref`: 获取一个引用的值，如果传入的不是引用，则直接返回该值。
// - `proxyRefs`: 将一个对象的引用属性代理到该对象本身，方便直接访问。
// - `customRef`: 创建一个自定义的响应式引用，允许开发者自定义其行为。
// - `triggerRef`: 手动触发引用的更新。
// - `type Ref`: 定义引用的类型。
// - `type MaybeRef`: 定义可能是引用或普通值的类型。
// - `type MaybeRefOrGetter`: 定义可能是引用、普通值或获取器的类型。
// - `type ToRef`: 定义将对象属性转换为引用的类型。
// - `type ToRefs`: 定义将响应式对象的属性转换为引用的类型。
// - `type UnwrapRef`: 定义解包引用的类型。
// - `type ShallowRef`: 定义浅层引用的类型。
// - `type ShallowUnwrapRef`: 定义解包浅层引用的类型。
// - `type RefUnwrapBailTypes`: 定义解包引用时的回退类型。
// - `type CustomRefFactory`: 定义自定义引用工厂的类型。
export {
  ref,
  shallowRef,
  isRef,
  toRef,
  toValue,
  toRefs,
  unref,
  proxyRefs,
  customRef,
  triggerRef,
  type Ref,
  type MaybeRef,
  type MaybeRefOrGetter,
  type ToRef,
  type ToRefs,
  type UnwrapRef,
  type ShallowRef,
  type ShallowUnwrapRef,
  type RefUnwrapBailTypes,
  type CustomRefFactory,
} from './ref'
// 这块导出了与响应式状态管理相关的功能和类型，包括：
// - `reactive`: 创建一个响应式对象。
// - `readonly`: 创建一个只读的响应式对象。
// - `isReactive`: 检查一个对象是否是响应式的。
// - `isReadonly`: 检查一个对象是否是只读的。
// - `isShallow`: 检查一个对象是否是浅层响应式的。
// - `isProxy`: 检查一个对象是否是代理对象。
// - `shallowReactive`: 创建一个浅层响应式对象。
// - `shallowReadonly`: 创建一个浅层只读的响应式对象。
// - `markRaw`: 标记一个对象为原始对象，不会被响应式系统代理。
// - `toRaw`: 获取一个代理对象的原始对象。
// - `toReactive`: 将一个普通对象转换为响应式对象。
// - `toReadonly`: 将一个普通对象转换为只读的响应式对象。
// - `type Raw`: 定义原始对象的类型。
// - `type DeepReadonly`: 定义深层只读对象的类型。
// - `type ShallowReactive`: 定义浅层响应式对象的类型。
// - `type UnwrapNestedRefs`: 定义解包嵌套引用的类型。
// - `type Reactive`: 定义响应式对象的类型。
// - `type ReactiveMarker`: 定义响应式标记的类型。
export {
  reactive,
  readonly,
  isReactive,
  isReadonly,
  isShallow,
  isProxy,
  shallowReactive,
  shallowReadonly,
  markRaw,
  toRaw,
  toReactive,
  toReadonly,
  type Raw,
  type DeepReadonly,
  type ShallowReactive,
  type UnwrapNestedRefs,
  type Reactive,
  type ReactiveMarker,
} from './reactive'
export {
  computed,
  type ComputedRef,
  type WritableComputedRef,
  type WritableComputedOptions,
  type ComputedGetter,
  type ComputedSetter,
  type ComputedRefImpl,
} from './computed'
export {
  effect,
  stop,
  enableTracking,
  pauseTracking,
  resetTracking,
  onEffectCleanup,
  ReactiveEffect,
  EffectFlags,
  type ReactiveEffectRunner,
  type ReactiveEffectOptions,
  type EffectScheduler,
  type DebuggerOptions,
  type DebuggerEvent,
  type DebuggerEventExtraInfo,
} from './effect'
export {
  trigger,
  track,
  ITERATE_KEY,
  ARRAY_ITERATE_KEY,
  MAP_KEY_ITERATE_KEY,
} from './dep'
export {
  effectScope,
  EffectScope,
  getCurrentScope,
  onScopeDispose,
} from './effectScope'
export { reactiveReadArray, shallowReadArray } from './arrayInstrumentations'
export { TrackOpTypes, TriggerOpTypes, ReactiveFlags } from './constants'
export {
  watch,
  getCurrentWatcher,
  traverse,
  onWatcherCleanup,
  WatchErrorCodes,
  type WatchOptions,
  type WatchScheduler,
  type WatchStopHandle,
  type WatchHandle,
  type WatchEffect,
  type WatchSource,
  type WatchCallback,
  type OnCleanup,
} from './watch'
