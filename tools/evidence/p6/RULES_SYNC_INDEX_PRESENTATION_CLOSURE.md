# Rules / Sync actual Index presentation closure — 2026-10-03

Baseline: `cd18dca17052410f8e0289bfad2984d90827c122`, matching P3 Rules factory and root Sync factory. The production Index is the actual consumer; current layout, default field values, action order and product-hidden Sync/Discover gates stay unchanged.

## Fixed production boundary

- Rules/Sync use their feature-local exact Runtime factories, preserving one original tail, busy state and operation receipt across same-Runtime Index reconstruction. Index retains only route/nav/mount/presentation scope and the real DTO.
- Each actual temporary Page builder captures the original Runtime, mount, navigation, Host and immutable presentation identity. All business callbacks call that captured Host. They never obtain the latest Host when an old native callback executes.
- Index attaches only if its local Host or identity changed. The old still-mounted getter returns its original Host and cannot steal the successor attachment. Active attachment checks reject its callbacks after successor attach, even when the old Index still has a matching local route/nav/mount.
- Attach predicates check only the base presentation scope; they do not recursively query the Host's active presentation. Actual callbacks separately check that attachment. Navigation/disappear detach only their matching identity; accepted work stays in the original domain owner.
- Rules adds one thin `isPresentationCurrent(identity)` query with the leaf owner's authorization. No Tail, Core protocol, mutation receipt or Store algorithm changed. Every Rules method consumes its original ID, including open, reconcile, nine mutations, refresh, import and export.
- JSON import's existing public Dialog remains unchanged. Index now captures each opening, nav, mount, Runtime and Rules attachment in a small keyed temporary Dialog subtree. An old close/local/online callback cannot close or operate a reopened/new-owner import. URL draft remains owned by the original dialog. Navigation closes the old modal.
- Sync explicit six-field `continueConfigSave` and original-generation `skipBackupRetention` callbacks retain exact arguments and shared owner semantics. Original secret/config preparation uncertainty is not automatically converted to current-head success.

## Real evidence

`test-rules-index-presentation-consumers.mjs`: 14 journey groups, actual AtomicFile/Core SQLite/Gateway/Orchestrator → Index emitted SDK callbacks → actual Page native save and shared recovery. Includes live/route/nav/mount/unset/unmount/replacement, same-Runtime reconstruction, old alive getter, accepted lost-ACK write, exact query recovery without second write, saved-with-refresh-failure, modal reopen and guard-removal/unconditional-attach negative controls.

`test-sync-index-operation-consumers.mjs`: all original actual Asset/Core/Gateway/Owner/Index/decorated Page/recovery scenarios preserved, plus old alive getter/new physical button, old detach, same-Runtime accepted restore handoff, original mutation-chain identity/busy, no duplicate dispatch, and unconditional-attach negative control. Old mounted Index now correctly refuses to borrow a successor Runtime.

`test-discover-operation-consumers.mjs`: full original source/kind/page/partial/retained-value/current/late/runtime/last native dispatch matrix; extra old alive getter and unconditional-attach counterexample is separately committed `86f306d7`.

Additional targeted gates passed: JSON actual real consumer draft/validation/close/propagation, architecture registry (100 unchanged business budgets + 8 shared owners + 19 finite policies), GeneralSettings 13 actual confirmation cases, Rules owner 10 actual CLI/SDK groups and factory 6 actual cold SQLite groups. The new Rules consumer is registered as integration, because it requires matching Core CLI and installed SDK.

## Evidence limits

This is actual production-method/SDK emitted/local IO evidence, not native lifecycle/focus/device scheduling or visual/user acceptance. Full canonical all-gate capture and signed HAP belong to the integrator. Rules subscription capacity and other separately assigned Core/reading work remain separate exits. No HAP, VM or device operation was run by this lane.
