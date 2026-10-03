# Settings text-cache command ownership and receipt honesty — 2026-10-03

The existing SettingsHost now owns this finite operation family through
SettingsCacheCleanupOwner and typed SettingsCacheGateway. Index retains the
current DTO and routes a user intent with captured Runtime/navigation; it no
longer dispatches or decodes cache.clear or maps all exceptions to false.

The Gateway reuses the canonical Core cache.clear command with scope=cache.
It validates the exact scope and all four nonnegative safe-integer counts before
confirming an ACK. Core remains the implementation of cache cleanup, catalog and
reading-position preservation; no cache algorithm or parser is duplicated.
ReaderWriteEvidence marks the real request admission and valid ACK boundaries.
Only the existing SDK's typed transaction-pending-before-execution contract can
retract dispatch evidence. A timeout, generic throw, forged error message or
malformed result is unknown. Request cancellation is never treated as proof of
rollback. Owner state retains the result independently of original page lifetime;
an exact current Runtime and current Settings route can consume its latest DTO.

The existing CategoryRow and cache text keep the same geometry/typography. Actual
SDK V1 Prop/Watch consumption displays 清理中 / 已清理 / 清理失败 (undispatched) /
结果未确认. The last state gives an honest native explanation on tap and cannot
send a second destructive request. Closing/reopening retains the unknown barrier
within the same Runtime. Existing readable caches/other application flows remain
usable; this barrier affects only the cleanup intent. A cold/new Runtime has no
exact old operation receipt: its idle action is an available new intent, not a
claim that a previous uncertain clear succeeded.

## Verified protocol limit, not fabricated readback

Current Core CacheClearParams have no operation ID and CacheClearData contain
scope/counts only. The canonical schema/runtime expose no query for one completed
clear. Therefore empty cache contents do not confirm an unknown clear; this slice
cannot provide exact reconciliation after a lost ACK. OperationFacts and explicit
confirmation carry the command result without falsely claiming that a separate
readback occurred. No fake retry query, automatic repeated clear or application-
wide lock has been introduced. A durable exact-clear journal/query would be a
separate Core protocol capability if that product recovery goal is required.

## V1 native callback lifetime

Only the small theme segmented actor and cache CategoryRow are keyed by the
page's observed presentation identity; the Page remains mounted. This supplies
fresh ordinary callbacks after same-instance reappearance and keeps old physical
callbacks bound to the original identity. Actual SDK constructor/replay probes
prove fresh actors work and old handlers are rejected; the helper does not model
native removal/layout/focus, so those remain platform acceptance exits.

## Local / actual SDK proof

`test-settings-cache-owner-consumer.mjs` exercises actual Gateway → finite owner →
existing Host field initializer → Index captured callbacks/DTO → full V1 decorated
Page properties/watchers → actual CategoryRow/text/native callback. Cases cover
valid counts, SDK typed refusal and explicit retry, lost ACK before/after modeled
execution, malformed scope/counts, fake error message, rapid duplicate taps,
publication reentry, publication exception, close/reopen (also in-flight), delayed
success/failure and Runtime/navigation/presentation retirement. No readonly or
recovery path repeats a cache.clear. The before/after native seam is controlled
fault injection; real Core mutation preservation is a separate Core test/target
claim, not proved by that fixture.

Static boundary, existing source/settings receipt consumers, PH35 retained cache
geometry/feedback, temporary leaf+Index Back bridges, selection ownership,
configuration reset, Runtime retirement, private Typography and test tiers pass.
Theme failure probes also pass with the small keyed native actors. No HAP, target,
visual or user acceptance is claimed by this lane.
