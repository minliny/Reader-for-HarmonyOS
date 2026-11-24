import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { readerAppColor } from '../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { svgAssetRecipes } from './svg-provenance.config.mjs';
import { renderSvgSource, svgThemeColorRole, syncThemeSvgAssets } from './sync-svg-assets.mjs';

const root = path.resolve(import.meta.dirname, '..');
const media = path.join(root, 'entry/src/main/resources/base/media');
const manifestPath = path.join(root, 'tools/theme-svg-variants.json');
const previousVariants = readFileSync(manifestPath, 'utf8');
const registeredVariants = JSON.parse(previousVariants);
const baseRecipes = new Map(svgAssetRecipes.map(recipe => [recipe.file, recipe]));
const explicitFamilies = new Set(svgAssetRecipes
  .filter(recipe => recipe.file.endsWith('_theme_night') &&
    (recipe.originType !== 'theme-palette-derived' || recipe.paletteRole !== undefined))
  .map(recipe => recipe.file.replace(/_theme_night$/, '')));
for (const recipe of svgAssetRecipes) {
  if (recipe.namedWhiteStroke) explicitFamilies.add(recipe.baseFile);
}

const filesIndex = process.argv.indexOf('--files');
const selectedFiles = filesIndex < 0 ? undefined : process.argv[filesIndex + 1]?.split(',');
if (filesIndex >= 0) {
  assert.ok(selectedFiles?.length && new Set(selectedFiles).size === selectedFiles.length &&
    selectedFiles.every(name => /^[A-Za-z][A-Za-z0-9_]*$/.test(name) && !name.endsWith('_theme_night')),
  'THEME_ICON_FILES_INVALID');
}
const names = new Set();

// Dynamic Reader helpers return complete bare asset names and add app.media at
// the call site. Discovery also accepts literal names in pure resource owners.
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(file);
    } else if (/\.(ets|ts)$/.test(entry.name) && entry.name !== 'ReaderThemeRegistry.ts') {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/(['"])(?:app\.media\.)?([A-Za-z][A-Za-z0-9_]*)\1/g)) {
        const name = match[2];
        if (!name.endsWith('_theme_night') && !explicitFamilies.has(name) &&
          existsSync(path.join(media, name + '.svg'))) names.add(name);
      }
    }
  }
}

if (selectedFiles) {
  for (const name of selectedFiles) {
    assert.ok(!explicitFamilies.has(name), `THEME_ICON_EXPLICIT_RECIPE_USE_SYNC_SVG_ASSETS ${name}`);
    assert.ok(baseRecipes.has(name), `THEME_ICON_SOURCE_MISSING ${name}`);
    names.add(name);
  }
} else {
  collect(path.join(root, 'entry/src/main/ets'));
}
if (process.argv.includes('--list')) {
  console.log(JSON.stringify([...names].sort()));
  process.exit(0);
}

// Keep the registered variants when only the day name is dynamically
// discoverable or the consumer is currently disabled.
if (!selectedFiles) for (const name of registeredVariants) names.add(name);
const check = process.argv.includes('--check');
const manifest = new Set(registeredVariants);
const registrySource = readFileSync(path.join(root, '../Reader-UI/theme/registry.json'));
const registryAdapter = readFileSync(path.join(root, 'entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts'), 'utf8');
const registryHash = createHash('sha256').update(registrySource).digest('hex');
assert.equal(registryAdapter.split('\n')[1], `// SHA256 ${registryHash}`,
  'Run generate-theme-registry.mjs before generating SVGs from the updated theme');

for (const name of [...names].sort()) {
  const base = baseRecipes.get(name);
  assert.ok(base, `THEME_ICON_SOURCE_MISSING ${name}`);
  const source = await renderSvgSource(base);
  const needsNight = manifest.has(name) || [...source.content.matchAll(/#[0-9a-f]{6}\b/gi)].some(([color]) => {
    const role = svgThemeColorRole(name, color);
    const night = readerAppColor(role, 'night');
    return night !== undefined && night !== readerAppColor(role, 'day');
  });
  if (needsNight) manifest.add(name);
}
const result = await syncThemeSvgAssets({
  check, files: selectedFiles, variants: [...manifest].sort(), previousVariants,
});
const variants = [...names].filter(name => manifest.has(name)).length;
console.log(`Theme SVG adapters: ${variants} night variants; ${result.count} SVG provenance entries ${check ? 'verified' : 'synchronized'}.`);
