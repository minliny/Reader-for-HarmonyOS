// Bookturn renderer state-assertion test (contract 13.3 item 4, standalone;
// not part of the HAP build). The renderer compiles unchanged against the
// glmock headers, so every frame's GL command stream is observable:
//   - exactly 3 draw commands (2 quad strips + 1 sheet element draw),
//   - exactly 2 blend state switches per frame (enter draw 2, enter draw 3),
//   - depth write off during the shadow pass, back on for the sheet,
//   - depth func LEQUAL, blend func SRC_ALPHA / ONE_MINUS_SRC_ALPHA,
//   - no FBO/MSAA/blit/readback surface anywhere (those symbols do not even
//     exist in the mock link surface, so a new use would fail to link).
#include "bookturn_renderer.h"

#include "gl_mock.h"

#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

using namespace reader::bookturn;

namespace {

int g_checks = 0;
int g_failures = 0;

void Check(const char* label, bool condition)
{
    ++g_checks;
    if (!condition) {
        ++g_failures;
        std::printf("FAIL %s\n", label);
    }
}

int CountName(const char* name)
{
    int count = 0;
    for (const glmock::Entry& entry : glmock::Log()) {
        if (std::strcmp(entry.name, name) == 0) {
            ++count;
        }
    }
    return count;
}

bool HasPair(const char* name, int64_t a, int64_t b)
{
    for (const glmock::Entry& entry : glmock::Log()) {
        if (std::strcmp(entry.name, name) == 0 && entry.a == a && entry.b == b) {
            return true;
        }
    }
    return false;
}

TexturePayload MakePayload(TextureSlot slot, const char* identity)
{
    TexturePayload payload;
    payload.slot = slot;
    payload.width = 8;
    payload.height = 8;
    payload.rowStride = 8 * 3;
    payload.sourceFormat = TextureSourceFormat::RGB_888;
    payload.identity = identity;
    payload.pixels.assign(static_cast<size_t>(8) * 8 * 3, 200);
    return payload;
}

void AssertFrameState(const char* context)
{
    const std::string prefix = std::string(context);
    Check((prefix + " drawArrays == 2").c_str(), CountName("glDrawArrays") == 2);
    Check((prefix + " drawElements == 1").c_str(), CountName("glDrawElements") == 1);
    Check((prefix + " blend switches == 2").c_str(), CountName("BLEND_SWITCH") == 2);
    Check((prefix + " blend ends off").c_str(), HasPair("BLEND_SWITCH", 0, 0));
    Check((prefix + " blend func src/1m").c_str(),
        HasPair("glBlendFuncSeparate", GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA));
    // The shadow pass must not scale the destination ALPHA: the composited
    // EGL surface would let the ArkUI page underneath bleed through the band.
    Check((prefix + " blend alpha pinned").c_str(),
        HasPair("glBlendFuncSeparateAlpha", GL_ZERO, GL_ONE));
    Check((prefix + " depth func LEQUAL").c_str(), HasPair("glDepthFunc", GL_LEQUAL, 0));
    Check((prefix + " depth write off once").c_str(), HasPair("DEPTH_MASK_SWITCH", 0, 0));
    Check((prefix + " depth write on once").c_str(), HasPair("DEPTH_MASK_SWITCH", 1, 0));
    // FBO/MSAA/blit/readback symbols do not exist in the mock link surface, so
    // any new renderer use of them fails to link; the runtime check guards the
    // one MSAA capability that shares glEnable.
    Check((prefix + " no MSAA enable").c_str(), !HasPair("glEnable", GL_MULTISAMPLE, 0));
}

}  // namespace

int main()
{
    BookTurnRenderer renderer;
    Check("initialize", renderer.Initialize((void*)0x1, 390, 780));
    Check("upload current", renderer.Upload(MakePayload(TextureSlot::CURRENT, "page-current")));
    Check("upload next", renderer.Upload(MakePayload(TextureSlot::NEXT, "page-next")));
    Check("upload previous", renderer.Upload(MakePayload(TextureSlot::PREVIOUS, "page-previous")));
    Check("ready next", renderer.HasRequiredTextures(Direction::NEXT));
    Check("ready previous", renderer.HasRequiredTextures(Direction::PREVIOUS));

    // Refusal path: without textures no draw command may be emitted.
    BookTurnRenderer bare;
    Check("bare initialize", bare.Initialize((void*)0x2, 390, 780));
    glmock::Reset();
    const BookTurnInput blocked;
    Check("bare draw refused", !bare.Draw(BookTurnSolver::Solve(blocked)));
    Check("refused emits no draw", CountName("glDrawArrays") == 0 && CountName("glDrawElements") == 0);

    constexpr float kWidth = 390.0F;
    constexpr float kHeight = 780.0F;
    constexpr int kTauSamples = 13;
    uint64_t generation = 1;
    int frame = 0;
    for (int pass = 0; pass < 2; ++pass) {
        const Direction direction = pass == 0 ? Direction::NEXT : Direction::PREVIOUS;
        for (int index = 0; index < kTauSamples; ++index) {
            // Same-edge ladder: edge.x = W * xNorm(tau) drives tau for both
            // directions (tau = s^-1(edge/W) is direction-independent).
            const float tau = static_cast<float>(index) / static_cast<float>(kTauSamples - 1);
            float xNorm = 1.0F;
            float beta = 0.0F;
            float scale = 1.0F;
            BookTurnSolver::Schedule(tau, xNorm, beta, scale);
            (void)beta;
            (void)scale;
            BookTurnInput input;
            input.generation = generation++;
            input.direction = direction;
            input.width = kWidth;
            input.height = kHeight;
            input.start = { 0.5F * kWidth, 0.5F * kHeight };
            input.pointer = input.start;
            input.edge = { kWidth * xNorm, 0.5F * kHeight };
            input.eventTimeNs = static_cast<int64_t>(tau * 6.0e8);
            const BookTurnPose pose = BookTurnSolver::Solve(input);
            glmock::Reset();
            const std::string label = (pass == 0 ? "next" : "previous") + std::string("[") +
                std::to_string(index) + "]";
            Check(("draw " + label).c_str(), renderer.Draw(pose));
            AssertFrameState(label.c_str());
            ++frame;
        }
    }
    Check("frames exercised", frame == 2 * kTauSamples);

    // Tilted frame: cone taper and highlight uniforms flow through the same
    // state structure.
    {
        BookTurnInput input;
        input.generation = generation++;
        input.direction = Direction::NEXT;
        input.width = kWidth;
        input.height = kHeight;
        input.start = { 0.5F * kWidth, 0.5F * kHeight };
        input.pointer = { 0.25F * kWidth, 0.25F * kHeight };
        input.edge = { 0.45F * kWidth, 0.25F * kHeight };
        input.eventTimeNs = 1;
        const BookTurnPose pose = BookTurnSolver::Solve(input);
        glmock::Reset();
        Check("draw tilted", renderer.Draw(pose));
        AssertFrameState("tilted");
    }

    // Theme paper fallback toggles a uniform, never the frame structure.
    renderer.SetThemePaper(0.98F, 0.96F, 0.92F);
    {
        BookTurnInput input;
        input.generation = generation++;
        input.direction = Direction::NEXT;
        input.width = kWidth;
        input.height = kHeight;
        input.edge = { 0.5F * kWidth, 0.5F * kHeight };
        const BookTurnPose pose = BookTurnSolver::Solve(input);
        glmock::Reset();
        Check("draw fallback", renderer.Draw(pose));
        AssertFrameState("fallback");
    }
    renderer.SetThemePaper(1.0F, 1.0F, -1.0F);

    // §7.3 early swap: after the coverage-time rotation the hidden-sheet
    // frame is a single static base draw from CURRENT, ignoring the
    // invalidated NEXT slot (which a full Draw would refuse on).
    renderer.CommitSlots(Direction::NEXT);
    renderer.SetSheetVisible(false);
    GLuint swappedBaseBinding = 0;
    {
        BookTurnInput input;
        input.generation = generation++;
        input.direction = Direction::NEXT;
        input.width = kWidth;
        input.height = kHeight;
        input.start = { kWidth, 0.5F * kHeight };
        input.pointer = input.start;
        float xNorm = 0.0F;
        float beta = 0.0F;
        float scale = 0.0F;
        BookTurnSolver::Schedule(0.95F, xNorm, beta, scale);
        input.edge = { kWidth * xNorm, 0.5F * kHeight };
        input.overrideTheta = true;
        input.radiusScale = scale;
        const BookTurnPose pose = BookTurnSolver::Solve(input);
        glmock::Reset();
        Check("draw base-only after early swap", renderer.Draw(pose));
        Check("base-only one binding", CountName("glBindTexture") == 1);
        Check("base-only one draw", CountName("glDrawArrays") == 1 && CountName("glDrawElements") == 0);
        Check("base-only no blend", CountName("BLEND_SWITCH") == 0);
        for (const glmock::Entry& entry : glmock::Log()) {
            if (std::strcmp(entry.name, "glBindTexture") == 0) {
                swappedBaseBinding = static_cast<GLuint>(entry.b);
                break;
            }
        }
        Check("base-only bound a texture", swappedBaseBinding != 0);
    }

    // Rollback replay after an early swap: UndoCommitSlots restores the
    // pre-rotation layout, so the full 3-draw structure returns and the
    // bottom slot holds the very texture the base-only frame bound.
    renderer.UndoCommitSlots();
    renderer.SetSheetVisible(true);
    {
        BookTurnInput input;
        input.generation = generation++;
        input.direction = Direction::NEXT;
        input.width = kWidth;
        input.height = kHeight;
        input.start = { kWidth, 0.5F * kHeight };
        input.pointer = input.start;
        float xNorm = 0.0F;
        float beta = 0.0F;
        float scale = 0.0F;
        BookTurnSolver::Schedule(0.5F, xNorm, beta, scale);
        input.edge = { kWidth * xNorm, 0.5F * kHeight };
        input.overrideTheta = true;
        input.radiusScale = scale;
        const BookTurnPose pose = BookTurnSolver::Solve(input);
        glmock::Reset();
        Check("draw rollback after undo", renderer.Draw(pose));
        AssertFrameState("undo");
        GLuint rollbackBottomBinding = 0;
        for (const glmock::Entry& entry : glmock::Log()) {
            if (std::strcmp(entry.name, "glBindTexture") == 0) {
                rollbackBottomBinding = static_cast<GLuint>(entry.b);
                break;
            }
        }
        Check("undo keeps the admitted page under the sheet",
            rollbackBottomBinding == swappedBaseBinding);
    }

    // Base-only refusal: with the sheet hidden and CURRENT invalidated, the
    // frame refuses without emitting any draw command.
    renderer.Invalidate(TextureSlot::CURRENT);
    {
        BookTurnInput input;
        input.generation = generation++;
        input.direction = Direction::NEXT;
        input.width = kWidth;
        input.height = kHeight;
        const BookTurnPose pose = BookTurnSolver::Solve(input);
        glmock::Reset();
        Check("base-only refused without current", !renderer.Draw(pose));
        Check("base-only refusal emits no draw",
            CountName("glDrawArrays") == 0 && CountName("glDrawElements") == 0);
    }
    renderer.Upload(MakePayload(TextureSlot::CURRENT, "page-current-refreshed"));

    Check("clear", renderer.Clear());

    // Clear restores the visible sheet, so a full NEXT frame draws again
    // (NEXT texture is invalidated by the rotation above; re-upload first).
    renderer.Upload(MakePayload(TextureSlot::NEXT, "page-next-refreshed"));
    {
        BookTurnInput input;
        input.generation = generation++;
        input.direction = Direction::NEXT;
        input.width = kWidth;
        input.height = kHeight;
        input.edge = { 0.5F * kWidth, 0.5F * kHeight };
        const BookTurnPose pose = BookTurnSolver::Solve(input);
        glmock::Reset();
        Check("draw full frame after clear", renderer.Draw(pose));
        AssertFrameState("after-clear");
    }

    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
