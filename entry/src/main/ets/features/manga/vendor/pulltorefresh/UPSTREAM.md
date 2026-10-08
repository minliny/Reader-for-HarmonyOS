# @ohos/pulltorefresh 2.1.1 for Reader boundary chapter turns

This is a source integration of the Apache-2.0 V1 component, not a second
Reader gesture engine. `PullToRefresh.ets` retains the upstream PanGesture
integration, directional pull bookkeeping, five-stage resistance calculations,
edge pinning, release admission and animated reset. Reader supplies the chapter
transaction and presentation builders.

- Canonical upstream (migration announced by upstream): https://gitcode.com/CPF-ApplicationTPC/ohos_pull_to_refresh
- Archived source used for the reproducible pin: https://gitee.com/openharmony-sig/ohos_pull_to_refresh
- Package/tag: `@ohos/pulltorefresh` / `2.1.1`
- Annotated tag object: `110c779e6bf081264293d788f9f3cd9897a20140`
- Commit: `f4829f0913472cac588abd3e70d4edf58cf2d34a`
- Tree: `2732346e51963d8f97005ecebd2c51a41b425434`
- License: Apache-2.0, retained as `LICENSE`; original Huawei copyright retained.
- `source-lock.json` records original and vendored SHA-256 fingerprints.
- `reader.patch` is the complete patch against the two pinned source files.

## Audited incompatibilities and bounded changes

The pinned README explicitly excludes up-loading when content does not fill a
screen. Its V1 implementation additionally checks `listOffsetOld != 0` before
`scroller.isAtEnd()`. A one-image short chapter at offset zero therefore cannot
turn to its successor. The fork uses `isAtEnd()` as the authoritative end fact,
including zero-offset content; it refuses admission when Scroller cannot report
an edge.

The stock component reduces the custom-list height by the pull displacement.
Reader sizes decoded image tiles and restoration anchors from the viewport,
so that resize changes the visual geometry while the user's finger moves. The
fork preserves the content's `height('100%')` and only changes its translation.
Header/footer builders are clipped inside the exposed band and hidden before
24vp raw pull distance.

The original trigger is 75% of the damped translation. The Reader interaction
requires intentional finger travel instead: after a confirmed edge has stayed
stable for 100ms, raw net outward travel accumulates; the threshold is
`clamp(viewportHeight * 0.2, 120, 180)` vp. Before-edge scrolling and the stable
edge wait do not contribute. Inward travel reduces that distance, disarms below
the threshold, and reaching zero cancels the remainder of this pointer gesture.
The original five-stage visual damping methods are unchanged.

The native parallel PanGesture explicitly requires one finger. A second touch,
native cancellation, disabled admission, missing neighbour, reset-token change,
geometry change or unmount resets the pull. Loading callbacks are serialized;
Promise rejection and synchronous throw reset the translated view. A generation
check prevents late results from touching a replacement/unmounted component.
Original stock timers, canvas refresh drawing and app-bundle image resources are
removed because Reader provides its own themed builders; no timer is retained.
The Configurator's three resource defaults are plain text to make the source
integration independent of upstream HAR resource merging.

## API and integration obligations

```ts
PullToRefresh({
  scroller: existingListScroller,
  customList: () => { /* unchanged List and LazyForEach */ },
  customRefresh: () => { /* previous chapter caption */ },
  customLoad: () => { /* next chapter caption */ },
  enabled: verticalAndUnzoomedAndReadyAndForegroundAndNoPanel,
  hasPrevious: previousNavigableChapterExists,
  hasNext: nextNavigableChapterExists,
  resetToken: chapterAndLifecycleResetEpoch,
  animationDuration: reduceMotion ? 0 : 180,
  onActivity: (active: boolean) => { /* freeze/release confirmed anchor */ },
  onPull: (direction: PullDirection, distance: number, armed: boolean) => {},
  onRefresh: async (): Promise<string> => { /* prepare then publish previous */ return ''; },
  onLoadMore: async (): Promise<string> => { /* prepare then publish next */ return ''; }
})
```

The direction is `'previous'`, `'next'` or `''`; it remains empty below 24vp and
returns `('', 0, false)` on reset. Return a settled Promise from either chapter
callback. Caller owns user-visible failures and target preparation cancellation.
Do not publish target progress before its first displayed frame. Set the native
scroll component's `edgeEffect(EdgeEffect.None)` as required by upstream, retain
its existing lazy data source, and fence restoration during `onActivity(true)`.
A reset token/disabled change cancels local pull state; the caller must separately
cancel its candidate chapter preparation.

## Evidence and remaining native checks

`node tools/test-manga-boundary-pull-upstream-sdk.mjs` executes the actual vendored
methods and installed-SDK emitted layout, with controlled Scroller edge facts
and pointer callbacks. It checks the short-content defect, stable boundary wait,
thresholds, cancellation, reverse travel, single request, rejection, stale results,
unmount, previous direction and unchanged resistance bounds. The SDK emission
proves fixed content height and native single-finger Pan callback wiring.

These are code/SDK evidence. Native gesture arbitration with the image Pinch,
real decoded tiles, end-edge layout, immersion and visible animation must be
verified with the manifest-bound HAP on the authorized VM. No physical-device
feel/performance or user acceptance is claimed by this source integration.

## Re-evaluation

Compare future upstream releases with these concrete defects. If upstream
supports short content, fixed viewport presentation, raw-distance thresholds and
cancel/lifetime gates completely, update the pin and remove the corresponding
Reader patch. Do not retain two production pull engines.
