import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { MANGA_DIRECTORY_VISUAL as visual, mangaDirectoryColor, mangaDirectoryColumns, mangaDirectoryLabelsFit,
  mangaDirectoryHeaderHeight, mangaDirectoryContentTop, mangaDirectoryFooterStacked, mangaDirectoryQuickFlowGaps,
  mangaDirectoryQuickMinimumListHeight, mangaDirectoryFullFlowFooter } from '../entry/src/main/ets/features/manga/MangaDirectoryVisual.ts';

const ui = new URL('../../Reader-UI/design/manga-directory/', import.meta.url);
const require = createRequire(new URL('../../Reader-UI/package.json', import.meta.url));
const postcss = require('postcss');
assert.equal(require('postcss/package.json').version, '8.5.29', 'CSS parser uses the pinned repaired version');
const spec = JSON.parse(readFileSync(new URL('visual.json', ui)));
const reference = readFileSync(new URL('reference.css', ui), 'utf8');
assert.equal(createHash('sha256').update(reference).digest('hex'), spec.reference.sha256);
const baseline = postcss.parse(reference, { from: new URL('reference.css', ui).pathname, map: { prev: false } });
const generated = postcss.parse(readFileSync(new URL('visual.generated.css', ui), 'utf8'), { from: new URL('visual.generated.css', ui).pathname, map: { prev: false } });
function declaration(ast, selector, property) {
  let value;
  ast.walkRules(selector, rule => { rule.walkDecls(property, decl => { value = decl.value; }); });
  assert.notEqual(value, undefined, `actual CSS contains ${selector} ${property}`);
  return value;
}
for (const [selector, property, field] of [
  ['.chapter-row','min-height','namedMinHeight'], ['.volume-heading','min-height','groupMinHeight'],
  ['.search-field','min-height','searchHeight'], ['.search-field','gap','searchGap'],
  ['.manga-header','height','headerHeight'], ['.manga-header','border-radius','headerRadius'],
  ['.directory-number-grid','gap','gridGap'],
]) assert.equal(`${visual[field]}px`, declaration(baseline, selector, property), 'metric extracted from actual reference declaration');
assert.equal(declaration(baseline,'.search-field input,.search-field > span','font'), "400 13px/20px 'Reader Sans',sans-serif");
assert.equal(declaration(baseline,'.directory-summary strong','font'), "700 24px/34px 'Reader Serif',serif");
assert.equal(declaration(baseline,'.chapter-state','line-height'), `${visual.stateLineHeight}px`);
assert.equal(visual.toolLineHeight, 11 * 1.5, 'browser-resolved inherited tool line-height, independent of generated value');
assert.equal(visual.bodyFontWeight, 400); assert.equal(visual.currentFontWeight, 550); assert.equal(visual.groupFontWeight, 600);
const palettes = [':is(.manga-app,.manga-sheet-body,.adaptive-reader)', ':is(.manga-app,.manga-sheet-body,.adaptive-reader).theme-dark'];
for (const [index, scheme] of ['day','night'].entries()) {
  for (const role of ['paper','surface','soft','ink','muted','faint','green','accent','onGreen','active','line','frame']) {
    const property = `--${({soft:'surface-soft',active:'soft-green',onGreen:'on-green'})[role] ?? role}`;
    assert.equal(mangaDirectoryColor(role, scheme).toLowerCase(), declaration(baseline,palettes[index],property).toLowerCase());
    assert.equal(declaration(generated,palettes[index],property), spec.palette[scheme][role]);
  }
}
assert.equal(mangaDirectoryQuickMinimumListHeight(1), 58, 'a compact list retains the CSS named-row minimum');
assert.ok(Math.abs(mangaDirectoryQuickMinimumListHeight(3.2)-185.6)<1e-9,
  'the small-window viewport can carry the measured169.82vp named row instead of clipping a70.4vp line inside44vp');
assert.equal(mangaDirectoryFullFlowFooter(480,3.2,54,34,183.6),true,
  'a fixed current footer cannot consume the minimum readable catalog band');
assert.equal(mangaDirectoryFullFlowFooter(844,1,54,34,48),false,'ordinary Full keeps its fixed position footer');
assert.equal(mangaDirectoryFullFlowFooter(0,3.2,54,34,183.6),false,'an unmeasured viewport does not publish a guessed layout');
assert.equal(mangaDirectoryHeaderHeight(1),52); assert.equal(mangaDirectoryContentTop(1),80);
assert.ok(Math.abs(mangaDirectoryHeaderHeight(3.2)-97.6)<1e-9);
assert.ok(Math.abs(mangaDirectoryContentTop(3.2)-125.6)<1e-9);
assert.equal(mangaDirectoryColumns('numeric',false,false,1,353,[2,2,2,2]),4);
assert.equal(mangaDirectoryColumns('parts',true,true,3.2,280,[2,2,2]),1);
assert.equal(mangaDirectoryLabelsFit('numeric',3.2,240,[30]),false, 'overlong identifiers preserve full-row fallback');
assert.equal(mangaDirectoryQuickFlowGaps(), 2 * Number.parseFloat(declaration(baseline,'.manga-sheet-body','gap')), 'three CSS body children own two flow gaps');
assert.equal(mangaDirectoryFooterStacked(353,1,'8 / 24 页'),false);
assert.equal(mangaDirectoryFooterStacked(280,3.2,'999 / 999 页'),true, 'title receives an independent full-width row');
assert.equal(mangaDirectoryQuickMinimumListHeight(1),58,'short Quick viewport can contain the baseline named row');
assert.ok(Math.abs(mangaDirectoryQuickMinimumListHeight(3.2)-185.6)<1e-8,'enlarged Quick viewport holds the measured 169.82vp current row');
assert.equal(mangaDirectoryQuickMinimumListHeight(10),330,'paged Quick viewport remains bounded');
assert.equal(mangaDirectoryFullFlowFooter(480,3.2,54,34,183.6),true,'90.8vp fixed clear band cannot hold a 99.4vp line and padding');
assert.equal(mangaDirectoryFullFlowFooter(852,1,54,34,48),false,'default Full footer retains its approved overlay');
assert.equal(mangaDirectoryFullFlowFooter(852,3.2,54,34,183.6),false,'enlarged text in a tall window retains enough fixed clear band');
assert.equal(mangaDirectoryFullFlowFooter(Number.NaN,3.2,54,34,183.6),false,'unknown viewport does not invent an adaptive branch');
execFileSync(process.execPath, ['tools/generate-manga-directory-visual.mjs','--check'], { cwd: new URL('..',import.meta.url), stdio:'pipe' });
const receipt = JSON.parse(readFileSync(new URL('icon-provenance.json',ui)));
const arrow = readFileSync(new URL('arrow-left.svg',ui),'utf8');
assert.equal(receipt.version,'1.3.2'); assert.equal(receipt.license,'MIT');
assert.equal(createHash('sha256').update(arrow).digest('hex'),receipt.svgSha256);
for (const [name, role, scheme] of [['back','ink','day'],['back_theme_night','ink','night'],['previous','accent','day'],['previous_theme_night','accent','night']]) {
  assert.equal(readFileSync(new URL(`../entry/src/main/resources/base/media/manga_directory_${name}.svg`,import.meta.url),'utf8'), arrow.replaceAll('currentColor',spec.palette[scheme][role]));
}
console.log('PASS directory visual generation: frozen CSS declarations, palette, shared responsive helpers, pinned parser, exact upstream icon geometry, output freshness');
