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
const nativeTypes = read('entry/src/main/cpp/types/libreader_bookturn_napi/Index.d.ts');
const cmake = read('entry/src/main/cpp/CMakeLists.txt');
const host = read('entry/src/main/cpp/bookturn/bookturn_host.cpp');
const hostHeader = read('entry/src/main/cpp/bookturn/bookturn_host.h');
const motionHeader = read('entry/src/main/cpp/bookturn/bookturn_motion.h');
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
assert.match(surface, /@Prop surfaceOpacity: number = 1;/);
assert.match(surface, /\.opacity\(this\.surfaceOpacity\)/,
  'Native visibility must use an immediate opacity gate without rebuilding XComponent');
assert.match(session, /clearSurface\(generation: number\)/);
assert.match(nativeTypes, /export const clearSurface:/);
assert.match(interaction, /\.zIndex\(7\)/,
  'the single raw input owner must have explicit composition priority above XComponent');
assert.doesNotMatch(napi, /OnNativeTouch/,
  'the visual-only native component must not register an empty touch consumer');
assert.match(napi,
  /OH_NativeXComponent_Callback g_xcomponentCallbacks \{[\s\S]*OnSurfaceDestroyed,[\s\S]*nullptr,/,
  'the XComponent callback table must leave DispatchTouchEvent unregistered');

assert.equal((method(stage.slice(stage.indexOf('export struct ReaderPageTurnStage')), 'build() {').match(/ReaderPageTurnSurface\(\{/g) ?? []).length, 2,
  'two physical slots stay mounted across idle, drag and promotion');
// Non-flat reserve retention, cold-provider avoidance and acknowledgement
// ownership are exercised against the production methods in the stage test.
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
  /slot === BOOK_TURN_TEXTURE_CURRENT[\s\S]*snapshot\.get\(`\$\{READER_BOOK_TURN_CURRENT_PAGE_SNAPSHOT_ID\}-\$\{this\.pageTurnCurrentSlot\}`,[\s\S]*waitUntilRenderFinished: true/,
  'text-only current pages reuse the physical mounted snapshot; image-bearing pages use decoder-checked capture');
assert.match(stage,
  /staticSnapshotId: this\.slotSnapshotId\('a'\)[\s\S]*staticSnapshotId: this\.slotSnapshotId\('b'\)/,
  'the mounted static content, excluding live highlights, exposes a unique stable snapshot ID per physical slot');
assert.match(local, /captureDecodedBookTurnPage\(content, generation\)/,
  'offscreen captures share bounded decoder-ready admission, with production cold/failure/stale tests');
assert.match(local, /createFromComponent\(\s*content, delays\[attempt\], true,[\s\S]*?waitUntilRenderFinished: true/,
  'image decoding and painting must both complete before a texture may publish');
assert.match(local,
  /private async captureBookTurnTexture\([\s\S]*generation !== this\.bookTurnTextureCaptureGeneration[\s\S]*this\.pageTurnInputPhase\(\) !== 'idle'[\s\S]*bookTurnCapturedIdentity/,
  'a stale capture must be rejected before ComponentSnapshot allocates or renders a page tree');
assert.match(local,
  /previousPhase === 'idle' && state\.phase !== 'idle'[\s\S]*this\.bookTurnTextureCaptureGeneration \+= 1/,
  'the first gesture-owned frame must invalidate any idle snapshot already in flight');
assert.match(local,
  /private failBookTurnTextureCapture\([\s\S]*this\.failBookTurnRuntime\(\);[\s\S]*this\.drainRapidPageTurn\(\);/,
  'a texture failure must degrade the mounted Native capability without trapping complete input');
assert.doesNotMatch(local, /ReaderBookTurn diagnostic/,
  'temporary VM tracing must not remain in the frame or input path');
assert.doesNotMatch(local, /ReaderInput diagnostic/,
  'temporary raw-input tracing must not remain in the frame path');
assert.match(local,
  /private shouldMountBookTurnSurface\(\): boolean[\s\S]*pageTransition === 'simulation'/,
  'a transient native capability failure must not change the selected surface lifecycle');
assert.match(local, /if \(this\.shouldMountBookTurnSurface\(\)\)/,
  'the selected simulation XComponent must stay mounted through a transient runtime failure');
assert.match(local,
  /surfaceOpacity: this\.usesBookTurnSimulation\(\) \? this\.bookTurnSurfaceOpacity : 0/,
  'a failed simulation surface must remain mounted but hidden while the static page path is active');
// Native lifecycle notifications must not use a dead revision counter as an
// ArkUI invalidation signal.  The counter was never consumed by build(), yet
// its @State increment rebuilt the entire ReadingExperience (including the
// XComponent) for every READY/TEXTURE/PRESENTED event and exposed a black
// compositor frame during unrelated control-bar motion.
assert.doesNotMatch(local, /@State\s+private\s+bookTurnNativeRevision/,
  'native event diagnostics must not be an unused root @State');
assert.doesNotMatch(method(local, 'private onBookTurnNativeEvent('),
  /bookTurnNativeRevision\s*=/,
  'native event dispatch must not increment an unused root invalidation counter');
// Root-local protocol/bookkeeping markers must not become ArkUI invalidation
// sources. They are read by native/settle callbacks or synchronous error/timer
// code only; the render tree is driven by the explicit reactive allowlist.
const localBuild = method(local, 'build() {');
for (const field of [
  'pageTurnPresentationPhase',
  'bookTurnSurfaceGeneration',
  'bookmarkPreviewChanged',
  'autoPageSessionRemainingSeconds',
  'sessionMorphHoldProgress',
  'failureCode',
]) {
  assert.doesNotMatch(local,
    new RegExp(`@State(?:\\s+@Watch\\([^)]*\\))?\\s+private\\s+${field}\\b`),
    `${field} is protocol/bookkeeping-only and must remain non-reactive`);
  assert.match(local, new RegExp(`private\\s+${field}\\s*:`),
    `${field} must remain explicitly declared as a plain field`);
  assert.doesNotMatch(localBuild, new RegExp(`\\bthis\\.${field}\\b`),
    `${field} must not be read by the LocalReadingExperience build tree`);
}
assert.match(local,
  /this\.bookTurnMotion !== undefined && this\.bookTurnMotion\.direction !== direction/,
  'a live same-direction drag must remain startable through MOVE and UP settlement');
assert.match(textureBuilder, /chromeSessionVisible:\s*false/);
assert.doesNotMatch(textureBuilder, /ttsHighlight|autoPageHighlight/,
  'dynamic highlight state must not be rasterized into reusable page textures');
assert.doesNotMatch(interaction, /ComponentSnapshot|PixelMap|uploadTexture/,
  'the raw MOVE owner must not touch page rasterization');
assert.doesNotMatch(interaction, /tapOnlyCancelled|tapOnlyMaxDistance|pointerOrigin/,
  'deferred input must not retain assignment-only distance state beside the canonical gesture arena');

assert.match(rendererHeader, /kMeshColumns = 64/);
assert.match(rendererHeader, /kMeshRows = 128/);
assert.match(renderer, /GL_RGB8/);
// The gl_FrontFacing ban (contract 8.1: faces switch by the geometric wrap
// angle) applies to the GLSL itself; the C++ side may document the policy.
const shaderSource = renderer.slice(
  renderer.indexOf('kSheetFragmentShader[] = R"glsl('),
  renderer.lastIndexOf(')glsl"'),
);
assert.notEqual(shaderSource.indexOf('R"glsl('), -1, 'shader source must be embedded');
assert.doesNotMatch(shaderSource, /gl_FrontFacing/,
  'back-page color cannot switch per triangle or expose the mesh as a jagged boundary');
assert.doesNotMatch(renderer, /vec3\(0\.96,\s*0\.95,\s*0\.92\)/,
  'the folded page must preserve the active page theme instead of replacing it with fixed beige');
assert.match(renderer, /backMix = smoothstep\(HALF_PI - 0\.02, HALF_PI \+ 0\.02, abs\(vPhi\)\)/,
  'front/back material color must cross the analytic fold continuously; the S-arc drape carries a signed facing angle so abs() keeps the switch geometric');
// 2026-08-30 user rulings (final, third supersedes the second): the revealed
// page keeps only the Huawei contact band (Draw 2, uBandWidth/uBandPeak) and
// the spine pool (contract 8.4) plus the physical light rig stay deleted; the
// sheet's OWN curl shading (fold valley / back plate / curvature / curl
// highlight, contract 8.2) is restored so the wrap stays readable.
assert.doesNotMatch(renderer + rendererHeader,
  /uPoolPeak|uPoolWidthStart|uPoolWidthEnd|kSpinePool|bookturn_lighting|CurrentLightRig/,
  'the spine pool and the light rig were deleted; they must not zombie back');
assert.match(renderer, /uBandWidth/,
  'the Huawei contact band (the only revealed-page shadow) must stay present');
assert.match(renderer,
  /uValleyGate[\s\S]*uFrontStripWidth[\s\S]*uHighlightPhiWidth/,
  'the sheet-self curl shading (valley / front strip / highlight) must stay present');
assert.match(renderer, /glBufferData\([\s\S]*GL_STATIC_DRAW/);
const draw = method(renderer, 'bool BookTurnRenderer::Draw(');
assert.doesNotMatch(draw, /eglMakeCurrent|glGetUniformLocation|glGetError|glBufferData|glTexImage2D/,
  'the frame hot path must reuse all context, geometry, texture and uniform resources');
// §7.3: after the tau_swap coverage point the sheet hides and only the static
// base draws; the visible path keeps its single sheet draw.
assert.equal((draw.match(/DrawBottom\(/g) ?? []).length, 2,
  'the visible frame and the hidden-sheet base-only branch each draw the bottom once');
assert.equal((draw.match(/DrawSheet\(/g) ?? []).length, 1);
assert.match(rendererHeader, /void SetSheetVisible\(bool visible\);/);
assert.match(rendererHeader, /void UndoCommitSlots\(\);/);
assert.match(rendererHeader, /void ShowTerminalPage\(TextureSlot slot\);/);
assert.doesNotMatch(method(host, 'bool BookTurnHost::ProcessSettlementFrame('), /CommitSlots\(/,
  'source and destination bindings survive until durable commit');
assert.match(method(host, 'void BookTurnHost::Run('), /pendingSettlementGeneration_ == sample\.generation/);

// Surface lifecycle is a serialized boundary.  A delayed create callback
// queued before detach must be dropped with the rest of the mailbox, while a
// genuinely newer attach is carried until teardown has published SURFACE_LOST.
assert.match(hostHeader, /surfaceRequestSerial_/);
assert.match(hostHeader, /surfaceLifecycleSerialAtomic_/);
assert.match(hostHeader, /pendingAttachSerial_/);
const attachSurface = method(host, 'void BookTurnHost::AttachSurface(');
assert.doesNotMatch(attachSurface, /detachRequested_\s*=\s*false/,
  'attach must not cancel a queued detach');
const hostRun = method(host, 'void BookTurnHost::Run(');
assert.match(hostRun, /for \(std::optional<TexturePayload>& pending : pendingTextures_\)[\s\S]*pending\.reset\(\)/,
  'detach must release unconsumed texture payloads');
assert.match(hostRun, /pendingSample_\.reset\(\)/,
  'detach must invalidate the unconsumed sample mailbox');
assert.match(hostRun, /pendingCommitSlots_\s*=\s*false/,
  'detach must invalidate an unconsumed slot commit');
assert.match(hostRun, /pendingAttachSerial_\s*>\s*serial/,
  'only an attach newer than the detach may survive the boundary');
assert.match(hostRun, /IsSurfaceLifecycleCurrent\(lifecycleSerial\)/,
  'unlocked EGL work must be rejected after a lifecycle change');
assert.match(hostRun, /ProcessChaseFrame\(frameSeconds, timestamp, lifecycleSerial\)/);
assert.match(hostRun, /ProcessSettlementFrame\(frameSeconds, lifecycleSerial\)/);
assert.match(host, /NotifySurfaceEvent\(surfaceSerial, HostEvent::FRAME_PRESENTED/,
  'a stale draw must not publish FRAME_PRESENTED');
assert.match(host, /NotifySurfaceEvent\(lifecycleSerial, HostEvent::SLOTS_COMMITTED/,
  'a stale slot operation must not publish SLOTS_COMMITTED');
const rendererShutdown = method(renderer, 'void BookTurnRenderer::Shutdown(');
assert.match(rendererShutdown, /ResetPresentationState\(\)/,
  'renderer shutdown must reset per-surface presentation flags');
assert.match(renderer, /fallbackPaperEnabled_\s*=\s*false/);
assert.match(renderer, /sheetVisible_\s*=\s*true/);

// V2 §5.3: ArkTS records only the newest raw sample; the render thread owns
// chase and frame advance on OH_NativeVSync one-shot callbacks.
assert.match(host, /pendingSample_/);
assert.match(host, /OH_NativeVSync/);
assert.match(host, /UpdateFrameLoopWanted/);
assert.match(host, /ChaseAdvance/);
assert.match(host, /PresentChaseSample\(chase_, liveSample_, frameTimeNs\)/,
  'the VSync frame must consume the bounded causal presentation sample');
const frameLoopPolicy = method(host, 'void BookTurnHost::UpdateFrameLoopWanted(');
assert.match(frameLoopPolicy, /fingerDown_/,
  'a gesture owner must keep the VSync presentation timeline alive until release');
assert.doesNotMatch(frameLoopPolicy, /fingerDown_\s*&&\s*chaseRunning_/,
  'tracking must not collapse to one frame whenever chase catches a sparse MOVE sample');
assert.doesNotMatch(hostHeader, /bool chaseRunning_/,
  'the obsolete input-cadence frame gate must not return');
assert.match(hostHeader, /std::optional<BookTurnSample> pendingSample_;/);
assert.doesNotMatch(host, /kFrameInterval/);
assert.doesNotMatch(method(host, 'bool BookTurnHost::ProcessSettlementFrame('), /sleep_for|glGetError/);
const settlementFrame = method(host, 'bool BookTurnHost::ProcessSettlementFrame(');
assert.match(settlementFrame,
  /SettleThetaAt\(settlementStartTheta_,\s*settlementElapsed_,\s*settlementDuration_\)/,
  'gesture release must preserve the live tilt and phase its decay over the full settlement');
assert.doesNotMatch(motionHeader + settlementFrame, /kTiltZeroSeconds/,
  'the former fixed 80ms posture snap must not return');
assert.match(napi, /kMaximumTexturePixels = 3'000'000ULL/);
assert.doesNotMatch(method(napi, 'bool ReadPixelMap('), /for \(/,
  'PixelMap conversion must run on the native render thread, not block ArkTS/NAPI');
assert.match(method(renderer, 'bool CompactRgb8('), /payload\.sourceFormat/);

// Stage 3 dropped the edge/velocity fields: the session forwards raw gesture
// samples (start/pointer/time) and native derives the chased edge.
assert.match(session,
  /updateInput\([\s\S]*input\.verticalPrevious,[\s\S]*input\.pointerX,[\s\S]*input\.pointerY/);
assert.doesNotMatch(session, /input\.edgeX|input\.edgeY/);
assert.match(local,
  /BOOK_TURN_EVENT_VISUAL_COMMIT_ENDPOINT[\s\S]*beginPreparedPageTurnPersistence/,
  'durable progress may start only after the native visual endpoint');
assert.match(local,
  /BOOK_TURN_EVENT_SLOTS_COMMITTED[\s\S]*finishSuccessfulPageTurnPresentation/);
assert.match(local, /export type ReaderPagePresentationPhase[\s\S]*'surfaceHidden'[\s\S]*'released'/,
  'gesture, promotion, hiding and release must share one explicit presentation phase');
assert.match(local,
  /this\.bookTurnSurfaceOpacity = 0;[\s\S]*this\.bookTurnSession\.releaseTerminalFrame/,
  'simulation commit must hide the surface before releasing its native terminal frame');
assert.match(local,
  /scheduleBookTurnRollbackSurfaceClear[\s\S]*this\.bookTurnSurfaceOpacity = 0[\s\S]*releaseTerminalFrame[\s\S]*clearSurface/,
  'rollback must use the same hidden-surface barrier as commit');
assert.match(stage, /READER_PAGE_TURN_SLOT_A = 'reader-page-slot-a'/);
assert.match(stage, /READER_PAGE_TURN_SLOT_B = 'reader-page-slot-b'/);
assert.match(stage, /slotIdentity: string/);
assert.match(stage, /@Prop @Watch\('onRenderRevisionChanged'\) renderRevision/,
  'simulation slot must acknowledge the promoted render revision after an ArkUI frame');
assert.match(local, /onBookTurnArkUIFramePresented\(revision\)/,
  'Native terminal release must wait for an ArkUI promoted-page acknowledgement');
assert.match(session, /BOOK_TURN_EVENT_FRAME_PRESENTED = 9/,
  'Native must expose a one-shot first-frame handshake for each generation');
assert.match(host, /firstFrameNotifiedGeneration_/,
  'Native must latch the first successful frame per generation');
assert.match(local,
  /BOOK_TURN_EVENT_FRAME_PRESENTED[\s\S]*bookTurnSurfaceOpacity = 1/,
  'simulation surface must become visible only after Native draws a valid frame');
assert.match(local,
  /private rapidPageTurnState: ReaderRapidPageTurnState = createReaderRapidPageTurnState\(\)/);
assert.match(local, /private pendingPointerSegmentReserved: boolean = false/);
assert.doesNotMatch(local, /rapidPageTurn(?:Queue|Directions):/);

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
assert.equal((control.match(/pageTurnSimulationAvailable: this\.pageTurnSimulationAvailable/g) ?? []).length, 2,
  'one shared Appearance and one Settings content adapter must share the Host capability');
assert.match(control, /ReaderControlAppearanceContent\(\{/);
assert.match(control, /ReaderControlSettingsContent\(\{/);
assert.doesNotMatch(control, /ReaderSettingsFullPanel\(\{/);
assert.doesNotMatch(control, /ReaderAppearanceMotionStage\(\{|ReaderSettingsModulePanel\(\{/);
assert.match(settingsFull,
  /option === 'simulation' && !this\.pageTurnSimulationAvailable[\s\S]*return false;/);
assert.match(settingsModule,
  /option === 'simulation' && !this\.pageTurnSimulationAvailable[\s\S]*return false;/);
assert.match(appearanceFull,
  /kind === 'pageTurn' && !this\.pageTurnSimulationAvailable[\s\S]*return \['覆盖', '平移', '滚动', '无动画'\];/);
assert.match(appearanceFull, /仿真当前宿主能力不可用，本会话使用无动画/);

console.log('reader book-turn architecture contract: PASS');

assert.match(napi, /napi_create_async_work\(env, nullptr, name, ExecuteTextureCopy, CompleteTextureCopy/);
assert.match(napi, /ReadPixelMap\(request.pixelMap, request.payload\)/);
assert.match(napi, /napi_call_function[\s\S]*const bool queued = admitted && request->host->QueueTexture/,
  'async pixel copies recheck JS capture ownership before mailbox publication');
assert.match(local, /await this\.bookTurnSession\.uploadTexture\(slot, pixelMap, page\.textureIdentity, canPublish\)/);

const snapshotSurface = readFileSync(new URL('../entry/src/main/ets/features/reading/ReadingSurface.ets', import.meta.url), 'utf8');
assert.match(textureBuilder,/snapshotSynchronousImages: true/);
assert.match(snapshotSurface,/@Prop snapshotSynchronousImages: boolean = false/);
assert.equal((snapshotSurface.match(/\.syncLoad\(this\.snapshotSynchronousImages\)/g)??[]).length,4,'all offscreen file/resource images participate; regular reading remains asynchronous');
