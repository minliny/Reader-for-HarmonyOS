import { requireToolPackage } from './lib/tool-environment.mjs';
// Finite approved-demo adapter: Chromium parses CSS; Reader only maps named
// properties to platform roles. No parallel CSS parser or layout engine.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const input = resolve(root, 'docs/ui-design/shared-download/demo.html');
const raw = readFileSync(input, 'utf8');
const css = raw.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const fontLink = raw.match(/<link[^>]+href="https:\/\/fonts\.googleapis\.com[^>]+>/)?.[0];
if (!css) throw Error('Approved download demo stylesheet missing');
const sha = createHash('sha256').update(raw).digest('hex');
const storageInput = resolve(root, 'docs/ui-design/shared-download/storage-demo.html');
const storageRaw = readFileSync(storageInput, 'utf8');
const storageCss = storageRaw.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const storageFontLink = storageRaw.match(/<link[^>]+href="https:\/\/fonts\.googleapis\.com[^>]+>/)?.[0];
if (!storageCss) throw Error('Approved storage demo stylesheet missing');
const storageSha = createHash('sha256').update(storageRaw).digest('hex');
const { chromium } = requireToolPackage('playwright', process.env.READER_PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ headless: true });
let rules;
let radioSize;
let overlayColors;
let selectMetrics;
let storageRules;
let storageOverlayColors;
let storageUnknownSummary;
try {
  const page = await browser.newPage();
  await page.setContent((fontLink ?? '') + '<style>' + css + '</style>');
  if (fontLink) {
    await page.evaluate(async () => {
      const faces = await document.fonts.load('13px "Noto Sans SC"', '全部状态下载状态快速选择 Aa');
      await document.fonts.ready;
      if (faces.length === 0 || faces.some(face => face.status !== 'loaded') || !document.fonts.check('13px "Noto Sans SC"', '全部状态')) throw Error('Approved native Select font unavailable');
    });
  }
  rules = await page.evaluate(() => {
    const sheet = Array.from(document.styleSheets).find(item => item.ownerNode.tagName === 'STYLE');
    const visit = (rule, media = '') => {
      if (rule instanceof CSSMediaRule) return Array.from(rule.cssRules).flatMap(child => visit(child, rule.conditionText));
      if (!(rule instanceof CSSStyleRule)) return [];
      const probe = document.createElement('div');
      probe.style.cssText = rule.style.cssText;
      const parent = document.createElement('div');
      parent.className = 'phone';
      const phoneRule = Array.from(sheet.cssRules).find(candidate =>
        candidate instanceof CSSStyleRule && candidate.selectorText === '#shared-reader-download .phone');
      parent.style.cssText = phoneRule.style.cssText;
      parent.append(probe); document.body.append(parent);
      const expanded = Object.fromEntries(['font-size','font-weight','line-height','padding-top','padding-bottom',
        'padding-left','padding-right','margin-top','margin-bottom','border-top-left-radius',
        'border-radius','gap','grid-template-columns'].map(name => [name, rule.style.getPropertyValue(name)]));
      // A var() inside border shorthand intentionally defers its longhands in
      // CSSOM. Ask Chromium for that width; never parse the shorthand ourselves.
      if (rule.style.getPropertyValue('border')) expanded['border-top-width'] = getComputedStyle(probe).borderTopWidth;
      parent.remove();
      return [{
      media,
      selector: rule.selectorText.replaceAll('#shared-reader-download ', ''),
      declarations: Object.fromEntries(Array.from(rule.style).map(name => [name, rule.style.getPropertyValue(name)])),
      expanded,
      }];
    };
    return Array.from(sheet.cssRules).flatMap(rule => visit(rule));
  });
  radioSize = await page.evaluate(() => {
    const root = document.createElement('div'); root.id = 'shared-reader-download';
    const phone = document.createElement('div'); phone.className = 'phone';
    const row = document.createElement('label'); row.className = 'range-choice';
    const radio = document.createElement('input'); radio.type = 'radio';
    row.append(radio); phone.append(row); root.append(phone); document.body.append(root);
    const width = parseFloat(getComputedStyle(radio).width); root.remove(); return width;
  });
  // The native opaque system band must match the browser's authored scrim.
  // Chromium Canvas2D owns alpha compositing and rounding, not a second color engine.
  overlayColors = await page.evaluate(() => {
    const root = document.createElement('div'); root.id = 'shared-reader-download';
    const phone = document.createElement('div'); phone.className = 'phone';
    const scrim = document.createElement('button'); scrim.className = 'scrim';
    phone.append(scrim); root.append(phone); document.body.append(root);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const out = {};
    for (const [name, scheme] of [['day', 'light'], ['night', 'dark']]) {
      phone.style.colorScheme = scheme;
      const style = getComputedStyle(phone), overlay = getComputedStyle(scrim).backgroundColor;
      const composite = base => {
        context.clearRect(0, 0, 1, 1); context.fillStyle = base; context.fillRect(0, 0, 1, 1);
        context.fillStyle = overlay; context.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
        return {r, g, b, a: a / 255};
      };
      out[name] = {background: composite(style.backgroundColor), foreground: composite(style.color)};
    }
    root.remove(); return out;
  });
  selectMetrics = await page.evaluate(() => {
    const root = document.createElement('div'); root.id = 'shared-reader-download';
    const phone = document.createElement('div'); phone.className = 'phone'; root.append(phone); document.body.append(root);
    const measure = className => {
      const row = document.createElement('div'); row.className = className;
      const select = document.createElement('select'); select.append(document.createElement('option'));
      row.append(select); phone.append(row);
      const style = getComputedStyle(select), rect = select.getBoundingClientRect();
      const measured = {height:rect.height, contentHeight:rect.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom), arrowSlot:rect.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)};
      row.remove(); return measured;
    };
    const result = {settings:measure('settings-line'), quick:measure('chapter-toolbar')}; root.remove(); return result;
  });
  const storagePage = await browser.newPage();
  await storagePage.setContent((storageFontLink ?? '') + '<style>' + storageCss + '</style>');
  if (storageFontLink) {
    await storagePage.evaluate(async () => {
      const faces = await document.fonts.load('500 22px "Noto Sans SC"', '已下载内容自动保存 2.0 GB');
      await document.fonts.ready;
      if (faces.length === 0 || faces.some(face => face.status !== 'loaded')) throw Error('Approved storage font unavailable');
    });
  }
  storageRules = await storagePage.evaluate(() => {
    const sheet = Array.from(document.styleSheets).find(item => item.ownerNode.tagName === 'STYLE');
    const visit = (rule, media = '') => {
      if (rule instanceof CSSMediaRule) return Array.from(rule.cssRules).flatMap(child => visit(child, rule.conditionText));
      if (!(rule instanceof CSSStyleRule)) return [];
      const expanded = Object.fromEntries(['font-size','font-weight','line-height','padding-top','padding-bottom',
        'padding-left','padding-right','margin-top','margin-bottom','border-top-left-radius',
        'border-radius','gap'].map(name => [name, rule.style.getPropertyValue(name)]));
      return [{media, selector:rule.selectorText.replaceAll('#reader-storage-demo ', ''),
        declarations:Object.fromEntries(Array.from(rule.style).map(name => [name,rule.style.getPropertyValue(name)])), expanded}];
    };
    return Array.from(sheet.cssRules).flatMap(rule => visit(rule));
  });
  // Measure the approved empty-capacity DOM. Baseline fallback is a browser
  // layout result, not a second text/layout engine or a new design constant.
  storageUnknownSummary = await storagePage.evaluate(async raw => {
    const parsed = new DOMParser().parseFromString(raw, 'text/html');
    const root = parsed.getElementById('reader-storage-demo');
    if (!root) throw Error('Approved storage DOM missing');
    root.querySelector('[data-ui="total"]').textContent = '';
    root.querySelector('[data-ui="clean"]').disabled = true;
    document.body.append(root);
    const faces = await document.fonts.load('400 13px "Noto Sans SC"', '已下载内容');
    await document.fonts.ready;
    if (faces.length === 0 || faces.some(face => face.status !== 'loaded') ||
        !document.fonts.check('400 13px "Noto Sans SC"', '已下载内容')) throw Error('Approved unknown storage label font unavailable');
    const row = root.querySelector('.summary-top').getBoundingClientRect();
    const label = root.querySelector('.summary-top > span').getBoundingClientRect();
    const result = {height:row.height,labelTop:label.top - row.top,
      disabledOpacity:parseFloat(getComputedStyle(root.querySelector('[data-ui="clean"]')).opacity)};
    root.remove(); return result;
  }, storageRaw);
  storageOverlayColors = await storagePage.evaluate(() => {
    const root = document.createElement('div'); root.id = 'reader-storage-demo';
    const phone = document.createElement('div'); phone.className = 'phone';
    const scrim = document.createElement('button'); scrim.className = 'scrim';
    const dialog = document.createElement('div'); dialog.className = 'dialog-layer';
    phone.append(scrim,dialog); root.append(phone); document.body.append(root);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    const out = {};
    for (const [name,scheme] of [['day','light'],['night','dark']]) {
      phone.style.colorScheme = scheme;
      const style = getComputedStyle(phone);
      const overlays = [getComputedStyle(scrim).backgroundColor,getComputedStyle(dialog).backgroundColor];
      const composite = base => {
        context.clearRect(0,0,1,1); context.fillStyle = base; context.fillRect(0,0,1,1);
        for (const overlay of overlays) { context.fillStyle = overlay; context.fillRect(0,0,1,1); }
        const [r,g,b,a] = context.getImageData(0,0,1,1).data;
        return {r,g,b,a:a/255};
      };
      out[name] = {background:composite(style.backgroundColor),foreground:composite(style.color)};
    }
    root.remove(); return out;
  });
} finally { await browser.close(); }
function ruleValue(inputRules, selector, property, media = '') {
  const row = inputRules.find(rule => rule.selector === selector && rule.media === media);
  if (!row) throw Error('Missing approved selector: ' + selector);
  const result = row.declarations[property] || row.expanded[property];
  if (!result) throw Error('Missing approved property: ' + selector + ' / ' + property);
  return result.trim();
}
function value(selector, property, media = '') { return ruleValue(rules, selector, property, media); }
function number(selector, property, media = '') {
  const result = value(selector, property, media);
  if (!/^-?\d+(?:\.\d+)?(?:px|%)?$/.test(result))
    throw Error('Unsupported finite numeric value: ' + selector + ' / ' + property + ' = ' + result);
  return parseFloat(result);
}
const fields = {};
const provenance = {};
for (const [name,n,selector,property] of [
  ['settingsSelectHeight',selectMetrics.settings.height,'.settings-line select','computed closed height'],
  ['chapterQuickHeight',selectMetrics.quick.height,'.chapter-toolbar select','computed closed height'],
  ['chapterQuickLineHeight',selectMetrics.quick.contentHeight,'.chapter-toolbar select','Chromium closed content line box excluding authored padding'],
  ['chapterQuickArrowSlot',selectMetrics.quick.arrowSlot,'.chapter-toolbar select','Chromium native empty-select slot excluding authored padding'],
  ['selectArrowSlot',selectMetrics.settings.arrowSlot,'.settings-line select','Chromium native empty-select slot excluding authored padding'],
]) {
  fields[name] = n; provenance[name] = {selector,property,authored:'Chromium computed native Select with inherited .phone font and authored padding'};
}
function field(name, selector, property, media = '') {
  fields[name] = number(selector, property, media);
  provenance[name] = { selector, property, ...(media ? {media} : {}), authored: value(selector, property, media) };
}
const map = [
  ['bodyFontSize','.phone','font-size'],['bodyLineHeight','.phone','line-height'],
  ['fontRegularWeight','.phone','font-weight'],['fontMediumWeight','.tabs button[aria-selected="true"]','font-weight'],
  ['fontSemiboldWeight','.dialog h3','font-weight'],['fontBoldWeight','.book-title','font-weight'],
  ['controlFontSize','.app-button','font-size'],['metaFontSize','.book-progress','font-size'],
  ['tagFontSize','.tags','font-size'],['tagLineHeight','.tags','line-height'],
  ['bookTitleFontSize','.book-title','font-size'],['bookTitleLineHeight','.book-title','line-height'],
  ['headerTitleFontSize','.header h2','font-size'],['headerTitleLineHeight','.header h2','line-height'],
  ['coverFontSize','.cover','font-size'],['coverLineHeight','.cover','line-height'],
  ['sheetTitleFontSize','.sheet-title strong','font-size'],['sheetTitleLineHeight','.sheet-title strong','line-height'],
  ['tabFontSize','.tabs button','font-size'],['searchFontSize','.phone','font-size'],
  ['listToolsFontSize','.list-tools button','font-size'],['sourceFontSize','.source','font-size'],['sourceLineHeight','.source','line-height'],
  ['storageFontSize','.storage-copy','font-size'],['storageLineHeight','.storage-copy','line-height'],
  ['emptyTitleFontSize','.empty strong','font-size'],['confirmTitleFontSize','.dialog h3','font-size'],
  ['confirmTitleLineHeight','.dialog h3','line-height'],['confirmBodyFontSize','.dialog p','font-size'],['confirmBodyLineHeight','.dialog p','line-height'],
  ['settingsHintFontSize','.settings-hint','font-size'],['settingsHintLineHeight','.settings-hint','line-height'],
  ['rangeHintFontSize','.range-choice small','font-size'],['rangeHintLineHeight','.range-choice small','line-height'],
  ['headerTop','.header','top'],['statusBarHeight','.statusbar','height'],['headerSide','.header','left'],
  ['headerHeight','.header','height'],['headerRadius','.header','border-radius'],['headerPadding','.header','padding-top'],
  ['headerIconWidth','.icon-action','width'],['headerIconHeight','.icon-action','height'],
  ['headerTextWidth','.header-text','width'],['contentTop','.scroll','padding-top'],
  ['contentSide','.scroll','padding-left'],['contentBottom','.scroll','padding-bottom'],
  ['tabsGap','.tabs','gap'],['tabsPadding','.tabs','padding-top'],['tabsRadius','.tabs','border-radius'],
  ['tabsTop','.tabs','margin-top'],['tabsBottom','.tabs','margin-bottom'],
  ['tabHeight','.tabs button','min-height'],['tabRadius','.tabs button','border-radius'],
  ['tabPaddingX','.tabs button','padding-left'],['tabPaddingY','.tabs button','padding-top'],
  ['searchHeight','.searchbar','min-height'],['searchRadius','.searchbar','border-radius'],
  ['searchGap','.searchbar','gap'],['searchPaddingX','.searchbar','padding-left'],
  ['searchIconSize','.searchbar > svg','width'],['searchClearWidth','.searchbar .icon-action','width'],
  ['listToolsGap','.list-tools','gap'],['listToolsHeight','.list-tools','min-height'],
  ['listToolsBottom','.list-tools','margin-bottom'],['listToolHeight','.list-tools button','min-height'],
  ['listToolIconSize','.list-tools svg','width'],['listToolIconGap','.list-tools button','gap'],
  ['sortPairGap','.sort-pair','gap'],['sortWidth','.sort-pair .direction-toggle','width'],
  ['sortIconSize','.direction-toggle svg','width'],['bookPaddingY','.book','padding-top'],
  ['coverWidth','.cover','width'],['coverHeight','.cover','min-height'],['coverRadius','.cover','border-radius'],
  ['coverPadding','.cover','padding-top'],['bookGap','.book-summary','gap'],['bookMinHeight','.book-summary','min-height'],
  ['bookTopHeight','.book-top','min-height'],['bookTopGap','.book-top','gap'],
  ['tagPaddingX','.tags span','padding-left'],['tagRadius','.tags span','border-radius'],
  ['sourceTop','.source','margin-top'],['progressTop','.book-progress','margin-top'],['progressGap','.book-progress','gap'],
  ['statusWidth','.status-action','width'],['statusHeight','.status-action','height'],['statusRadius','.status-action','border-radius'],
  ['statusPaddingX','.status-action','padding-left'],['statusIconSize','.status-action svg','width'],['statusGap','.status-action','column-gap'],
  ['moreWidth','.book-more','width'],['moreHeight','.book-more','height'],['moreIconSize','.book-more svg','width'],
  ['progressHeight','.progress-track','height'],['progressRadius','.progress-track','border-radius'],
  ['chapterHeight','.chapter-row','min-height'],['chapterGap','.chapter-row','gap'],
  ['chapterTailGap','.chapter-tail','gap'],['chapterMoreWidth','.chapter-tail .icon-action','width'],
  ['chapterMoreHeight','.icon-action','height'],
  ['chapterPaddingX','.chapter-row','padding-left'],['chapterPaddingY','.chapter-row','padding-top'],
  ['chapterActionHeight','.small-action','min-height'],['chapterActionRadius','.small-action','border-radius'],
  ['chapterActionPaddingX','.small-action','padding-left'],['chapterActionPaddingY','.small-action','padding-top'],
  ['chapterTitleFontSize','.chapter-title','font-size'],['chapterPanelTop','.chapter-panel','margin-top'],
  ['chapterQuickFontSize','.chapter-toolbar','font-size'],
  ['chapterToolbarTop','.chapter-toolbar','padding-top'],['chapterToolbarBottom','.chapter-toolbar','padding-bottom'],
  ['chapterToolbarGap','.chapter-toolbar','gap'],['chapterGroupHeight','.group-title','min-height'],
  ['chapterGroupPadding','.group-title','padding-top'],['chapterGroupTop','.group-title','margin-top'],
  ['chapterCheckSize','.chapter-row input, .book-check','width'],
  ['dockSide','.storage','left'],['dockBottom','.storage','bottom'],['dockRadius','.storage','border-radius'],
  ['dockPaddingX','.storage','padding-left'],['dockPaddingY','.storage','padding-top'],['dockGap','.storage','gap'],
  ['dockIconWidth','.storage .icon-action','width'],['selectionPadding','.manage-dock','padding-top'],
  ['selectionSummaryGap','.manage-summary','gap'],['selectionSummaryBottom','.manage-summary','margin-bottom'],
  ['actionGap','.action-row','gap'],['buttonHeight','.app-button','min-height'],
  ['buttonPaddingX','.app-button','padding-left'],['buttonPaddingY','.app-button','padding-top'],['buttonRadius','.app-button','border-radius'],
  ['disabledOpacity','.phone button:disabled','opacity'],
  ['emptyTop','.empty','padding-top'],['emptyBottom','.empty','padding-bottom'],['emptySide','.empty','padding-left'],
  ['emptyGap','.empty','gap'],['emptyIconSize','.empty > svg','width'],
  ['sheetMaxPercent','.sheet','max-height'],['sheetRadius','.sheet','border-top-left-radius'],
  ['gripWidth','.grip','width'],['gripHeight','.grip','height'],['gripRadius','.grip','border-radius'],
  ['gripTop','.grip','margin-top'],['gripBottom','.grip','margin-bottom'],
  ['sheetTitleHeight','.sheet-title','min-height'],['sheetTitleLeft','.sheet-title','padding-left'],['sheetTitleRight','.sheet-title','padding-right'],
  ['sheetBodySide','.sheet-body','padding-left'],['sheetBodyBottom','.sheet-body','padding-bottom'],
  ['sheetFooterTop','.sheet-footer','padding-top'],['sheetFooterSide','.sheet-footer','padding-left'],['sheetFooterBottom','.sheet-footer','padding-bottom'],
  ['rangeHeight','.range-choice','min-height'],['rangePaddingY','.range-choice','padding-top'],['rangeGap','.range-choice','gap'],
  ['settingsHeight','.settings-line','min-height'],['settingsGap','.settings-line','gap'],['settingsHintMargin','.settings-hint','margin-top'],
  ['dialogOuterSide','.dialog-layer','padding-left'],['dialogRadius','.dialog','border-radius'],
  ['dialogTop','.dialog','padding-top'],['dialogSide','.dialog','padding-left'],['dialogBottom','.dialog','padding-bottom'],
  ['dialogTitleBottom','.dialog h3','margin-bottom'],['dialogBodyBottom','.dialog p','margin-bottom'],
  ['borderWidth','.header','border-top-width'],['titleChevronSize','.book-title svg','width'],
  ['searchPaddingY','.searchbar input','padding-top'],['toolPaddingY','.list-tools button','padding-top'],
  ['settingsSelectMaxWidth','.settings-line select','max-width'],['settingsSelectPadding','.settings-line select','padding-top'],
  ['settingsSelectRadius','.settings-line select','border-radius'],
  ['rangeSelectPadding','.range-book select','padding-top'],['rangeSelectRadius','.range-book select','border-radius'],
  ['rangeBookBottom','.range-book','margin-bottom'],['rangeSelectionTop','.range-selection','margin-top'],
  ['touchTarget','.status-action::after, .book-more::after','height','(pointer: coarse)'],
  ['iconSize','.phone svg','width'],['chapterMenuHeight','.chapter-menu button','min-height'],
  ['chapterMenuPaddingY','.chapter-menu button','padding-top'],['textActionHeight','.text-action','min-height'],
  ['textActionPaddingY','.text-action','padding-top'],['chapterToolbarSelectMaxWidth','.chapter-toolbar select','max-width'],
];
for (const row of map) field(...row);
if (!Number.isFinite(radioSize) || radioSize <= 0) throw Error('HTML radio box unavailable');
fields.radioSize = radioSize;
provenance.radioSize = {selector:'.range-choice input',property:'width',browserDefault:true,
  boundary:'Measured Chromium HTML radio box; native ring rasterization remains platform-specific.'};
// These roles deliberately inherit the authored base line box.
for (const name of ['controlLineHeight','metaLineHeight','tabLineHeight','searchLineHeight',
  'listToolsLineHeight','emptyTitleLineHeight','chapterTitleLineHeight']) {
  fields[name] = fields.bodyLineHeight;
  provenance[name] = { selector: '.phone', property: 'line-height', inherited: true };
}
fields.headerTopGap = fields.headerTop - fields.statusBarHeight;
provenance.headerTopGap = { derived: 'headerTop - statusBarHeight' };
const slots = value('.header', 'grid-template-columns').split(/\s+/);
fields.headerSlotWidth = parseFloat(slots[0]);
provenance.headerSlotWidth = { selector: '.header', property: 'grid-template-columns' };
for (const [prefix,selector] of [['header','.header'],['tab','.tabs button[aria-selected="true"]'],['sheet','.sheet']]) {
  const shadow = value(selector, 'box-shadow').match(/^(-?\d+(?:\.\d+)?)(?:px)?\s+(-?\d+(?:\.\d+)?)(?:px)?\s+(\d+(?:\.\d+)?)(?:px)?\s+var\(--shadow\)$/);
  if (!shadow) throw Error('Unsupported approved shadow: ' + value(selector, 'box-shadow'));
  for (const [suffix,index] of [['ShadowX',1],['ShadowY',2],['ShadowRadius',3]]) {
    fields[prefix + suffix] = Number(shadow[index]);
    provenance[prefix + suffix] = {selector,property:'box-shadow',authored:value(selector,'box-shadow')};
  }
}
// The storage sheet has its own approved v2 source. Retain the original 207
// download-page fields unchanged and add only its finite named constraints.
const storageProvenance = {};
const storageMap = [
  ['storageBodyTop','.sheet-body','padding-top'],['storageBodySide','.sheet-body','padding-left'],
  ['storageBodyBottom','.sheet-body','padding-bottom'],['storageSummaryGap','.summary-top','gap'],
  ['storageTotalFontSize','.total','font-size'],['storageTotalLineHeight','.total','line-height'],
  ['storageTotalWeight','.total','font-weight'],['storageTotalMinHeight','.total','min-height'],
  ['storageValueFontSize','.breakdown dd','font-size'],['storageValueLineHeight','.breakdown dd','line-height'],
  ['storageValueWeight','.breakdown dd','font-weight'],['storageValueMinHeight','.breakdown dd','min-height'],
  ['storageBreakdownTop','.breakdown','margin-top'],['storageBreakdownGap','.breakdown','gap'],
  ['storageRowGap','.breakdown > div','gap'],['storageCaptionGap','.breakdown dt','gap'],
  ['storageLabelFontSize','.breakdown dt','font-size'],['storageLabelLineHeight','.breakdown dt','line-height'],
  ['storageCaptionFontSize','.breakdown dt small','font-size'],['storageCaptionLineHeight','.breakdown dt small','line-height'],
  ['storageFreeTop','.free-row','margin-top'],['storageFreeBottom','.free-row','margin-bottom'],
  ['storageFreeGap','.free-row','gap'],['storageFreeFontSize','.free-row','font-size'],
  ['storageSettingsTitleTop','.settings-title','margin-top'],
  ['storageSettingsTitleFontSize','.settings-title','font-size'],['storageSettingsTitleLineHeight','.settings-title','line-height'],
  ['storageSettingsHeight','.settings-row','min-height'],['storageSettingsGap','.settings-row','gap'],
  ['storageSelectWidth','.settings-row select','width'],['storageSelectHeight','.settings-row select','min-height'],
  ['storageSelectPadding','.settings-row select','padding-top'],['storageSelectRadius','.settings-row select','border-radius'],
  ['storageFooterTop','.sheet-footer','padding-top'],['storageFooterSide','.sheet-footer','padding-left'],
  ['storageFooterBottom','.sheet-footer','padding-bottom'],['storageActionGap','.clean-button','gap'],
  ['storageActionIconSize','.clean-button svg','width'],['storageActionMinHeight','.clean-button','min-height'],
  ['storageActionPaddingY','.clean-button','padding-top'],['storageActionPaddingX','.clean-button','padding-left'],
  ['storageActionRadius','.clean-button','border-radius'],['storageActionFontSize','.clean-button','font-size'],
  ['storageActionDisabledOpacity','.clean-button:disabled','opacity'],['storageFeedbackTop','.feedback','margin-top'],
  ['storageFeedbackFontSize','.feedback','font-size'],['storageFeedbackLineHeight','.feedback','line-height'],
];
for (const [name,selector,property] of storageMap) {
  const authored = ruleValue(storageRules,selector,property);
  if (!/^-?\d+(?:\.\d+)?(?:px|%)?$/.test(authored)) throw Error('Unsupported finite storage value: ' + selector + ' / ' + property + ' = ' + authored);
  fields[name] = parseFloat(authored);
  storageProvenance[name] = {source:'storage-demo.html',sourceSha256:storageSha,selector,property,authored};
  provenance[name] = storageProvenance[name];
}
// The approved .phone button:disabled selector outranks the clean-button rule.
// Consume Chromium's full cascade, not the lower-specificity declaration.
if (!Number.isFinite(storageUnknownSummary.disabledOpacity) || storageUnknownSummary.disabledOpacity < 0 ||
    storageUnknownSummary.disabledOpacity > 1) throw Error('Invalid approved disabled storage opacity');
fields.storageActionDisabledOpacity = storageUnknownSummary.disabledOpacity;
storageProvenance.storageActionDisabledOpacity = {source:'storage-demo.html',sourceSha256:storageSha,
  selector:'.clean-button:disabled',property:'opacity',measured:storageUnknownSummary.disabledOpacity,
  derived:'Chromium computed style of approved disabled button with the complete CSS cascade'};
provenance.storageActionDisabledOpacity = storageProvenance.storageActionDisabledOpacity;
fields.storageFreeLineHeight = fields.bodyLineHeight;
storageProvenance.storageFreeLineHeight = {source:'storage-demo.html',sourceSha256:storageSha,
  selector:'.phone',property:'line-height',authored:ruleValue(storageRules,'.phone','line-height'),inherited:true};
provenance.storageFreeLineHeight = storageProvenance.storageFreeLineHeight;
for (const [name, property] of [['storageUnknownSummaryMinHeight','height'],['storageUnknownSummaryLabelTop','labelTop']]) {
  const measured = storageUnknownSummary[property];
  if (!Number.isFinite(measured) || measured < 0) throw Error('Invalid approved unknown summary measurement: ' + property);
  fields[name] = measured;
  storageProvenance[name] = {source:'storage-demo.html',sourceSha256:storageSha,selector:'.summary-top',
    property,measured,derived:'Chromium DOM with approved font and empty [data-ui="total"]'};
  provenance[name] = storageProvenance[name];
}
if (Number(ruleValue(storageRules,'.phone','line-height').replace('px','')) !== fields.bodyLineHeight ||
    Number(ruleValue(storageRules,'.phone','font-size').replace('px','')) !== fields.bodyFontSize ||
    Number(ruleValue(storageRules,'.phone','font-weight')) !== fields.fontRegularWeight)
  throw Error('Storage inherited body role no longer matches the shared download role');
const storageStructure = Object.fromEntries(['.summary-top','.total','.breakdown','.breakdown > div','.breakdown dt',
  '.breakdown dd','.free-row','.settings-row','.settings-row select','.clean-button','.clean-button:disabled','.feedback']
  .map(selector => [selector,storageRules.find(rule=>rule.selector===selector && rule.media==='').declarations]));
const colorNames = ['paper','surface','ink','muted','line','soft','green','greenInk','softGreen','danger','scrim','shadow'];
const colorKeys = {greenInk:'green-ink',softGreen:'soft-green'};
const palettes = {};
for (const name of colorNames) {
  const authored = value('.phone', '--' + (colorKeys[name] || name));
  if (authored !== ruleValue(storageRules,'.phone','--' + (colorKeys[name] || name)))
    throw Error('Storage palette must use the existing shared download role: ' + name);
  const match = authored.match(/^light-dark\((#[0-9a-f]{6,8}),\s*(#[0-9a-f]{6,8})\)$/i);
  if (!match) throw Error('Unsupported finite demo palette: ' + authored);
  function rgba(hex) { return { r:parseInt(hex.slice(1,3),16), g:parseInt(hex.slice(3,5),16),
    b:parseInt(hex.slice(5,7),16), a:hex.length === 9 ? parseInt(hex.slice(7,9),16)/255 : 1 }; }
  palettes[name] = { day:rgba(match[1]), night:rgba(match[2]),
    provenance:'user-approved shared download demo; SHA256 ' + sha + '; CSS --' + (colorKeys[name] || name) };
}
for (const [name, role] of [['overlayChrome','background'], ['overlayChromeInk','foreground']]) {
  colorNames.push(name);
  palettes[name] = {day:overlayColors.day[role], night:overlayColors.night[role],
    provenance:'user-approved shared download demo; SHA256 ' + sha + '; Chromium Canvas2D --scrim over --' + (role === 'background' ? 'paper' : 'ink')};
}
for (const [name,role] of [['overlayChromeDouble','background'],['overlayChromeDoubleInk','foreground']]) {
  colorNames.push(name);
  palettes[name] = {day:storageOverlayColors.day[role],night:storageOverlayColors.night[role],
    provenance:'user-approved storage management v2 demo; SHA256 ' + storageSha +
      '; Chromium Canvas2D .scrim and .dialog-layer over --' + (role==='background'?'paper':'ink')};
}
const output = resolve(root, 'entry/src/main/ets/features/common/SharedDownloadVisualSpec.ts');
let code = '// Generated from approved docs/ui-design/shared-download/demo.html by Chromium CSSOM.\n' +
  '// Storage v2 constraints come from approved storage-demo.html; each source SHA is independent.\n' +
  '// Do not edit values. This finite adapter is not a general HTML/CSS engine.\n' +
  'import { readerAppColor } from \'./ReaderThemeRegistry.ts\';\n' +
  'export const SHARED_DOWNLOAD_DEMO_SHA256 = ' + JSON.stringify(sha) + ';\n' +
  'export const SHARED_DOWNLOAD_STORAGE_DEMO_SHA256 = ' + JSON.stringify(storageSha) + ';\n' +
  'export class SharedDownloadVisualSpec {\n';
for (const [name, n] of Object.entries(fields)) code += '  readonly ' + name + ': number = ' + n + ';\n';
code += '}\nexport const DOWNLOAD_VISUAL = new SharedDownloadVisualSpec();\n' +
  'export type DownloadVisualColorRole = ' + colorNames.map(JSON.stringify).join(' | ') + ';\n' +
  'export function downloadVisualColor(role: DownloadVisualColorRole, scheme: string): string {\n';
for (const name of colorNames) code += '  if (role === ' + JSON.stringify(name) + ') return readerAppColor(' +
  JSON.stringify('TOK_DOWNLOAD_' + name.replace(/[A-Z]/g,c=>'_' + c).toUpperCase()) + ', scheme);\n';
code += '  return readerAppColor(\'TOK_DOWNLOAD_INK\', scheme);\n}\n' +
  'export class SharedDownloadOverlayChromeSpec {\n' +
  '  underlayColor: string; contentColor: string; navigationUnderlayColor: string; navigationContentColor: string; tone: \'light\' | \'dark\';\n' +
  '  constructor(scheme: string, sheetVisible: boolean, layerCount: number = 1) {\n' +
  '    this.underlayColor = downloadVisualColor(layerCount === 2 ? \'overlayChromeDouble\' : \'overlayChrome\', scheme);\n' +
  '    this.contentColor = downloadVisualColor(layerCount === 2 ? \'overlayChromeDoubleInk\' : \'overlayChromeInk\', scheme);\n' +
  '    this.navigationUnderlayColor = sheetVisible ? downloadVisualColor(\'surface\', scheme) : this.underlayColor;\n' +
  '    this.navigationContentColor = sheetVisible ? downloadVisualColor(\'ink\', scheme) : this.contentColor;\n' +
  '    this.tone = scheme === \'night\' ? \'light\' : \'dark\';\n' +
  '  }\n}\n' +
  'export function downloadOverlayChromeStyle(scheme: string, sheetVisible: boolean, layerCount: number = 1): SharedDownloadOverlayChromeSpec {\n' +
  '  return new SharedDownloadOverlayChromeSpec(scheme, sheetVisible, layerCount);\n}\n' +
  'export class SharedDownloadInsets {\n  left: number; right: number;\n' +
  '  constructor(left: number, right: number) { this.left = left; this.right = right; }\n}\n' +
  'export function sharedDownloadContentInsets(safeLeft: number, safeRight: number): SharedDownloadInsets {\n' +
  '  return new SharedDownloadInsets(Math.max(DOWNLOAD_VISUAL.contentSide, Number.isFinite(safeLeft) ? safeLeft : 0), Math.max(DOWNLOAD_VISUAL.contentSide, Number.isFinite(safeRight) ? safeRight : 0));\n}\n' +
  'export function sharedDownloadSheetMaxHeight(windowHeight: number, topInset: number, bottomInset: number): number {\n' +
  '  const usable = Math.max(0, windowHeight - Math.max(0, topInset) - Math.max(0, bottomInset));\n' +
  '  return Math.min(Math.max(0, windowHeight) * DOWNLOAD_VISUAL.sheetMaxPercent / 100, usable);\n}\n' +
  'export class SharedDownloadScaledText {\n  fontSize: number; lineHeight: number;\n' +
  '  constructor(fontSize: number, lineHeight: number) { this.fontSize = fontSize; this.lineHeight = lineHeight; }\n}\n' +
  'export function sharedDownloadTextScale(fontSize: number, lineHeight: number, fontScale: number): SharedDownloadScaledText {\n' +
  '  const scale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;\n' +
  '  return new SharedDownloadScaledText(fontSize * scale, lineHeight * scale);\n}\n';
const manifestPath = resolve(root,'docs/ui-design/shared-download/visual-spec.json');
const manifest = { schemaVersion:1, source:'demo.html', sourceSha256:sha,
  storageSource:'storage-demo.html',storageSourceSha256:storageSha,storageProvenance,storageStructure,
  extractor:'Chromium CSSOM via existing Playwright', fields, provenance, palettes,
  ruleBoundary:'Original authored CSS, including min/max and inherited line boxes; platform layout tree consumes named constraints.',
  nativeVisualVerification:'OPEN' };
const registryPath = resolve(root,'../Reader-UI/theme/registry.json');
const registry = JSON.parse(readFileSync(registryPath,'utf8'));
for (const name of colorNames) registry.appRoles['TOK_DOWNLOAD_' + name.replace(/[A-Z]/g,c=>'_' + c).toUpperCase()] = palettes[name];
const registryCode = JSON.stringify(registry,null,2) + '\n';
const outputs = [[output,code],[manifestPath,JSON.stringify(manifest,null,2)+'\n'],[registryPath,registryCode]];
for (const [path, content] of outputs) {
  if (process.argv.includes('--check')) {
    if (readFileSync(path,'utf8') !== content) throw Error('Download visual input stale: ' + path);
  } else writeFileSync(path,content);
}
console.log('Approved download visual definitions: ' + Object.keys(fields).length + ' CSS-derived fields and ' + colorNames.length + ' day/night roles; SHA256 ' + sha);
