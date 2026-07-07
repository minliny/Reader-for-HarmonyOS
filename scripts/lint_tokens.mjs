// lint_tokens.mjs — enforces "no raw token values outside contract/generated/".
// Flags raw `#hex` colors and `Npx`-unit spacing (the token value formats) anywhere in
// entry/src/main/ets/ EXCEPT under contract/generated/. Plain numbers (vp) and derived
// line-heights are allowed — only token-formatted values (hex / px-unit) are forbidden.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ETS = path.resolve(__dirname, '..', 'entry/src/main/ets');
const EXCLUDE_DIRS = ['contract/generated'];

const HEX = /#[0-9a-fA-F]{3,8}\b/;
const PX = /\b\d+px\b/;

const offenders = [];
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.includes(path.relative(ETS, p))) continue;
      walk(p);
    } else if (e.name.endsWith('.ets')) {
      const src = fs.readFileSync(p, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        // Skip comment-only lines.
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) return;
        // Per-line opt-out for system-layer values that are not design tokens
        // (e.g. the transparent system-bar color in SafeAreaAdapter). Mark the
        // line with `// lint:allow` and a reason; this stays narrow — only design
        // tokens are meant to flow through TokenAdapter / contract/generated/.
        if (trimmed.includes('// lint:allow')) return;
        if (HEX.test(line)) offenders.push(`${path.relative(ETS, p)}:${i + 1} raw hex: ${line.trim()}`);
        if (PX.test(line)) offenders.push(`${path.relative(ETS, p)}:${i + 1} raw px: ${line.trim()}`);
      });
    }
  }
}
walk(ETS);

if (offenders.length > 0) {
  console.error(`✗ token lint: ${offenders.length} raw token value(s) found outside contract/generated/:\n`);
  for (const o of offenders) console.error(`  ${o}`);
  process.exit(1);
}
console.log(`✓ token lint: no raw hex/px values outside contract/generated/`);
