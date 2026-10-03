# RSS original recovery shared surface

R3 finite component contract, 2026-10-04.

`RssOriginalRecoverySurface` is one actual domain recovery implementation for RSS management, editor, entry, source-feed and main-feed consumers. It renders existing `ReaderRecoveryNotice` and `ReaderRecoveryAction`, with no duplicate style specification. Normal page geometry is unchanged. This commit supplies the component; the five page and Index consumers are a separate pending slice.

The native action key is a typed `RssRecoveryActionIdentity` object containing presentation identity, finite scope, and the complete actual original projection. It is not an unchecked heterogeneous tuple. Both action label and initial continuation eligibility come from the immutable key. Enabled and dispatch predicates require the mounted component, exact current key and non-busy owner projection. Feed/foreign/corrupt/unqualified originals have no continuation. The callback passes the captured original generation, operation ID, method, family and entity to the real domain authority.

`test-rss-original-recovery-surface-sdk.mjs` passes 15 groups using actual Core SQLite apply/query, the existing Atomic original carrier, actual RSS Gateway and fully decorated SDK-emitted shared component plus recovery controls. It proves zero apply for exact query, exact same ID/full original continuation, old native action retirement by every identity axis, busy/foreign/feed/unqualified/disappear refusal, confirmed Core/unqualified cleanup without continuation, and a guard-removal negative control. It does not claim native removal, layout, focus, platform animation, ArkTS full-build, HAP, device or user acceptance.

The remaining five-consumer slice is tracked independently and awaits the producer's stable standalone original-emitter/pure-query contract.
