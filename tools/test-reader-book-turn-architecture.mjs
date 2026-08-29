import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');
const local = read('entry/src/main/ets/features/reading/LocalReadingExperience.ets');
const stage = read('entry/src/main/ets/features/reading/ReaderPageTurnStage.ets');
const surface = read('entry/src/main/ets/features/reading/ReaderBookTurnSurface.ets');
const textureBuilder = read('entry/src/main/ets/features/reading/BookTurnTextureBuilder.ets');
const interaction = read('entry/src/main/ets/features/reading/ReaderPageInteractionLayer.ets');
const session = read('entry/src/main/ets/features/reading/BookTurnPresentationSession.ets');
const cmake = read('entry/src/main/cpp/CMakeLists.txt');
const host = read('entry/src/main/cpp/bookturn/bookturn_host.cpp');
const renderer = read('entry/src/main/cpp/bookturn/bookturn_renderer.cpp');
const rendererHeader = read('entry/src/main/cpp/bookturn/bookturn_renderer.h');
const napi = read('entry/src/main/cpp/bookturn/bookturn_napi.cpp');
const control = read('entry/src/main/ets/features/reading/ReaderControlPanel.ets');
const settingsFull = read('entry/src/main/ets/features/reading/ReaderSettingsFullPanel.ets');
const settingsModule = read('entry/src/main/ets/features/reading/ReaderSettingsModulePanel.ets');
const appearanceFull = read('entry/src/main/ets/features/reading/ReaderAppearanceFullPanel.ets');

function method(source, signature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `missing method ${signature}`);
  const brace = source.indexOf('{', start);
  assert.notEqual(brace, -1, `missing method body ${signature}`);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`unterminated method ${signature}`);
}

// The invalidated implementation must stay deleted; no compatibility shell
// may quietly restore its Canvas/native path.
for (const removed of [
  'entry/src/main/cpp/pagecurl',
  'entry/src/main/ets/features/reading/ReaderNativePageCurlSurface.ets',
  'entry/src/main/ets/features/reading/ReaderPageRasterCache.ts',
  'tools/test-reader-pagecurl-host-pipeline.mjs',
  'tools/test-reader-pagecurl-native-core.mjs',
]) {
  assert.equal(existsSync(path.join(root, removed)), false, `${removed} must remain absent`);
}

assert.match(cmake, /add_library\(reader_bookturn_napi SHARED/);
assert.doesNotMatch(cmake, /pagecurl/i);
assert.match(surface, /type:\s*XComponentType\.TEXTURE/);
assert.match(surface, /libraryname:\s*'reader_bookturn_napi'/);
assert.doesNotMatch(surface, /Canvas|onDraw|DrawingRenderingContext/);
assert.match(surface,
  /\.zIndex\(0\)[\s\S]*\.hitTestBehavior\(HitTestMode\.None\)/,
  'the native visual surface must remain below and absent from ArkUI hit testing');
assert.match(interaction, /\.zIndex\(7\)/,
  'the single raw input owner must have explicit composition priority above XComponent');
assert.doesNotMatch(napi, /OnNativeTouch/,
  'the visual-only native component must not register an empty touch consumer');
assert.match(napi,
  /OH_NativeXComponent_Callback g_xcomponentCallbacks \{[\s\S]*OnSurfaceDestroyed,[\s\S]*nullptr,/,
  'the XComponent callback table must leave DispatchTouchEvent unregistered');

const simulationStage = stage.slice(
  stage.indexOf("if (this.pageTurnStyle === 'simulation')"),
  stage.indexOf("} else if", stage.indexOf("if (this.pageTurnStyle === 'simulation')")),
);
assert.equal((simulationStage.match(/ReaderPageTurnSurface\(\{/g) ?? []).length, 1,
  'simulation idle stage must mount only the live page tree');
assert.doesNotMatch(simulationStage, /this\.previousPage|this\.nextPage/);

assert.match(local, /new ComponentContent<BookTurnTextureBuildInput>/);
assert.match(local, /createFromComponent\(/);
assert.match(local, /READER_BOOK_TURN_TEXTURE_MAX_PIXELS = 3_000_000/);
assert.match(local,
  /Math\.sqrt\(READER_BOOK_TURN_TEXTURE_MAX_PIXELS \/ pixelCount\) \* 0\.99/,
  'snapshot scaling must retain rounding headroom below the Native pixel ceiling');
assert.match(local,
  /READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID = 'reader-book-turn-current-page'/);
assert.match(local,
  /currentPageSnapshotId: this\.usesBookTurnSimulation\(\)[\s\S]*READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID/);
assert.match(local,
  /slot === BOOK_TURN_TEXTURE_CURRENT[\s\S]*snapshot\.get\(READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID,[\s\S]*waitUntilRenderFinished: false/,
  'the image-ready mounted current page must be captured directly instead of rebuilt offscreen');
assert.match(stage,
  /currentPageSnapshotId[\s\S]*this\.currentPageSnapshotId\.length > 0[\s\S]*this\.currentPageSnapshotId/,
  'the mounted simulation page must expose the same short stable snapshot ID');
assert.match(local,
  /createFromComponent\(\s*content,\s*0,\s*false,/,
  'offscreen image readiness must not block every page texture indefinitely');
assert.match(local, /waitUntilRenderFinished: false/,
  'offscreen neighbour snapshots must not wait forever on a newly mounted Image node');
assert.match(local,
  /private failBookTurnTextureCapture\([\s\S]*this\.failBookTurnRuntime\(\);[\s\S]*this\.drainPendingManualPageTurn\(\);/,
  'a texture failure must degrade the mounted Native capability without trapping complete input');
assert.doesNotMatch(local, /ReaderBookTurn diagnostic/,
  'temporary VM tracing must not remain in the frame or input path');
assert.doesNotMatch(local, /ReaderInput diagnostic/,
  'temporary raw-input tracing must not remain in the frame path');
assert.match(local,
  /this\.bookTurnMotion !== undefined && this\.bookTurnMotion\.direction !== direction/,
  'a live same-direction drag must remain startable through MOVE and UP settlement');
assert.match(textureBuilder, /chromeSessionVisible:\s*false/);
assert.doesNotMatch(textureBuilder, /ttsHighlight|autoPageHighlight/,
  'dynamic highlight state must not be rasterized into reusable page textures');
assert.doesNotMatch(interaction, /ComponentSnapshot|PixelMap|uploadTexture/,
  'the raw MOVE owner must not touch page rasterization');

assert.match(rendererHeader, /kMeshColumns = 64/);
assert.match(rendererHeader, /kMeshRows = 128/);
assert.match(renderer, /GL_RGB8/);
assert.doesNotMatch(renderer, /gl_FrontFacing/,
  'back-page color cannot switch per triangle or expose the mesh as a jagged boundary');
assert.doesNotMatch(renderer, /vec3\(0\.96,\s*0\.95,\s*0\.92\)/,
  'the folded page must preserve the active page theme instead of replacing it with fixed beige');
assert.match(renderer, /backMix = smoothstep\(HALF_PI - 0\.04, HALF_PI \+ 0\.04, vPhi\)/,
  'front/back material color must cross the analytic fold continuously');
assert.match(renderer, /glBufferData\([\s\S]*GL_STATIC_DRAW/);
const draw = method(renderer, 'bool BookTurnRenderer::Draw(');
assert.doesNotMatch(draw, /eglMakeCurrent|glGetUniformLocation|glGetError|glBufferData|glTexImage2D/,
  'the frame hot path must reuse all context, geometry, texture and uniform resources');
assert.equal((draw.match(/DrawBottom\(/g) ?? []).length, 1);
assert.equal((draw.match(/DrawSheet\(/g) ?? []).length, 1);

assert.match(host, /constexpr auto kFrameInterval = std::chrono::microseconds\(16667\)/);
assert.match(host, /pendingInput_ = input/);
assert.match(host, /pendingInput_\.reset\(\)/);
assert.doesNotMatch(method(host, 'bool BookTurnHost::ProcessSettlementFrame('), /sleep_for|glGetError/);
assert.match(napi, /kMaximumTexturePixels = 3'000'000ULL/);
assert.doesNotMatch(method(napi, 'bool ReadPixelMap('), /for \(/,
  'PixelMap conversion must run on the native render thread, not block ArkTS/NAPI');
assert.match(method(renderer, 'bool CompactRgb8('), /payload\.sourceFormat/);

assert.match(session, /updateInput\([\s\S]*input\.edgeX,[\s\S]*input\.edgeY/);
assert.match(local,
  /BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT[\s\S]*beginPreparedPageTurnPersistence/,
  'durable progress may start only after the native visual endpoint');
assert.match(local,
  /BOOK_TURN_EVENT_SLOTS_COMMITTED[\s\S]*finishSuccessfulPageTurnPresentation/);
assert.match(local, /private pendingManualPageTurnIntent: ReaderPageTapIntent \| undefined/);
assert.match(local, /private pendingPointerSegmentReserved: boolean = false/);
assert.doesNotMatch(local, /pendingManualPageTurn(?:Queue|Directions):/);

// A failed native probe is a session capability result, not permission to
// switch the same gesture to a flat renderer or to wait on a hidden slide.
assert.match(local,
  /private effectivePageTurnStyle\(\): ReaderPageTurnStyle[\s\S]*this\.reduceMotion \|\| \(selected === 'simulation' && this\.bookTurnRuntimeFailed\)[\s\S]*return 'none';/);
assert.match(local, /pageTurnStyle: this\.effectivePageTurnStyle\(\)/);
assert.match(local,
  /private animatePageTurnRollback\(\): void[\s\S]*this\.usesNoAnimationPageTurnRuntime\(\)[\s\S]*this\.finishPageTurnRollback\(generation\);/);
assert.match(local,
  /const noAnimation = this\.usesNoAnimationPageTurnRuntime\(\);[\s\S]*else if \(noAnimation\) \{[\s\S]*beginPreparedPageTurnPersistence/);
assert.match(local, /pageTurnSimulationAvailable: !this\.bookTurnRuntimeFailed/);
assert.match(control, /@Prop pageTurnSimulationAvailable: boolean = true/);
assert.equal((control.match(/pageTurnSimulationAvailable: this\.pageTurnSimulationAvailable/g) ?? []).length, 3,
  'full Appearance and both Settings surfaces must receive the same session capability');
assert.match(settingsFull,
  /option === 'simulation' && !this\.pageTurnSimulationAvailable[\s\S]*return false;/);
assert.match(settingsModule,
  /option === 'simulation' && !this\.pageTurnSimulationAvailable[\s\S]*return false;/);
assert.match(appearanceFull,
  /kind === 'pageTurn' && !this\.pageTurnSimulationAvailable[\s\S]*return \['覆盖', '平移', '滚动', '无动画'\];/);
assert.match(appearanceFull, /仿真当前宿主能力不可用，本会话使用无动画/);

console.log('reader book-turn architecture contract: PASS');
