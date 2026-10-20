# Settings owner → Index → actual SDK consumer

Production dependency: Root `afd64aa5` supplies the one exact Runtime
`SettingsOrchestrator`, original Preferences queue and explicit Host lease.
The consumer migration preserves existing flags, labels, geometry and controls.

## Actual consumer contract

- `bindSettingsPresentation` creates one finite identity from Index instance,
  physical mount, navigation generation and settings/bookshelfSettings route.
- Re-reading the old binding returns its actual attachment status. It never
  reattaches the alive old Index over a newer consumer.
- `settingsSurface` / `bookshelfSettingsSurface` capture original Runtime,
  mount, Host, route, navigation and presentation ID at each small page entry.
  All save, restore, read reconciliation, accepted retry, cache actions,
  navigation and temporary Back callbacks check that exact attachment.
- Native callbacks cannot acquire the new owner or borrow its current ID.
  Each route opening uses its existing navigation generation as the key; the
  persistent reading component tree is not changed.
- Navigation/unmount detaches only the matching settings presentation. The
  original accepted Preferences writes still settle in their original queue.
- State publishers check the underlying Runtime/mount/navigation/route scope;
  the original Orchestrator delivery lease admits them. This also consumes the
  synchronous accepted DTO during attach, before `SettingsHost.bindPresentation`
  assigns its own attachment fields. Requiring the Host attachment too early
  loses this DTO while `open()` waits behind an unfinished flush.
- Cache clear/query/qualified original continuation keep their original exact
  durable authority; these callbacks now retain the same presentation scope.

## Evidence

`test-settings-index-presentation-consumers.mjs` compiles the actual Index
initializer/builders, complete original Preferences Gateway/Host/Orchestrator,
actual decorated SDK page fields, shared CategoryRow/Toggle and RecoveryAction.
Ten groups cover alive old getters, all old physical/navigation/cache callbacks,
late accepted ACK delivery into the new presentation, before/after-flush unknown,
pure native reconciliation, explicit one-shot full snapshot retry, old physical
generation after real V1 Prop update, bookshelfSettings, Runtime/mount/nav
retirement and a guard-removal negative control.

The original Source/Settings consumer matrix, cache physical consumer matrix,
general confirmation and Runtime owner matrices, Settings wiring and three-leaf
Back SDK matrix retain their original assertions. A cache positive case now
binds its actual new navigation before expecting the new small native actor to
dispatch; the old actor remains rejected.

This is code and local installed-SDK emitted consumer evidence. Whole application
ArkTS/HAP, native scheduling, target pixels, focus and user acceptance belong to
the canonical delivery pipeline and are not claimed here.
