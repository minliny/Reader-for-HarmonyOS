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
  "entry/src/main/ets/ui/components/BookshelfComponents.ets|radius: 26, color: ReaderUiVisualTokens.bookshelfCoverShadow, offsetX: 0, offsetY: 8",
  // Library/BookCard List cover 493:192: 0 6 12 rgba(52,38,26,.12).
  "entry/src/main/ets/ui/components/BookshelfComponents.ets|radius: 12, color: ReaderUiVisualTokens.bookshelfListCoverShadow, offsetX: 0, offsetY: 6",
  // Bookshelf/MultiSelect 2914:58964: checkbox only, 0 2 4 rgba(0,0,0,.15).
  "entry/src/main/ets/ui/slots/OverlayHost.ets|radius: 4, color: ReaderUiVisualTokens.multiSelectCheckboxShadow, offsetX: 0, offsetY: 2",
  // Library/BookActionSheet 2903:1737: 0 18 46 rgba(89,70,50,.16).
  "entry/src/main/ets/ui/slots/OverlayHost.ets|radius: 46, color: ReaderUiVisualTokens.actionSheetShadow, offsetX: 0, offsetY: 18",
  // Library/BookDetail/DeleteDialog 2269:66: same Figma effect binding.
  "entry/src/main/ets/ui/slots/OverlayHost.ets|radius: 46, color: ReaderUiVisualTokens.actionSheetShadow, offsetX: 0, offsetY: 18",
  // Reader/SessionCapsule 1164:10227: 0 3 8 rgba(70,52,35,.07), footer control only.
  "entry/src/main/ets/ui/components/ReaderComponents.ets|radius: 8, color: ReaderUiVisualTokens.readerSessionCapsuleShadow, offsetX: 0, offsetY: 3",
  // Library/LocalImportDialog Importing 2899:58923: 0 25 50 rgba(0,0,0,.25).
  "entry/src/main/ets/ui/slots/OverlayHost.ets|radius: 50, color: ReaderUiVisualTokens.localImportDialogShadow, offsetX: 0, offsetY: 25",
  // Library/LocalImportDialog Import Result 2657:917: same Figma effect binding.
  "entry/src/main/ets/ui/slots/OverlayHost.ets|radius: 50, color: ReaderUiVisualTokens.localImportDialogShadow, offsetX: 0, offsetY: 25",
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
