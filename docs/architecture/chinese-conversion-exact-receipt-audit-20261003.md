# Chinese conversion: exact processing authority and physical intent

## Recorded defect and original scope

The original `reader.chinese-conversion.put` is a processing mutation: it changes
the singleton mode and seals local reading coordinates in the existing storage
transaction. A lost acknowledgement could leave the mode saved while the old
Gateway/LRE treated the operation as failed. Reopening or reading a matching mode
cannot prove the original write. Retired physical selection callbacks could also
borrow a successor book or an original unknown operation's current callback.

Core candidate `e1bb21327920710ee67a903b614b2debba2557fa` adds the finite
`reader.chinese-conversion.put` variant to the existing Rules exact receipt
authority. It reuses the original DTO/algorithm, existing SQLite transaction,
fixed caller head, same-ID payload validation and pure query. Schema 34 and
protocol 1 remain unchanged. `rules.mutation.conversion.v1` is required; an older
Native without it cannot accept this new intent. No silent legacy fallback is
allowed. Root separately binds the compiled Native/SDK/HAP to this Core source.

## Production boundary and resulting behavior

`ReaderChineseConversionGateway` shares `RulesMutationOwner` and its full Atomic
intent with Full/Quick/Settings/Subscription mutations. An unknown original blocks
new writes across this domain and across warm Runtime reconstruction. Startup
queries the exact original; it does not replay. An explicit recovery choice uses
the original ID/sequence/full mode tuple, regardless of a replacement selector
draft. A historical receipt releases its original write only; the Gateway then
reads the current mode for presentation. A matching mode is never a receipt.

LRE keeps the original persist-before-content-mutation CAS barrier for a new
conversion. Recovery of an already accepted unknown skips a stale old-body write,
because the original conversion may already have changed processing coordinates.
The durable original survives view retirement; old book/lifecycle/presentation
callbacks cannot install its late acknowledgement into the new reader.

ArkUI V1 ordinary callback fields do not receive normal `@Prop` updates. Directly
passing a newly constructed callback therefore leaves a retained appearance child
with an old actor. The finite `chineseConversionIdentity` Prop carries the actual
LRE lifecycle/source/book/operation tuple. Stable existing callbacks forward the
identity captured by the physical choice; leaf and LRE each check it. Only the
small selector actor is keyed by its selection generation and conversion identity.
Reading, appearance, scroll and the single motion-progress tree remain retained.
Mask/commit/dismiss/native-finish closures refuse a retired selection. Hidden
legacy Full/MotionStage consumers retain compatible optional callback signatures;
their entry points remain hidden.

All current dimensions, colors, typography, motion values and original selection
labels remain unchanged. Selecting the current mode can reach the owning LRE;
there it remains a no-op for a settled write and can recover an unknown original.

## Executed evidence

- `tools/test-reader-chinese-conversion.mjs`: **20 PASS**, actual Gateway,
  RulesOwner and LRE production methods, installed SDK emitter and cold SQLite
  CLI. Covers validation, unsupported capability before acceptance, original
  lost ACK before/after effect, pure exact recovery, same-ID replay, historical
  ACK versus a newer current mode, pre-dispatch retirement and accepted late ACK.
- `tools/test-reader-chinese-conversion-sdk-actors.mjs`: **10 PASS**, actual SDK
  parent Builders, V1 property runtime, retained appearance leaves, shared
  ReaderSelectPanel and ReaderChoiceRow physical callbacks. Covers current Prop
  delivery, old-row rejection, close/reopen, actual leaf teardown/re-entry,
  deferred native finish, broken forwarding negative control, and the complete
  SDK choice → LRE → Gateway → Atomic intent → Core SQLite lost-ACK recovery.
- Existing appearance motion-tree, content-surface, select-semantics and shared
  choice-row gates pass; source `git diff --check` passes.

This is code/SDK/CLI evidence. AtomicFile power-loss durability, native animation
scheduling/removal/focus, target behavior, pixels and user acceptance remain
separate evidence. No HAP build, VM or device operation was performed in this lane.

## Revert boundary

Revert the Host conversion slice together; it changes only the finite Gateway,
LRE conversion projection and four appearance callback consumers/tests. Preserve
the Rules full intent and local Core receipt authority. An accepted unknown cannot
be discarded, rewritten as a new ID, rolled back by reading a matching mode, or
silently dispatched through an older Native. A prior historical receipt must not
restore its old mode over a later current mode.
