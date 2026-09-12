# Official ArkUI differential-test fixture

The two gzip files are unmodified files from OpenHarmony `arkui_ace_engine`,
`OpenHarmony-5.0.0-Release`. Each adjacent JSON records the exact upstream blob
and uncompressed SHA-256. Their original copyright/license headers are retained;
see LICENSE (Apache-2.0).

These files are test-only. Reader uses the installed ArkUI API 23 implementation,
and never packages this fixture into the application. The test runs the actual
upstream attribute comparison and patch functions against a native-call recorder.
It proves property forwarding and comparison behavior of this pinned version,
not VM scheduling, native layout, GPU cost or HarmonyOS API 23 frame duration.

The generated 5.0 bundle references a shared `_a` temporary; the test context
declares it without modifying the fixture. Native operations are recorded, not
emulated. Framework enums, value types and comparisons execute upstream code.
