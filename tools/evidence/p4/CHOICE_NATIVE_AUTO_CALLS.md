# Choice native AUTO setter correction

Observed source defect: shared `ReaderChoiceRow.normalRow` called `lineHeight(undefined)` for the default rows and `textAlign(undefined)` / `textOverflow(undefined)` for Settings rows. The former contract compared the recorded value with `undefined`, which could not distinguish an absent setter from a setter carrying undefined. Native ArkUI does not define these arguments as an instruction to preserve AUTO.

The finite `ReaderChoiceLabelModifier` now calls optional line/alignment/overflow setters only when the original finite spec authors them. Optional variable font-weight settings are supplied only for the existing appearance-library variant; other variants call the one-argument setter. Normal geometry, role values, selected weight and event owner remain unchanged. Position-based source-group/compact rows are unchanged.

The existing real parent/SDK row test retains all eight original variants, guarded duplicate commits, retained Props, owner retirement and common/variant propagation. It additionally inspects the actual Text `attributeCalls`, including setter existence and argument count. Three source mutations reintroduce actual undefined line/alignment/overflow setters; each fails the omission assertion while the old recorded-value equality would still pass. This is source + actual SDK/native API-call evidence, not renderer/pixel/target acceptance.

Choice's already-shared producer is now registered with its exact eight-spec implementation, spec source, actual consumer edges, delete/SDK proof, rather than admitting modifier aliases by local variable names. The original 100 private business budget rows and Choice's existing owner counts remain unchanged.
