#ifndef READER_PAGECURL_RENDERER_H
#define READER_PAGECURL_RENDERER_H

#include "pagecurl_c.h"
#include "pagecurl_pixel_buffer.h"

#include <EGL/egl.h>
#include <GLES3/gl3.h>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

namespace reader::pagecurl {

/** Program locations are resolved once after link, never during a VSync draw. */
struct PageCurlFrameUniformLocations {
    GLint fold_origin = -1;
    GLint fold_direction = -1;
    GLint curl_radius = -1;
    GLint progress = -1;
    GLint aspect = -1;
    GLint direction = -1;
};

class PageCurlRenderer final {
public:
    PageCurlRenderer() = default;
    ~PageCurlRenderer();

    bool Initialize(void* native_window, uint32_t width, uint32_t height);
    bool Resize(uint32_t width, uint32_t height);
    bool CachePage(const std::string& key, const PixelBuffer& pixels);
    [[nodiscard]] bool HasCachedPage(const std::string& key) const;
    bool SelectPages(const std::string& current_key, const std::string& target_key);
    bool Draw(const pc_curl_frame& frame);
    bool ClearTransparent();
    void Destroy();

    [[nodiscard]] bool IsReady() const;

private:
    bool CreateEgl(void* native_window);
    bool CreatePrograms();
    bool CreateMeshes();
    bool MakeCurrent();
    bool UploadTexture(GLuint texture, const PixelBuffer& pixels);
    GLuint CompileShader(GLenum type, const char* source);
    GLuint LinkProgram(const char* vertex_source, const char* fragment_source);
    void DestroyGlObjects();

    struct CachedPageTexture {
        GLuint texture = 0;
        uint64_t last_used = 0;
    };

    void EvictOneCachedPage();

    EGLDisplay display_ = EGL_NO_DISPLAY;
    EGLSurface surface_ = EGL_NO_SURFACE;
    EGLContext context_ = EGL_NO_CONTEXT;
    EGLConfig config_ = nullptr;
    uint32_t width_ = 0;
    uint32_t height_ = 0;
    GLuint page_program_ = 0;
    GLuint target_program_ = 0;
    PageCurlFrameUniformLocations page_frame_uniforms_ {};
    PageCurlFrameUniformLocations target_frame_uniforms_ {};
    GLint page_sampler_uniform_ = -1;
    GLint page_tint_uniform_ = -1;
    GLint target_sampler_uniform_ = -1;
    GLuint page_vao_ = 0;
    GLuint page_vbo_ = 0;
    GLuint page_ebo_ = 0;
    GLsizei page_index_count_ = 0;
    GLuint quad_vao_ = 0;
    GLuint quad_vbo_ = 0;
    GLuint current_texture_ = 0;
    GLuint target_texture_ = 0;
    std::string current_texture_key_;
    std::string target_texture_key_;
    std::unordered_map<std::string, CachedPageTexture> cached_pages_;
    uint64_t texture_clock_ = 0;
    bool textures_ready_ = false;
};

} // namespace reader::pagecurl

#endif
