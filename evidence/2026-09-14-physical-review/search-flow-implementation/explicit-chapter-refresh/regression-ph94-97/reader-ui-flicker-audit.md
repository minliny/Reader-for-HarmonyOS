# Reader UI flicker code audit

Observed report: returning from reading to detail makes reading/shelf action buttons flicker; switching bookshelf list/cover briefly hides top-right actions.
Baseline: HarmonyOS 153219bde4883ba81c0a0069c98d45cd325a525e, clean worktree at audit start.

Confirmed bookshelf cause: BookshelfPage.ets:509 applies viewSwitchHeaderOpacity to the shared row containing title and all four actions. sampleViewSwitch:1300 plus MotionSpec.ets:52-55 makes this value exactly zero from 270 to 500 ms. Assets are already unconditional Image nodes, so the code-side cause is ancestor opacity, not branch remount.

Detail audit: LocalBookDetail actionArea has stable unconditional Stack/Text actors. It renders current toc/readingEnabled/removalEnabled/removing props directly. Font registration has a process latch. The parent agent owns Index route/async state investigation; this task will not mask real unavailable/removal states in the presentation component.

Planned bounded fix: limit the existing header opacity track to the title so persistent controls remain visible. Keep all motion times, cover/list actors, artwork, action callbacks, and resting geometry. Verify production sampler plus SDK-generated Builder observers; no HAP or device action.

## Completed repair and local evidence
- BookshelfPage.ets:487 moves the existing header opacity onto the title; the shared action row remains opaque. Existing assets, 34x34 controls, timing and cover/list motion remain.
- New tools/test-bookshelf-detail-control-stability.mjs exercises actual production sampleViewSwitch and the real SDK-emitted bookshelfList/sectionAction Builder observers. It invokes ListItem's native deferred-content callback once per retained item; this is probe scaffolding, not a replacement production animation.
- Baseline reproduces fading at 210 ms: shared toolbar ancestor opacity 0.5 instead of 1. Actual curve endpoints guarantee full hiding from 270 to 500 ms. The probe uses linear interpolation between those endpoints, so it does not claim native curve/pixel fidelity.
- Fixed: 52 snapshots across day/night, cover/list directions and reverse sampling retain 4 icon actor ids and full action ancestor opacity, while title opacity retains its original timeline.
- Detail actionArea Builder retains its two actors, dimensions, enabled state and opacity for repeated book/progress/TOC identity updates; actual unreadability/removal props still disable their corresponding action. No presentation workaround added.
- Existing test-reader-motion-repair, test-bookshelf-view-and-menu (including test-surface-repair), and test-bookshelf-detail-removal passed. Owned-file diff check passed.

Logs: /private/tmp/reader-ui-flicker-baseline-test.log; /private/tmp/reader-ui-flicker-fixed-test.log; /private/tmp/reader-ui-flicker-motion-regression.log; /private/tmp/reader-ui-flicker-shelf-regression.log; /private/tmp/reader-ui-flicker-detail-regression.log.

Open: Index parent route/admission refresh state is owned by root; detail-return flashing is not declared fixed solely from the stable presentation component probe. No HAP, VM, physical device, visual acceptance or user acceptance claim.

## Follow-up: assigned Index detail projection repair
Root delegated refreshDetailAcquisitionProjection and installRemoteReadingSession (plus return/notification scope). The actual change is limited to those two methods and one private revision field; returnToReadingOrigin and subscription code were verified through the probe but needed no mutation.

Confirmed cause: after an actual Coordinator cache-prefetch increments projectionRevision twice, a metadata projection drops the old in-memory prepared chapter. Before this fix it also changes readable to verifying and unnecessarily re-probes even when the same Core source/catalog/context snapshot already returns verificationCurrent=true. Repeated metadata notifications thus expose a transient gate change on return.

Fix: accept the just-read Core verification only for the same canonical session and a stable Coordinator revision during the read. Keep readable without restamping or reusing the old prepared body. Record the revision of this independently confirmed gate; a later source/processing mutation still invalidates it even after the old prepared body was removed. A raced metadata snapshot is reread. Stale source facts revoke the visible readable gate and do not probe through the stale context. A needed body revalidation is awaited under the existing projection coalescing guard, so repeated notifications cannot create another competing probe.

Evidence:
- New tools/test-detail-acquisition-return-stability.mjs uses production Index methods, actual BookAcquisitionCoordinator and actual RemoteReadingFlowGateway, with synthetic Core RPC responses. Revisions are not stubbed: prefetch 0->2, replace rule 2->4, source update on both boundaries.
- Baseline 153219bd fails 'Core-confirmed return cannot flash verifying'. Log: /private/tmp/reader-detail-return-projection-baseline.log; captured original source: /private/tmp/reader-detail-return-before.ets.
- Fixed test passes stable return and repeated notices, stale prepared eviction, exactly one revalidation after real processing invalidation, and rejection/reread of a pre-source-update snapshot. Log: /private/tmp/reader-detail-return-projection-test.log.
- Existing test-remote-reading-evidence passes: /private/tmp/reader-detail-return-evidence-regression.log.
- Existing test-search-candidate-acquisition passes all 37 cases: /private/tmp/reader-detail-return-candidate-regression.log.
- Diff check passed. Changes remain uncommitted for root integration.

Root separately owns the prompt/force-refresh self-cancellation repair and reader gateway work. This report claims local code/state/Builder evidence only; no device pixel acceptance.

## Final bounded return-projection repair (2026-09-15)

Two review findings corrected in production Index: stale acquisition previously assigned verifying without starting any work; new-catalog projection discarded current Core verification and reprobed even when source/catalog/context were exact. The stale branch now re-enters the existing same-identity cache-first detail entry, retaining the actual shelf snapshot and detail return route. Its optional retainAdmissionThroughProbe flag applies only to this automatic recovery, holds the existing admission marker until the body probe settles, and records its terminal failure generation to prevent metadata retries. Successful current-revision offline prepared evidence is retained across subsequent stale catalog notifications.

For canonical catalog changes, the projection revision is checked after catalog/directory reads. installRemoteReadingSession accepts readability only with current revision, schema v2 verificationCurrent, non-stale facts, exact row identity, sourceVersion, catalogVersion, contextVersion, and no pending context refresh. Previous prepared body is never attached to a different catalog or rebased to a later projection revision.

Regression uses unmodified production Index methods, actual BookAcquisitionCoordinator revisions and actual RemoteReadingFlowGateway with controlled Core RPC fixtures. Delayed body plus repeated stale notifications reproduced the intermediate ownership defect (navigation generation 5 instead of 2); the lifecycle flag fixes it. Final cases cover source mutation during projection, current disabled-source offline recovery (shelf and non-shelf), preserved search return route and shelf progress object, repeated stale notifications while/after body loading, missing offline cache terminal failure without repeated attempts, new-catalog verification without any verifying write or old body, mismatched source/catalog/context, and processing mutation during catalog reading. Actual captureRemotePositionContext helper is injected, fixing the integration harness timeout.

PASS logs: /private/tmp/reader-detail-return-final-test.log; /private/tmp/reader-detail-return-final-entry.log; /private/tmp/reader-detail-return-final-evidence.log; /private/tmp/reader-detail-return-final-candidate.log. git diff --check PASS. No device/build operation or pixel/acceptance claim. Changes frozen for Root integration; no independent commit.
