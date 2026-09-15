import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

/** Run the installed SDK's unmodified value/get/reset/copy methods.
 * Subscriber/dependency delivery is instrumented, not a renderer simulation. Original
 * V1 proxy handlers, value wrapping and recursive copying are all executed.
 */
export function createArkUIPropertyRuntimeProbe() {
  const path = process.env.READER_ARKUI_PREVIEW_RUNTIME ??
    '/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/previewer/common/bin/libace_compatible.dylib';
  const binary = readFileSync(path), marker = binary.indexOf(Buffer.from('class SynchedPropertyOneWayPU'));
  assert.ok(marker > 0, 'installed SDK embeds its property runtime');
  const source = binary.subarray(binary.lastIndexOf(0, marker) + 1, binary.indexOf(0, marker)).toString('utf8');
  const classSource = name => {
    const start = source.indexOf(`class ${name} `), end = source.indexOf('\n}', start);
    assert.ok(start >= 0 && end > start, `actual SDK ${name}`);
    return source.slice(start, end + 2);
  };
  const names = ['ObservedPropertyPU', 'ObservedPropertyObjectPU', 'ObservedPropertySimplePU',
    'SynchedPropertyOneWayPU', 'SynchedPropertySimpleOneWayPU', 'SynchedPropertyObjectOneWayPU',
    'SynchedPropertyNestedObjectPU'];
  const proxyStart = source.indexOf('class SubscribableHandler {');
  const proxyEnd = source.indexOf("ObservedObject.__OBSERVED_OBJECT_RAW_OBJECT = Symbol('_____raw_object__');", proxyStart);
  const trackedStart = source.indexOf('class TrackedObject {');
  const trackedEnd = source.indexOf('TrackedObject.___TRACKED_PREFIX_LEN = TrackedObject.___TRACKED_PREFIX.length;', trackedStart);
  assert.ok(proxyStart > 0 && proxyEnd > proxyStart && trackedEnd > trackedStart);
  const classes = source.slice(trackedStart, source.indexOf('\n', trackedEnd)) + '\n' +
    source.slice(proxyStart, source.indexOf('\n', proxyEnd)) + '\n' + names.map(classSource).join('\n');
  let active;
  const dependencies = new WeakMap(), dirty = new Map(), reads = [], updates = [], copies = [];
  const subscribers = new Map(); let propertyId = 0;
  const mark = (owner, name) => {
    const ids = dependencies.get(owner)?.get(name);
    if (ids) {
      let pending = dirty.get(owner);
      if (!pending) dirty.set(owner, pending = new Set());
      for (const id of ids) pending.add(id);
    }
    owner.watches?.get(name)?.call(owner, name);
  };
  class ObservedPropertyAbstractPU {
    constructor(owner, name) {
      this.owner = owner; this.info_ = name; this.subscribers = new Set();
      this.id_ = ++propertyId; subscribers.set(this.id_, this);
    }
    id__() { return this.id_; }
    setDecoratorInfo() {}
    checkIsSupportedValue() { return true; }
    checkIsObject(value) { return value === undefined || (value !== null && typeof value === 'object'); }
    getPropSourceObservedPropertyFakeName() { return `${this.info_}:source`; }
    debugInfo() { return this.info_; }
    recordPropertyDependentUpdate() {
      reads.push({ owner: this.owner, name: this.info_, id: active?.owner === this.owner ? active.id : -1 });
      if (active?.owner !== this.owner) return;
      let byName = dependencies.get(this.owner);
      if (!byName) dependencies.set(this.owner, byName = new Map());
      let ids = byName.get(this.info_);
      if (!ids) byName.set(this.info_, ids = new Set());
      ids.add(active.id);
    }
    notifyPropertyHasChangedPU() {
      if (this.owner instanceof ObservedPropertyAbstractPU) this.owner.syncPeerHasChanged(this);
      else if (this.owner) mark(this.owner, this.info_);
      for (const subscriber of this.subscribers) subscriber.syncPeerHasChanged(this);
    }
    notifyTrackedObjectPropertyHasChanged() { this.notifyPropertyHasChangedPU(); }
    onTrackedObjectPropertyCompatModeHasChangedPU() { this.notifyPropertyHasChangedPU(); }
    addSubscriber(owner) { this.subscribers.add(owner); }
    removeSubscriber(owner) { this.subscribers.delete(owner); }
    numberOfSubscrbers() { return this.subscribers.size; }
    purgeDependencyOnElmtId() {}
    aboutToBeDeleted() {}
  }
  const nativeBoundary = {
    ObservedPropertyAbstractPU, SubscribableAbstract: class {},
    InteropConfigureStateMgmt: { needsInterop: () => false },
    SubscriberManager: { Find: id => subscribers.get(id) },
    ObserveV2: { SYMBOL_REFS: Symbol('v2-refs'), V2_DECO_META: Symbol('v2-meta'), SYMBOL_MAKE_OBSERVED: Symbol('v2-make'),
      SYMBOL_PROXY_GET_TARGET: Symbol('v2-target') },
    ViewPU: { pauseRendering() {}, restoreRendering() {} }, ViewStackProcessor: { getApiVersion: () => 21 },
    stateMgmtConsole: { error: message => { throw new Error(message); }, warn: message => { throw new Error(message); } },
  };
  const sdk = new Function(...Object.keys(nativeBoundary), `${classes}; return { ObservedObject, ${names.join(', ')} };`)
    (...Object.values(nativeBoundary));
  const originalCopy = sdk.SynchedPropertyOneWayPU.prototype.copyObject;
  sdk.SynchedPropertyOneWayPU.prototype.copyObject = function(value, name) {
    copies.push({ name, object: value !== null && typeof value === 'object' });
    return originalCopy.call(this, value, name);
  };
  const hooks = {
    onObserverEnter(owner, id) { active = { owner, id }; },
    onObserverExit() { active = undefined; },
    onChildUpdate(child, params) { updates.push({ child, params }); },
  };
  return {
    sdk, hooks, reads, updates, copies, dependencies,
    source: { path, classesSha256: createHash('sha256').update(classes).digest('hex'),
      layer: 'actual SDK property/proxy classes and compiler output; subscriber/dependency delivery instrumented; no renderer/layout/pixels' },
    flush() {
      let turns = 0;
      while (dirty.size) {
        assert.ok(++turns < 100, 'bounded dependency delivery');
        const [owner, ids] = dirty.entries().next().value;
        dirty.delete(owner); owner.replayOnly(ids);
      }
    },
    deepCopy: value => sdk.SynchedPropertyOneWayPU.deepCopyObjectInternal(value, 'legacy-presentation'),
  };
}
