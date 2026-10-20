# Rules presentation lease over the existing processing authority

Index reconstruction previously constructed another Rules Orchestrator and lost
its read projection/last receipt/Tail while the actual shared RulesMutationOwner
still retained an accepted original. A physical callback looking up the new host
could then borrow the successor presentation's admission.

`RulesManagementOrchestrator.forRuntime(owner)` returns one exact current Runtime
host. A retired lookup returns `undefined` and cannot replace the successor cache.
It preserves the original Tail, snapshot/latest receipt and existing shared Rules
authority; constructor compatibility remains for isolated legacy consumers.

The current Index integration contract is:

```ts
const host = RulesManagementOrchestrator.forRuntime(capturedRuntime);
host?.attachPresentation(capturedId, emit, capturedRuntimeNavigationRouteCurrent);
host?.open(capturedId);
host?.saveDictRule(draft, capturedId);
host?.reconcile(capturedReceiptGeneration, capturedId);
host?.importBundle(urlOrUndefined, capturedId);
host?.detachPresentation(capturedId);
```

Every public intent has the optional presentation ID as its last argument. New
shared consumers must supply it; a missing/wrong/retired ID performs no read,
write, download or export. `attachPresentation` checks the exact Runtime and
the captured caller admission before replacing emit/current. Attachment and
matching detachment retire the old session; an old detachment cannot clear a new
lease. The Index must use a unique identity per presentation registration and
capture it in the physical callback, rather than dynamically obtain a fresh ID.

Retirement cannot cancel a dispatched durable Rules write or clear its Atomic
intent. A successor open performs the existing exact original query and normal
projection refresh. It does not infer success from matching lists or automatically
replay an unknown write. Reload checks session admission before each subsequent
read; an old in-flight response cannot publish or start its next read.

`test-rules-presentation-runtime-owner.mjs`: **6 PASS** using actual complete
Orchestrator, Gateway/RulesOwner/Atomic helper, installed SDK emitter and cold
SQLite CLI. Covers shared identity, stale/missing physical lease, wrong retire,
preserved accepted Tail, actual lost ACK during replacement, pure original
recovery, old Runtime lookup and caller guard exceptions. The original
subscription Gateway/Orchestrator journey regression remains a separate gate.

Index/physical-page consumers are owned by P5 and must consume this interface
before that application boundary can close. No UI geometry, Native/HAP, device,
visual or user-acceptance claim is made by this leaf commit.
