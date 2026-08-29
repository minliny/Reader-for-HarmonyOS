#ifndef READER_BOOKTURN_RENDERER_H
#define READER_BOOKTURN_RENDERER_H

#include "bookturn_solver.h"

#include <EGL/egl.h>
#include <GLES3/gl3.h>

#include <array>
#include <cstdint>
#include <string>
#include <vector>

namespace reader::bookturn {

enum class TextureSlot : int32_t {
    PREVIOUS = 0,
    CURRENT = 1,
    NEXT = 2,
    STAGING = 3,
};

enum class TextureSourceFormat : int32_t {
    RGBA_8888 = 0,
    BGRA_8888 = 1,
    RGB_565 = 2,
    RGB_888 = 3,
};

struct TexturePayload {
    TextureSlot slot = TextureSlot::STAGING;
    uint32_t width = 0;
    uint32_t height = 0;
    uint32_t rowStride = 0;
    TextureSourceFormat sourceFormat = TextureSourceFormat::RGBA_8888;
    std::string identity;
    /** Raw snapshot rows. RGB8 compaction happens on the render thread. */
    std::vector<uint8_t> pixels;
};

/** GLES3 renderer; every GL object and EGL context is owned by one render thread. */
class BookTurnRenderer final {
public:
    BookTurnRenderer() = default;
    ~BookTurnRenderer();

    BookTurnRenderer(const BookTurnRenderer&) = delete;
    BookTurnRenderer& operator=(const BookTurnRenderer&) = delete;

    bool Initialize(void* nativeWindow, uint64_t width, uint64_t height);
    void Resize(uint64_t width, uint64_t height);
    void Shutdown();
    bool Upload(TexturePayload&& payload);
    void Invalidate(TextureSlot slot);
    bool HasRequiredTextures(Direction direction) const;
    uint32_t ReadyMask() const;
    bool Draw(const BookTurnPose& pose);
    bool Clear();
    void CommitSlots(Direction direction);

private:
    // The free edge bends primarily along page height while the cylinder bends
    // across page width. 64x128 removes visible chords on phone-density
    // surfaces while staying below 17k triangles per frame.
    static constexpr int kMeshColumns = 64;
    static constexpr int kMeshRows = 128;

    struct TextureState {
        GLuint handle = 0;
        uint32_t width = 0;
        uint32_t height = 0;
        std::string identity;
        bool ready = false;
    };

    struct BottomUniforms {
        GLint pageSize = -1;
        GLint normal = -1;
        GLint axis = -1;
        GLint pageWidth = -1;
        GLint texture = -1;
    };

    struct SheetUniforms {
        GLint pageSize = -1;
        GLint axis = -1;
        GLint radius = -1;
        GLint theta = -1;
        GLint texture = -1;
    };

    bool InitializeEgl(void* nativeWindow);
    bool InitializePrograms();
    bool InitializeGeometry();
    bool InitializeTextures();
    GLuint CompileShader(GLenum type, const char* source);
    GLuint LinkProgram(GLuint vertex, GLuint fragment);
    void DrawBottom(const BookTurnPose& pose, TextureSlot slot);
    void DrawSheet(const BookTurnPose& pose, TextureSlot slot);
    void DestroyGl();
    TextureState& Slot(TextureSlot slot);
    const TextureState& Slot(TextureSlot slot) const;

    EGLDisplay display_ = EGL_NO_DISPLAY;
    EGLSurface surface_ = EGL_NO_SURFACE;
    EGLContext context_ = EGL_NO_CONTEXT;
    EGLConfig config_ = nullptr;
    uint64_t surfaceWidth_ = 0;
    uint64_t surfaceHeight_ = 0;

    GLuint bottomProgram_ = 0;
    GLuint sheetProgram_ = 0;
    BottomUniforms bottomUniforms_;
    SheetUniforms sheetUniforms_;
    GLuint bottomVao_ = 0;
    GLuint bottomVbo_ = 0;
    GLuint sheetVao_ = 0;
    GLuint sheetVbo_ = 0;
    GLuint sheetIbo_ = 0;
    GLsizei sheetIndexCount_ = 0;
    std::array<TextureState, 4> textures_;
};

}  // namespace reader::bookturn

#endif  // READER_BOOKTURN_RENDERER_H
