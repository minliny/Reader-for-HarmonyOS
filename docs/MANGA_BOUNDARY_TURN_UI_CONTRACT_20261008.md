# Manga boundary chapter turn: UI registration and typography

This finite change belongs to the isolated manga-boundary-turn-20261008 workspace,
based on HarmonyOS commit `493e631560088f342daef6a8f2535b2cfeec2907`. Final source, signing and artifact identity are recorded by the root in the
canonical delivery manifest. This document records the candidate implementation
and its code/SDK evidence. No shared historical design witness is recaptured.

## Recorded first full-gate failures

The initial canonical contract run at
`/var/folders/53/6tc2ktbd19dbwxd5pmbp0d_w0000gn/T/reader-contract-run-Pk4smg`
failed architecture-consumer-baseline and architecture-shared-producers because
the new real `features/manga/vendor/pulltorefresh/PullToRefresh.ets` UI had no
file policy. It failed bounded-typography-carriers, conventional-typography-
coverage and native-default-control-contracts because new direct hint/status
Text and labelled Button actors appeared in MangaReadingSurface, which has an
exact existing typography witness. These are source contract failures discovered
before HAP/native verification, not evidence of device behaviour.

## Source-side resolution

Register the exact pinned Apache-2.0 V1 upstream component as a native gesture
adapter with zero private font/background budget. Its original five-stage
resistance methods, source hash lock, patch, copyright and license stay intact.

The new hint and preparation/failure status actors move into the finite
MangaBoundaryTurnFeedback component, with `hint` and `status` variants.
MangaReadingSurface retains thin `boundaryHint`/`boundaryStatus` builders and its
chapter transaction; it passes caption, adjacent chapter title, raw progress,
current colours, measured safe insets and actual retry/dismiss callbacks.

The feedback Text and labelled Button actors consume existing public
`TYPE_SOURCE_SWITCH_NOVEL_ACTION`, `TYPE_SOURCE_SWITCH_NOVEL_METADATA` and
`TYPE_SOURCE_SWITCH_NOVEL_COLUMN` roles. Public font family/weight/size/line boxes
remain with ReaderTypography; Button line boxes stay native AUTO. No literal
font-size slot, native-default label exemption, duplicate role or rewrite of the
historical manga/selected directory typography fixtures is introduced.

The original paper/ink/muted/accent theme, 88vp pull band, progress track,
36vp actions, status padding and safe-area placement stay with the same chapter
feedback presentation. The actor has two real backgrounds and zero private
font calls. No new global shared-producer exemption is added.

MangaReadingSurface retains one additional background for retainedChapterPixels:
it covers gaps around the old visible images while candidate images are being
admitted. This is the existing paper colour behind a specific native retained
image actor, required so unconfirmed candidate pixels cannot show through.
The Surface policy explicitly records 19 previous backgrounds plus this single
native render backing (20 total), while its original 36 font budget and all
historical exact Text/native-default carriers remain unchanged.

## Verification boundary

The targeted architecture/typography tests must pass without changing their
requirements or rewriting approval fixtures. The boundary Surface test executes
the actual SDK-generated feedback Text/buttons, current colours, safe-area
inputs and callback forwarding. The full canonical gate, signed HAP compilation
and manifest-bound native VM evidence are recorded separately by the root.
