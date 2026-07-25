// Figma-first visual guard.  DemoAliasTokens.shadow* comes from the legacy
// frontend demo CSS, not from a Figma visual contract.  A blur on a full-width
// ArkUI section leaks beyond its bounds and caused the repeated body-corner
// halo regression.  Every UI shadow must therefore be an explicit, current
// Figma effect binding below; do not add a generic demo elevation here.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const uiRoot = path.join(repo, 'entry/src/main/ets/ui');

const allowlist = [
  // Library/BookCard 493:196: cover only, 0 8 26 rgba(89,70,50,.10).
  "entry/src/main/ets/ui/components/BookshelfComponents.ets|radius: 26, color: FigmaReadingVisualTokens.shelfCoverShadow, offsetX: 0, offsetY: 8",
  // Library/BookCard List cover 493:192: 0 6 12 rgba(52,38,26,.12).
  "entry/src/main/ets/ui/components/BookshelfComponents.ets|radius: 12, color: FigmaReadingVisualTokens.shelfListCoverShadow, offsetX: 0, offsetY: 6",
  // Book Detail/DeleteDialog 2269:66: 0 18 46 rgba(89,70,50,.16).
  "entry/src/main/ets/ui/slots/OverlayHost.ets|radius: 46, color: '#29594632', offsetX: 0, offsetY: 18",
  // Library/LocalImportDialog State=Import Result 2657:917: 0 25 50 -12 rgba(0,0,0,.25).
  "entry/src/main/ets/ui/components/FigmaLocalImportDialog.ets|radius: 50, color: FigmaLibraryVisualTokens.dialogShadow, offsetX: 0, offsetY: 25",
  // Overlay/Restore Backup Confirm 2834:32130: 0 18 46 rgba(89,70,50,.16).
  "entry/src/main/ets/ui/components/FigmaRestoreBackupOverlay.ets|radius: FigmaSyncBackupVisualTokens.confirmShadowRadius, color: FigmaSyncBackupVisualTokens.confirmShadow, offsetX: 0, offsetY: FigmaSyncBackupVisualTokens.confirmShadowOffsetY,",
];

function collectEtsFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectEtsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ets')) {
      files.push(fullPath);
    }
  }
  return files;
}

const observed = [];
for (const file of collectEtsFiles(uiRoot)) {
  const source = fs.readFileSync(file, 'utf8');
  const relative = path.relative(repo, file).split(path.sep).join('/');
  for (const match of source.matchAll(/\.shadow\(\{\s*([^}]*)\}\)/g)) {
    const detail = match[1].replace(/\s+/g, ' ').trim();
    observed.push(`${relative}|${detail}`);
  }
}

assert.deepEqual(
  observed.sort(),
  allowlist.slice().sort(),
  'Unbound ArkUI shadow detected. Bind a real Figma node/effect first, then update this allowlist and the F0 crosswalk; do not reuse a demo shadow token on a page surface.',
);

console.log(`Figma shadow allowlist verified: ${observed.length} current effect bindings`);
