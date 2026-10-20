# Theme Runtime handoff

Current UI geometry and original preferences keys are unchanged. `ReaderThemeHost.install` synchronously retires presentation, keeps the subsequently installed EntryAbility recovery barrier, and waits for the same predecessor close boundary as Native before creating/subscribing/loading the successor Store. A failed predecessor remains a failed admission.

`closeRuntime` preserves the entire predecessor chain even when an intermediate Runtime never starts; three rapid Ability generations cannot bypass an old final flush. Theme selection/restore/automatic system reconciliation use captured generation and Store identity at the actual Store change admission. A dispatched save still finishes; retirement does not become proof of non-dispatch.

Actual Adapter/Store/Runtime.close/ThemeHost integration proves `old warm → old final warm → successor night`, not the previous `old warm → successor night → old final warm` overwrite. Rejected predecessor, superseded installer, recovery barrier ordering, lost flush ACK, native close rejection, and three-generation negative controls pass locally. The tests preserve production method bodies and control platform IO only.

Native/ArkTS/HAP/current target remain separate exits. A predecessor native-close rejection can block this process until a valid lifecycle restart; no catch silently releases unknown resource authority. Cold reads expose the current snapshot but do not confirm a previous process's unknown save.
