# R8 frozen source delta, version 2

This is a new directory; the complete version 1 record remains in its original location. Version 2 adds one existing test replacement for the exact ordered optional-entry AppStorage writes. The original five source/probe inputs are unchanged. The first three canonical build attempts produced no HAP; Root preserves their preflight/gate failures separately.

The unified parent remains the frozen final R7 effective inventory with 7,116 files. Version 2 contains six operations: four replacements and two additions, leaving the other 7,112 parent records identical by bytes and mode. Full R4 + R5 + R6 + R7 + R8 reconstruction reads back 7,118 files. The effective inventory fingerprint is `d4fe72fef5c39a44df81e82c4d1f48a2ae6d5c43ee1b54e44eb9089dd7e62928`.

`freeze-inputs.json` SHA-256 is `3f131ce3d62dffeaf5ad5672887e18677d4b231ceba65472dabee7d577e047d7`. The source delta is 42,823 bytes, SHA-256 `e8797ae848c632ba3e8ef2f55c8114305e0f5f6718e78ed14039bfe8290c2c8d`. Core input fingerprint, Native SDK package and original Host SO are unchanged. Before/after guards also cover the full R8 version 1 preservation directory.

Run `python3 verify_delta.py --expected-freeze-sha256 3f131ce3d62dffeaf5ad5672887e18677d4b231ceba65472dabee7d577e047d7` to verify every archive byte and mode independently of the original delivery source tree. Actual filesystem reconstruction also passed and its temporary directory was removed afterward.

These are numeric metadata probes and code regressions. Archive/package verification does not establish native image-origin correctness, pixel provenance, full-screen acceptance or user acceptance. Root owns canonical signed build and device scenarios. This agent performs no build, HDC operation, cache extraction or private-signing copy and does not modify frozen R4/R5/R6/R7 evidence or move earlier R8 records.
