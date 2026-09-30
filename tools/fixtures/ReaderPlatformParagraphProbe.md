# Paragraph API semantic fixture

This tracked fixture preserves the existing Reader declaration-only probe from
`evidence/2026-09-20-seamless-entry-implementation/prototype/ReaderPlatformParagraphProbe.ts`.
It is not a production renderer and does not establish device support or pixels.

The previous mandatory test read an untracked historical evidence file and failed
with ENOENT on this isolated checkout. The fixture was copied byte-for-byte from
the canonical workspace on 2026-09-25. SHA-256:
`ceb4b9832348898e5942e5cec72dcfb0c2949e1f652506b05c3841d8700cfb9b`.

`node tools/test-reader-platform-paragraph-probe.mjs` checks this source against
installed DevEco SDK declarations, so future clean checkouts keep that same gate.
