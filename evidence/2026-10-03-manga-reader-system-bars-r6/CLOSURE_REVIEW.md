# R6 final evidence closure

Root confirmed all VM operations ended, both HDC leases were released and the final app scene is the bookshelf with chapter 05, page 5/32 retained. Its source, build, install and scenario records are frozen. The independent VM reviewer froze `vm/INDEPENDENT_REVIEW.md`, SHA-256 `dfa5e49b4585b9efc4905948ff9781a2fdb03ac57ece05055d727297607da0cf`.

This independent closure covers both `evidence/2026-10-03-manga-reader-system-bars-r6/` and the original SDK evidence path `evidence/2026-10-03-manga-reader-sheets-r6/`. The SDK path is retained for evidence history. Production negative-control fixtures are instead in `tools/fixtures/manga-system-bars-r5/` and were bound into the canonical controller snapshot.

Before final synchronization, the persistent tree had 108 system-bars evidence files and 77 SDK evidence files; the temporary delivery tree had 47 and 77 respectively. All existing common records matched by bytes and mode; the temporary tree had no extra records or conflicting records. The 61 new system-bars records, including VM originals and source preservation/binding records, were copied exactly to the temporary delivery tree. Additional closure files are recorded in the final self-excluding inventory.

Three zero-byte failed probes are intentionally retained: `vm/reader-log.txt`, `vm/window-directory.txt` and `vm/window-settled.txt`. Their SHA-256, length and mode are recorded; they were not silently deleted or treated as successful evidence. The first SDK run's 13 fixture failures and the install attempt blocked by the build lock also remain in the record. Successful later results have separate files.

Final readback checks every file in both R6 directories against `FINAL_SHA256SUMS.json` and checks the persistent and temporary copies match exactly. No production source, tests, canonical manifests, HAP bytes, private signing materials, R4/R5 records or device state are changed by this closure. Source archive and package verification already passed; they were not repeated as a substitute for the parent's separate VM evidence. Iteration classification and acceptance boundaries remain unchanged.
