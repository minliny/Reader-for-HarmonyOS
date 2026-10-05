# Tencent official free chapter rule correction

The enabled `https://ac.qq.com` builtins failed while parsing the official free first chapter of 《斗破苍穹》 (`id/531040`, `cid/1`, title `01`). The greedy `picture` array regex also captured the following `ads` object, and QuickJS rejected that text with `Syntax: expecting ';'`. The old nonce match lacked the official global digit/ASCII-letter token boundary.

The two pinned variants now use that boundary and `JSON.parse(java.base64Decode(data)).picture`. Present `ruleContent` and `contentRule` aliases are synchronized. Both variants are v7 with pinned fingerprints; their historical verification timestamps/results, discovery rules and enabled state are retained. The correction includes each old unfingerprinted `contentRule` value (or `null` for previous absence), so production upgrade guards can preserve user alias edits and deletions. Core's current corpus contains only the second variant; the already archived first corpus source remains archived and is corrected after historical recovery by the supply refresh tool.

The 8,989-byte Core replay fixture preserves the exact public response DATA value and nonce script. Both variants emit the same 36 ordered image URLs and exclude ads; the previous rules reproduce the syntax error. The first two images returned HTTP 200 JPEG, 1600×2666, and were visually inspected as official illustrated chapter frontmatter. Image bytes were kept in temporary files rather than added to the repository.

The official mobile detail states that the catalog has 681 chapters and permits trial reading through catalog entry 160. The current desktop catalog marks entry 160 (`100（下）`, `cid/162`) free and entry 161 (`101（上）`, `cid/163`) paid. Only free chapter `01` was opened. Both live CLI L1–L5 chains passed: the simple source in 6.1 seconds, and the app's preferred `🔖腾讯漫画` variant in 26.1 seconds, each with 27 search results and 681 parsed chapters. These are CLI/Host and local parser results; VM and user visual acceptance remain separate.

Validation:

- `cargo test -p reader-content --test tencent_source_rule`: 2 passed.
- `node tools/test-tencent-picture-source-correction.mjs`: both production manga replays, exact revision/history checks, and actual RuntimeOwner upgrade/custom alias protection passed.
- `node tools/test-baozi-image-source-correction.mjs`: passed.
- `node tools/generate-bundled-source-index.mjs --check`: 919 preferred identities verified.

After the managed v7 upgrade, search `斗破苍穹` with `🔖腾讯漫画`, choose the official book `https://ac.qq.com/Comic/comicInfo/id/531040`, then open `01`. User-customized sources retain their own rules.

See `summary.json` for captured response/fixture/CLI hashes, source fingerprints, URLs, image checks and provenance. `live-simple-source.json` and `live-preferred-source.json` retain the separate new live reports without rewriting historical bundled verification records.
