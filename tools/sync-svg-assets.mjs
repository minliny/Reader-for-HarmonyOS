import { readerAppColor } from '../entry/src/main/ets/features/common/ReaderThemeRegistry.ts';
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
  SVG_RADIX_PACKAGE,
  SVG_RADIX_COMPONENT_SOURCES,
  svgRadixSheetRecipes,
  svgAssetRecipes,
  SVG_DOWNLOAD_LUCIDE_PACKAGE,
  SVG_DOWNLOAD_LUCIDE_SOURCES,
  svgDownloadLucideRecipes,
  SVG_MESSAGE_LUCIDE_PACKAGE,
  svgMessageLucideRecipes,
  svgActionForegroundRecipes,
  svgControlForegroundRecipes,
  SVG_TTS_SELECTED_C,
  svgTtsSelectedCRecipes,
} from './svg-provenance.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEDIA_DIR = path.join(ROOT, 'entry/src/main/resources/base/media');
const ICON_SOURCE_DIR = path.join(ROOT, 'docs/ui-design/svg-provenance/figma-icons');
const PAGE_SOURCE_DIR = path.join(ROOT, 'docs/ui-design/svg-provenance/figma-page-assets');
const RADIX_SOURCE_DIR = path.join(ROOT, 'docs/ui-design/svg-provenance/radix-icons');
const DOWNLOAD_LUCIDE_SOURCE_DIR = path.join(ROOT, 'docs/ui-design/svg-provenance/download-lucide');
const MESSAGE_LUCIDE_SOURCE_DIR = path.join(ROOT, 'docs/ui-design/svg-provenance/message-lucide');
const TTS_SELECTED_C_SOURCE_DIR = path.join(ROOT, 'docs/ui-design/svg-provenance/tts-selected-c');
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
  if (recipe.fillInterior) {
    assert.ok(!/<path[^>]*\bfill=/.test(result), `${recipe.sourceFile}: paths already carry a fill attribute`);
    result = result.replaceAll('<path d=', `<path fill="${recipe.color}" d=`);
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
  if (recipe.originType === 'user-selected-icon-adapted') {
    assert.deepEqual(recipe, svgTtsSelectedCRecipes.find(value => value.file === recipe.file),
      'only the six explicitly selected TTS C spacing adapters are admitted');
    const sourcePath = path.join(TTS_SELECTED_C_SOURCE_DIR, 'transport-previous.svg');
    const receiptPath = path.join(TTS_SELECTED_C_SOURCE_DIR, 'SOURCE.json');
    const source = await readFile(sourcePath, 'utf8');
    const receiptRaw = await readFile(receiptPath, 'utf8');
    assert.equal(sha256(source), SVG_TTS_SELECTED_C.sourceSha256, 'selected TTS C geometry changed');
    assert.equal(sha256(receiptRaw), SVG_TTS_SELECTED_C.receiptSha256, 'selected TTS C receipt changed');
    const receipt = JSON.parse(receiptRaw);
    assert.equal(receipt.selectionId, recipe.selectionId);
    const color = readerAppColor(recipe.colorRole, 'day');
    assert.match(color, /^#FF[0-9A-F]{6}$/i, 'selected TTS C adapter preserves original opaque role');
    let content = source.replace('width="26" height="26"', `width="${recipe.size}" height="${recipe.size}"`)
      .replace('stroke="currentColor"', `stroke="#${color.slice(3)}"`);
    if (recipe.mirrorX) content = content.replace(/(<svg\b[^>]*>)([\s\S]*)(<\/svg>)/,
      '$1<g transform="translate(26 0) scale(-1 1)">$2</g>$3');
    return { content, manifest: { file: `${recipe.file}.svg`, semanticRole: recipe.semanticRole,
      originType: recipe.originType, selectionId: recipe.selectionId, selectedVariant: 'C',
      license: receipt.license, sourceFile: path.relative(ROOT, sourcePath), sourceSha256: sha256(source),
      sourceReceiptFile: path.relative(ROOT, receiptPath), sourceReceiptSha256: sha256(receiptRaw),
      originalAsset: receipt.originalAssets.find(value => value.file === `${recipe.file}.svg`),
      transform: { pathMutation: 'user-approved-C-spacing', viewBox: '0 0 26 26', strokeWidth: 1.9,
        mirrorX: recipe.mirrorX, intrinsicSizePreserved: recipe.size, colorRole: recipe.colorRole } } };
  }
  if (recipe.originType === 'lucide-static-svg-derived') {
    assert.deepEqual(recipe, svgMessageLucideRecipes.find(value => value.file === recipe.file),
      'only the two approved C17 image-off recolors are admitted');
    const sourcePath = path.join(MESSAGE_LUCIDE_SOURCE_DIR, 'image-off.svg');
    const source = await readFile(sourcePath, 'utf8');
    const license = await readFile(path.join(MESSAGE_LUCIDE_SOURCE_DIR, 'LICENSE'), 'utf8');
    assert.equal(sha256(source), SVG_MESSAGE_LUCIDE_PACKAGE.sourceSha256, 'pinned ImageOff geometry');
    assert.equal(sha256(license), SVG_MESSAGE_LUCIDE_PACKAGE.licenseSha256, 'complete upstream ISC/Feather notice');
    assert.equal(sha256(await readFile(path.join(MESSAGE_LUCIDE_SOURCE_DIR, 'SOURCE.json'))),
      SVG_MESSAGE_LUCIDE_PACKAGE.receiptSha256, 'pinned ImageOff npm receipt');
    assert.equal((source.match(/stroke="currentColor"/g) ?? []).length, 1, 'one original stroke recolor');
    const content = `<!--\n${license.trim()}\n-->\n` + source.replace('stroke="currentColor"', `stroke="${recipe.color}"`);
    return { content, manifest: { file: recipe.file + '.svg', semanticRole: recipe.semanticRole,
      originType: recipe.originType, componentName: recipe.component,
      upstreamPackage: SVG_MESSAGE_LUCIDE_PACKAGE.name, upstreamVersion: SVG_MESSAGE_LUCIDE_PACKAGE.version,
      upstreamUrl: SVG_MESSAGE_LUCIDE_PACKAGE.url, license: SVG_MESSAGE_LUCIDE_PACKAGE.license,
      licenseFile: path.relative(ROOT, path.join(MESSAGE_LUCIDE_SOURCE_DIR, 'LICENSE')),
      licenseSha256: SVG_MESSAGE_LUCIDE_PACKAGE.licenseSha256,
      sourceReceiptFile: path.relative(ROOT, path.join(MESSAGE_LUCIDE_SOURCE_DIR, 'SOURCE.json')),
      sourceReceiptSha256: SVG_MESSAGE_LUCIDE_PACKAGE.receiptSha256,
      sourceFile: path.relative(ROOT, sourcePath), sourceSha256: SVG_MESSAGE_LUCIDE_PACKAGE.sourceSha256,
      transform: { pathMutation: 'none', viewBox: 'preserved', recolor: recipe.color } } };
  }
  if (recipe.originType === 'lucide-component-derived') {
    assert.deepEqual(recipe, svgDownloadLucideRecipes.find(value => value.file === recipe.file),
      'only approved download demo Lucide recipes are admitted');
    const input = SVG_DOWNLOAD_LUCIDE_SOURCES[recipe.component];
    assert.ok(input, 'Lucide component outside pinned download input set');
    const sourcePath = path.join(DOWNLOAD_LUCIDE_SOURCE_DIR, input.sourceFile);
    const source = await readFile(sourcePath,'utf8');
    assert.equal(sha256(source), input.sourceSha256, 'Lucide node source hash drifted');
    assert.equal(sha256(await readFile(path.join(DOWNLOAD_LUCIDE_SOURCE_DIR,'SOURCE.json'),'utf8')),
      SVG_DOWNLOAD_LUCIDE_PACKAGE.receiptSha256, 'Lucide source receipt drifted');
    assert.equal(sha256(await readFile(path.join(DOWNLOAD_LUCIDE_SOURCE_DIR,'LICENSE'),'utf8')),
      SVG_DOWNLOAD_LUCIDE_PACKAGE.licenseSha256, 'Lucide ISC license drifted');
    const nodes = JSON.parse(source);
    assert.ok(Array.isArray(nodes) && nodes.length > 0);
    const shapes = nodes.map(([tag, attrs]) => {
      assert.ok(['path','circle','rect','line','polyline','polygon','ellipse'].includes(tag));
      assert.ok(Object.keys(attrs).every(key => /^(d|cx|cy|r|x|y|width|height|rx|ry|x1|x2|y1|y2|points)$/.test(key)));
      const attributes = Object.entries(attrs).map(([key,val]) => {
        assert.equal(typeof val,'string'); assert.ok(!/[<>&"]/.test(val));
        return key + '="' + val + '"';
      }).join(' ');
      return '<' + tag + ' fill="none" ' + attributes + '/>';
    }).join('');
    const transform = recipe.flipY ? 'translate(12 12) scale(1 -1) rotate(90) translate(-12 -12)' :
      recipe.rotation ? 'rotate(' + recipe.rotation + ' 12 12)' : '';
    const content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' +
      recipe.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      (transform ? '<g transform="' + transform + '">' + shapes + '</g>' : shapes) + '</svg>\n';
    return {content,manifest:{file:recipe.file+'.svg',semanticRole:recipe.semanticRole,
      originType:recipe.originType,componentName:recipe.component,
      upstreamPackage:SVG_DOWNLOAD_LUCIDE_PACKAGE.name,upstreamVersion:SVG_DOWNLOAD_LUCIDE_PACKAGE.version,
      upstreamUrl:SVG_DOWNLOAD_LUCIDE_PACKAGE.url,license:SVG_DOWNLOAD_LUCIDE_PACKAGE.license,
      licenseFile:path.relative(ROOT,path.join(DOWNLOAD_LUCIDE_SOURCE_DIR,'LICENSE')),
      licenseSha256:SVG_DOWNLOAD_LUCIDE_PACKAGE.licenseSha256,
      sourceReceiptFile:path.relative(ROOT,path.join(DOWNLOAD_LUCIDE_SOURCE_DIR,'SOURCE.json')),
      sourceReceiptSha256:SVG_DOWNLOAD_LUCIDE_PACKAGE.receiptSha256,
      sourceFile:path.relative(ROOT,sourcePath),sourceSha256:input.sourceSha256,
      transform:{pathMutation:'none',viewBox:'preserved',recolor:recipe.color,rotationDegrees:recipe.rotation,flipY:recipe.flipY}}};
  }
  if (recipe.originType === 'radix-component-derived') {
    const pinnedRecipe = svgRadixSheetRecipes.find(value => value.file === recipe.file);
    assert.deepEqual(recipe, pinnedRecipe, `${recipe.file}: only the pinned manga sheet Radix recipes are allowed`);
    const input = SVG_RADIX_COMPONENT_SOURCES[recipe.component];
    assert.ok(input, `${recipe.file}: Radix component is outside the pinned eleven-icon input set`);
    assert.equal(recipe.sourceFile, input.sourceFile);
    assert.equal(recipe.sourceSha256, input.sourceSha256);
    const sourcePath = path.join(RADIX_SOURCE_DIR, input.sourceFile);
    const source = await readFile(sourcePath, 'utf8');
    assert.equal(sha256(source), input.sourceSha256, `${recipe.sourceFile}: pinned Radix source hash drifted`);
    assert.match(source, /viewBox="0 0 15 15"/, `${recipe.sourceFile}: upstream viewBox must remain unchanged`);
    const canonicalColor = input.canonicalColor ?? '#756F69';
    assert.deepEqual([...new Set(source.match(/#[0-9a-f]{6}\b/gi))], canonicalColor === 'currentColor' ? [] : [canonicalColor],
      `${recipe.sourceFile}: expected canonical Radix fill`);
    assert.ok(source.includes(`fill="${canonicalColor}"`), `${recipe.sourceFile}: the pinned source paint exists`);
    const content = source.replaceAll(`fill="${canonicalColor}"`, `fill="${recipe.color}"`);
    assert.equal(content.replaceAll(`fill="${recipe.color}"`, `fill="${canonicalColor}"`), source,
      `${recipe.file}: only fixed path recoloring is allowed`);
    return { content, manifest: {
      file: `${recipe.file}.svg`, semanticRole: recipe.semanticRole, originType: recipe.originType,
      componentName: recipe.component, upstreamPackage: SVG_RADIX_PACKAGE.name,
      upstreamVersion: SVG_RADIX_PACKAGE.version, upstreamUrl: SVG_RADIX_PACKAGE.url,
      upstreamIntegrity: SVG_RADIX_PACKAGE.integrity, upstreamGitHead: SVG_RADIX_PACKAGE.gitHead,
      license: SVG_RADIX_PACKAGE.license, licenseFile: path.relative(ROOT, path.join(RADIX_SOURCE_DIR, 'LICENSE')),
      licenseSha256: SVG_RADIX_PACKAGE.licenseSha256,
      sourceReceiptFile: path.relative(ROOT, path.join(RADIX_SOURCE_DIR, 'SOURCE.json')),
      sourceReceiptSha256: SVG_RADIX_PACKAGE.receiptSha256,
      sourceFile: path.relative(ROOT, sourcePath), sourceSha256: input.sourceSha256,
      transform: { pathMutation: 'none', recolor: recipe.color, viewBox: 'preserved' },
    } };
  }
  if (recipe.originType === 'theme-palette-derived') {
    const base = svgAssetRecipes.find(value => value.file === recipe.baseFile);
    assert.ok(base && base.originType !== 'theme-palette-derived', 'night variant requires an original trusted design asset');
    if (recipe.paletteRole) assert.deepEqual(recipe, [...svgActionForegroundRecipes, ...svgControlForegroundRecipes]
      .find(value => value.file === recipe.file), 'explicit foreground adapters must use a registered finite recipe');
    const original = await renderRecipe(base);
    const roles = [];
    const scheme = recipe.scheme ?? 'night';
    let content = original.content.replace(/#[0-9a-f]{6}\b/gi, color => {
      const role = recipe.paletteRole ?? `app.icon.${recipe.baseFile === 'reader_page_bookmark_filled' ? 'reader_directory_marker_bookmark_active' : recipe.baseFile}.${color.slice(1).toUpperCase()}`;
      const target = readerAppColor(role, scheme);
      assert.match(target, /^#FF[0-9A-F]{6}$/i, `${role}: SVG adapter preserves original opacity`);
      roles.push(role);
      return `#${target.slice(3)}`;
    });
    if (recipe.namedWhiteStroke) {
      assert.equal(recipe.file, 'reader_control_replace_add_theme_night', 'only the finite replace add foreground uses named white stroke');
      assert.equal((content.match(/stroke="white"/g) ?? []).length, 2, 'replace add contains the two original white strokes');
      const target = readerAppColor(recipe.paletteRole, scheme);
      assert.match(target, /^#FF[0-9A-F]{6}$/i, 'replace add preserves the original opaque stroke');
      content = content.replaceAll('stroke="white"', `stroke="#${target.slice(3)}"`);
      roles.push(recipe.paletteRole);
    }
    if (recipe.strokeWidth !== undefined) {
      assert.equal(recipe.baseFile, 'download_visual_trash', 'only the finite action-sheet trash stroke adapter is approved');
      assert.equal(recipe.strokeWidth, 1.75);
      assert.equal((content.match(/stroke-width="2"/g) ?? []).length, 1, 'Lucide trash has one root stroke-width attribute');
      content = content.replace('stroke-width="2"', `stroke-width="${recipe.strokeWidth}"`);
    }
    const themeSource = await readFile(path.join(ROOT, 'entry/src/main/ets/features/common/ReaderThemeRegistry.ts'), 'utf8');
    return { content, manifest: { ...original.manifest, file: `${recipe.file}.svg`, semanticRole: recipe.semanticRole,
      originType: recipe.originType, baseAsset: `${recipe.baseFile}.svg`, baseSha256: sha256(original.content),
      themeRegistrySha256: sha256(themeSource), transform: { pathMutation: 'none', palette: scheme,
        colorRoles: [...new Set(roles)], ...(recipe.strokeWidth !== undefined ? { strokeWidth: recipe.strokeWidth } : {}) } } };
  }
  if (recipe.originType === 'figma-node-platform-adapted') {
    const original = await renderRecipe({ ...recipe, originType: 'figma-node-export' });
    assert.equal(recipe.file, 'import_refresh');
    // Figma's rotated rectangular export clip cuts the authored arc in the platform rasterizer.
    // Keep all path/paint/viewBox bytes, remove only that export-time clipping group.
    const content = original.content.replace(/<g clip-path="url\(#clip0_2657_819\)">\n/, '').replace('</g>\n', '')
      .replace(/<defs>[\s\S]*?<\/defs>\n/, '');
    assert.deepEqual(content.match(/<path[^>]+>/g), original.content.match(/<path[^>]+>/g));
    return { content, manifest: { ...original.manifest, originType: recipe.originType,
      transform: { pathMutation: 'none', exportClipRemoval: 'clip0_2657_819', viewBox: 'preserved' } } };
  }
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
          pathMutation: recipe.fillInterior ? 'fill-interior-for-explicit-state' : recipe.fillNone ? 'fill-none-on-stroke-paths' : 'none',
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

async function assertRadixSourceCatalogue() {
  const files = (await readdir(RADIX_SOURCE_DIR)).filter(file => file.endsWith('.svg')).sort();
  const expected = Object.values(SVG_RADIX_COMPONENT_SOURCES).map(input => input.sourceFile).sort();
  assert.equal(expected.length, 11, 'Radix input set is exactly the original ten components plus the reviewed directory ArrowLeftIcon');
  assert.deepEqual(files, expected, 'Radix source catalogue must exactly match the pinned eleven components');
  const license = await readFile(path.join(RADIX_SOURCE_DIR, 'LICENSE'), 'utf8');
  assert.equal(sha256(license), SVG_RADIX_PACKAGE.licenseSha256, 'pinned Radix MIT license hash drifted');
  const receipt = await readFile(path.join(RADIX_SOURCE_DIR, 'SOURCE.json'), 'utf8');
  assert.equal(sha256(receipt), SVG_RADIX_PACKAGE.receiptSha256, 'pinned Radix demo extraction receipt hash drifted');
  const provenance = JSON.parse(receipt);
  assert.equal(provenance.package, SVG_RADIX_PACKAGE.name);
  assert.equal(provenance.version, SVG_RADIX_PACKAGE.version);
  assert.equal(provenance.resolved, SVG_RADIX_PACKAGE.url);
  assert.equal(provenance.integrity, SVG_RADIX_PACKAGE.integrity);
  assert.equal(provenance.gitHead, SVG_RADIX_PACKAGE.gitHead);
  assert.equal(provenance.license, SVG_RADIX_PACKAGE.license);
  assert.equal(provenance.licenseSha256, SVG_RADIX_PACKAGE.licenseSha256);
  assert.deepEqual(provenance.components, SVG_RADIX_COMPONENT_SOURCES);
  assert.equal(provenance.directoryArrow.designSource, 'Reader-UI/design/manga-directory/arrow-left.svg');
  assert.equal(provenance.directoryArrow.designSourceSha256, SVG_RADIX_COMPONENT_SOURCES.ArrowLeftIcon.sourceSha256);
  assert.equal(provenance.directoryArrow.provenanceFile, 'ArrowLeftIcon.PROVENANCE.json');
  const arrowReceipt = await readFile(path.join(RADIX_SOURCE_DIR, provenance.directoryArrow.provenanceFile), 'utf8');
  assert.equal(sha256(arrowReceipt), provenance.directoryArrow.provenanceSha256, 'reviewed directory arrow receipt changed');
  const arrowProvenance = JSON.parse(arrowReceipt);
  assert.equal(arrowProvenance.upstream, SVG_RADIX_PACKAGE.name);
  assert.equal(arrowProvenance.version, SVG_RADIX_PACKAGE.version);
  assert.equal(arrowProvenance.license, SVG_RADIX_PACKAGE.license);
  assert.equal(arrowProvenance.export, 'ArrowLeftIcon');
  assert.equal(arrowProvenance.sourceSha256, provenance.installedPackageFiles['index.js']);
  assert.equal(arrowProvenance.svgSha256, SVG_RADIX_COMPONENT_SOURCES.ArrowLeftIcon.sourceSha256);
  for (const input of Object.values(SVG_RADIX_COMPONENT_SOURCES)) {
    assert.equal(sha256(await readFile(path.join(RADIX_SOURCE_DIR, input.sourceFile))), input.sourceSha256,
      `${input.sourceFile}: canonical upstream path/viewBox bytes changed`);
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

export async function syncSvgAssets({ check = false, files } = {}) {
  const selected = files === undefined ? undefined : new Set(files);
  if (selected) assert.ok(selected.size > 0 && selected.size === files.length, 'selected SVG files must be nonempty and unique');
  if (!selected) {
    await assertSourceCatalogue();
    await assertRadixSourceCatalogue();
  }
  const recipeNames = svgAssetRecipes.map((recipe) => recipe.file);
  assert.equal(new Set(recipeNames).size, recipeNames.length, 'SVG provenance recipes must be unique');
  assert.doesNotMatch(JSON.stringify(svgAssetRecipes), BANNED_PROVENANCE,
    'SVG provenance recipes may not contain untrusted origin categories');
  if (selected) for (const file of selected) assert.ok(recipeNames.includes(file), `${file}: selected SVG recipe does not exist`);

  const rendered = [];
  for (const recipe of svgAssetRecipes) {
    if (selected && !selected.has(recipe.file)) continue;
    const item = await renderRecipe(recipe);
    item.manifest.sha256 = sha256(item.content);
    rendered.push({ recipe, ...item });
  }

  const expectedFiles = rendered.map(({ recipe }) => `${recipe.file}.svg`).sort();
  const actualFiles = (await readdir(MEDIA_DIR)).filter((file) => file.endsWith('.svg')).sort();
  if (check && !selected) {
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

  const previousEntries = selected ? JSON.parse(await readFile(MANIFEST_PATH, 'utf8')).entries
    .filter(entry => !selected.has(entry.file.replace(/\.svg$/, ''))) : [];
  const manifest = `${JSON.stringify({
    schemaVersion: SVG_PROVENANCE_SCHEMA_VERSION,
    generatedBy: 'tools/sync-svg-assets.mjs',
    policy: {
      allowedOrigins: ['figma-component-derived', 'figma-node-export', 'figma-make-dom-export', 'figma-make-source-export', 'figma-node-adapted', 'figma-css-primitive', 'figma-node-platform-adapted', 'theme-palette-derived', 'radix-component-derived', 'lucide-component-derived', 'lucide-static-svg-derived', 'user-selected-icon-adapted'],
      unknownAllowed: false,
      manualPathMutationAllowed: false,
      userApprovedPathAdaptations: [SVG_TTS_SELECTED_C.selectionId],
    },
    entries: [...previousEntries, ...rendered.map(({ manifest: entry }) => entry)]
      .sort((left, right) => left.file.localeCompare(right.file)),
  }, null, 2)}\n`;

  if (check) {
    assert.equal(await readFile(MANIFEST_PATH, 'utf8'), manifest,
      'SVG provenance manifest is stale; run node tools/sync-svg-assets.mjs');
  } else {
    await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
    await writeFile(MANIFEST_PATH, manifest);
  }

  await assertProductionReferences(selected ? [...selected] : recipeNames);
  return { count: rendered.length, manifestPath: MANIFEST_PATH };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const filesIndex = process.argv.indexOf('--files');
  const files = filesIndex < 0 ? undefined : process.argv[filesIndex + 1]?.split(',').filter(Boolean);
  if (filesIndex >= 0) assert.ok(files?.length, '--files requires a comma-separated recipe list');
  const result = await syncSvgAssets({ check, files });
  console.log(`${check ? 'verified' : 'synced'} ${result.count} trusted SVG assets`);
}
