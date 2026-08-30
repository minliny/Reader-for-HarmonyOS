#include "bookturn_renderer.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstddef>
#include <utility>

namespace reader::bookturn {
namespace {

constexpr char kBottomVertexShader[] = R"glsl(#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aUv;
out vec2 vUv;
out vec2 vPage;
uniform vec2 uPageSize;
void main() {
    vUv = aUv;
    vPage = aUv * uPageSize;
    gl_Position = vec4(aPosition, 0.9, 1.0);
}
)glsl";

// Draw 1: static bottom page with the binding-edge gutter gradient baked in
// (contract 8.5). The fold-following shadow of V1 moves to draw 2; the gutter
// never follows the fold.
constexpr char kBottomFragmentShader[] = R"glsl(#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vPage;
layout(location = 0) out vec4 outColor;
uniform sampler2D uTexture;
uniform float uGutterWidth;
uniform float uGutterAlpha;
void main() {
    vec3 base = texture(uTexture, vUv).rgb;
    float gutter = (1.0 - smoothstep(0.0, uGutterWidth, vPage.x)) * uGutterAlpha;
    outColor = vec4(base * (1.0 - gutter), 1.0);
}
)glsl";

// Draw 2: contact shadow (contract 8.3, HUAWEI-measured re-spec 2026-08-30),
// the single dynamic shadow (2026-08-30 ruling): a narrow (~3.7%W, peak
// ~0.11) cast shadow hugging the moving sheet's silhouette on the revealed
// side; the old page-wide 0.05W/0.42 band (whose d<=0 side painted the whole
// revealed page at peak) is abolished. The dynamic spine shadow pool
// (contract 8.4) is abolished in place and must not return.
constexpr char kBandFragmentShader[] = R"glsl(#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vPage;
layout(location = 0) out vec4 outColor;
uniform vec2 uNormal;
uniform vec2 uTangent;
uniform vec2 uPageSize;
uniform float uAxis;
uniform float uTau;
uniform float uRadius;
uniform float uApexDist;
uniform float uSigmaGrip;
uniform float uBandWidth;
uniform float uBandPeak;
// Frozen schedule boundaries from bookturn_solver.h; keep in sync.
const float HALF_PI = 1.57079632679;
// Cone radius law, formula-identical to solver ConeRadius: the contact
// shadow's inner edge must track the curved silhouette of the sheet.
float coneRadius(vec2 page) {
    if (uApexDist <= 0.0001 || uRadius <= 0.0001) {
        return uRadius;
    }
    float sigma = dot(page, uTangent);
    return uRadius * (sigma - (uSigmaGrip - uApexDist)) / uApexDist;
}
void main() {
    // The silhouette sits at r*sin(phiMax) along the normal ray through the
    // fragment, where phiMax caps the wrap at the sheet's free edge; sigma is
    // constant along that ray because tangent is perpendicular to normal.
    float contact = 0.0;
    if (uTau > 0.02 && uRadius > 0.0001) {
        float gate = smoothstep(0.02, 0.08, uTau);
        float d = dot(vPage, uNormal) - uAxis;
        float dFree = d + (uPageSize.x - vPage.x) / max(uNormal.x, 0.5);
        float radius = coneRadius(vPage);
        float edge = radius * sin(clamp(dFree / max(radius, 0.0001), 0.0, HALF_PI));
        contact = uBandPeak * gate * (1.0 - smoothstep(edge, edge + uBandWidth, d));
    }
    outColor = vec4(0.0, 0.0, 0.0, contact);
}
)glsl";

// Draw 3 vertex stage: the strict three-branch cone binding, contract 6.3
// (2026-08-30 rework), evaluated per vertex from pose uniforms. This must
// stay formula-identical to the solver's MapMaterial/ConeRadius (single
// p(q) authority): same apex law, same three branches, same fold/depth
// fields. phi stays in [0, pi] and is continuous across the seam.
constexpr char kSheetVertexShader[] = R"glsl(#version 300 es
precision highp float;
layout(location = 0) in vec2 aMaterial;
out vec2 vUv;
out vec3 vNormal;
out float vPhi;
out float vD;
out float vRadius;
uniform vec2 uPageSize;
uniform float uAxis;
uniform float uRadius;
uniform float uTheta;
uniform float uApexDist;
uniform float uSigmaGrip;
uniform float uCameraDist;
const float PI = 3.14159265358979323846;
void main() {
    vec2 q = aMaterial * uPageSize;
    vec2 tangent = vec2(sin(uTheta), cos(uTheta));
    vec2 normal = vec2(cos(uTheta), -sin(uTheta));
    float sigma = dot(q, tangent);
    float distance = dot(q, normal) - uAxis;
    // Developable-cone apex law: r(sigma) = R * (sigma - sigmaApex) /
    // apexDist with the apex on the fold axis; uApexDist <= 0 selects the
    // A-grade cylinder (r constant = R).
    float radius = uRadius;
    if (uApexDist > 0.0001 && uRadius > 0.0001) {
        radius = uRadius * (sigma - (uSigmaGrip - uApexDist)) / uApexDist;
    }
    float foldedNormal = distance;
    float depth = 0.0;
    float phi = 0.0;
    if (distance > 0.0) {
        if (radius <= 0.0001) {
            foldedNormal = -distance;
            phi = PI;
        } else if (distance < PI * radius) {
            phi = distance / radius;
            foldedNormal = radius * sin(phi);
            depth = radius * (1.0 - cos(phi));
        } else {
            // Flat mirrored continuation at height 2r: the exact
            // flipped-over plate. One curvature everywhere past the fold --
            // no S-arc, no signed phi, no M silhouette.
            foldedNormal = -(distance - PI * radius);
            depth = 2.0 * radius;
            phi = PI;
        }
    }
    vec2 projected = sigma * tangent + (uAxis + foldedNormal) * normal;
    // Fixed-axis perspective (2026-08-30 user directive): the camera sits on
    // the page-normal axis through the page center at uCameraDist. The z=0
    // plane maps 1:1 (flat part, binding edge, contact line invariant); only
    // the raised wrap and mirrored plate shift radially outward, so the
    // flipped plate separates from the page below by parallax instead of
    // coinciding with it.
    float persp = uCameraDist / max(uCameraDist - depth, 1.0);
    vec2 center = uPageSize * 0.5;
    projected = center + (projected - center) * persp;
    vec2 ndc = vec2(2.0 * projected.x / uPageSize.x - 1.0,
                    1.0 - 2.0 * projected.y / uPageSize.y);
    // Depth sign contract 6.3: the bulge rises toward the viewer (+z), which
    // is nearer and therefore a SMALLER NDC z. Sheet base plane 0.0, static
    // bottom page 0.9; max bulge maps to -0.45.
    float depthNdc = -0.45 * clamp(depth / 64.0, 0.0, 1.0);
    gl_Position = vec4(ndc, depthNdc, 1.0);
    vUv = aMaterial;
    vNormal = vec3(-sin(phi) * normal, cos(phi));
    vPhi = phi;
    vD = distance;
    vRadius = radius;
}
)glsl";

// Draw 3 fragment stage: double-sided shading, contract 8.2/8.3 (2026-08-30
// HUAWEI-measured recalibration). Flat regions render at exactly 1.0
// brightness -- every darkening is fold-proximity, the page-wide |vPhi|/pi
// gradient of the previous package is abolished. The shade families:
//   - fold-centered valley on the moving page: darkest at the crease
//     (~15%), decaying narrowly over the flat front strip and widely across
//     the wrap (the measured 15-25%W roll);
//   - uniform back-plate tone (~9%) under the ghost-text chain;
//   - modest curvature modulation only inside the wrap;
//   - narrow silhouette highlight re-anchored at phi = pi/2.
// Faces switch by the geometric wrap angle (phi past pi/2), never
// gl_FrontFacing (contract 8.1); at the silhouette the surface is edge-on so
// the narrow switch window cannot show a seam.
constexpr char kSheetFragmentShader[] = R"glsl(#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vNormal;
in float vPhi;
in float vD;
in float vRadius;
layout(location = 0) out vec4 outColor;
uniform sampler2D uTexture;
uniform vec3 uPaperColor;
uniform float uPaperFallback;
uniform float uHighlightPhiWidth;
uniform float uFrontStripWidth;
uniform float uValleyGate;
const float PI = 3.14159265358979323846;
const float HALF_PI = 1.57079632679;
const float BF_BRIGHTNESS = 0.96;
const float BF_DESAT = 0.10;
const float BF_CONTRAST = 0.18;
const float VALLEY_PEAK = 0.15;
const float BACK_PLATE_DARK = 0.09;
void main() {
    vec3 normal = normalize(vNormal);
    vec3 light = normalize(vec3(-0.32, -0.20, 0.93));
    // abs(vPhi): phi is in [0, pi] under the strict three-branch model, so
    // abs() is an exact no-op; kept as the architecture-gate literal.
    float backMix = smoothstep(HALF_PI - 0.02, HALF_PI + 0.02, abs(vPhi));
    float diffuse = mix(max(dot(normal, light), 0.0), max(dot(-normal, light), 0.0), backMix);
    // Curvature modulation lives only inside the wrap: sin() gates it to
    // zero on both flat ends, so flat ground is lit at exactly 1.0.
    float wrapGate = sin(clamp(vPhi, 0.0, PI));
    float lighting = mix(1.0, 0.94 + 0.06 * diffuse, wrapGate);
    vec3 frontColor = texture(uTexture, vUv).rgb;
    // Paper fallback (contract 8.6): while enabled the backface paper derives
    // from the theme background color instead of the front texture; the front
    // keeps the texture. The derivation is the same 96%/10% rule, no fixed
    // beige or gray constants.
    vec3 backSource = mix(frontColor, uPaperColor, uPaperFallback);
    float luminance = dot(backSource, vec3(0.2126, 0.7152, 0.0722));
    vec3 backColor = mix(backSource, vec3(luminance), BF_DESAT);
    backColor = (backColor * BF_BRIGHTNESS - 0.5) * (1.0 + BF_CONTRAST) + 0.5;
    vec3 color = mix(frontColor, backColor, backMix);
    color *= lighting;
    // Fold-centered valley: peak at the crease, narrow decay over the flat
    // front (d < 0), wide decay across the roll diameter (d > 0). Gated out
    // while no wrap exists (resting page, settled commit).
    float dAbs = abs(vD);
    float valleyWidth = vD < 0.0 ? uFrontStripWidth : 2.0 * vRadius;
    float valley = VALLEY_PEAK * uValleyGate *
        (1.0 - smoothstep(0.0, valleyWidth, dAbs));
    float backPlate = BACK_PLATE_DARK * backMix;
    color *= (1.0 - valley) * (1.0 - backPlate);
    // Curl-crest highlight, anchored at the silhouette (phi = pi/2).
    float highlight = (1.0 - smoothstep(0.0, uHighlightPhiWidth, abs(vPhi - HALF_PI))) * 0.04;
    color += highlight;
    outColor = vec4(color, 1.0);
}
)glsl";

constexpr std::array<float, 16> kBottomVertices = {
    -1.0F,  1.0F, 0.0F, 0.0F,
    -1.0F, -1.0F, 0.0F, 1.0F,
     1.0F,  1.0F, 1.0F, 0.0F,
     1.0F, -1.0F, 1.0F, 1.0F,
};

// Shading calibration constants (contract 8.3-8.5). Values inside a contract
// range use the HUAWEI-reference midpoint; explicit A/B pairs stay compiled
// until the stage-4 device A/B freezes one (B consumed by default, matching
// the solver's taper handling).
constexpr float kGutterWidthRatio = 0.08F;
constexpr float kGutterAlphaA = 0.06F;
constexpr float kGutterAlphaB = 0.10F;
constexpr float kGutterAlphaDefault = 0.5F * (kGutterAlphaA + kGutterAlphaB);
// Contact shadow hugging the moving sheet's silhouette on the revealed side
// (contract 8.3, HUAWEI-measured 2026-08-30: ~3.7%W wide, peak ~0.11).
constexpr float kContactWidthRatio = 0.037F;
constexpr float kContactPeakAlpha = 0.11F;
// Front-side strip of the fold-centered valley on the moving sheet (narrow,
// ~3.5%W, peak 0.15; the wrap side decays over the full 2r band instead).
constexpr float kFrontStripRatio = 0.035F;
// Fixed-axis perspective (2026-08-30 user directive): camera distance as a
// ratio of max(pageW, pageH). 4x keeps the flat z=0 sheet pixel-exact while
// the mirrored plate (z=2r) offsets ~5-8%W at mid-screen -- the flipped part
// reads as a parallel sheet hovering above the page instead of coinciding.
constexpr float kSheetCameraDistRatio = 4.0F;
constexpr float kCurlHighlightWidthMinVp = 5.0F;
constexpr float kCurlHighlightWidthMaxVp = 10.0F;

uint32_t SourceBytesPerPixel(TextureSourceFormat format)
{
    if (format == TextureSourceFormat::RGB_565) return 2U;
    if (format == TextureSourceFormat::RGB_888) return 3U;
    return 4U;
}

bool CompactRgb8(TexturePayload& payload)
{
    const uint32_t sourceBytes = SourceBytesPerPixel(payload.sourceFormat);
    const size_t sourceSize = static_cast<size_t>(payload.rowStride) * payload.height;
    const size_t compactSize = static_cast<size_t>(payload.width) * payload.height * 3U;
    if (payload.width == 0 || payload.height == 0 ||
        payload.rowStride < payload.width * sourceBytes || payload.pixels.size() != sourceSize) {
        return false;
    }
    if (payload.sourceFormat == TextureSourceFormat::RGB_565) {
        std::vector<uint8_t> rgb(compactSize);
        for (uint32_t y = 0; y < payload.height; ++y) {
            const uint8_t* sourceRow = payload.pixels.data() + static_cast<size_t>(y) * payload.rowStride;
            uint8_t* target = rgb.data() + static_cast<size_t>(y) * payload.width * 3U;
            for (uint32_t x = 0; x < payload.width; ++x) {
                const uint16_t packed = static_cast<uint16_t>(sourceRow[2 * x]) |
                    static_cast<uint16_t>(sourceRow[2 * x + 1] << 8U);
                target[0] = static_cast<uint8_t>(((packed >> 11U) & 0x1FU) * 255U / 31U);
                target[1] = static_cast<uint8_t>(((packed >> 5U) & 0x3FU) * 255U / 63U);
                target[2] = static_cast<uint8_t>((packed & 0x1FU) * 255U / 31U);
                target += 3;
            }
        }
        payload.pixels = std::move(rgb);
        payload.rowStride = payload.width * 3U;
        payload.sourceFormat = TextureSourceFormat::RGB_888;
        return true;
    }

    // RGB/RGBA/BGRA rows compact forward in their existing allocation. The
    // destination never overtakes unread source bytes, so the low-end idle
    // preparation path does not allocate another full-page buffer.
    for (uint32_t y = 0; y < payload.height; ++y) {
        const size_t sourceOffset = static_cast<size_t>(y) * payload.rowStride;
        const size_t targetOffset = static_cast<size_t>(y) * payload.width * 3U;
        for (uint32_t x = 0; x < payload.width; ++x) {
            const size_t sourcePixel = sourceOffset + static_cast<size_t>(x) * sourceBytes;
            const uint8_t red = payload.sourceFormat == TextureSourceFormat::BGRA_8888 ?
                payload.pixels[sourcePixel + 2] : payload.pixels[sourcePixel];
            const uint8_t green = payload.pixels[sourcePixel + 1];
            const uint8_t blue = payload.sourceFormat == TextureSourceFormat::BGRA_8888 ?
                payload.pixels[sourcePixel] : payload.pixels[sourcePixel + 2];
            const size_t targetPixel = targetOffset + static_cast<size_t>(x) * 3U;
            payload.pixels[targetPixel] = red;
            payload.pixels[targetPixel + 1] = green;
            payload.pixels[targetPixel + 2] = blue;
        }
    }
    payload.pixels.resize(compactSize);
    payload.rowStride = payload.width * 3U;
    payload.sourceFormat = TextureSourceFormat::RGB_888;
    return true;
}

}  // namespace

BookTurnRenderer::~BookTurnRenderer()
{
    Shutdown();
}

bool BookTurnRenderer::Initialize(void* nativeWindow, uint64_t width, uint64_t height)
{
    Shutdown();
    surfaceWidth_ = std::max<uint64_t>(1, width);
    surfaceHeight_ = std::max<uint64_t>(1, height);
    if (!InitializeEgl(nativeWindow) || !InitializePrograms() ||
        !InitializeGeometry() || !InitializeTextures()) {
        Shutdown();
        return false;
    }
    glViewport(0, 0, static_cast<GLsizei>(surfaceWidth_), static_cast<GLsizei>(surfaceHeight_));
    return Clear();
}

void BookTurnRenderer::Resize(uint64_t width, uint64_t height)
{
    surfaceWidth_ = std::max<uint64_t>(1, width);
    surfaceHeight_ = std::max<uint64_t>(1, height);
    if (context_ != EGL_NO_CONTEXT) {
        glViewport(0, 0, static_cast<GLsizei>(surfaceWidth_), static_cast<GLsizei>(surfaceHeight_));
    }
}

void BookTurnRenderer::Shutdown()
{
    if (display_ != EGL_NO_DISPLAY && context_ != EGL_NO_CONTEXT) {
        eglMakeCurrent(display_, surface_, surface_, context_);
        DestroyGl();
        eglMakeCurrent(display_, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
    }
    if (display_ != EGL_NO_DISPLAY && surface_ != EGL_NO_SURFACE) {
        eglDestroySurface(display_, surface_);
    }
    if (display_ != EGL_NO_DISPLAY && context_ != EGL_NO_CONTEXT) {
        eglDestroyContext(display_, context_);
    }
    if (display_ != EGL_NO_DISPLAY) {
        eglTerminate(display_);
    }
    display_ = EGL_NO_DISPLAY;
    surface_ = EGL_NO_SURFACE;
    context_ = EGL_NO_CONTEXT;
    config_ = nullptr;
}

bool BookTurnRenderer::Upload(TexturePayload&& payload)
{
    if (context_ == EGL_NO_CONTEXT || !CompactRgb8(payload)) {
        return false;
    }
    TextureState& staging = Slot(TextureSlot::STAGING);
    glBindTexture(GL_TEXTURE_2D, staging.handle);
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB8, static_cast<GLsizei>(payload.width),
        static_cast<GLsizei>(payload.height), 0, GL_RGB, GL_UNSIGNED_BYTE, payload.pixels.data());
    if (glGetError() != GL_NO_ERROR) {
        return false;
    }
    staging.width = payload.width;
    staging.height = payload.height;
    staging.identity = std::move(payload.identity);
    staging.ready = true;
    if (payload.slot != TextureSlot::STAGING) {
        std::swap(Slot(payload.slot), staging);
        staging.ready = false;
        staging.identity.clear();
    }
    return true;
}

void BookTurnRenderer::Invalidate(TextureSlot slot)
{
    TextureState& texture = Slot(slot);
    texture.ready = false;
    texture.identity.clear();
}

bool BookTurnRenderer::HasRequiredTextures(Direction direction) const
{
    if (!Slot(TextureSlot::CURRENT).ready) return false;
    return direction == Direction::NEXT ? Slot(TextureSlot::NEXT).ready : Slot(TextureSlot::PREVIOUS).ready;
}

uint32_t BookTurnRenderer::ReadyMask() const
{
    uint32_t mask = 0;
    for (size_t index = 0; index < textures_.size(); ++index) {
        if (textures_[index].ready) mask |= 1U << index;
    }
    return mask;
}

bool BookTurnRenderer::Draw(const BookTurnPose& pose)
{
    lastRefusal_ = DrawRefusal::NONE;
    if (context_ == EGL_NO_CONTEXT) {
        lastRefusal_ = DrawRefusal::NO_CONTEXT;
        return false;
    }
    if (!sheetVisible_) {
        if (!Slot(TextureSlot::CURRENT).ready) {
            lastRefusal_ = DrawRefusal::CURRENT_MISSING;
            return false;
        }
    } else if (!HasRequiredTextures(pose.direction)) {
        lastRefusal_ = DrawRefusal::TEXTURES_MISSING;
        return false;
    }
    glViewport(0, 0, static_cast<GLsizei>(surfaceWidth_), static_cast<GLsizei>(surfaceHeight_));
    glClearColor(0.0F, 0.0F, 0.0F, 0.0F);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glDisable(GL_CULL_FACE);
    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LEQUAL);
    if (!sheetVisible_) {
        // §7.3 early swap: the rotated CURRENT slot already holds the
        // admitted page, so only the static base frame is emitted (no sheet,
        // no shadow band, zero blend switches).
        glDisable(GL_BLEND);
        glDepthMask(GL_TRUE);
        DrawBottom(pose, TextureSlot::CURRENT);
        if (eglSwapBuffers(display_, surface_) != EGL_TRUE) {
            lastRefusal_ = DrawRefusal::SWAP_FAILED;
            return false;
        }
        return true;
    }
    const TextureSlot bottom = pose.direction == Direction::NEXT ? TextureSlot::NEXT : TextureSlot::CURRENT;
    const TextureSlot moving = pose.direction == Direction::NEXT ? TextureSlot::CURRENT : TextureSlot::PREVIOUS;
    // Fixed 3-draw structure (contract 8.1): opaque bottom, blended shadow
    // pass with depth writes off, opaque moving sheet. Exactly two blend
    // switches per frame (enter draw 2, enter draw 3).
    glDisable(GL_BLEND);
    glDepthMask(GL_TRUE);
    DrawBottom(pose, bottom);
    glEnable(GL_BLEND);
    // Alpha channels of all three passes write 1.0, but plain GL_SRC_ALPHA
    // blending also scales the destination ALPHA, so the shadow pass dropped
    // the framebuffer alpha below 1 across the band region. The EGL surface
    // has an alpha channel, and the compositor then blended the ArkUI page
    // underneath (the outgoing page) through the band — the mid-turn
    // double-exposure ghost. Keep RGB math identical and pin alpha to 1.
    glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ZERO, GL_ONE);
    glDepthMask(GL_FALSE);
    DrawShadowBand(pose);
    glDisable(GL_BLEND);
    glDepthMask(GL_TRUE);
    DrawSheet(pose, moving);
    if (eglSwapBuffers(display_, surface_) != EGL_TRUE) {
        lastRefusal_ = DrawRefusal::SWAP_FAILED;
        return false;
    }
    return true;
}

bool BookTurnRenderer::Clear()
{
    sheetVisible_ = true;
    if (context_ == EGL_NO_CONTEXT) return false;
    glDisable(GL_DEPTH_TEST);
    glClearColor(0.0F, 0.0F, 0.0F, 0.0F);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    return eglSwapBuffers(display_, surface_) == EGL_TRUE;
}

void BookTurnRenderer::SetSheetVisible(bool visible)
{
    sheetVisible_ = visible;
}

void BookTurnRenderer::UndoCommitSlots()
{
    std::swap(Slot(TextureSlot::NEXT), Slot(TextureSlot::CURRENT));
    std::swap(Slot(TextureSlot::CURRENT), Slot(TextureSlot::PREVIOUS));
}

void BookTurnRenderer::CommitSlots(Direction direction)
{
    if (direction == Direction::NEXT) {
        std::swap(Slot(TextureSlot::PREVIOUS), Slot(TextureSlot::CURRENT));
        std::swap(Slot(TextureSlot::CURRENT), Slot(TextureSlot::NEXT));
        Invalidate(TextureSlot::NEXT);
    } else {
        std::swap(Slot(TextureSlot::NEXT), Slot(TextureSlot::CURRENT));
        std::swap(Slot(TextureSlot::CURRENT), Slot(TextureSlot::PREVIOUS));
        Invalidate(TextureSlot::PREVIOUS);
    }
}

bool BookTurnRenderer::InitializeEgl(void* nativeWindow)
{
    if (nativeWindow == nullptr) return false;
    display_ = eglGetDisplay(EGL_DEFAULT_DISPLAY);
    if (display_ == EGL_NO_DISPLAY || eglInitialize(display_, nullptr, nullptr) != EGL_TRUE) return false;
    const EGLint attributes[] = {
        EGL_SURFACE_TYPE, EGL_WINDOW_BIT,
        EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT,
        EGL_RED_SIZE, 8, EGL_GREEN_SIZE, 8, EGL_BLUE_SIZE, 8, EGL_ALPHA_SIZE, 8,
        EGL_DEPTH_SIZE, 16,
        EGL_NONE,
    };
    EGLint count = 0;
    if (eglChooseConfig(display_, attributes, &config_, 1, &count) != EGL_TRUE || count < 1) return false;
    const EGLint contextAttributes[] = { EGL_CONTEXT_CLIENT_VERSION, 3, EGL_NONE };
    context_ = eglCreateContext(display_, config_, EGL_NO_CONTEXT, contextAttributes);
    if (context_ == EGL_NO_CONTEXT) return false;
    surface_ = eglCreateWindowSurface(display_, config_, reinterpret_cast<EGLNativeWindowType>(nativeWindow),
        nullptr);
    if (surface_ == EGL_NO_SURFACE) return false;
    return eglMakeCurrent(display_, surface_, surface_, context_) == EGL_TRUE;
}

bool BookTurnRenderer::InitializePrograms()
{
    GLuint vertex = CompileShader(GL_VERTEX_SHADER, kBottomVertexShader);
    GLuint fragment = CompileShader(GL_FRAGMENT_SHADER, kBottomFragmentShader);
    bottomProgram_ = LinkProgram(vertex, fragment);
    glDeleteShader(vertex);
    glDeleteShader(fragment);
    vertex = CompileShader(GL_VERTEX_SHADER, kBottomVertexShader);
    fragment = CompileShader(GL_FRAGMENT_SHADER, kBandFragmentShader);
    bandProgram_ = LinkProgram(vertex, fragment);
    glDeleteShader(vertex);
    glDeleteShader(fragment);
    vertex = CompileShader(GL_VERTEX_SHADER, kSheetVertexShader);
    fragment = CompileShader(GL_FRAGMENT_SHADER, kSheetFragmentShader);
    sheetProgram_ = LinkProgram(vertex, fragment);
    glDeleteShader(vertex);
    glDeleteShader(fragment);
    if (bottomProgram_ == 0 || bandProgram_ == 0 || sheetProgram_ == 0) return false;

    bottomUniforms_.pageSize = glGetUniformLocation(bottomProgram_, "uPageSize");
    bottomUniforms_.texture = glGetUniformLocation(bottomProgram_, "uTexture");
    bottomUniforms_.gutterWidth = glGetUniformLocation(bottomProgram_, "uGutterWidth");
    bottomUniforms_.gutterAlpha = glGetUniformLocation(bottomProgram_, "uGutterAlpha");

    bandUniforms_.pageSize = glGetUniformLocation(bandProgram_, "uPageSize");
    bandUniforms_.normal = glGetUniformLocation(bandProgram_, "uNormal");
    bandUniforms_.tangent = glGetUniformLocation(bandProgram_, "uTangent");
    bandUniforms_.axis = glGetUniformLocation(bandProgram_, "uAxis");
    bandUniforms_.tau = glGetUniformLocation(bandProgram_, "uTau");
    bandUniforms_.radius = glGetUniformLocation(bandProgram_, "uRadius");
    bandUniforms_.apexDist = glGetUniformLocation(bandProgram_, "uApexDist");
    bandUniforms_.sigmaGrip = glGetUniformLocation(bandProgram_, "uSigmaGrip");
    bandUniforms_.bandWidth = glGetUniformLocation(bandProgram_, "uBandWidth");
    bandUniforms_.bandPeak = glGetUniformLocation(bandProgram_, "uBandPeak");

    sheetUniforms_.pageSize = glGetUniformLocation(sheetProgram_, "uPageSize");
    sheetUniforms_.axis = glGetUniformLocation(sheetProgram_, "uAxis");
    sheetUniforms_.radius = glGetUniformLocation(sheetProgram_, "uRadius");
    sheetUniforms_.theta = glGetUniformLocation(sheetProgram_, "uTheta");
    sheetUniforms_.apexDist = glGetUniformLocation(sheetProgram_, "uApexDist");
    sheetUniforms_.sigmaGrip = glGetUniformLocation(sheetProgram_, "uSigmaGrip");
    sheetUniforms_.cameraDist = glGetUniformLocation(sheetProgram_, "uCameraDist");
    sheetUniforms_.texture = glGetUniformLocation(sheetProgram_, "uTexture");
    sheetUniforms_.highlightPhiWidth = glGetUniformLocation(sheetProgram_, "uHighlightPhiWidth");
    sheetUniforms_.frontStripWidth = glGetUniformLocation(sheetProgram_, "uFrontStripWidth");
    sheetUniforms_.valleyGate = glGetUniformLocation(sheetProgram_, "uValleyGate");
    sheetUniforms_.paperColor = glGetUniformLocation(sheetProgram_, "uPaperColor");
    sheetUniforms_.paperFallback = glGetUniformLocation(sheetProgram_, "uPaperFallback");

    return bottomUniforms_.pageSize >= 0 && bottomUniforms_.texture >= 0 &&
        bottomUniforms_.gutterWidth >= 0 && bottomUniforms_.gutterAlpha >= 0 &&
        bandUniforms_.pageSize >= 0 && bandUniforms_.normal >= 0 && bandUniforms_.tangent >= 0 &&
        bandUniforms_.axis >= 0 && bandUniforms_.tau >= 0 && bandUniforms_.radius >= 0 &&
        bandUniforms_.apexDist >= 0 && bandUniforms_.sigmaGrip >= 0 &&
        bandUniforms_.bandWidth >= 0 &&
        bandUniforms_.bandPeak >= 0 &&
        sheetUniforms_.pageSize >= 0 && sheetUniforms_.axis >= 0 && sheetUniforms_.radius >= 0 &&
        sheetUniforms_.theta >= 0 && sheetUniforms_.apexDist >= 0 && sheetUniforms_.sigmaGrip >= 0 &&
        sheetUniforms_.cameraDist >= 0 &&
        sheetUniforms_.texture >= 0 && sheetUniforms_.highlightPhiWidth >= 0 &&
        sheetUniforms_.frontStripWidth >= 0 && sheetUniforms_.valleyGate >= 0 &&
        sheetUniforms_.paperColor >= 0 && sheetUniforms_.paperFallback >= 0;
}

bool BookTurnRenderer::InitializeGeometry()
{
    glGenVertexArrays(1, &bottomVao_);
    glGenBuffers(1, &bottomVbo_);
    glBindVertexArray(bottomVao_);
    glBindBuffer(GL_ARRAY_BUFFER, bottomVbo_);
    glBufferData(GL_ARRAY_BUFFER, sizeof(kBottomVertices), kBottomVertices.data(), GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), nullptr);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float),
        reinterpret_cast<void*>(2 * sizeof(float)));

    std::vector<float> vertices;
    vertices.reserve((kMeshColumns + 1) * (kMeshRows + 1) * 2);
    for (int row = 0; row <= kMeshRows; ++row) {
        for (int column = 0; column <= kMeshColumns; ++column) {
            vertices.push_back(static_cast<float>(column) / kMeshColumns);
            vertices.push_back(static_cast<float>(row) / kMeshRows);
        }
    }
    std::vector<uint16_t> indices;
    indices.reserve(kMeshColumns * kMeshRows * 6);
    for (int row = 0; row < kMeshRows; ++row) {
        for (int column = 0; column < kMeshColumns; ++column) {
            const uint16_t topLeft = static_cast<uint16_t>(row * (kMeshColumns + 1) + column);
            const uint16_t bottomLeft = static_cast<uint16_t>((row + 1) * (kMeshColumns + 1) + column);
            indices.push_back(topLeft);
            indices.push_back(bottomLeft);
            indices.push_back(static_cast<uint16_t>(topLeft + 1));
            indices.push_back(static_cast<uint16_t>(topLeft + 1));
            indices.push_back(bottomLeft);
            indices.push_back(static_cast<uint16_t>(bottomLeft + 1));
        }
    }
    sheetIndexCount_ = static_cast<GLsizei>(indices.size());
    glGenVertexArrays(1, &sheetVao_);
    glGenBuffers(1, &sheetVbo_);
    glGenBuffers(1, &sheetIbo_);
    glBindVertexArray(sheetVao_);
    glBindBuffer(GL_ARRAY_BUFFER, sheetVbo_);
    glBufferData(GL_ARRAY_BUFFER, static_cast<GLsizeiptr>(vertices.size() * sizeof(float)),
        vertices.data(), GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), nullptr);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, sheetIbo_);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, static_cast<GLsizeiptr>(indices.size() * sizeof(uint16_t)),
        indices.data(), GL_STATIC_DRAW);
    glBindVertexArray(0);
    return glGetError() == GL_NO_ERROR;
}

bool BookTurnRenderer::InitializeTextures()
{
    std::array<GLuint, 4> handles {};
    glGenTextures(static_cast<GLsizei>(handles.size()), handles.data());
    for (size_t index = 0; index < handles.size(); ++index) {
        textures_[index].handle = handles[index];
        glBindTexture(GL_TEXTURE_2D, handles[index]);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    }
    return glGetError() == GL_NO_ERROR;
}

GLuint BookTurnRenderer::CompileShader(GLenum type, const char* source)
{
    const GLuint shader = glCreateShader(type);
    glShaderSource(shader, 1, &source, nullptr);
    glCompileShader(shader);
    GLint compiled = GL_FALSE;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &compiled);
    if (compiled != GL_TRUE) {
        glDeleteShader(shader);
        return 0;
    }
    return shader;
}

GLuint BookTurnRenderer::LinkProgram(GLuint vertex, GLuint fragment)
{
    if (vertex == 0 || fragment == 0) return 0;
    const GLuint program = glCreateProgram();
    glAttachShader(program, vertex);
    glAttachShader(program, fragment);
    glLinkProgram(program);
    GLint linked = GL_FALSE;
    glGetProgramiv(program, GL_LINK_STATUS, &linked);
    if (linked != GL_TRUE) {
        glDeleteProgram(program);
        return 0;
    }
    return program;
}

void BookTurnRenderer::DrawBottom(const BookTurnPose& pose, TextureSlot slot)
{
    glUseProgram(bottomProgram_);
    glUniform2f(bottomUniforms_.pageSize, pose.width, pose.height);
    glUniform1f(bottomUniforms_.gutterWidth, kGutterWidthRatio * pose.width);
    glUniform1f(bottomUniforms_.gutterAlpha, kGutterAlphaDefault);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, Slot(slot).handle);
    glUniform1i(bottomUniforms_.texture, 0);
    glBindVertexArray(bottomVao_);
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
}

void BookTurnRenderer::DrawShadowBand(const BookTurnPose& pose)
{
    // Contact shadow on the revealed side hugs the sheet's curved silhouette
    // (per-fragment cone law in the shader); the sole dynamic shadow.
    glUseProgram(bandProgram_);
    glUniform2f(bandUniforms_.pageSize, pose.width, pose.height);
    glUniform2f(bandUniforms_.normal, pose.normal.x, pose.normal.y);
    glUniform2f(bandUniforms_.tangent, pose.tangent.x, pose.tangent.y);
    glUniform1f(bandUniforms_.axis, pose.axis);
    glUniform1f(bandUniforms_.tau, pose.tau);
    glUniform1f(bandUniforms_.radius, pose.radius);
    glUniform1f(bandUniforms_.apexDist, pose.apexDist);
    glUniform1f(bandUniforms_.sigmaGrip, pose.sigmaGrip);
    glUniform1f(bandUniforms_.bandWidth, kContactWidthRatio * pose.width);
    glUniform1f(bandUniforms_.bandPeak, kContactPeakAlpha);
    glBindVertexArray(bottomVao_);
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);
}

void BookTurnRenderer::DrawSheet(const BookTurnPose& pose, TextureSlot slot)
{
    glUseProgram(sheetProgram_);
    glUniform2f(sheetUniforms_.pageSize, pose.width, pose.height);
    glUniform1f(sheetUniforms_.axis, pose.axis);
    glUniform1f(sheetUniforms_.radius, pose.radius);
    glUniform1f(sheetUniforms_.theta, pose.theta);
    glUniform1f(sheetUniforms_.apexDist, pose.apexDist);
    glUniform1f(sheetUniforms_.sigmaGrip, pose.sigmaGrip);
    // Fixed-axis perspective (2026-08-30): camera distance scales with the
    // page so the plate parallax offset stays a constant fraction of W.
    glUniform1f(sheetUniforms_.cameraDist,
        kSheetCameraDistRatio * std::max(pose.width, pose.height));
    // Curl-edge highlight width (contract 8.2): clamp(0.02W, 8vp, 16vp),
    // converted to the wrap-angle half window via the local cone radius. A
    // collapsed radius has no curl left to catch light.
    float highlightPhiWidth = 0.0F;
    if (pose.radius > 1.0F) {
        const float widthVp = std::clamp(0.02F * pose.width, kCurlHighlightWidthMinVp,
            kCurlHighlightWidthMaxVp);
        highlightPhiWidth = 0.5F * widthVp / pose.radius;
    }
    glUniform1f(sheetUniforms_.highlightPhiWidth, highlightPhiWidth);
    glUniform1f(sheetUniforms_.frontStripWidth, kFrontStripRatio * pose.width);
    // The fold-centered valley must not darken the resting page: at tau=0 the
    // fold sits at the free edge and the front strip (d<=0 branch) would paint
    // the flat sheet's edge at peak. The gate measures how far the fold line
    // has actually moved into the sheet along +normal: dFreeMax over 2r, so a
    // lifted tilt (tau=0, theta>0) still shades genuinely lifted material.
    float valleyGate = 0.0F;
    {
        const float dFreeMax = pose.width * pose.normal.x +
            std::max(0.0F, pose.height * pose.normal.y) - pose.axis;
        valleyGate = std::clamp(dFreeMax / std::max(1.0F, 2.0F * pose.radius), 0.0F, 1.0F);
    }
    glUniform1f(sheetUniforms_.valleyGate, valleyGate);
    glUniform3f(sheetUniforms_.paperColor, fallbackPaper_[0], fallbackPaper_[1], fallbackPaper_[2]);
    glUniform1f(sheetUniforms_.paperFallback, fallbackPaperEnabled_ ? 1.0F : 0.0F);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, Slot(slot).handle);
    glUniform1i(sheetUniforms_.texture, 0);
    glBindVertexArray(sheetVao_);
    glDrawElements(GL_TRIANGLES, sheetIndexCount_, GL_UNSIGNED_SHORT, nullptr);
}

void BookTurnRenderer::SetThemePaper(float red, float green, float blue)
{
    if (blue < 0.0F) {
        fallbackPaperEnabled_ = false;
        return;
    }
    fallbackPaper_[0] = red;
    fallbackPaper_[1] = green;
    fallbackPaper_[2] = blue;
    fallbackPaperEnabled_ = true;
}

void BookTurnRenderer::DestroyGl()
{
    std::array<GLuint, 4> handles {};
    for (size_t index = 0; index < textures_.size(); ++index) {
        handles[index] = textures_[index].handle;
        textures_[index] = TextureState {};
    }
    glDeleteTextures(static_cast<GLsizei>(handles.size()), handles.data());
    glDeleteBuffers(1, &sheetIbo_);
    glDeleteBuffers(1, &sheetVbo_);
    glDeleteVertexArrays(1, &sheetVao_);
    glDeleteBuffers(1, &bottomVbo_);
    glDeleteVertexArrays(1, &bottomVao_);
    glDeleteProgram(sheetProgram_);
    glDeleteProgram(bandProgram_);
    glDeleteProgram(bottomProgram_);
    bottomProgram_ = 0;
    bandProgram_ = 0;
    sheetProgram_ = 0;
    bottomVao_ = 0;
    bottomVbo_ = 0;
    sheetVao_ = 0;
    sheetVbo_ = 0;
    sheetIbo_ = 0;
    sheetIndexCount_ = 0;
    bottomUniforms_ = BottomUniforms {};
    bandUniforms_ = BandUniforms {};
    sheetUniforms_ = SheetUniforms {};
}

BookTurnRenderer::TextureState& BookTurnRenderer::Slot(TextureSlot slot)
{
    return textures_[static_cast<size_t>(slot)];
}

const BookTurnRenderer::TextureState& BookTurnRenderer::Slot(TextureSlot slot) const
{
    return textures_[static_cast<size_t>(slot)];
}

}  // namespace reader::bookturn
