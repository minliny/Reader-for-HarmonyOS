# Appearance write confirmation audit

Source input: AppearanceStore `6094483b202a602e51e2c29b348256cf07cb0a3a`, Preferences `7a05b82b619d3dd009a8355ef7392061aa6500a1` (identical integration 9ce2e0eb).

Existing theme-specific failure handling compensates the accepted theme back to the old snapshot whenever save rejects. The platform adapter dispatches put then flush; a flush rejection provides no atomic proof that the put/flush did not persist. Automatically compensating can overwrite a successful choice after a lost acknowledgement. The theme and ordinary typography paths also apply different failure meanings.

Required contract: retain accepted user snapshot and mark it unconfirmed until a fulfilled save; do not infer success from a matching cached get; do not automatically write the previous theme. A later explicit choice or lifecycle flush may write the latest complete normalized snapshot because this domain setter is idempotent. Same preference-file IO must serialize across replacement Runtime/store instances; a new warm store must preserve uncertainty from a rejected dispatched save. Old callbacks must not publish into a replacement store.

Local tests must execute actual store + Preferences adapter with put success/flush lost ACK, ensure-store failure before dispatch, ordered old/new owner writes, warm reopen and finite idempotent flush. Full ArkTS/native persistence/target evidence remains separate. No visual geometry changes.

Implementation local result: actual adapter/store negative matrix covers put before/after partial effect, flush before/after durable effect, warm replacement accepted intent even where native cache remains old, no compensation, no cached matching success, and exact-file queue ordering. Existing store/themeHost/themeSelection regression PASS. One retained uncertain snapshot plus one IO tail is bounded. Runtime startAfterPredecessor remains the lifecycle authority; the IO queue does not authorize a retired UI to issue a new choice. Cold restart loads actual present state, not confirmation of the previous transaction; no cross-process save receipt is claimed.
