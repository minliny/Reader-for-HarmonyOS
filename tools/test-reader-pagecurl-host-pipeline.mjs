import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const reading = new URL('../entry/src/main/ets/features/reading/', import.meta.url);
const cpp = new URL('../entry/src/main/cpp/', import.meta.url);
const local = readFileSync(new URL('LocalReadingExperience.ets', reading), 'utf8');
const surface = readFileSync(new URL('ReadingSurface.ets', reading), 'utf8');
const rasterCache = readFileSync(new URL('ReaderPageRasterCache.ts', reading), 'utf8');
const nativeSurface = readFileSync(new URL('ReaderNativePageCurlSurface.ets', reading), 'utf8');
const stage = readFileSync(new URL('ReaderPageTurnStage.ets', reading), 'utf8');
const interaction = readFileSync(new URL('ReaderPageInteractionLayer.ets', reading), 'utf8');
const nativeHost = readFileSync(new URL('pagecurl/pagecurl_native_host.cpp', cpp), 'utf8');
const renderer = readFileSync(new URL('pagecurl/pagecurl_renderer.cpp', cpp), 'utf8');
const motion = readFileSync(new URL('pagecurl/pagecurl_motion.cpp', cpp), 'utf8');
const mesh = readFileSync(new URL('pagecurl/pagecurl_mesh.cpp', cpp), 'utf8');
const napi = readFileSync(new URL('napi_init.cpp', cpp), 'utf8');

assert.match(stage,
  /ReadingSurface\(\{[\s\S]*\.id\(`\$\{this\.pageIdentity\}:composed`\)/,
  'the complete body and four-corner chrome must have one transform-free snapshot root');
assert.match(local,
  /getComponentSnapshot\(\)\.get\(componentId, \{\s*scale: 1,\s*waitUntilRenderFinished: true,/,
  'page layers must be captured only after their mounted component finished rendering');
assert.match(local,
  /pageTurnRenderPageForTextureKey\([\s\S]*composedTextureKey === key[\s\S]*Render revision is a component-mount identity, not raster content[\s\S]*pageTurnRenderPageForTextureKey\(key\)/,
  'equivalent snapshots must survive a render-revision-only component replacement');
assert.match(local,
  /READER_PAGE_RASTER_CAPTURE_RETRY_LIMIT = 4;[\s\S]*scheduleReaderPageRasterCaptureRetry\(attempt \+ 1\)[\s\S]*attempt > READER_PAGE_RASTER_CAPTURE_RETRY_LIMIT[\s\S]*captureReaderPage\(page, generation, attempt\)/,
  'off-tree or stale-generation snapshots must retry the latest mounted page window with a strict bound');
assert.match(local,
  /READER_PAGE_RASTER_CAPTURE_ADMISSION_MS = 48;[\s\S]*pageRasterCaptureAdmissionTimer = setTimeout[\s\S]*pageTurnRenderPages\(\)\.forEach[\s\S]*READER_PAGE_RASTER_CAPTURE_ADMISSION_MS/,
  'the render-revision mount burst must settle before the full raster window enters ComponentSnapshot');
assert.match(stage,
  /@Prop @Watch\('onRasterIdentityChanged'\) rasterIdentity:[\s\S]*onRasterIdentityChanged\(\)[\s\S]*signalPageReadyAfterRenderAdmission/,
  'visual key changes with stable geometry must still trigger a fresh layer capture');
assert.match(rasterCache, /private records: Map<string, ReaderPageRasterRecord>/);
assert.match(rasterCache,
  /get\(key: string\): ReaderPageRasterRecord \| undefined/,
  'the CPU window must own exactly one composed PixelMap per page');
assert.doesNotMatch(rasterCache, /bodyRecords|chromeRecords|ReaderPageRasterPair/,
  'the cache must not retain duplicate full-screen body and chrome PixelMaps');

assert.match(nativeSurface,
  /primePage\(\s*textureKey: string,\s*page: image\.PixelMap,/,
  'idle native priming must receive one already composed page snapshot');
assert.match(nativeSurface,
  /isPageReady\(textureKey: string\): boolean;[\s\S]*prepare\(\s*movingTextureKey: string,\s*underTextureKey: string,/,
  'gesture-time prepare must select two resident texture keys without PixelMap transfer');
assert.match(nativeSurface,
  /native renderer owns the idle transparent clear[\s\S]*\.opacity\(1\)/,
  'the native surface must already be compositor-visible when a physical Pan begins');
assert.doesNotMatch(nativeSurface, /\.opacity\(this\.rendererVisible \? 1 : 0\)/,
  'a fully transparent XComponent can deadlock RendererReady behind its own visibility gate');
assert.doesNotMatch(nativeSurface, /\.opacity\(this\.rendererVisible \? 1 : 0\.001\)/,
  'a short physical Pan must not wait one ArkUI property frame before native pixels are visible');
assert.match(nativeHost,
  /PrimePage\([\s\S]*CopyPixelMap\(env, page, page_pixels\)[\s\S]*PendingPageUpload \{texture_key, std::move\(page_pixels\)\}/,
  'idle priming must copy one composed PixelMap and queue one GPU upload');
assert.doesNotMatch(nativeHost, /ComposePage|body_pixels|chrome_pixels|composed_pixels/,
  'native priming must not allocate and blend three full-page RGBA buffers');
assert.match(nativeHost,
  /SelectPages\(moving_texture_key, under_texture_key\)[\s\S]*RendererReady\(session_id\)/,
  'the host must consume the semantic moving/under roles resolved by direction');
assert.match(nativeHost,
  /IsPageReady\([\s\S]*std::unique_lock lock\(mutex_, std::try_to_lock\)[\s\S]*!lock\.owns_lock\(\)[\s\S]*return false/,
  'the first physical MOVE must never wait behind native upload/draw/swap work');
assert.match(nativeHost,
  /PageCurlNativeHost::Prepare\([\s\S]*std::unique_lock lock\(mutex_, std::try_to_lock\)[\s\S]*!lock\.owns_lock\(\)[\s\S]*SelectPages/,
  'native admission must choose the mounted fallback immediately instead of catching up after a blocking lock');
assert.match(nativeHost,
  /PageCurlNativeHost::Update\([\s\S]*independently synchronized latest pointer[\s\S]*engine_->UpdatePointer/,
  'high-frequency MOVE must bypass the Host GL mutex once Begin owns the VSync loop');
assert.match(nativeHost,
  /event\.type == PC_EVENT_TURN_CANCELLED[\s\S]*clear_pending_ = true;/,
  'a settled rollback must release old current/target LRU protection before idle window uploads');
assert.doesNotMatch(nativeHost,
  /bool PageCurlNativeHost::Prepare\([\s\S]{0,900}CopyPixelMap/,
  'gesture-time prepare must not copy or compose full-screen PixelMaps');
assert.match(renderer,
  /kMaxCachedPages = 3;[\s\S]*CachePage\([\s\S]*EvictOneCachedPage\([\s\S]*SelectPages\(/,
  'GPU residency must stay bounded to the previous/current/next page window');
assert.match(mesh, /BuildStaticSheetMesh[\s\S]*columns[\s\S]*rows[\s\S]*indices\.push_back/,
  'the renderer must build one immutable indexed material grid');
assert.match(renderer, /kSheetColumns = 32;[\s\S]*kSheetRows = 48;/,
  'the analytic cylinder must use the reduced immutable mesh density');
assert.match(renderer, /GL_STATIC_DRAW/,
  'V2 must upload the sheet mesh as immutable GPU data');
assert.match(renderer, /glDrawElements\(GL_TRIANGLES/,
  'V2 must draw the indexed sheet mesh');
assert.doesNotMatch(renderer, /GL_DYNAMIC_DRAW|BuildCurlMesh\(frame/,
  'no frame may rebuild or upload a CPU curl strip');
assert.match(renderer,
  /float signedDistance = dot\(relative, normal\);[\s\S]*vec2 curled = material \+ normal \*[\s\S]*bindingWeight = smoothstep\(0\.0, BINDING_WIDTH, material\.x\)[\s\S]*deformed = mix\(material, curled, bindingWeight\)[\s\S]*gl_Position = vec4\(ndc, -height \* 0\.7, 1\.0\);[\s\S]*gl_FrontFacing/,
  'the moving sheet must use a cylindrical curl, a narrow fixed-spine blend, and orthographic projection');
assert.doesNotMatch(renderer, /uCreaseCurvature|alongDelta|perspectiveW/,
  'quadratic local normals and pointer-pivot perspective must not fan-stretch the page');
assert.match(renderer,
  /kTargetFragmentShader[\s\S]*distanceToCrease = abs\(dot\(relative, normal\)\)[\s\S]*contactShadow/,
  'the target-page shadow must follow the same straight cylindrical crease');
assert.match(motion,
  /kMaximumFingerDragProgress = 0\.75F[\s\S]*anchor_ = \{1\.0F, input_origin_\.y\}[\s\S]*1\.0F - kMaximumFingerDragProgress[\s\S]*frame_\.crease_curvature = 0\.0F/,
  'Native must use a stable free-edge grip and cap raw horizontal transfer');
assert.match(motion,
  /const Vec2 followed = \{[\s\S]*anchor_\.x \+ raw\.x - input_origin_\.x,[\s\S]*anchor_\.y \+ raw\.y - input_origin_\.y[\s\S]*std::min\(followed\.x, anchor_\.x\)/,
  'the stable free-edge grip must keep exact physical finger displacement without first-MOVE teleporting');
assert.doesNotMatch(motion, /ProjectToBindingConstraint|BindingEdgeRemainsFlat|MaximumBindingSignedDistance/,
  'the real two-dimensional pointer must not be projected away from the finger');
assert.doesNotMatch(motion, /vertical_intent_violation_|kMaxVerticalToHorizontalTurnRatio/,
  'an admitted sheet must not disappear when the same finger moves upward');
assert.match(renderer, /PageCurlFrameUniformLocations QueryFrameUniforms\(GLuint program\)/);
assert.match(renderer,
  /page_frame_uniforms_ = QueryFrameUniforms\(page_program_\);[\s\S]*target_frame_uniforms_ = QueryFrameUniforms\(target_program_\);/,
  'uniform locations must be cached at program creation instead of queried on every VSync');
assert.match(renderer,
  /SetFrameUniforms\(target_frame_uniforms_, frame, aspect\)[\s\S]*SetFrameUniforms\(page_frame_uniforms_, frame, aspect\)/);
const drawSection = renderer.slice(renderer.indexOf('bool PageCurlRenderer::Draw('),
  renderer.indexOf('bool PageCurlRenderer::ClearTransparent('));
assert.doesNotMatch(drawSection, /glGetUniformLocation|glGetError/,
  'the VSync draw path must avoid driver query/synchronization calls');
assert.doesNotMatch(renderer, /textureSize_placeholder|kPageVertexShaderResolved/,
  'the shipped shader source must be the exact compiled shader, without placeholder copies');

assert.match(local,
  /READER_PAGECURL_EVENT_RENDERER_READY[\s\S]*onNativePageCurlRendererReady[\s\S]*this\.nativePageCurlVisible = true;/,
  'ArkUI content may be covered only after the renderer-ready barrier');
assert.match(local,
  /primeNativePageCurlPage\([\s\S]*context\.primePage\(page\.composedTextureKey, record\.pixelMap\)[\s\S]*context\.prepare\(\s*movingPage\.composedTextureKey,\s*underPage\.composedTextureKey,[\s\S]*this\.onNativePageCurlRendererReady\(sessionId\)/,
  'page textures must be primed off-gesture and begin in the admitting pointer callback');
assert.match(local,
  /simulationGestureMode === 'undecided'[\s\S]*tryPrepareNativePageCurlGesture\(\)[\s\S]*simulationGestureMode = 'native'[\s\S]*simulationGestureMode = 'fallback'[\s\S]*simulationPageTurnFallbackActive = prepared !== undefined/,
  'the first horizontal sample must fix native or measured fallback until the gesture completes or is cancelled');
assert.match(local,
  /simulationPageTurnFallbackActive = prepared !== undefined/,
  'a genuinely cold page must still track the physical finger instead of appearing broken');
assert.doesNotMatch(local, /gesture-cancelled:vertical-intent/,
  'upward movement after page admission must continue shaping the same curl actor');
assert.match(local,
  /const movingPage = direction === 'previous' \? adjacentPage : currentPage;[\s\S]*const underPage = direction === 'previous' \? currentPage : adjacentPage;/,
  'previous must move the previous page over the stationary current page');
assert.doesNotMatch(local, /GESTURE_WARMUP|armNativePageCurlGestureWarmup|nativePageCurlGestureWarmupTimer/,
  'active drag must not poll or wait for texture upload');
assert.match(local,
  /const outcome = context\.release\([\s\S]*velocityY[\s\S]*nativePageCurlReleaseIntent = commit \? 'commit' : 'rollback'[\s\S]*armNativePageCurlStatusPoll\(\)/,
  'Native must consume both release velocity axes and return the commit decision before Host turn dispatch');
assert.match(local,
  /context\.hostCommitted\(this\.nativePageCurlSessionId\)/,
  'the durable Core progress completion must cross the first host barrier');
assert.match(local,
  /nativePageCurlAwaitingHostPresentSession[\s\S]*postFrameCallback[\s\S]*context\.hostPresented\(sessionId\)/,
  'the native texture may hide only after the promoted ArkUI target page has reached a later frame');
assert.match(local,
  /releaseIntent === 'rollback'[\s\S]*status\.phase === READER_PAGECURL_PHASE_IDLE[\s\S]*releaseIntent === 'commit'[\s\S]*READER_PAGECURL_PHASE_AWAITING_HOST_COMMIT[\s\S]*READER_PAGECURL_PHASE_AWAITING_HOST_PRESENT/,
  'native settlement must reconcile from durable phase as well as one-shot event bits');
assert.match(local,
  /READER_PAGECURL_RELEASE_DEADLINE_MS = 1200;[\s\S]*armNativePageCurlReleaseDeadline\(sessionId\)[\s\S]*release-timeout:[\s\S]*handleNativePageCurlRenderFailure\(\)/,
  'a missing native release acknowledgement must never leave the whole reading input layer disabled');
assert.match(local,
  /READER_PAGECURL_PRESENT_DEADLINE_MS = 800;[\s\S]*private armNativePageCurlPresentDeadline\(sessionId[\s\S]*present-timeout:[\s\S]*acknowledgeNativePagePresented\(sessionId\)[\s\S]*armNativePageCurlPresentDeadline\(nativeSessionId\)/,
  'a missing ArkUI presentation callback must have a bounded host-present recovery');
assert.match(local,
  /pageChromeStateFrozen\(\)[\s\S]*pageTurnSettlementActive[\s\S]*phase === 'tracking'[\s\S]*phase === 'dragging'[\s\S]*phase === 'settling'/,
  'clock/status/capsule geometry must stay immutable from DOWN through settlement');
assert.match(local,
  /projectReaderPageCurlGesture\(state, this\.viewportHeight\)[\s\S]*nativePageCurlStartX = projection\.originX;[\s\S]*nativePageCurlStartY = projection\.originY;[\s\S]*nativePageCurlCurrentX = projection\.currentX;[\s\S]*nativePageCurlCurrentY = projection\.currentY;/,
  'native must receive the physical DOWN and latest two-dimensional pointer');
assert.match(interaction,
  /\.onTouch\(\(event: TouchEvent\): void => this\.handleTouch\(event\)\)[\s\S]*TouchType\.Down[\s\S]*TouchType\.Move[\s\S]*TouchType\.Up/,
  'the input arena must observe raw DOWN MOVE UP instead of starting after Pan recognition');
assert.doesNotMatch(interaction, /\bPanGesture\(|\bTapGesture\(|\bGestureGroup\(/,
  'tap, drag, control, and selection arbitration must share one raw pointer stream');
assert.match(interaction, /systemOwnsPointer\(event, pointer\)/,
  'system edge ownership must be decided before page admission');
assert.match(interaction,
  /const eventTimeMs = this\.eventTimeMs\(event\);[\s\S]*updateVelocity\(pointer\.x, pointer\.y, eventTimeMs\)[\s\S]*event\.timestamp/,
  'velocity and tap duration must use the platform event clock rather than callback wall time');
assert.match(local,
  /context\.updatePointer\([\s\S]*nativePageCurlEventTimeMs\(this\.nativePageCurlPendingGesture\)[\s\S]*context\.release\([\s\S]*nativePageCurlEventTimeMs/,
  'the same physical sample timestamp must cross the binary native boundary');

assert.doesNotMatch(napi, /JSON|stringify|parse\(/,
  'high-frequency pagecurl calls must stay on the binary NAPI boundary');
assert.match(napi,
  /napi_value PrimePage[\s\S]*count = 2[\s\S]*napi_value Prepare[\s\S]*count = 4[\s\S]*moving_texture_key[\s\S]*under_texture_key/,
  'NAPI must keep PixelMaps in the idle prime call and keys in the high-frequency prepare call');
assert.match(napi,
  /napi_value Release[\s\S]*count = 5[\s\S]*can_commit[\s\S]*velocity_x[\s\S]*velocity_y[\s\S]*return Int/,
  'release must remain binary and return Native commit or rollback synchronously');

console.log('reader PageCurl Host/raster/barrier pipeline: PASS');
