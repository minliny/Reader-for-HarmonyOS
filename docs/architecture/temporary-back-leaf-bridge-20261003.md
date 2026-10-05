# Domain temporary surfaces and system Back

## Source and ownership

Baseline: Host `6334fecc112313168e7a2d9ce4271c807c705e76`; independent branch
`codex/p5-temporary-back-20261003`. No dirty integration files were copied.
Only SettingsPage, SourceManagementPage and BookshelfShell production files change.
Index, BookshelfPage, native hosts, common Choice/Menu components and Typography are
owned by other lanes and are not changed here.

The existing leaf-visible state remains the only owner: `openSelect/selectionId`,
`groupOpen/groupClosing/groupSelectionId`, and `moreMenuVisible/moreSelectionId`.
The new mounted/appearance identity only admits callbacks; it does not replicate
visibility or create an overlay manager, state bus or global overlay registry.
Per-module monotonically increasing identity counters carry no overlay state.

## Findings recorded before closure

1. All three leaves lacked a system Back callback bridge to Index. Index cannot
   honestly consume a leaf temporary surface by reading its private UI state.
2. SourceManagementPage gave every group panel the fixed `source-group` identity;
   its commit/dismiss ignored the panel's opening identity. A late former panel
   ACK could change the selected group or close a replacement panel.
3. BookshelfShell menu callbacks read only current visibility and had no opening
   identity. An obsolete dismiss/action callback could act on a newly opened menu.

These are code/lifecycle findings on the baseline, not a claim of reproduced
native-device timing. Actual production-method guard removal is a negative
control for 2/3; captured old callbacks demonstrably change replacement state
when admission is removed.

## Integration API

All three components expose the same regular callback (not an @Prop):

```ts
onTemporaryBackBridge: (
  handler: (() => boolean) | undefined, identity: string
) => void
```

Each `aboutToAppear` registers a fresh closure and a fresh identity. The closure
captures that identity; it returns false after disappear or after a later appear
on the same component instance. `aboutToDisappear` first retires local admission
and closes its owned temporary state, then unregisters `(undefined, capturedId)`.

Index must register three finite scopes: settings/source/bookshelf. Its registration
callback must capture the navigation/runtime owner and check those plus leaf ID
before accepting registration, retirement or invocation. An old unregister must
not clear a new identity. A leaf returns true only when it consumes its own layer;
false falls through to the existing route handling. Index-owned delete/import/
source-switch/local-import/group-edit temporary layers retain higher priority.
This lane does not implement that parent priority; P5 owns its actual integration.

## Real behavior

* Settings retires only the current owned selection; selection value and unrelated
  settings remain. The responsive Phone sheet and Tablet overlay are unchanged.
* Source sets `groupClosing=true` and consumes Back until ReaderSelectPanel completes
  its existing collapse. Native duration/easing, width, anchor, typography, options,
  current-value projection and commit-before-collapse remain. Each opening has a
  unique identity. Old commit/dismiss/mask callbacks are rejected; unknown/currently
  unavailable options and choices after outside/Back close are rejected.
* Shelf hides only its More overlay, following its existing host close assignment.
  Each menu opening gets an identity. Old dismiss/business callbacks cannot close
  or dispatch from a replacement opening. The existing menu still owns click
  collapse, anchor measurement, native actors and update capability/busy checks.
  Old More trigger callbacks are also rejected after an appearance replacement.

## Verification and limits

`tools/test-temporary-back-leaf-sdk.mjs` executes installed SDK compiler output,
actual SDK V1 property classes, real SettingsSelectOverlay, ReaderSelectPanel,
ReaderChoiceRow, BookshelfMoreMenu and ReaderActionMenuSurface. It proves live
handler admission, no layer fallthrough consumption, Phone/Tablet choices,
source collapse plus old finish replay, old select/close/action rejection,
capability/busy checks, same-instance disappear/reappear, real shared action
callbacks, and production guard-removal negative controls.

Unrelated settings/source page bodies and outer shell slot containers use bounded
fixtures. Shelf pointer native methods are inert boundaries. The helper does not
model native conditional removal; menu reopen explicitly runs real disappear and
a fresh SDK constructor path while retaining old callbacks. Callback/Prop behavior
is proved; native scheduling, focus, actual Back dispatch, pixels and geometry
are not inferred from these fixtures.

Additional PASS: existing settings-selection owner; bookshelf-shell 14 checks
(including unchanged Index readiness fixtures); settings overlay; select semantic;
shared ChoiceRow gates. Old leaf fixtures now instantiate the production callback
default and open the menu through its real identity method; their original
behavior/capability assertions remain.

Code/SDK leaf gate: PASS. Parent Index integration: separate P5 gate. Full SDK/HAP,
real native Back/focus/conditional-removal behavior, device, visual and user
acceptance remain OPEN. No HAP or target was occupied.

Rollback boundary: revert this slice together with its parent bridge consumption.
Reverting only parent consumption leaves local close/identity hardening safe but
system Back falls through again; reverting only leaf callbacks leaves parent with
no registered handler. There are no data schema, durable receipt or secret changes.
