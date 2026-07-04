// ReaderPerformance — performance optimization helpers.
//
// Three responsibilities:
//
// 1. Memoization: `memoize` wraps a pure function with a single-entry cache.
//    Used to avoid recomputing expensive derivation chains on every UI
//    re-render (e.g. layout token aggregation, sorted candidate lists).
//
// 2. Lazy list helpers: `lazyListDataSource` adapter bridges a plain array
//    to the IDataSource interface required by LazyForEach, so consumer code
//    can switch from ForEach (full materialization) to LazyForEach (windowed
//    rendering) without restructuring the data source.
//
// 3. Reduced-motion system hook: `shouldReduceMotionFromSystem` reads the
//    HarmonyOS system configuration for the user's animation scale. When
//    the user has set Developer Options → Window animation scale / Transition
//    animation scale / Animator duration scale to 0, we treat it as a
//    reduced-motion request. The actual read happens in EntryAbility, which
//    publishes 'readerSystemReducedMotion' into AppStorage; Index.ets picks
//    it up via the AppStorage.subscriber pattern and calls
//    ReaderUiReducer.setReducedMotion.

// Memoization — single-entry cache for pure functions.
export class Memoized<T> {
  private cached: T | undefined;
  private hasValue: boolean = false;
  private readonly fn: () => T;

  constructor(fn: () => T) {
    this.fn = fn;
  }

  get(): T {
    if (!this.hasValue) {
      this.cached = this.fn();
      this.hasValue = true;
    }
    return this.cached as T;
  }

  invalidate(): void {
    this.cached = undefined;
    this.hasValue = false;
  }
}

// LazyListDataSource — minimal IDataSource adapter for plain arrays.
// ArkUI's LazyForEach requires an IDataSource; this wraps a snapshot array
// so consumers can pass `new LazyListDataSource(books)` directly.
export class LazyListDataSource<T> implements IDataSource {
  private items: T[] = [];
  private listeners: DataChangeListener[] = [];

  constructor(items: T[] = []) {
    this.items = items;
  }

  setData(items: T[]): void {
    this.items = items;
    this.notifyReload();
  }

  totalCount(): number {
    return this.items.length;
  }

  getData(index: number): T {
    return this.items[index];
  }

  registerDataChangeListener(listener: DataChangeListener): void {
    if (this.listeners.indexOf(listener) < 0) {
      this.listeners.push(listener);
    }
  }

  unregisterDataChangeListener(listener: DataChangeListener): void {
    const pos = this.listeners.indexOf(listener);
    if (pos >= 0) {
      this.listeners.splice(pos, 1);
    }
  }

  private notifyReload(): void {
    for (let i = 0; i < this.listeners.length; i++) {
      this.listeners[i].onDataReloaded();
    }
  }
}

// ReaderPerformance — utility wrappers.
export class ReaderPerformance {
  // memoize — convenience constructor for inline memoization.
  static memoize<T>(fn: () => T): Memoized<T> {
    return new Memoized<T>(fn);
  }

  // shouldReduceMotionFromAppStorage — reads 'readerSystemReducedMotion'
  // from AppStorage. EntryAbility publishes this from
  // AccessibilitySystemAbility / ConfigurationConstant updates. Default is
  // false when not set (cold start before the hook fires).
  static shouldReduceMotionFromAppStorage(): boolean {
    const v = AppStorage.get<boolean>('readerSystemReducedMotion');
    if (v === undefined || v === null) {
      return false;
    }
    return v === true;
  }
}
