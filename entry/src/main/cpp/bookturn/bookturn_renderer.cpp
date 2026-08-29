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

constexpr char kBottomFragmentShader[] = R"glsl(#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vPage;
layout(location = 0) out vec4 outColor;
uniform sampler2D uTexture;
uniform vec2 uNormal;
uniform float uAxis;
uniform float uPageWidth;
void main() {
    vec4 base = texture(uTexture, vUv);
    float planeDistance = dot(vPage, uNormal) - uAxis;
    float shadowWidth = clamp(0.06 * uPageWidth, 18.0, 36.0);
    float shadow = (1.0 - smoothstep(0.0, shadowWidth, abs(planeDistance))) * 0.22;
    outColor = vec4(base.rgb * (1.0 - shadow), 1.0);
}
)glsl";

constexpr char kSheetVertexShader[] = R"glsl(#version 300 es
precision highp float;
layout(location = 0) in vec2 aMaterial;
out vec2 vUv;
out vec3 vNormal;
out float vPhi;
uniform vec2 uPageSize;
uniform float uAxis;
uniform float uRadius;
uniform float uTheta;
const float PI = 3.14159265358979323846;
void main() {
    vec2 q = aMaterial * uPageSize;
    vec2 tangent = vec2(sin(uTheta), cos(uTheta));
    vec2 normal = vec2(cos(uTheta), -sin(uTheta));
    float sigma = dot(q, tangent);
    float distance = dot(q, normal) - uAxis;
    float foldedNormal = distance;
    float depth = 0.0;
    float phi = 0.0;
    if (distance > 0.0) {
        if (uRadius <= 0.0001) {
            foldedNormal = -distance;
            phi = PI;
        } else if (distance < PI * uRadius) {
            phi = distance / uRadius;
            foldedNormal = uRadius * sin(phi);
            depth = uRadius * (1.0 - cos(phi));
        } else {
            phi = PI;
            foldedNormal = -(distance - PI * uRadius);
            depth = 2.0 * uRadius;
        }
    }
    vec2 projected = sigma * tangent + (uAxis + foldedNormal) * normal;
    vec2 ndc = vec2(2.0 * projected.x / uPageSize.x - 1.0,
                    1.0 - 2.0 * projected.y / uPageSize.y);
    float depthNdc = -0.45 * clamp(depth / 64.0, 0.0, 1.0);
    gl_Position = vec4(ndc, depthNdc, 1.0);
    vUv = aMaterial;
    vNormal = vec3(-sin(phi) * normal, cos(phi));
    vPhi = phi;
}
)glsl";

constexpr char kSheetFragmentShader[] = R"glsl(#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vNormal;
in float vPhi;
layout(location = 0) out vec4 outColor;
uniform sampler2D uTexture;
void main() {
    vec4 sampleColor = texture(uTexture, vUv);
    vec3 normal = normalize(vNormal);
    vec3 light = normalize(vec3(-0.32, -0.20, 0.93));
    const float HALF_PI = 1.57079632679;
    float backMix = smoothstep(HALF_PI - 0.04, HALF_PI + 0.04, vPhi);
    float diffuse = mix(max(dot(normal, light), 0.0), max(dot(-normal, light), 0.0), backMix);
    float lighting = 0.94 + 0.06 * diffuse;
    vec3 frontColor = sampleColor.rgb;
    float luminance = dot(frontColor, vec3(0.2126, 0.7152, 0.0722));
    // The back is the same physical page. Preserve the active theme/background
    // hue and only apply a small paper transmission/desaturation term; a fixed
    // beige replacement makes night and custom backgrounds visibly wrong.
    vec3 backColor = mix(frontColor, vec3(luminance), 0.10) * 0.96;
    vec3 color = mix(frontColor, backColor, backMix);
    float creaseDistance = abs(vPhi - 1.57079632679);
    float dark = (1.0 - smoothstep(0.0, 0.42, creaseDistance)) * 0.12;
    float highlight = (1.0 - smoothstep(0.0, 0.20, abs(vPhi - 1.25))) * 0.04;
    color = color * lighting * (1.0 - dark + highlight);
    outColor = vec4(color, 1.0);
}
)glsl";

constexpr std::array<float, 16> kBottomVertices = {
    -1.0F,  1.0F, 0.0F, 0.0F,
    -1.0F, -1.0F, 0.0F, 1.0F,
     1.0F,  1.0F, 1.0F, 0.0F,
     1.0F, -1.0F, 1.0F, 1.0F,
};

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
    if (context_ == EGL_NO_CONTEXT || !HasRequiredTextures(pose.direction)) return false;
    glViewport(0, 0, static_cast<GLsizei>(surfaceWidth_), static_cast<GLsizei>(surfaceHeight_));
    glClearColor(0.0F, 0.0F, 0.0F, 0.0F);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    glDisable(GL_BLEND);
    glDisable(GL_CULL_FACE);
    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LEQUAL);
    const TextureSlot bottom = pose.direction == Direction::NEXT ? TextureSlot::NEXT : TextureSlot::CURRENT;
    const TextureSlot moving = pose.direction == Direction::NEXT ? TextureSlot::CURRENT : TextureSlot::PREVIOUS;
    DrawBottom(pose, bottom);
    DrawSheet(pose, moving);
    return eglSwapBuffers(display_, surface_) == EGL_TRUE;
}

bool BookTurnRenderer::Clear()
{
    if (context_ == EGL_NO_CONTEXT) return false;
    glDisable(GL_DEPTH_TEST);
    glClearColor(0.0F, 0.0F, 0.0F, 0.0F);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    return eglSwapBuffers(display_, surface_) == EGL_TRUE;
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
    vertex = CompileShader(GL_VERTEX_SHADER, kSheetVertexShader);
    fragment = CompileShader(GL_FRAGMENT_SHADER, kSheetFragmentShader);
    sheetProgram_ = LinkProgram(vertex, fragment);
    glDeleteShader(vertex);
    glDeleteShader(fragment);
    if (bottomProgram_ == 0 || sheetProgram_ == 0) return false;
    bottomUniforms_.pageSize = glGetUniformLocation(bottomProgram_, "uPageSize");
    bottomUniforms_.normal = glGetUniformLocation(bottomProgram_, "uNormal");
    bottomUniforms_.axis = glGetUniformLocation(bottomProgram_, "uAxis");
    bottomUniforms_.pageWidth = glGetUniformLocation(bottomProgram_, "uPageWidth");
    bottomUniforms_.texture = glGetUniformLocation(bottomProgram_, "uTexture");
    sheetUniforms_.pageSize = glGetUniformLocation(sheetProgram_, "uPageSize");
    sheetUniforms_.axis = glGetUniformLocation(sheetProgram_, "uAxis");
    sheetUniforms_.radius = glGetUniformLocation(sheetProgram_, "uRadius");
    sheetUniforms_.theta = glGetUniformLocation(sheetProgram_, "uTheta");
    sheetUniforms_.texture = glGetUniformLocation(sheetProgram_, "uTexture");
    return bottomUniforms_.pageSize >= 0 && bottomUniforms_.normal >= 0 &&
        bottomUniforms_.axis >= 0 && bottomUniforms_.pageWidth >= 0 && bottomUniforms_.texture >= 0 &&
        sheetUniforms_.pageSize >= 0 && sheetUniforms_.axis >= 0 && sheetUniforms_.radius >= 0 &&
        sheetUniforms_.theta >= 0 && sheetUniforms_.texture >= 0;
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
    glUniform2f(bottomUniforms_.normal, pose.normal.x, pose.normal.y);
    glUniform1f(bottomUniforms_.axis, pose.axis);
    glUniform1f(bottomUniforms_.pageWidth, pose.width);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, Slot(slot).handle);
    glUniform1i(bottomUniforms_.texture, 0);
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
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, Slot(slot).handle);
    glUniform1i(sheetUniforms_.texture, 0);
    glBindVertexArray(sheetVao_);
    glDrawElements(GL_TRIANGLES, sheetIndexCount_, GL_UNSIGNED_SHORT, nullptr);
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
    glDeleteProgram(bottomProgram_);
    bottomProgram_ = 0;
    sheetProgram_ = 0;
    bottomVao_ = 0;
    bottomVbo_ = 0;
    sheetVao_ = 0;
    sheetVbo_ = 0;
    sheetIbo_ = 0;
    sheetIndexCount_ = 0;
    bottomUniforms_ = BottomUniforms {};
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
