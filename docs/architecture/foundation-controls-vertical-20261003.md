# P4 shared Button / Field: first complete consumer families

## Scope and effect

SourceToolsPage, RulesManagementPage and SyncPage now construct the same real
`ReaderButton` / `ReaderFormField` classes. Their helper Builders keep only
business arguments and existing admission predicates. The former private native
font, color, padding, border, radius, height and callback wrappers are removed.

`ReaderControlSpecs` holds five finite button and three finite field variants.
It is a typed specification registry; pages cannot supply private appearance
parameters or a general style object. Variants preserve the actual application:

| Variant | Existing physical contract |
| --- | --- |
| source-action | 42 height, 8 radius, original NotoSansSC 12 / 700 role |
| source-compact | 30 height, 7 radius, 10 horizontal padding, original 11 / 700 |
| rules-action | 40 height, 8 radius, original 12 / 700 |
| rules-compact | 30 height, 7 radius, 12 padding, 11 / 700, font family AUTO |
| sync-action | original Stack/Text structure, 40 height, 10 radius, Inter 12 / 900, original Sync fill/border, opacity AUTO |
| source-debug | 40 height, 8 radius, 12 padding, NotoSansSC 12, weight AUTO |
| rules-input | 40 height, 8 radius, 12 padding, NotoSansSC 12 / 400 |
| sync-credential | 36 height, 6 radius, 11 padding, Inter 12 / 600, original input/placeholder roles |

AUTO remains an omitted native modifier. Plain credentials retain the native
default input type; password credentials retain native Password masking. Draft,
validation, queue, receipt and recovery work stay in their original owners.
The SourceTools code TextArea and native enum Selects are separate families and
retain their current implementation in this first slice.

## State, callback and motion contract

- `actionEnabled` and `isEditable` are explicit Props and avoid inherited ArkUI
  method-name collisions. Old native callbacks read current availability.
- All existing business predicates remain intact, including unknown writes,
  read-only operations, busy state and mutation-specific rule barriers.
- Mounted shared actors reject callbacks after their own disappearance. V1
  plain callback fields remain construction-time callbacks: the parent must
  delegate to current parent state or provide an exact bounded entity/action
  identity. The migration does not promise arbitrary setter refresh.
- Button normal/pressed/disabled presentation delegates to the existing
  ReaderPressFeedback / official ColorMetrics adapter. ArkUI owns pointer
  release and cancellation. Normal geometry remains unchanged.
- Text buttons use one combined native AttributeModifier registration so label
  and frame do not depend on the platform preserving multiple registrations.
- No page or reader persistent component tree is remounted by this slice.

## Proof and gate registration

The finite producer registry includes two exact component interfaces, actual
consumer edges, the full typed specification shape, removal evidence and SDK
proof paths. It does not exempt the common directory. Original 100 business
budgets are unchanged; the two actual producers have bounded shared-owner rows.
Unknown variants, privately overridden callers and altered physical/spec
implementation fail the gate.

The original conventional typography baseline remains 28 files / 248 carriers /
818 parameters. Shared carrier successors prove original owner → actual SDK
component → actual AttributeModifier → native tuple, including AUTO and role
propagation. SourceTools preserves all 25 original nodes / 14 distinct roles:
21 direct consumers and four actual shared carriers.

Local checks include the three real parent pages, five button / three field
variants, current Prop updates, disabled/unmount handling, password/plain input,
controlled drafts, pressed/normal restoration, role propagation and finite
variant isolation. Existing SourceTools owner/Index/SDK unknown and stale callback
journeys, Sync Store/Gateway/owner/Index/SDK cold-intent and bounded backup-exit
journeys retain their original assertions. Native-default, consumer budget,
finite producer, full conventional typography source/SDK and original Theme
foreground checks pass.

This is a complete three-family source/local SDK slice. Other private control
consumers still require the authorized following migrations. Full ArkTS/HAP,
target, visual and user-acceptance tiers are separate; none is claimed here.
