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
    uint64_t surfaceEpoch = 0;
    TextureSlot slot = TextureSlot::STAGING;
    uint32_t width = 0;
    uint32_t height = 0;
    uint32_t rowStride = 0;
    TextureSourceFormat sourceFormat = TextureSourceFormat::RGBA_8888;
    std::string identity;
    /** Raw snapshot rows. RGB8 compaction happens on the render thread. */
    std::vector<uint8_t> pixels;
};

struct DynamicHighlights {
    std::string identity;
    // Normalized page rectangles followed by RGBA; negative alpha selects multiply.
    std::vector<std::array<float, 4>> rects;
    std::vector<std::array<float, 4>> colors;
};

/** GLES3 renderer; every GL object and EGL context is owned by one render thread. */
class BookTurnRenderer final {
public:
    /** Why the last Draw() refused; reported with RENDER_FAILURE so the host
     *  side can distinguish a transient driver swap glitch from a texture
     *  readiness gap (the cold-entry first-turn signature). */
    enum class DrawRefusal : int32_t {
        NONE = 0,
        NO_CONTEXT = 1,
        CURRENT_MISSING = 2,
        TEXTURES_MISSING = 3,
        SWAP_FAILED = 4,
    };

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
    /** Clear the EGL surface after its XComponent owner is hidden. This is
     *  intentionally separate from the retained-frame release barrier. */
    bool ClearSurface();
    /** Explicit visible clear for legacy callers. Initialization deliberately
     *  clears its back buffer without swapping; settlement paths must use
     *  ClearSurface() only after ArkUI has hidden the surface. */
    bool Clear();
    void CommitSlots(Direction direction);
    /** §7.3 tau_swap: hide the moving sheet after the early swap; Draw then
     *  emits the static base frame from the rotated CURRENT slot alone. */
    void SetSheetVisible(bool visible);
    void ShowTerminalPage(TextureSlot slot);
    /** Inverse of a CommitSlots rotation for the §7.3 rollback replay. */
    void UndoCommitSlots();
    void UndoCommitSlots(Direction direction);
    /** Theme-derived backface paper source (contract 8.6): consumed only while
     *  fallback mode is on; passing a negative blue disables the fallback. */
    void SetThemePaper(float red, float green, float blue);
    void SetDynamicHighlights(DynamicHighlights&& highlights);

    DrawRefusal LastDrawRefusal() const { return lastRefusal_; }

private:
    // Contract 10.2: 65x129 vertices / 16384 triangles; the vertex shader
    // evaluates the developable-cone mapping per frame from pose uniforms.
    static constexpr int kMeshColumns = 64;
    static constexpr int kMeshRows = 128;

    struct TextureState {
        GLuint handle = 0;
        uint32_t width = 0;
        uint32_t height = 0;
        std::string identity;
        bool ready = false;
    };

    struct HighlightUniforms { GLint count = -1; GLint rects = -1; GLint colors = -1; };

    struct BottomUniforms {
        HighlightUniforms highlights;
        GLint pageSize = -1;
        GLint texture = -1;
        GLint gutterWidth = -1;
        GLint gutterAlpha = -1;
    };

    struct BandUniforms {
        GLint pageSize = -1;
        GLint normal = -1;
        GLint tangent = -1;
        GLint axis = -1;
        GLint tau = -1;
        GLint radius = -1;
        GLint apexDist = -1;
        GLint sigmaGrip = -1;
        GLint bandWidth = -1;
        GLint bandPeak = -1;
    };

    struct SheetUniforms {
        HighlightUniforms highlights;
        GLint pageSize = -1;
        GLint axis = -1;
        GLint radius = -1;
        GLint theta = -1;
        GLint apexDist = -1;
        GLint sigmaGrip = -1;
        GLint cameraDist = -1;
        GLint texture = -1;
        GLint highlightPhiWidth = -1;
        GLint frontStripWidth = -1;
        GLint valleyGate = -1;
        GLint paperColor = -1;
        GLint paperFallback = -1;
    };

    DynamicHighlights dynamicHighlights_;
    void BindDynamicHighlights(const HighlightUniforms& uniforms, TextureSlot slot);
    bool InitializeEgl(void* nativeWindow);
    bool InitializePrograms();
    bool InitializeGeometry();
    bool InitializeTextures();
    GLuint CompileShader(GLenum type, const char* source);
    GLuint LinkProgram(GLuint vertex, GLuint fragment);
    void DrawBottom(const BookTurnPose& pose, TextureSlot slot, float gutterAlpha);
    void DrawShadowBand(const BookTurnPose& pose);
    void DrawSheet(const BookTurnPose& pose, TextureSlot slot);
    void DestroyGl();
    void ResetPresentationState();
    TextureState& Slot(TextureSlot slot);
    const TextureState& Slot(TextureSlot slot) const;

    EGLDisplay display_ = EGL_NO_DISPLAY;
    EGLSurface surface_ = EGL_NO_SURFACE;
    EGLContext context_ = EGL_NO_CONTEXT;
    EGLConfig config_ = nullptr;
    uint64_t surfaceWidth_ = 0;
    uint64_t surfaceHeight_ = 0;

    GLuint bottomProgram_ = 0;
    GLuint bandProgram_ = 0;
    GLuint sheetProgram_ = 0;
    BottomUniforms bottomUniforms_;
    BandUniforms bandUniforms_;
    SheetUniforms sheetUniforms_;
    GLuint bottomVao_ = 0;
    GLuint bottomVbo_ = 0;
    GLuint sheetVao_ = 0;
    GLuint sheetVbo_ = 0;
    GLuint sheetIbo_ = 0;
    GLsizei sheetIndexCount_ = 0;
    std::array<TextureState, 4> textures_;
    float fallbackPaper_[3] = { 1.0F, 1.0F, 1.0F };
    bool fallbackPaperEnabled_ = false;
    bool sheetVisible_ = true;
    TextureSlot terminalSlot_ = TextureSlot::CURRENT;
    DrawRefusal lastRefusal_ = DrawRefusal::NONE;
};

}  // namespace reader::bookturn

#endif  // READER_BOOKTURN_RENDERER_H
