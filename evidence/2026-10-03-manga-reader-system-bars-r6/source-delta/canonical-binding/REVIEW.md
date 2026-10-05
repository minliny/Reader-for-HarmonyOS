# R6 source-to-package binding review

PASS for the public source and artifact chain. The independent agent did not build, install, use HDC, alter production inputs, stage or commit files.

- Canonical iteration run: `20261003T132254Z-568ec4e3-d6c1d5d4`; `acceptanceEligible=false`.
- Manifest: 14,754 bytes, SHA-256 `ccca0d246ca3ed72727924dbea10cc62ede584934481e0576318eb2f6dc3d723`.
- Signed HAP: 198,672,053 bytes, SHA-256 `0c57c7221e3a7612bf764c471655d120f3d37fe63e7f003c8a93a7b5d837bff7`; exact authorized `minliny_HarmonyOS` certificate SHA-256 `3A563778E5BF17CD3EAD0218E13B4A5030DE3F5D7D4E21E0336D8EB37B676DC4`.
- All 2,428 canonical input records matched the R4 + R5 + R6 effective source inventory byte-for-byte and mode-for-mode: 1,824 Harmony source, 586 controller and 18 workspace records. Both exact R5 counterfactual fixtures under `tools/fixtures/manga-system-bars-r5/` are in the canonical controller snapshot.
- Effective full source inventory: 7,113 files; SHA-256 inventory fingerprint `c71936aced3644d4ea9fc8c0bb7610bc72467dcd7b3f3a4362b6892bbca49e4b`. New R6 delta is 12 files: 10 replacements and two additions. The other 7,101 parent records are unchanged.
- Core canonical input fingerprint remains `9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b`. Original Host and SDK SO remains `1fabbfa63b996e39da9a3ec01f6b396cf841f0d0b4016303daac56a974c17996`. Published embedded SO is the documented strip output, 17,908,136 bytes, SHA-256 `adb383b33be91db7d605e5e343c578c45f0ea82c24e81ac8d6e8c22a482c3f06`; it is distinct from the original unstripped input.
- Both actual HAPs and both embedded Native entries were read back. The unsigned artifact is recorded for provenance and was not installed by this agent. Native SDK package, Core build snapshot, build identity and vendored entries match the frozen preserved package.
- No private signing configuration, keystore, passwords, certificate payload or profile material was copied. Only the canonical public manifest, input snapshots and public Native provenance were saved. Frozen R4, R5 and R6 source delta files passed before/after hash guards.

`verify_delta.py` verifies the source archive chain without the delivery source tree. `verify_binding.py --require-artifacts` passed independently against the preserved records and actual signed/unsigned artifact bytes. This review makes no claim about VM behavior, status-bar placement, gesture-indicator visibility, animation timing, physical devices or user acceptance; those require the parent's separate scenario evidence.
