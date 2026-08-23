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

assert.match(stage, /export class ReaderPageTurnRenderPage/);
for (const field of ['identity', 'chapterTitle', 'showChapterTitle', 'fragments', 'bottomJustifyGap']) {
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
  /const chapterIndex = this\.pageTurnPreparation\?\.origin\.chapter\.chapterIndex \?\?[\s\S]*?this\.chapter\?\.chapterIndex \?\? -1;/,
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
]) {
  assert.match(stage, new RegExp(`@Prop(?:\\s+@\\w+\\([^)]*\\))?\\s+${prop}:`),
    `stage must receive ${prop} from its owner`);
}

assert.match(stage,
  /return this\.pageTurnStyle !== 'none' && this\.pageTurnStyle !== 'scroll' &&\s*Number\.isFinite\(this\.viewportWidth\) && this\.viewportWidth > 0;/,
  'only paged animated styles with a finite positive live width may enter two-page rendering');
assert.match(stage,
  /this\.pageTurnStyle === 'cover'[\s\S]*this\.pageTurnStyle === 'simulation'[\s\S]*this\.pageTurnStyle === 'slide'/,
  'cover, simulation and slide must remain separate presentation strategies');
assert.match(stage,
  /else \{\s*ReaderPageTurnSurface\(\{[\s\S]*?pageIdentity: this\.currentPage\.identity,[\s\S]*?translateX: 0,/,
  'none and missing-target states must keep a single stationary current page');
assert.match(stage,
  /@Component\s+struct ReaderPageTurnSurface[\s\S]*@Prop pageIdentity: string[\s\S]*@Prop chapterTitle: string[\s\S]*@Prop showChapterTitle: boolean[\s\S]*@Prop pageFragments: ReadingSurfacePageFragment\[\][\s\S]*ReadingSurface\(\{/,
  'each page slot must be a real component receiving explicit primitive and array props');
assert.match(stage,
  /ReaderPageTurnSurface\(\{[\s\S]*?pageIdentity: this\.currentPage\.identity,[\s\S]*?chapterTitle: this\.currentPage\.chapterTitle,[\s\S]*?showChapterTitle: this\.currentPage\.showChapterTitle,[\s\S]*?pageFragments: this\.currentPage\.fragments,[\s\S]*?ttsHighlightStart: this\.ttsHighlightStart,[\s\S]*?ttsHighlightEnd: this\.ttsHighlightEnd/,
  'the current page must bind directly into the page-slot component from Stage.build');
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
  /else if \(this\.hasLiveTurnWidth\(\) && this\.pageTurnStyle === 'slide' &&\s*this\.turnDirection === 'next'[\s\S]*?\} else \{/,
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
