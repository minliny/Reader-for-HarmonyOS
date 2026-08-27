import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const stage = readFileSync(
  new URL('../entry/src/main/ets/features/reading/ReaderPageTurnStage.ets', import.meta.url),
  'utf8',
);
const settings = readFileSync(
  new URL('../entry/src/main/ets/features/reading/ReaderSettingsState.ts', import.meta.url),
  'utf8',
);
const experience = readFileSync(
  new URL('../entry/src/main/ets/features/reading/LocalReadingExperience.ets', import.meta.url),
  'utf8',
);
const nativeSurface = readFileSync(
  new URL('../entry/src/main/ets/features/reading/ReaderNativePageCurlSurface.ets', import.meta.url),
  'utf8',
);

assert.match(stage, /export class ReaderPageTurnRenderPage/);
for (const field of [
  'identity',
  'chapterTitle',
  'showChapterTitle',
  'fragments',
  'bottomJustifyGap',
  'chromeTopStartText',
  'chromeTopEndText',
  'chromeBottomStartText',
  'chromeBottomEndText',
  'chromeSessionVisible',
  'chromeSessionWidth',
  'chromeSessionHeight',
  'bodyRasterKey',
  'chromeRasterKey',
  'composedTextureKey',
]) {
  assert.match(stage, new RegExp(`\\b${field}:`), `render page must expose ${field}`);
}
assert.match(stage, /fragments: ReadingSurfacePageFragment\[\]/);
assert.match(stage, /export struct ReaderPageTurnStage/);
assert.match(settings, /pageTransition: 'slide'/,
  'Reader Settings must retain slide as the product default');
assert.match(stage,
  /@Prop pageTurnStyle: ReaderPageTurnStyle = readerPageTurnStyle\(createDefaultReaderSettingsSnapshot\(\)\);/,
  'the presentation stage must not introduce a second page-turn default');
assert.match(experience,
  /ReaderPageTurnStage\(\{[\s\S]*currentPage: this\.currentPageTurnRenderPage\(\),[\s\S]*previousPage: this\.preparedPageTurnRenderPage\('previous'\),[\s\S]*nextPage: this\.preparedPageTurnRenderPage\('next'\),[\s\S]*pageTurnStyle: readerPageTurnStyle\(this\.readerSettingsSnapshot\),[\s\S]*turnDirection: this\.pageTurnDirection,[\s\S]*offsetX: this\.pageTurnOffsetX,[\s\S]*viewportWidth: this\.pageTurnStageViewportWidth\(\),[\s\S]*layout: this\.readingLayout\(\),[\s\S]*appearance: this\.appearanceSnapshot/,
  'LocalReadingExperience must connect its prepared pages and live geometry to the stage');
assert.match(experience,
  /const origin = this\.pageTurnPreparation\?\.origin;[\s\S]*?const chapterIndex = origin\?\.chapter\.chapterIndex \?\? this\.chapter\?\.chapterIndex \?\? -1;/,
  'current-page identity must stay bound to the visible origin during cross-chapter preparation');

for (const prop of [
  'currentPage',
  'previousPage',
  'nextPage',
  'pageTurnStyle',
  'turnDirection',
  'offsetX',
  'viewportWidth',
  'layout',
  'appearance',
  'ttsHighlightStart',
  'ttsHighlightEnd',
  'longPressSelectText',
  'nativeCurlVisible',
  'simulationFallbackActive',
]) {
  assert.match(stage, new RegExp(`@Prop(?:\\s+@\\w+\\([^)]*\\))?\\s+${prop}:`),
    `stage must receive ${prop} from its owner`);
}

assert.match(stage,
  /return \(this\.pageTurnStyle === 'slide' \|\| this\.pageTurnStyle === 'cover'\) &&\s*Number\.isFinite\(this\.viewportWidth\) && this\.viewportWidth > 0;/,
  'only retained slide and cover modes may enter two-page rendering');
assert.doesNotMatch(stage, /rotateY|rotationCenterX|\.rotate\(|PathShape|Canvas\(/,
  'simulation must never regress to the rejected straight fold/ArkUI rotation placeholder');
assert.match(stage,
  /else if \(this\.pageTurnStyle === 'simulation'\)[\s\S]*?this\.previousPage[\s\S]*?this\.nextPage[\s\S]*?this\.currentPage[\s\S]*?ReaderNativePageCurlSurface\(\{/,
  'simulation must keep measured previous/current/next page surfaces available for independent raster capture');
assert.match(stage,
  /simulationPreviousPageX\(\)[\s\S]*simulationNextPageX\(\)[\s\S]*simulationCurrentPageX\(\)[\s\S]*hasSimulationFallbackWidth\(\)/,
  'a cold simulation gesture must retain one flat finger-follow fallback without unmounting native curl');
assert.match(stage, /onPageReady: \(identity: string\): void => this\.onPageReady\(identity\)/,
  'each simulation page must report its mounted component identity to the raster owner');
assert.match(nativeSurface,
  /XComponent\(\{[\s\S]*type: XComponentType\.TEXTURE,[\s\S]*libraryname: 'pagecurl'/,
  'the admitted curl renderer must use the native pagecurl texture surface');
assert.match(nativeSurface, /\.hitTestBehavior\(HitTestMode\.None\)/,
  'the native texture must never steal text selection, links, controls, or edge gestures');
assert.doesNotMatch(nativeSurface, /PanGesture|TapGesture|SwipeGesture|\.gesture\(/,
  'gesture arbitration remains owned by the ArkTS Host');
assert.match(stage,
  /else \{\s*ReaderPageTurnSurface\(\{[\s\S]*?pageIdentity: this\.currentPage\.identity,[\s\S]*?translateX: 0,/,
  'none and missing-target states must keep a single stationary current page');
assert.match(stage,
  /@Component\s+struct ReaderPageTurnSurface[\s\S]*@Prop(?:\s+@\w+\([^)]*\))*\s+pageIdentity: string[\s\S]*@Prop(?:\s+@\w+\([^)]*\))*\s+rasterIdentity: string[\s\S]*@Prop chapterTitle: string[\s\S]*@Prop showChapterTitle: boolean[\s\S]*@Prop pageFragments: ReadingSurfacePageFragment\[\][\s\S]*ReadingSurface\(\{/,
  'each page slot must be a real component receiving explicit primitive and array props');
assert.match(stage, /onRasterIdentityChanged\(\): void[\s\S]*signalPageReadyAfterRenderAdmission\(\)/,
  'page readiness must be re-admitted when same-sized page chrome or body raster content changes');
assert.match(stage,
  /ReaderPageTurnSurface\(\{[\s\S]*?pageIdentity: this\.currentPage\.identity,[\s\S]*?chapterTitle: this\.currentPage\.chapterTitle,[\s\S]*?showChapterTitle: this\.currentPage\.showChapterTitle,[\s\S]*?pageFragments: this\.currentPage\.fragments,[\s\S]*?ttsHighlightStart: this\.ttsHighlightStart,[\s\S]*?ttsHighlightEnd: this\.ttsHighlightEnd/,
  'the current page must bind directly into the page-slot component from Stage.build');
assert.match(stage,
  /chromeBottomStartText: this\.currentPage\.chromeBottomStartText,[\s\S]*?chromeBottomEndText: this\.currentPage\.chromeBottomEndText,[\s\S]*?chromeSessionWidth: this\.currentPage\.chromeSessionWidth/,
  'the page-owned footer must travel with every explicit page slot');
assert.doesNotMatch(stage, /^\s*@Builder\b/m,
  'the stage must not route any page through ArkUI V1 Builder value semantics');
assert.doesNotMatch(stage, /renderPage\(/,
  'the original complex-object Builder bridge must stay removed');

const previousBranch = stage.match(
  /else if \(this\.hasLiveTurnWidth\(\) && this\.pageTurnStyle === 'slide' &&\s*this\.turnDirection === 'previous'[\s\S]*?\} else if/,
)?.[0] ?? '';
assert.ok(previousBranch.indexOf('pageIdentity: this.previousPage.identity,') >= 0);
assert.ok(previousBranch.indexOf('pageIdentity: this.previousPage.identity,') <
  previousBranch.indexOf('pageIdentity: this.currentPage.identity,'),
  'previous destination must paint below the moving current page');
const nextBranch = stage.match(
  /else if \(this\.hasLiveTurnWidth\(\) && this\.pageTurnStyle === 'slide' &&\s*this\.turnDirection === 'next'[\s\S]*?\} else if \(this\.pageTurnStyle === 'simulation'\)/,
)?.[0] ?? '';
assert.ok(nextBranch.indexOf('pageIdentity: this.nextPage.identity,') >= 0);
assert.ok(nextBranch.indexOf('pageIdentity: this.nextPage.identity,') <
  nextBranch.indexOf('pageIdentity: this.currentPage.identity,'),
  'next destination must paint below the moving current page');
assert.match(stage, /return this\.offsetX - this\.viewportWidth;/,
  'the previous page must sit exactly one live viewport to the left');
assert.match(stage, /return this\.viewportWidth \+ this\.offsetX;/,
  'the next page must sit exactly one live viewport to the right');

assert.match(stage,
  /Stack\(\{ alignContent: Alignment\.TopStart \}\)[\s\S]*\.width\('100%'\)\s*\.height\('100%'\)\s*\.clip\(true\);/,
  'the stage must clip a full-size two-page composition');
assert.match(stage, /ReadingSurface\(\{/,
  'the stage must reuse the existing reading presentation component');
assert.doesNotMatch(stage, /\b390\b|\b760\b/,
  'page placement must not use phone or tablet reference widths');
assert.doesNotMatch(stage, /PanGesture|TapGesture|SwipeGesture|\.gesture\(|animateTo|onTurn|requestPageTurn/,
  'the presentation stage must not own input, animation, or business commands');

console.log('reader page-turn presentation stage contract: PASS');
