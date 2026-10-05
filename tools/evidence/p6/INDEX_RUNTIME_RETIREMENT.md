# Index Runtime retirement admission — 2026-10-03

Baseline: integrated Host `4bfec1eb`; work performed in an independent Host worktree.

## Located fault

28 Index identity comparisons called the hard-failing `ReaderRuntimeOwner.current()` getter from asynchronous or stale callback admission. Runtime removal could reject a legitimate accepted write settlement or `finally`. Index teardown also reacquired the current Runtime rather than preserving the one its mount owned, so a retiring Index could clean up a replacement Runtime.

## Implemented contract

`isCurrentRuntime(capturedOwner)` uses production `ReaderRuntimeOwner.isCurrent` with explicit undefined rejection. Required live feature construction still uses the hard-failing `current()` getter. Route, generation, book/entity and operation guards remain in place. Index captures its exact owner at mount, clears that field at teardown and only performs normal endSearch/pause cleanup while that exact owner remains installed. Replacement and unavailable Runtime cleanup belongs to their existing owner lifecycle.

## Verification and fixture correction

SDK AST verifies no direct current() equality/inequality remains. Real production Runtime static instance seam tests unavailable/replacement/normal/repeat teardown. Bookshelf Gateway→Index→real SDK recovery tests cover accepted single/batch/detail ACK, readback finally and accepted import after actual Runtime unset. Discover, full RSS Index, RSS management, native Alert, private Typography and test-tier checks pass. Full actual AssetStore→Sync→Index→SDK page passes stale/unset and accepted save settlement. The prior Sync test only overrode current() while leaving production isCurrent storage installed; it was corrected to unset the actual test Runtime storage seam, with the getter still proving hard failure. No guard was weakened.

Code and local SDK contract evidence only. HAP, target/device, visual and user acceptance are handled separately and are not established by this change.
