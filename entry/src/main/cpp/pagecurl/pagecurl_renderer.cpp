#include "pagecurl_renderer.h"
#include "pagecurl_mesh.h"

#include <EGL/eglext.h>
#include <array>
#include <cstddef>
#include <vector>

namespace reader::pagecurl {
namespace {
constexpr size_t kMaxCachedPages = 3;
constexpr uint32_t kSheetColumns = 32;
constexpr uint32_t kSheetRows = 48;

constexpr const char* kPageVertexShader = R"glsl(#version 300 es
precision highp float;
layout(location = 0) in vec2 aMaterialUv;

uniform vec2 uFoldOrigin;
uniform vec2 uFoldDirection;
uniform float uCurlRadius;
uniform float uAspect;
uniform float uDirection;

out vec2 vTexCoord;
out vec3 vNormal;
out float vCurlAngle;
out float vHeight;
out float vEdgeDistance;

const float PI = 3.14159265359;
const float BINDING_WIDTH = 0.075;

float canonicalX(float x) {
    return uDirection < 0.0 ? 1.0 - x : x;
}

float physicalX(float x) {
    return uDirection < 0.0 ? 1.0 - x : x;
}

void main() {
    vec2 material = vec2(canonicalX(aMaterialUv.x), aMaterialUv.y * uAspect);
    vec2 origin = vec2(canonicalX(uFoldOrigin.x), uFoldOrigin.y * uAspect);
    vec2 normal = normalize(vec2(uDirection < 0.0 ? -uFoldDirection.x : uFoldDirection.x,
        uFoldDirection.y));
    vec2 relative = material - origin;
    float signedDistance = dot(relative, normal);

    float radius = max(uCurlRadius, 0.004);
    float curlLength = PI * radius;
    float mappedDistance = signedDistance;
    float height = 0.0;
    float angle = 0.0;
    if (signedDistance > 0.0) {
        if (signedDistance < curlLength) {
            angle = signedDistance / radius;
            mappedDistance = radius * sin(angle);
            height = radius * (1.0 - cos(angle));
        } else {
            angle = PI;
            mappedDistance = -(signedDistance - curlLength);
            height = 2.0 * radius;
        }
    }

    vec2 curled = material + normal * (mappedDistance - signedDistance);
    // The free-edge control point follows the finger's exact 2D displacement. Pin the
    // canonical binding line in the shader and distribute the unavoidable
    // clamp through one narrow spine band, instead of projecting the complete
    // pointer trajectory and making the visible page detach or mirror-snap.
    float bindingWeight = smoothstep(0.0, BINDING_WIDTH, material.x);
    vec2 deformed = mix(material, curled, bindingWeight);
    height *= bindingWeight;
    vec2 physical = vec2(physicalX(deformed.x), deformed.y / uAspect);
    vec2 ndc = vec2(physical.x * 2.0 - 1.0, (1.0 - physical.y) * 2.0 - 1.0);
    // Orthographic projection preserves the developable cylinder's material
    // lengths. The former pointer-pivot perspective divided every lifted
    // vertex by W<1 and was the direct source of fan-shaped page stretching.
    gl_Position = vec4(ndc, -height * 0.7, 1.0);

    float sine = sin(angle);
    float cosine = cos(angle);
    vNormal = normalize(vec3(-normal.x * sine, normal.y * sine, cosine));
    vTexCoord = aMaterialUv;
    vCurlAngle = angle;
    vHeight = height;
    vEdgeDistance = min(min(aMaterialUv.x, 1.0 - aMaterialUv.x),
        min(aMaterialUv.y, 1.0 - aMaterialUv.y));
}
)glsl";

constexpr const char* kPageFragmentShader = R"glsl(#version 300 es
precision highp float;
uniform sampler2D uCurrentPage;
uniform vec4 uPaperTint;
in vec2 vTexCoord;
in vec3 vNormal;
in float vCurlAngle;
in float vHeight;
in float vEdgeDistance;
out vec4 outColor;

void main() {
    vec4 source = texture(uCurrentPage, vTexCoord);
    bool backFacing = !gl_FrontFacing || vCurlAngle > 1.57079632679;
    vec3 lightDirection = normalize(vec3(-0.38, -0.46, 0.80));
    float diffuse = 0.72 + 0.28 * max(dot(normalize(vNormal), lightDirection), 0.0);
    float foldOcclusion = 1.0 - 0.22 * sin(clamp(vCurlAngle, 0.0, 3.14159265359));
    float highlight = exp(-pow((vCurlAngle - 1.14) / 0.24, 2.0)) * 0.10;
    vec3 frontColor = source.rgb * diffuse * foldOcclusion + vec3(highlight);
    vec3 backInk = mix(source.rgb, uPaperTint.rgb, 0.42);
    float backLight = 0.78 + 0.14 * max(dot(-normalize(vNormal), lightDirection), 0.0);
    vec3 backColor = backInk * backLight;
    vec3 color = backFacing ? backColor : frontColor;

    // A density-independent material edge stays attached to the deformed
    // silhouette. fwidth makes the coverage stable across phone resolutions.
    float edgeWidth = max(fwidth(vEdgeDistance) * 1.35, 0.00035);
    float edgeCoverage = smoothstep(0.0, edgeWidth, vEdgeDistance);
    vec3 edgeColor = mix(uPaperTint.rgb * 0.72, vec3(1.0), 0.18 + min(vHeight * 2.0, 0.22));
    color = mix(edgeColor, color, edgeCoverage);
    outColor = vec4(color, source.a);
}
)glsl";

constexpr const char* kTargetVertexShader = R"glsl(#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
layout(location = 1) in vec2 aTexCoord;
out vec2 vTexCoord;
void main() {
    gl_Position = vec4(aPosition.x * 2.0 - 1.0, (1.0 - aPosition.y) * 2.0 - 1.0, 0.0, 1.0);
    vTexCoord = aTexCoord;
}
)glsl";

constexpr const char* kTargetFragmentShader = R"glsl(#version 300 es
precision highp float;
uniform sampler2D uTargetPage;
uniform vec2 uFoldOrigin;
uniform vec2 uFoldDirection;
uniform float uCurlRadius;
uniform float uProgress;
uniform float uAspect;
uniform float uDirection;
in vec2 vTexCoord;
out vec4 outColor;

float canonicalX(float x) {
    return uDirection < 0.0 ? 1.0 - x : x;
}

void main() {
    vec2 page = vec2(canonicalX(vTexCoord.x), vTexCoord.y * uAspect);
    vec2 origin = vec2(canonicalX(uFoldOrigin.x), uFoldOrigin.y * uAspect);
    vec2 normal = normalize(vec2(uDirection < 0.0 ? -uFoldDirection.x : uFoldDirection.x,
        uFoldDirection.y));
    vec2 relative = page - origin;
    float distanceToCrease = abs(dot(relative, normal));
    float lift = min(1.0, uCurlRadius / 0.12);
    float shadowWidth = mix(0.014, 0.072, lift);
    float contactShadow = 1.0 - smoothstep(0.0, shadowWidth, distanceToCrease);
    float shadow = contactShadow * mix(0.12, 0.34, lift) * smoothstep(0.01, 0.16, uProgress);
    vec4 source = texture(uTargetPage, vTexCoord);
    outColor = vec4(source.rgb * (1.0 - shadow), source.a);
}
)glsl";

PageCurlFrameUniformLocations QueryFrameUniforms(GLuint program)
{
    return {
        glGetUniformLocation(program, "uFoldOrigin"),
        glGetUniformLocation(program, "uFoldDirection"),
        glGetUniformLocation(program, "uCurlRadius"),
        glGetUniformLocation(program, "uProgress"),
        glGetUniformLocation(program, "uAspect"),
        glGetUniformLocation(program, "uDirection"),
    };
}

void SetFrameUniforms(
    const PageCurlFrameUniformLocations& uniforms,
    const pc_curl_frame& frame,
    float aspect)
{
    glUniform2f(uniforms.fold_origin, frame.fold_origin_x, frame.fold_origin_y);
    glUniform2f(uniforms.fold_direction,
        frame.fold_direction_x, frame.fold_direction_y);
    glUniform1f(uniforms.curl_radius, frame.curl_radius);
    glUniform1f(uniforms.progress, frame.progress);
    glUniform1f(uniforms.aspect, aspect);
    glUniform1f(uniforms.direction, static_cast<float>(frame.direction));
}
} // namespace

PageCurlRenderer::~PageCurlRenderer()
{
    Destroy();
}

bool PageCurlRenderer::Initialize(void* native_window, uint32_t width, uint32_t height)
{
    Destroy();
    if (native_window == nullptr || width == 0 || height == 0 || !CreateEgl(native_window) || !MakeCurrent()) {
        Destroy();
        return false;
    }
    width_ = width;
    height_ = height;
    if (!CreatePrograms() || !CreateMeshes()) {
        Destroy();
        return false;
    }
    glViewport(0, 0, static_cast<GLsizei>(width_), static_cast<GLsizei>(height_));
    glDisable(GL_CULL_FACE);
    glEnable(GL_DEPTH_TEST);
    glDepthFunc(GL_LEQUAL);
    glEnable(GL_BLEND);
    glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
    const bool cleared = ClearTransparent();
    eglMakeCurrent(display_, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
    return cleared;
}

bool PageCurlRenderer::Resize(uint32_t width, uint32_t height)
{
    if (!IsReady() || width == 0 || height == 0) return false;
    width_ = width;
    height_ = height;
    return true;
}

bool PageCurlRenderer::CachePage(const std::string& key, const PixelBuffer& pixels)
{
    if (!IsReady() || key.empty() || !pixels.IsValid() || !MakeCurrent()) return false;
    auto found = cached_pages_.find(key);
    if (found == cached_pages_.end()) {
        if (cached_pages_.size() >= kMaxCachedPages) EvictOneCachedPage();
        GLuint texture = 0;
        glGenTextures(1, &texture);
        if (texture == 0) {
            eglMakeCurrent(display_, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
            return false;
        }
        found = cached_pages_.emplace(key, CachedPageTexture {texture, ++texture_clock_}).first;
    }
    const bool uploaded = UploadTexture(found->second.texture, pixels);
    found->second.last_used = ++texture_clock_;
    if (!uploaded) {
        const GLuint failed_texture = found->second.texture;
        glDeleteTextures(1, &failed_texture);
        cached_pages_.erase(found);
    }
    eglMakeCurrent(display_, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
    return uploaded;
}

bool PageCurlRenderer::HasCachedPage(const std::string& key) const
{
    return !key.empty() && cached_pages_.find(key) != cached_pages_.end();
}

bool PageCurlRenderer::SelectPages(const std::string& current_key, const std::string& target_key)
{
    auto current = cached_pages_.find(current_key);
    auto target = cached_pages_.find(target_key);
    if (current == cached_pages_.end() || target == cached_pages_.end()) return false;
    current_texture_ = current->second.texture;
    target_texture_ = target->second.texture;
    current_texture_key_ = current_key;
    target_texture_key_ = target_key;
    current->second.last_used = ++texture_clock_;
    target->second.last_used = ++texture_clock_;
    textures_ready_ = true;
    return true;
}

bool PageCurlRenderer::Draw(const pc_curl_frame& frame)
{
    if (!IsReady() || !textures_ready_ || page_index_count_ <= 0 || !MakeCurrent()) return false;
    const float aspect = static_cast<float>(height_) / static_cast<float>(width_);
    glViewport(0, 0, static_cast<GLsizei>(width_), static_cast<GLsizei>(height_));
    glClearColor(0.0F, 0.0F, 0.0F, 0.0F);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    glDisable(GL_DEPTH_TEST);
    glUseProgram(target_program_);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, target_texture_);
    glUniform1i(target_sampler_uniform_, 0);
    SetFrameUniforms(target_frame_uniforms_, frame, aspect);
    glBindVertexArray(quad_vao_);
    glDrawArrays(GL_TRIANGLE_STRIP, 0, 4);

    glEnable(GL_DEPTH_TEST);
    glClear(GL_DEPTH_BUFFER_BIT);
    glUseProgram(page_program_);
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, current_texture_);
    glUniform1i(page_sampler_uniform_, 0);
    glUniform4f(page_tint_uniform_, 0.94F, 0.92F, 0.86F, 1.0F);
    SetFrameUniforms(page_frame_uniforms_, frame, aspect);
    glBindVertexArray(page_vao_);
    glDrawElements(GL_TRIANGLES, page_index_count_, GL_UNSIGNED_SHORT, nullptr);
    glBindVertexArray(0);

    const bool success = eglSwapBuffers(display_, surface_) == EGL_TRUE;
    eglMakeCurrent(display_, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
    return success;
}

bool PageCurlRenderer::ClearTransparent()
{
    if (!IsReady() || !MakeCurrent()) return false;
    glViewport(0, 0, static_cast<GLsizei>(width_), static_cast<GLsizei>(height_));
    glClearColor(0.0F, 0.0F, 0.0F, 0.0F);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
    const bool success = eglSwapBuffers(display_, surface_) == EGL_TRUE;
    current_texture_ = 0;
    target_texture_ = 0;
    current_texture_key_.clear();
    target_texture_key_.clear();
    textures_ready_ = false;
    eglMakeCurrent(display_, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
    return success;
}

void PageCurlRenderer::Destroy()
{
    if (display_ != EGL_NO_DISPLAY && context_ != EGL_NO_CONTEXT) {
        if (MakeCurrent()) DestroyGlObjects();
        eglMakeCurrent(display_, EGL_NO_SURFACE, EGL_NO_SURFACE, EGL_NO_CONTEXT);
    }
    if (display_ != EGL_NO_DISPLAY && surface_ != EGL_NO_SURFACE) eglDestroySurface(display_, surface_);
    if (display_ != EGL_NO_DISPLAY && context_ != EGL_NO_CONTEXT) eglDestroyContext(display_, context_);
    if (display_ != EGL_NO_DISPLAY) eglTerminate(display_);
    display_ = EGL_NO_DISPLAY;
    surface_ = EGL_NO_SURFACE;
    context_ = EGL_NO_CONTEXT;
    config_ = nullptr;
    width_ = 0;
    height_ = 0;
    textures_ready_ = false;
}

bool PageCurlRenderer::IsReady() const
{
    return display_ != EGL_NO_DISPLAY && surface_ != EGL_NO_SURFACE && context_ != EGL_NO_CONTEXT;
}

bool PageCurlRenderer::CreateEgl(void* native_window)
{
    display_ = eglGetDisplay(EGL_DEFAULT_DISPLAY);
    if (display_ == EGL_NO_DISPLAY || eglInitialize(display_, nullptr, nullptr) != EGL_TRUE) return false;
    const EGLint attributes[] = {
        EGL_SURFACE_TYPE, EGL_WINDOW_BIT,
        EGL_RENDERABLE_TYPE, EGL_OPENGL_ES3_BIT,
        EGL_RED_SIZE, 8,
        EGL_GREEN_SIZE, 8,
        EGL_BLUE_SIZE, 8,
        EGL_ALPHA_SIZE, 8,
        EGL_DEPTH_SIZE, 16,
        EGL_NONE,
    };
    EGLint count = 0;
    if (eglChooseConfig(display_, attributes, &config_, 1, &count) != EGL_TRUE || count < 1) return false;
    const EGLint context_attributes[] = {EGL_CONTEXT_CLIENT_VERSION, 3, EGL_NONE};
    context_ = eglCreateContext(display_, config_, EGL_NO_CONTEXT, context_attributes);
    if (context_ == EGL_NO_CONTEXT) return false;
    surface_ = eglCreateWindowSurface(display_, config_, static_cast<EGLNativeWindowType>(native_window), nullptr);
    return surface_ != EGL_NO_SURFACE;
}

bool PageCurlRenderer::CreatePrograms()
{
    page_program_ = LinkProgram(kPageVertexShader, kPageFragmentShader);
    target_program_ = LinkProgram(kTargetVertexShader, kTargetFragmentShader);
    if (page_program_ == 0 || target_program_ == 0) return false;
    page_frame_uniforms_ = QueryFrameUniforms(page_program_);
    target_frame_uniforms_ = QueryFrameUniforms(target_program_);
    page_sampler_uniform_ = glGetUniformLocation(page_program_, "uCurrentPage");
    page_tint_uniform_ = glGetUniformLocation(page_program_, "uPaperTint");
    target_sampler_uniform_ = glGetUniformLocation(target_program_, "uTargetPage");
    return page_sampler_uniform_ >= 0 && page_tint_uniform_ >= 0 && target_sampler_uniform_ >= 0;
}

bool PageCurlRenderer::CreateMeshes()
{
    std::vector<SheetMeshVertex> vertices;
    std::vector<uint16_t> indices;
    if (!BuildStaticSheetMesh(kSheetColumns, kSheetRows, vertices, indices)) return false;
    page_index_count_ = static_cast<GLsizei>(indices.size());

    glGenVertexArrays(1, &page_vao_);
    glGenBuffers(1, &page_vbo_);
    glGenBuffers(1, &page_ebo_);
    glBindVertexArray(page_vao_);
    glBindBuffer(GL_ARRAY_BUFFER, page_vbo_);
    glBufferData(GL_ARRAY_BUFFER, static_cast<GLsizeiptr>(vertices.size() * sizeof(SheetMeshVertex)),
        vertices.data(), GL_STATIC_DRAW);
    glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, page_ebo_);
    glBufferData(GL_ELEMENT_ARRAY_BUFFER, static_cast<GLsizeiptr>(indices.size() * sizeof(uint16_t)),
        indices.data(), GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, sizeof(SheetMeshVertex), nullptr);

    const std::array<float, 16> quad = {{0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 1, 1}};
    glGenVertexArrays(1, &quad_vao_);
    glGenBuffers(1, &quad_vbo_);
    glBindVertexArray(quad_vao_);
    glBindBuffer(GL_ARRAY_BUFFER, quad_vbo_);
    glBufferData(GL_ARRAY_BUFFER, sizeof(quad), quad.data(), GL_STATIC_DRAW);
    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), nullptr);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float),
        reinterpret_cast<void*>(2 * sizeof(float)));
    glBindVertexArray(0);
    return glGetError() == GL_NO_ERROR;
}

bool PageCurlRenderer::MakeCurrent()
{
    return IsReady() && eglMakeCurrent(display_, surface_, surface_, context_) == EGL_TRUE;
}

bool PageCurlRenderer::UploadTexture(GLuint texture, const PixelBuffer& pixels)
{
    glBindTexture(GL_TEXTURE_2D, texture);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glPixelStorei(GL_UNPACK_ALIGNMENT, 1);
    glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, static_cast<GLsizei>(pixels.width),
        static_cast<GLsizei>(pixels.height), 0, GL_RGBA, GL_UNSIGNED_BYTE, pixels.rgba.data());
    return glGetError() == GL_NO_ERROR;
}

GLuint PageCurlRenderer::CompileShader(GLenum type, const char* source)
{
    const GLuint shader = glCreateShader(type);
    if (shader == 0) return 0;
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

GLuint PageCurlRenderer::LinkProgram(const char* vertex_source, const char* fragment_source)
{
    const GLuint vertex = CompileShader(GL_VERTEX_SHADER, vertex_source);
    const GLuint fragment = CompileShader(GL_FRAGMENT_SHADER, fragment_source);
    if (vertex == 0 || fragment == 0) {
        if (vertex != 0) glDeleteShader(vertex);
        if (fragment != 0) glDeleteShader(fragment);
        return 0;
    }
    const GLuint program = glCreateProgram();
    glAttachShader(program, vertex);
    glAttachShader(program, fragment);
    glLinkProgram(program);
    glDeleteShader(vertex);
    glDeleteShader(fragment);
    GLint linked = GL_FALSE;
    glGetProgramiv(program, GL_LINK_STATUS, &linked);
    if (linked != GL_TRUE) {
        glDeleteProgram(program);
        return 0;
    }
    return program;
}

void PageCurlRenderer::DestroyGlObjects()
{
    for (const auto& entry : cached_pages_) {
        if (entry.second.texture != 0) glDeleteTextures(1, &entry.second.texture);
    }
    if (page_ebo_ != 0) glDeleteBuffers(1, &page_ebo_);
    if (page_vbo_ != 0) glDeleteBuffers(1, &page_vbo_);
    if (quad_vbo_ != 0) glDeleteBuffers(1, &quad_vbo_);
    if (page_vao_ != 0) glDeleteVertexArrays(1, &page_vao_);
    if (quad_vao_ != 0) glDeleteVertexArrays(1, &quad_vao_);
    if (page_program_ != 0) glDeleteProgram(page_program_);
    if (target_program_ != 0) glDeleteProgram(target_program_);
    current_texture_ = target_texture_ = 0;
    current_texture_key_.clear();
    target_texture_key_.clear();
    cached_pages_.clear();
    texture_clock_ = 0;
    page_ebo_ = page_vbo_ = quad_vbo_ = 0;
    page_vao_ = quad_vao_ = 0;
    page_index_count_ = 0;
    page_program_ = target_program_ = 0;
    page_frame_uniforms_ = {};
    target_frame_uniforms_ = {};
    page_sampler_uniform_ = -1;
    page_tint_uniform_ = -1;
    target_sampler_uniform_ = -1;
}

void PageCurlRenderer::EvictOneCachedPage()
{
    auto candidate = cached_pages_.end();
    for (auto entry = cached_pages_.begin(); entry != cached_pages_.end(); ++entry) {
        if (entry->first == current_texture_key_ || entry->first == target_texture_key_) continue;
        if (candidate == cached_pages_.end() || entry->second.last_used < candidate->second.last_used) {
            candidate = entry;
        }
    }
    if (candidate == cached_pages_.end()) {
        for (auto entry = cached_pages_.begin(); entry != cached_pages_.end(); ++entry) {
            if (candidate == cached_pages_.end() || entry->second.last_used < candidate->second.last_used) {
                candidate = entry;
            }
        }
    }
    if (candidate == cached_pages_.end()) return;
    const GLuint texture = candidate->second.texture;
    if (texture != 0) glDeleteTextures(1, &texture);
    if (candidate->first == current_texture_key_) current_texture_key_.clear();
    if (candidate->first == target_texture_key_) target_texture_key_.clear();
    cached_pages_.erase(candidate);
}

} // namespace reader::pagecurl
