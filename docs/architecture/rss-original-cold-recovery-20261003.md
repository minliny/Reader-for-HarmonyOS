# RSS finite original-write recovery

Baseline Host d040938d / Source 366bc346 production-equivalent. Core dependency
is a28d6cf9 + 7116827f (schema34, rules.mutation.rss-management.v1).

Code audit: RssGateway ordinary CRUD/entry/favorite writes were legacy RPCs.
RssOrchestrator, Editor and RouteOperationHost retained unknown only in warm
maps. A cold owner had no original DTO/ID and matching lists could not prove
whether an older submitted mutation would still commit. This is a required
code/contract gap, not an OS limitation. Six finite Core methods are now present;
Host migration must use the original Rules authority, not a new ledger.

RSS writes reuse RulesMutationOwner + its single complete Atomic intent and
Core head. Source, subscription, ordinary Rules and RSS share that domain;
recovery is family + exact original ID + physical generation + entity-bound.
Pure query may qualify an exact historical ACK; it never dispatches apply.
Explicit continuation can only dispatch the complete retained same ID/DTO.
Higher head, null outside the exact predecessor, mismatched ACK, corrupted
intent or a foreign journey keep the authority blocked. Current rows never
replace receipt evidence. UI draft and fresh current read are separate facts.

Management, editor and entry/feed route producers must carry optional original
facts and expose separate pure-reconcile/explicit-continue callbacks. Accepted
writes settle regardless of route retirement; stale callbacks cannot publish
into or retry another current owner. Confirmed write + read failure remains
confirmed with stale data. Editor recovery preserves draft revisions and does
not replace a newer draft with historical saved content. Hidden favorites
navigation stays hidden; existing entry favorite interaction remains admitted.

Validation uses installed SDK production classes, original Atomic helper,
per-RPC cold SQLite CLI with actual core.info capability set, six original
write ACK loss before/after effect, read-back failure, warm/cold replacement,
foreign-family/entity/ID/generation callbacks, damaged receipt/DTO, route
retirement before real dispatch and after accepted dispatch. Actual device
AtomicFile/OS durability and native scheduling remain separate target evidence.

## Implemented producer contract and consumer handoff

The admitted write set is rss-source.put, rss.subscription.persist,
rss.subscription.remove, rss.entry.read, rss.favorite.persist and
rss.favorite.remove; the existing rss-source.import uses this same original
authority. A new Host opts in only when actual core.info advertises both
rules.mutation.exact.v1 and rules.mutation.rss-management.v1. An older Core
keeps its existing direct RPC path; it does not receive a cold-recovery claim.
rss.feed.refresh keeps its separate original network/Host continuation.

RssMutationRecoveryContract.ts defines a finite, type-only projection. The
management/route operation and editor snapshot carry optional original with
generation, operationId, sequence, method, scope, subscriptionId, guid,
confirmation, writeStage, busy, blocked, canRetryOriginal and message. It does
not expose a mutable accepted DTO to the page. A damaged/unreadable record is
scope=foreign, blocked=true, canRetryOriginal=false. Its empty ID and zero
sequence mean that no identity was qualified; they are display-only absence
and are never sent as a Core tuple. A current list remains readable, while
Editor canSave stays false until the authority is qualified.

| Original consumer | Pure action | Explicit original continuation |
| --- | --- | --- |
| RSS management | reconcileOriginal(expected?, presentationIdentity?) | continueOriginal(expected, presentationIdentity?) |
| RSS editor | reconcileOriginal(expected?, presentationIdentity?) or existing reconcile(operation generation) | continueOriginal(expected, presentationIdentity?) |
| Existing entry/favorite interaction | Existing reconcileRouteOperation with its captured route binding and operation generation | continueEntryOriginal(expected, binding) |

The Index/UI writer must capture the complete original identity and physical
presentation/route binding in each action. It must not read a fresh Host
identity from an older physical callback. Continue is offered only for the
matching management/editor/entry scope with canRetryOriginal=true; foreign
journeys expose their actual message without a RSS continuation. The current
operation and original fact have different generations and must not be
substituted for one another. Confirmation=confirmed + writeStage=cleanup
remains confirmed even if local cleanup is blocked; it must not use unknown
write wording. Existing shared RecoveryAction remains the bounded UI carrier.

No RSS .ets page, Index, visual tuple, hidden navigation entry or persistent
reading tree was changed here. New Index-to-page recovery controls remain OPEN
until the consumer writer supplies their actual SDK callback/state evidence.

## Shared receipt qualification

Live apply and exact query ACKs now await the same
RulesMutationIntentStore.qualifyTerminal used for retained snapshots, rather
than merely checking that an ACK hash has the right shape. It uses the existing
official SHA adapter and exact binding/method/outcome/data validation. Every
Rules Owner decode call, including subscription and Source recovery, awaits
that one validator. A modified live data/hash remains unknown until a genuine
exact query succeeds. SHA is corruption detection, not proof of a Native
author; forged-but-recomputed records retain that documented limitation.

## Local evidence and exit boundary

The two new integration gates exercise 32 Gateway groups and 17 actual owner
groups: all six writes plus import, before/after SQLite commit ACK loss,
historical ACK versus current projection, explicit same-ID/full DTO retry,
null/higher/foreign receipt, wrong entity/generation, damaged record, actual
last admission, busy dispatch, presentation reopen/old detach/late result,
draft preservation and exact rejected terminal. Nineteen directed gates also
retain original RSS, Source (10+5 groups), Rules, subscription and reading
invalidation journeys. Logs and full before/after source inventories are under
/private/tmp/reader-rss-cold-final-evidence-20261003; Core input is clean
7116827f07dd0de5c7a1961cde2f8807dd853537. The original failing fixture evidence
(missing real SettingsHost initializer and an obsolete physical button carrier
regex) remains in /private/tmp/reader-rss-editor-retained-final.log.

The P9 current-source probe preserves full 50/500/5000 input acceptance, cold
checkpoints 0/2500/5000, 12 Atomic ACK-loss paths and five corruption/non-author
negative controls. For 5000, reads=9,276,770 bytes, writes=17,136,087 bytes,
immutable plan writes=1 and bounded current snapshot<=1857 bytes. Necessary
live ACK validation changes receipt SHA work from 2N to 4N+1, still constant per
advance; total SHA calls=30,005. These are controlled SDK/Host resource counts,
not HarmonyOS elapsed-time or RAM acceptance. The P9 log is
/private/tmp/reader-rss-rules-live-ack-capacity-final-20261003.log.

SDK method execution, strict ArkTS/HAP, real AtomicFile durability, native
scheduling, device/UI and user acceptance are distinct evidence layers. Only
the first is asserted in this slice. Reverting to a Host without these RSS
methods is unsafe while an original Atomic intent remains; first settle the
same intent with the compatible Core/Host pair and confirm its local cleanup.
Never discard the intent, blindly retry through legacy RPC or use a matching
list to make rollback appear safe. Core schema34/protocol1/direct APIs remain
compatible, but pending caller receipts require the advertised new capability.
