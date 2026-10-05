# R8 frozen numeric-probe source delta, version 1

The exact final allowlist has five operations: three replacements and two additions. It replaces EntryAbility, MangaReadingSurface and the SDK probe helper, and adds MangaImageOriginGeometry plus the native geometry SDK regression. `freeze-inputs.json` SHA-256 is `5ef244921c2aa0c20be627aed129a04213f2826daa578aa210b94be4f31bf505`.

The parent chain is the exact R4 full archive followed by frozen R5, R6 and final R7 deltas. The R7 parent has 7,116 effective records. R8 changes three existing records, adds two and leaves the other 7,113 parent records identical by bytes and file mode. Complete filesystem reconstruction verifies 7,118 files; the effective inventory fingerprint is `d5392672dc097c1b9ea4849fc413eda95e68f6af08e956ed162784209420cf7c`.

The new source archive is 37,791 bytes, SHA-256 `39ec951c9dcd12072a304f0a681db93e728ee3aa9cdfd9baaf6a87c3085afb91`. Core's input fingerprint and the exact Native SDK/Host SO stay unchanged. No earlier attempt directory was moved, renamed or overwritten.

Run `python3 verify_delta.py --expected-freeze-sha256 5ef244921c2aa0c20be627aed129a04213f2826daa578aa210b94be4f31bf505` to independently verify every archive byte and mode without the delivery source tree. The preservation run also performed complete reconstruction in a fresh temporary directory and deleted that reconstruction directory afterward.

The changes collect numeric image-origin metadata for investigation. Source preservation and package binding cannot establish native geometry correctness, source/tile first pixels or full-screen acceptance. Root owns the canonical signed build, device collection and separate scenario evidence. No private signing material, cache content, build execution or HDC operation is performed by this preservation agent. Frozen R4, R5, R6 and R7 records remain unchanged.
