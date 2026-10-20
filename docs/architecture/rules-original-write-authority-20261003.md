# Existing rule domain: original dispatch and ACK authority

The current UI is the baseline. Normal rule rows, geometry, typography and
drafts are unchanged. An uncertain original mutation disables mutation actions;
pure list reads, export and draft editing remain available.

The reader Quick panel, full replacement form and Settings rules Gateway use
one `RulesMutationOwner` per captured Runtime. The existing Core collections,
validation, regex engine, portable schema and command DTOs remain authoritative.
The finite owner contains one original command, its actual dispatch evidence
and a qualified returned ACK. It does not store rules, execute replay, own a
global task queue or infer a receipt from a later matching rule.

`canDispatch` is checked by the existing actual Runtime after startup and before
SDK dispatch. `onDispatch` marks that boundary. Only the original returned ACK,
including operation, identity and changed field qualification, marks confirmed.
Old presentation retirement cannot erase an already dispatched command. A
branded Runtime non-dispatch exception has undispatched evidence; generic
post-dispatch failure or malformed ACK retains unknown and blocks new writes
across all three presentations. A successful current list read retains unknown.

Settings observes actual dispatch rather than incrementing a counter before a
Runtime startup wait. A new Settings presentation projects an existing unknown
from the same rule owner. Subscription/import coordination may not start another
compound write when a prior rule command is unknown. A current-data refresh does
not relabel that old operation as confirmed or failed.

Production tests execute the installed SDK-emitted actual Runtime dispatch
method, complete reader/Quick/Settings Gateways, original Settings Orchestrator
and SDK-generated Page action closures. They cover retirement during startup,
retained matching-read unknown, another presentation's write refusal, concurrent
busy refusal, late qualified original ACK, malformed identity, correct external
evidence, mutation vs export/edit admission and normal baseline action return.
Two production negative controls remove final admission and clear unknown on
read; the same scenarios detect both faults. Existing gateway/state, Quick,
rule-entity and typography checks pass with assertions relocated to the real
shared owner. The isolated lane's complete registry is not the final full gate;
the central integration registers the new SDK journey in the integration tier.

## Remaining boundaries

LRE still must consume the same owner instead of dropping its own unknown lock
on panel/book lifecycle change; it is the unique reader integrator's next step.
Legacy Core rule CRUD has no durable caller receipt/query. This Runtime-local
barrier is not a cold operation journal and a restart is not proof that the old
command failed. Cold rule reconciliation is explicitly unverified. It cannot be
closed by matching rows, another mutation, cache clearing, a generic retry or
the bookmark/cache receipt contract. Full ArkTS/HAP and actual target evidence
are independent exits, and visual/user acceptance remains deferred.
