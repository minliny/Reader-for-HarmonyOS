# Shared action role and focus closure

The original F01 and UI-S-INPUT contracts require accessible action names,
button roles and focus eligibility. ReaderButton's Text/Stack,
ReaderLabeledIconAction's Row/Stack and ReaderRecoveryAction's Text already
handled clicks and business eligibility, but omitted explicit BUTTON roles
and focusability. Official SDK defaults do not make Text focusable.

The existing five hit-node implementations now declare BUTTON and
`focusable(actionEnabled)`. Labels, public Props, finite variants, physical
style tuples, press feedback and business callbacks remain unchanged.
The original mounted guards stay in Button/LabeledIconAction. Recovery's
immutable domain actor remains its owner: retiring the real RSS parent
blocks both retained recovery callbacks without transferring domain state
or accepted work into the shared action.

`tools/test-shared-action-role-focus-sdk.mjs` compiles the actual components
with the official ETS transform and existing property-runtime probes. Its
six variant branches and real RSS parent composition verify role/name,
enabled-bound focus, current/disabled Prop updates, retained callbacks,
retirement and unchanged physical/AUTO tuples. Actual-source mutations
remove the role or force disabled focus to prove assertion sensitivity.
These are production/SDK code contracts, not native keyboard or screen
reader acceptance.

The exact producer and delegated-child implementation bindings are updated
without raising the 100 original business budgets or adding a producer.
There remain 13 finite registered producers. The new SDK test is explicitly
classified as integration; unclassified tests still fail the full gate.

Separately, all 27 obsolete conventional-typography migration exception keys
are removed. The current coverage remains zero private arguments. Actual
Menu Medium and Settings selected-weight mutations are rejected by the new
gate and accepted by the original gate, proving that retired exceptions
cannot silently return. Native AUTO and intentional platform-default actors
retain their existing finite contracts.

The first registration check caught an outdated RecoveryAction shape under
the RSS producer's delegate. Its failed log is retained, and the exact
delegate is corrected alongside the existing directory recovery binding.
Directed production/SDK checks, full Host contracts, real ArkTS compilation,
signed immutable HAP and target behavior are recorded separately. Source
changes require fresh full Host/build evidence; older device observations
cannot be reused as acceptance of this change. Visual and user acceptance
remain deferred under the user's instruction.
