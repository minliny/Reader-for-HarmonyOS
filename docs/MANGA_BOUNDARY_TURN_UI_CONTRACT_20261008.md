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

The user subsequently corrected the interaction to an upward pull beyond the
chapter's bottom, followed by release to enter the next chapter. Insufficient
distance returns to the current image. The preparation/retry/cancel card and
previous-chapter pull are superseded by this confirmed direction; the failed
`5b888a27` native evidence remains failed.

MangaBoundaryTurnFeedback now renders one flat 48vp footer Row: an upward arrow
and one brief caption. It has no chapter title, progress track, card, floating
overlay or action buttons. Its only props are `caption`, `paperColor`,
`inkColor` and `mutedColor`; the reading owner supplies pull/release/preparation
copy such as `正在进入下一章节…`. The upstream wrapper reveals and clips this
footer in the bottom area exposed by the upward pull. Failure toast and chapter
transaction ownership remain in MangaReadingSurface.

Both Text actors consume the existing public
`TYPE_SOURCE_SWITCH_NOVEL_ACTION` role. Public font family, weight, size and
line boxes remain with ReaderTypography. The footer follows the current
paper/ink/muted theme and does not receive pointer input. It has one real flat
background and zero private font calls. No literal font-size slot,
native-default label exemption, duplicate role or rewrite of the historical
manga/selected directory typography fixtures is introduced.

MangaReadingSurface delegates the retainedChapterPixels backing to the existing
ReaderPageFrameModifier (`reader` category with the current paper colour):
it covers gaps around the old visible images while candidate images are being
admitted. This is the existing paper colour behind a specific native retained
image actor, required so unconfirmed candidate pixels cannot show through.
The Surface policy remains at its original 19 private backgrounds. The shared
modifier owns this backing; the retained actor keeps explicit clipping and
HitTestMode.None. Its original font budget and historical exact
Text/native-default carriers remain unchanged. The SDK regression exercises
the actual Builder and shared modifier, including transparency, missing clip
and pointer interception counterexamples.

## Verification boundary

The targeted architecture/typography tests must pass without changing their
requirements or rewriting approval fixtures. The feedback SDK test executes
the actual generated footer Row/Text actors, day/night colours, one-line public
typography and retained caption/theme updates. The root boundary Surface test
checks release-to-next-chapter wiring. The full canonical gate, signed HAP compilation
and manifest-bound native VM evidence are recorded separately by the root.
