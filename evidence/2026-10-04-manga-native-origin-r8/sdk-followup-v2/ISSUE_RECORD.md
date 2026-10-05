# R8 follow-up v2: strict optional-entry write expectation

Issue recorded before modifying the existing test. Parent canonical build attempt 3 stopped at `tools/test-reader-optional-entry-memory-launch.mjs:72`: expected only `readerAppForeground=true`, while current EntryAbility intentionally writes `readerMangaImageOriginProbe=false` first for every cold launch without an explicit geometry opt-in.

Pre-edit test SHA-256: `8c5ce38343fc35ba39b9ca67b1224039ee8e6bb8fb492843644cd162dd0dab89`. Production EntryAbility SHA-256 remains `f21073d3703a24ae8f01a85dc2bb15f1b3ef517c6de59772b47352b73acac533`.

Code audit: the test executes the actual production onCreate body, supplying the optional-memory and offline diagnostic Wants but no geometry opt-in. The new exact boolean guard consequently resets geometry diagnostics to false in all six cases. The optional-entry-memory flag remains a constructor/runtime field and is not persisted to settings or AppStorage. The expected full ordered write list must include that one intentional false reset; it must not filter writes or tolerate additional mutations.

Authorized scope: only this one existing test in the temporary delivery Host, plus this new follow-up evidence directory. Production/helper files, the new R8 native geometry test, frozen v1 SDK evidence and R7 records remain unchanged. Parent will preserve v2 input separately before the next canonical build. Failure reproduction and post-fix result are recorded in separate logs.

