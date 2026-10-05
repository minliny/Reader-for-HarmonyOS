# Frozen R6 source delta

This independent delta is applied after the exact R4 full source archive and the frozen R5 two-file delta. It contains the two manga production changes, eight updated test/helper files and two exact R5 source fixtures under `tools/fixtures/manga-system-bars-r5/`. The fixtures are canonical controller inputs; old baseline evidence copies are retained separately as history.

`freeze-inputs.json` is the test agent's exact final input declaration, SHA-256 `87946896c17aad3edcfee490d13d321064ca74222acefcd9e6cbf77375d41ec9`. The delivery and persistent files were checked against that declaration before preservation. `comparison.json` records all unchanged parent paths and the two authorized source additions. `delta-manifest.json` identifies the parent archive chain and the effective inventory.

Run `python3 verify_delta.py` from any directory to verify every archived source byte and mode without the temporary delivery workspace or persistent source files. The preservation run also performs an actual full filesystem reconstruction before deleting its temporary reconstruction directory. R4 and R5 evidence is never rewritten.

No private signing materials, certificate files, password fields, Git internals, dependency caches or build caches are copied into this source delta. HAP build/source binding is appended in a separate `canonical-binding` directory after the parent publishes the new canonical manifest. Source reconstruction alone does not establish VM, physical-device, visual or user acceptance.
