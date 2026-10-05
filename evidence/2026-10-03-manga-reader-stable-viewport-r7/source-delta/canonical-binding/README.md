# R7 canonical binding

`binding.json` binds the exact reconstructed final R7 source to the published iteration HAP and records all canonical input snapshots and Native provenance. `python3 verify_binding.py --require-artifacts` verifies those public records, actual HAP bytes and embedded Native bytes without the temporary source tree.

The final source archive passed full reconstruction and independent archive verification. Preservation-history drift is explicitly disclosed in `REVIEW.md` and `../HISTORY_CORRECTION.md`; unavailable original version 1 metadata is not presented as preserved. Final version 2 source/package binding is verified independently of that history limitation.

No private signing material, build execution, device operation, visual acceptance or user acceptance is claimed by this directory.
