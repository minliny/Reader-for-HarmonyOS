#ifndef READER_BOOKTURN_HOST_H
#define READER_BOOKTURN_HOST_H

#include "bookturn_motion.h"
#include "bookturn_renderer.h"

#include <native_vsync/native_vsync.h>

#include <array>
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <thread>
#include <vector>

namespace reader::bookturn {

enum class HostEvent : int32_t {
    SURFACE_READY = 1,
    TEXTURE_READY = 2,
    VISUAL_COMMIT_ENDPOINT = 3,
    ROLLBACK_COMPLETE = 4,
    SURFACE_LOST = 5,
    RENDER_FAILURE = 6,
    SLOTS_COMMITTED = 7,
};

using HostEventCallback = std::function<void(HostEvent, uint64_t, int32_t)>;

/** Sample mailbox plus the single VSync-driven renderer thread. ArkTS only
 *  records the newest raw gesture sample (contract V2 §5.3); the chased edge
 *  and every frame advance on native VSync callbacks here. */
class BookTurnHost final {
public:
    BookTurnHost();
    ~BookTurnHost();

    BookTurnHost(const BookTurnHost&) = delete;
    BookTurnHost& operator=(const BookTurnHost&) = delete;

    void AttachSurface(void* nativeWindow, uint64_t width, uint64_t height);
    void ResizeSurface(uint64_t width, uint64_t height);
    void DetachSurface();
    void Configure(float widthVp, float heightVp);
    bool QueueTexture(TexturePayload&& payload);
    bool UpdateInput(const BookTurnSample& sample);
    bool Settle(uint64_t generation, bool commit);
    bool StartProgrammatic(uint64_t generation, Direction direction);
    bool CommitSlots(uint64_t generation, Direction direction);
    bool CanStart(Direction direction) const;
    bool IsReady() const;
    uint32_t ReadyMask() const;
    void SetEventCallback(HostEventCallback callback);

private:
    enum class Settlement : int32_t { NONE = 0, COMMIT = 1, ROLLBACK = 2 };

    void Run();
    void Notify(HostEvent event, uint64_t generation, int32_t detail);
    static void VsyncEntry(long long timestamp, void* data);
    void OnVsyncFrame(long long timestamp);
    void ProcessChaseFrame(float frameSeconds);
    bool ProcessSettlementFrame(float frameSeconds);
    void UpdateFrameLoopWanted();
    void RequestFrameIfWanted();
    void EmitFrameDiag();
    void RecordFrameDiag(float solveMs, float drawMs);
    BookTurnInput ProgrammaticInput(uint64_t generation, Direction direction) const;
    bool RequiredTexturesReady(Direction direction) const;

    mutable std::mutex mutex_;
    std::condition_variable condition_;
    std::condition_variable surfaceCondition_;
    std::thread renderThread_;
    bool stop_ = false;

    void* pendingWindow_ = nullptr;
    uint64_t pendingSurfaceWidth_ = 0;
    uint64_t pendingSurfaceHeight_ = 0;
    bool attachRequested_ = false;
    bool resizeRequested_ = false;
    bool detachRequested_ = false;
    uint64_t detachRequestSerial_ = 0;
    uint64_t detachCompleteSerial_ = 0;

    std::array<std::optional<TexturePayload>, 3> pendingTextures_;
    std::optional<BookTurnSample> pendingSample_;
    uint64_t sampleSerial_ = 0;
    uint64_t consumedSampleSerial_ = 0;
    Settlement pendingSettlement_ = Settlement::NONE;
    bool pendingSettlementEased_ = false;
    std::optional<Direction> pendingProgrammaticDirection_;
    uint64_t pendingSettlementGeneration_ = 0;
    bool pendingCommitSlots_ = false;
    uint64_t pendingCommitGeneration_ = 0;
    Direction pendingCommitDirection_ = Direction::NEXT;
    float configuredWidthVp_ = 0.0F;
    float configuredHeightVp_ = 0.0F;

    std::atomic<bool> rendererReady_ { false };
    std::atomic<uint32_t> readyMask_ { 0 };
    mutable std::mutex callbackMutex_;
    HostEventCallback callback_;

    // Native VSync plumbing. frameLoopWanted_ is the only cross-thread gate;
    // the tick flag and timestamp are written under mutex_ by the callback.
    OH_NativeVSync* nativeVsync_ = nullptr;
    std::atomic<bool> frameLoopWanted_ { false };
    std::atomic<bool> vsyncBusy_ { false };
    bool vsyncTickPending_ = false;
    long long vsyncTickTimestampNs_ = 0;
    long long lastFrameTimestampNs_ = 0;
    // Callback-thread steady clock reading taken with the tick flag, so the
    // worker can measure its own wake latency in one clock domain.
    std::chrono::steady_clock::time_point vsyncTickPostedAt_ {};

    // Render-thread-only state below this line.
    BookTurnRenderer renderer_;
    bool active_ = false;
    bool terminalCommit_ = false;
    BookTurnInput liveInput_;
    BookTurnSample liveSample_;
    BookTurnChaseState chase_;
    bool fingerDown_ = false;
    bool chaseRunning_ = false;
    uint64_t chaseGeneration_ = 0;
    BookTurnPose pose_;
    Settlement settlement_ = Settlement::NONE;
    bool settlementEased_ = false;
    float settlementTau0_ = 0.0F;
    float settlementTargetTau_ = 0.0F;
    float settlementDuration_ = 0.0F;
    float settlementElapsed_ = 0.0F;
    float settlementStartTheta_ = 0.0F;
    // §7.3 tau_swap: set when this settlement rotated the slots early; the
    // ArkTS commitSlots for the same generation is then a no-op rotation.
    bool settlementSwapped_ = false;
    uint64_t swappedGeneration_ = 0;
    // Consecutive Draw() refusals tolerated before the runtime is declared
    // failed. VM/low-end GPU drivers can transiently refuse eglSwapBuffers
    // (fence sync) for the first frames of a surface's life while still
    // presenting the frame; one refusal must not kill a committed turn.
    int consecutiveDrawFailures_ = 0;

    // Per-activity-window frame diagnostics (2026-08-30 real-device pacing
    // diagnosis): one hilog line per gesture/settlement window splits wake
    // latency from solve/draw cost. Render thread only.
    struct FrameDiagSample {
        float wakeMs;
        float solveMs;
        float drawMs;
    };
    std::vector<FrameDiagSample> frameDiag_;
    float currentWakeMs_ = 0.0F;
};

}  // namespace reader::bookturn

#endif  // READER_BOOKTURN_HOST_H
