import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  SVG_FIGMA_FILE_KEY,
  SVG_FIGMA_ICON_PAGE_NODE_ID,
  SVG_PROVENANCE_SCHEMA_VERSION,
  SVG_TABLER_LICENSE,
  SVG_TABLER_VERSION,
  svgAssetRecipes,
} from './svg-provenance.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA_DIR = path.join(ROOT, 'entry/src/main/resources/base/media');
const ICON_SOURCE_DIR = path.join(ROOT, 'docs/ui-design/svg-provenance/figma-icons');
const PAGE_SOURCE_DIR = path.join(ROOT, 'docs/ui-design/svg-provenance/figma-page-assets');
const MANIFEST_PATH = path.join(ROOT, 'docs/ui-design/SVG_PROVENANCE.json');
const MAIN_SOURCE_DIR = path.join(ROOT, 'entry/src/main');
const BANNED_PROVENANCE = /reference-only|readerseed|unknown|manual|approximation/i;

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function figmaNodeIdFromExport(svg, file) {
  const match = svg.match(/clip0_([0-9]+)_([0-9]+)/);
  assert.ok(match, `${file}: official Figma export has no embedded component node id`);
  return `${match[1]}:${match[2]}`;
}

function renderIcon(recipe, source) {
  assert.match(source, /#1F1B17/i, `${recipe.sourceFile}: expected canonical Figma icon ink`);
  let result = source.replaceAll('#1F1B17', recipe.color).replaceAll('#1f1b17', recipe.color);
  if (recipe.rotation !== 0) {
    result = result.replace(/<g([^>]*)>/, `<g transform="rotate(${recipe.rotation} 24 24)"$1>`);
  }
  if (recipe.fillNone) {
    assert.ok(!/<path[^>]*\bfill=/.test(result), `${recipe.sourceFile}: paths already carry a fill attribute`);
    result = result.replaceAll('<path d=', '<path fill="none" d=');
  }
  return `${result.trim()}\n`;
}

function renderPaperPrimitive(recipe) {
  const stops = recipe.stops
    .map(([color, offset]) => `<stop stop-color="${color}" offset="${offset}"/>`)
    .join('');
  return `<svg viewBox="0 0 ${recipe.width} ${recipe.height}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"><rect x="0" y="0" height="100%" width="100%" fill="url(#grad)" opacity="1"/><defs><radialGradient id="grad" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="10" gradientTransform="${recipe.gradientTransform}">${stops}</radialGradient></defs></svg>\n`;
}

async function renderRecipe(recipe) {
  if (recipe.originType === 'figma-component-derived') {
    const sourcePath = path.join(ICON_SOURCE_DIR, recipe.sourceFile);
    const source = await readFile(sourcePath, 'utf8');
    const figmaNodeId = figmaNodeIdFromExport(source, recipe.sourceFile);
    return {
      content: renderIcon(recipe, source),
      manifest: {
        file: `${recipe.file}.svg`,
        semanticRole: recipe.semanticRole,
        originType: recipe.originType,
        figmaFileKey: SVG_FIGMA_FILE_KEY,
        figmaPageNodeId: SVG_FIGMA_ICON_PAGE_NODE_ID,
        figmaNodeId,
        componentName: recipe.component,
        upstreamName: recipe.component.replace(/^Icon\//, ''),
        upstreamVersion: SVG_TABLER_VERSION,
        license: SVG_TABLER_LICENSE,
        sourceFile: path.relative(ROOT, sourcePath),
        sourceSha256: sha256(source),
        transform: {
          pathMutation: recipe.fillNone ? 'fill-none-on-stroke-paths' : 'none',
          recolor: recipe.color,
          rotationDegrees: recipe.rotation,
        },
      },
    };
  }
  if (recipe.originType === 'figma-node-export' || (recipe.originType === 'figma-make-dom-export' || recipe.originType === 'figma-make-source-export')) {
    const sourcePath = path.join(PAGE_SOURCE_DIR, recipe.sourceFile);
    const source = await readFile(sourcePath, 'utf8');
    return {
      content: `${source.trim()}\n`,
      manifest: {
        file: `${recipe.file}.svg`,
        semanticRole: recipe.semanticRole,
        originType: recipe.originType,
        figmaFileKey: recipe.figmaFileKey ?? SVG_FIGMA_FILE_KEY,
        ...(recipe.originType.startsWith('figma-make-') ? {
          sourceSelector: recipe.sourceSelector, sourceVersion: recipe.sourceVersion,
        } : { figmaNodeId: recipe.sourceNodeId }),
        license: 'Reader project design',
        sourceFile: path.relative(ROOT, sourcePath),
        sourceSha256: sha256(source),
        transform: { pathMutation: 'none' },
      },
    };
  }
  if (recipe.originType === 'figma-node-adapted') {
    const sourcePath = path.join(PAGE_SOURCE_DIR, recipe.sourceFile);
    const source = await readFile(sourcePath, 'utf8');
    assert.equal(recipe.bodyExtension, 50, `${recipe.file}: unsupported popover body extension`);
    const content = source
      .replace('height="218" viewBox="0 0 232 218"', 'height="268" viewBox="0 0 232 268"')
      .replace('V164C203.5 172.56 196.56 179.5 188 179.5H44C35.44 179.5 28.5 172.56 28.5 164V46',
        'V214C203.5 222.56 196.56 229.5 188 229.5H44C35.44 229.5 28.5 222.56 28.5 214V46')
      .replace('width="232" height="218" filterUnits', 'width="232" height="268" filterUnits');
    assert.notEqual(content, source, `${recipe.file}: Figma reference did not accept the approved body extension`);
    return {
      content: `${content.trim()}\n`,
      manifest: {
        file: `${recipe.file}.svg`,
        semanticRole: recipe.semanticRole,
        originType: recipe.originType,
        figmaFileKey: SVG_FIGMA_FILE_KEY,
        figmaNodeId: recipe.sourceNodeId,
        license: 'Reader project design',
        sourceFile: path.relative(ROOT, sourcePath),
        sourceSha256: sha256(source),
        transform: {
          pathMutation: 'extend-straight-body-only',
          bodyExtensionVp: recipe.bodyExtension,
          pointerAndCornerGeometry: 'preserved',
        },
      },
    };
  }
  assert.equal(recipe.originType, 'figma-css-primitive', `${recipe.file}: unsupported provenance type`);
  return {
    content: renderPaperPrimitive(recipe),
    manifest: {
      file: `${recipe.file}.svg`,
      semanticRole: recipe.semanticRole,
      originType: recipe.originType,
      figmaFileKey: SVG_FIGMA_FILE_KEY,
      figmaNodeId: recipe.sourceNodeId,
      license: 'Reader project design',
      sourceFile: 'Figma get_design_context inline SVG background layer',
      sourceSha256: null,
      transform: {
        pathMutation: 'not-applicable',
        width: recipe.width,
        height: recipe.height,
        gradientTransform: recipe.gradientTransform,
        stops: recipe.stops,
      },
    },
  };
}

async function collectFiles(directory, suffix) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolute, suffix));
    } else if (entry.name.endsWith(suffix)) {
      files.push(absolute);
    }
  }
  return files;
}

async function assertSourceCatalogue() {
  const sources = (await readdir(ICON_SOURCE_DIR)).filter((file) => file.endsWith('.svg')).sort();
  assert.equal(sources.length, 139, 'official Figma icon catalogue must contain all 139 components');
  const nodeIds = new Set();
  for (const file of sources) {
    const source = await readFile(path.join(ICON_SOURCE_DIR, file), 'utf8');
    assert.doesNotMatch(source, BANNED_PROVENANCE, `${file}: banned provenance marker`);
    const nodeId = figmaNodeIdFromExport(source, file);
    assert.ok(!nodeIds.has(nodeId), `${file}: duplicate official Figma component node ${nodeId}`);
    nodeIds.add(nodeId);
  }
}

async function assertProductionReferences(expectedNames) {
  const sourceFiles = await collectFiles(MAIN_SOURCE_DIR, '.ets');
  sourceFiles.push(...await collectFiles(MAIN_SOURCE_DIR, '.ts'));
  let source = '';
  for (const file of sourceFiles) {
    source += `\n${await readFile(file, 'utf8')}`;
  }
  for (const name of expectedNames) {
    const quotedSingle = `'${name}'`;
    const quotedDouble = `"${name}"`;
    const resource = `app.media.${name}`;
    assert.ok(source.includes(quotedSingle) || source.includes(quotedDouble) || source.includes(resource),
      `${name}.svg: production resource has no ArkTS reference`);
  }
}

export async function syncSvgAssets({ check = false } = {}) {
  await assertSourceCatalogue();
  const recipeNames = svgAssetRecipes.map((recipe) => recipe.file);
  assert.equal(new Set(recipeNames).size, recipeNames.length, 'SVG provenance recipes must be unique');
  assert.doesNotMatch(JSON.stringify(svgAssetRecipes), BANNED_PROVENANCE,
    'SVG provenance recipes may not contain untrusted origin categories');

  const rendered = [];
  for (const recipe of svgAssetRecipes) {
    const item = await renderRecipe(recipe);
    item.manifest.sha256 = sha256(item.content);
    rendered.push({ recipe, ...item });
  }

  const expectedFiles = rendered.map(({ recipe }) => `${recipe.file}.svg`).sort();
  const actualFiles = (await readdir(MEDIA_DIR)).filter((file) => file.endsWith('.svg')).sort();
  if (check) {
    assert.deepEqual(actualFiles, expectedFiles,
      'production SVG set must exactly match the trusted provenance registry');
  }

  for (const { recipe, content } of rendered) {
    const destination = path.join(MEDIA_DIR, `${recipe.file}.svg`);
    if (check) {
      const actual = await readFile(destination, 'utf8');
      assert.equal(actual, content, `${recipe.file}.svg: generated bytes or provenance hash drifted`);
    } else {
      await writeFile(destination, content);
    }
  }

  const manifest = `${JSON.stringify({
    schemaVersion: SVG_PROVENANCE_SCHEMA_VERSION,
    generatedBy: 'tools/sync-svg-assets.mjs',
    policy: {
      allowedOrigins: ['figma-component-derived', 'figma-node-export', 'figma-make-dom-export', 'figma-make-source-export', 'figma-node-adapted', 'figma-css-primitive'],
      unknownAllowed: false,
      manualPathMutationAllowed: false,
    },
    entries: rendered.map(({ manifest: entry }) => entry),
  }, null, 2)}\n`;

  if (check) {
    assert.equal(await readFile(MANIFEST_PATH, 'utf8'), manifest,
      'SVG provenance manifest is stale; run node tools/sync-svg-assets.mjs');
  } else {
    await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
    await writeFile(MANIFEST_PATH, manifest);
  }

  await assertProductionReferences(recipeNames);
  return { count: rendered.length, manifestPath: MANIFEST_PATH };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const result = await syncSvgAssets({ check });
  console.log(`${check ? 'verified' : 'synced'} ${result.count} trusted SVG assets`);
}
