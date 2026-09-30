# Platform paragraph SDK fixture

This declaration prototype is a byte-for-byte copy of the local
`evidence/2026-09-20-seamless-entry-implementation/prototype/ReaderPlatformParagraphProbe.ts`.
It is tracked here because the contract test requires it in a fresh worktree;
historical evidence directories are not reproducible build inputs.

The test still checks the real installed SDK declarations and compiles this
adapter with the SDK TypeScript checker. This is an SDK contract fixture, not
a production renderer or device acceptance result.
