# General settings: accepted choice and Preferences confirmation

## Actual failure before this repair

Base Host `7b56cd4b`; actual SettingsGateway with a controlled Preferences adapter:
one reduceMotion change wrote four new keys, the flush persisted them and then lost
its ACK. Catch wrote four old keys. Durable reduceMotion was true, cached load
reported false, and a later unrelated flush persisted the old false value. This
was a real old-value compensation, not a platform-only limitation.

Input remains the four booleans autoCheckUpdate/tapBottomScrollTop/reduceMotion/
crashLog, defaults true/true/false/true, in `reader_settings_v1`. No storage rename,
new task queue, reset scope, new visual spec, or business data deletion.

## Finite file owner

One file-local IO tail spans Gateway/context/Runtime reconstruction. Complete
accepted snapshot/revision and actual flush-ACK snapshot/revision are independent.
The first put marks dispatch; only returned flush qualifies saved. Failed put or
flush retains accepted choice and unknown; it never writes old values. Warm load
of accepted unknown neither waits on a hanging old flush nor qualifies background
subscribers. Initial/coherent normal reads and ACK-qualified writes preserve the
existing subscription contract. Changed-key writes merge with the latest complete
accepted snapshot, preserving concurrent sibling flags and default-reset ordering.

Runtime/UI admission is checked after barrier, queue, store acquisition and any
initial read, immediately before first put. After first dispatch the accepted flush
continues even if presentation retires; old presentation callbacks reject delivery.
Configuration reset uses the same file lane and last owner admission.

## Consumer contract

SettingsHost open/reconcile/toggle retain signatures. A recreated Host reconstructs
accepted/unknown from the finite file owner. `reconcile(generation)` stays read-only.
New `SettingsHost.retryAccepted(generation)` is an explicit complete-snapshot setter;
only the current receipt generation with `SettingsOperationProjection.canRetryAccepted`
may invoke it. Its captured accepted revision must still be current at first put.
Double click, stale receipt and retired Runtime/UI cannot acquire another write.
The retry button should say "重试保存当前设置". Existing four switch rows/defaults/layout
stay unchanged; Index/Page callback connection belongs to the integration writer.

## Evidence boundaries

`test-general-settings-write-confirmation.mjs` executes full actual Gateway,
Orchestrator, Host, write evidence and shared projection source through the installed
SDK TypeScript parser/emitter. Negative matrix includes before/after durable flush
ACK loss, partial put, cross-context queue, hanging flush/warm rebuild, four last
admission waits, stale/double/closed callback, exhaustion, pure reconcile, and finite
retry. Existing actual Index→decorated SDK Page consumer and configuration-reset
matrices also run; obsolete assertions demanding blind rollback are corrected.

This is code/local/SDK-source evidence. It does not prove whole-project ArkTS,
HAP, device, OS crash durability or cold reconstruction of the original unreturned
Preferences transaction. Static warm facts are not a durable receipt. A cold startup
loads actual persisted flags; it must not claim that cached get confirms a prior
flush or that the original unfinished operation was reconstructed. Those boundaries
remain separately named in the final audit; no new global receipt store is implied.
