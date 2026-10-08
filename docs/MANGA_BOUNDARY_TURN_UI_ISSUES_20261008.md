# Manga boundary turn UI: recorded contract issues

Source baseline: HarmonyOS `493e631560088f342daef6a8f2535b2cfeec2907`, independent
`manga-boundary-turn-20261008` workspace. Final candidate/manifest identity is
recorded separately by the root. First observed canonical run:
`reader-contract-run-Pk4smg`, exit 1; no HAP/device acceptance was established.

- **UI-001 — new upstream real UI unregistered.** Trigger: architecture consumer
  and shared-producer full gates inventory the pinned PullToRefresh native
  component. Evidence: both logs report `unregistered actual UI file:
  features/manga/vendor/pulltorefresh/PullToRefresh.ets`. Resolution: exact file
  policy with zero private typography/background budget and existing upstream
  SHA-256/patch/license proof. No wildcard or shared-producer exemption added.
- **UI-002 — new feedback breaks the exact historical typography witness.**
  Trigger: boundaryHint/boundaryStatus add literal 13/11fp Text and native-default
  labelled Buttons directly to MangaReadingSurface. Evidence: bounded carrier,
  conventional typography and native-default full gates report an exact approved
  carrier/tuple mismatch. Resolution: finite MangaBoundaryTurnFeedback actor
  consumes existing public action/metadata/column roles; Surface retains thin
  business wrappers. All original exact historical carriers/approval files stay
  unchanged. The SDK test checks both themes, real Text/Button attributes,
  measured safe insets and retry/cancel callback forwarding.
- **UI-003 — retained pixels require one explicit native paper backing.**
  Source audit after UI-002 shows Surface's original 19 background calls plus one
  retainedChapterPixels paper backing. It prevents unconfirmed candidate pixels
  showing through uncovered areas. Resolution: account for that one native render
  actor in its concrete Surface policy (20 backgrounds), preserving 36 private
  font calls and adding no global or historical budget exemption.

Targeted verification after resolution: architecture-consumer-baseline,
architecture-shared-producers, bounded-typography-carriers,
conventional-typography-coverage, native-default-control-contracts and
manga-boundary-surface-sdk pass. Native image/gesture layout, signed HAP and
manifest-bound VM evidence remain separate gates.
