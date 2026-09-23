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
    /** The retained terminal frame was cleared after the generation-matched
     *  ArkUI content-ready confirmation (barrier closed). */
    TERMINAL_RELEASED = 8,
    /** First successfully drawn frame; AUTOMATIC detail carries the start token.
     *  EGL submission only, not a physical display acknowledgement. */
    FRAME_PRESENTED = 9,
};

struct BookTurnFrameState {
    uint64_t generation = 0;
    Direction direction = Direction::NEXT;
    float edgeX = 0.0F;
    float edgeY = 0.0F;
    float theta = 0.0F;
    uint64_t surfaceEpoch = 0;
    float width = 0.0F;
    float height = 0.0F;
};

// The last argument is the originating surface epoch, carried through the JS
// queue so a replacement surface can reject an already-enqueued old event.
using HostEventCallback = std::function<void(HostEvent, uint64_t, int32_t, uint64_t)>;

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
    std::optional<BookTurnFrameState> Regrab(const BookTurnSample& sample, uint64_t previousGeneration);
    bool EndGesture(const BookTurnSample& sample, bool commit);
    bool Settle(uint64_t generation, bool commit);
    bool StartProgrammatic(uint64_t generation, Direction direction,
        ProgrammaticProfile profile = ProgrammaticProfile::MANUAL);
    /** Confirm the generation/token after ArkUI schedules the surface reveal.
     *  An accepted duplicate never restarts an already running timeline. */
    bool StartAutomaticTimeline(uint64_t generation, int32_t surfaceToken);
    bool CommitSlots(uint64_t generation, Direction direction);
    /** ArkUI presentation barrier (2026-08-31): a commit settlement never
     *  clears the surface; the new-page terminal frame stays presented until
     *  ArkUI confirms the promoted content revision and layout are ready and calls
     *  ReleaseTerminalFrame with the same settlementGeneration. Retain adopts
     *  or refreshes the hold (idempotent); a stale confirmation is rejected.
     *  A missing confirmation keeps the terminal frame retained (it can never
     *  expose the outgoing page) and only logs a timeout diagnostic. */
    bool RetainTerminalFrame(uint64_t generation);
    bool ReleaseTerminalFrame(uint64_t generation);
    /** Clear the retained EGL surface after ArkUI has hidden the XComponent.
     *  The generation must have been released first; this split prevents a
     *  transparent swap from racing the promoted ArkUI page. */
    bool ClearSurface(uint64_t generation);
    /** Atomic snapshot of the currently retained terminal generation
     *  (0 = surface follows the live animation / cleared). */
    uint64_t RetainedTerminalGeneration() const;
    uint64_t CommittedSlotsGeneration() const;
    uint64_t CompletedTerminalGeneration() const;
    bool SetDynamicHighlights(DynamicHighlights&& highlights);
    bool CanStart(Direction direction) const;
    bool IsReady() const;
    uint64_t SurfaceEpoch() const;
    uint32_t ReadyMask() const;
    void SetEventCallback(HostEventCallback callback);

private:
    enum class Settlement : int32_t { NONE = 0, COMMIT = 1, ROLLBACK = 2 };
    enum class AutomaticStart : int32_t { NONE = 0, PRIMING = 1, WAITING = 2, RUNNING = 3 };

    void Run();
    void Notify(HostEvent event, uint64_t generation, int32_t detail, uint64_t surfaceEpoch);
    bool IsSurfaceLifecycleCurrent(uint64_t serial) const;
    void NotifySurfaceEvent(uint64_t serial, HostEvent event, uint64_t generation,
        int32_t detail);
    void SetRetainedTerminalGeneration(uint64_t generation);
    void CheckTerminalRetainTimeout();
    static void VsyncEntry(long long timestamp, void* data);
    void OnVsyncFrame(long long timestamp);
    bool ProcessChaseFrame(float frameSeconds, int64_t frameTimeNs, uint64_t surfaceSerial);
    bool ProcessSettlementFrame(float frameSeconds, int64_t frameTimeNs, uint64_t surfaceSerial);
    void ResetAutomaticStart();
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
    std::optional<DynamicHighlights> pendingHighlights_;
    std::optional<DynamicHighlights> acceptedHighlights_;
    uint64_t acceptedHighlightSurfaceSerial_ = 0;
    bool highlightFrameDirty_ = false;

    void* pendingWindow_ = nullptr;
    uint64_t pendingSurfaceWidth_ = 0;
    uint64_t pendingSurfaceHeight_ = 0;
    bool attachRequested_ = false;
    bool resizeRequested_ = false;
    bool detachRequested_ = false;
    // A single request clock lets the render thread distinguish an attach
    // queued before a detach (stale: drop it) from an attach that arrived
    // after the detach was requested (new surface: process it next).  This
    // keeps surface teardown serial without allowing an old window to be
    // re-mounted by a delayed condition-variable wakeup.
    uint64_t surfaceRequestSerial_ = 0;
    // Lock-free mirror used by render operations while mutex_ is released
    // around EGL/GL calls. Attach, detach, and host shutdown advance the
    // serial before invalidating the old surface.
    std::atomic<uint64_t> surfaceLifecycleSerialAtomic_ { 0 };
    uint64_t pendingAttachSerial_ = 0;
    uint64_t detachRequestSerial_ = 0;
    uint64_t detachCompleteSerial_ = 0;

    std::array<std::optional<TexturePayload>, 3> pendingTextures_;
    std::optional<BookTurnSample> pendingSample_;
    uint64_t sampleSerial_ = 0;
    uint64_t inputOwnerGeneration_ = 0;
    std::atomic<uint64_t> inputOwnerGenerationAtomic_ { 0 };
    std::optional<BookTurnFrameState> pendingRegrabFrame_;
    mutable std::mutex frameMutex_;
    BookTurnFrameState submittedFrame_;
    bool inputEnded_ = false;
    uint64_t consumedSampleSerial_ = 0;
    Settlement pendingSettlement_ = Settlement::NONE;
    ProgrammaticProfile pendingProgrammaticProfile_ = ProgrammaticProfile::MANUAL;
    bool pendingSettlementEased_ = false;
    bool pendingAutomaticTimeline_ = false;
    std::optional<Direction> pendingProgrammaticDirection_;
    uint64_t pendingSettlementGeneration_ = 0;
    bool pendingCommitSlots_ = false;
    uint64_t pendingCommitGeneration_ = 0;
    Direction pendingCommitDirection_ = Direction::NEXT;
    std::atomic<uint64_t> committedSlotsGenerationAtomic_ { 0 };
    // ArkUI presentation barrier requests (queued from the NAPI thread).
    bool pendingRetain_ = false;
    uint64_t pendingRetainGeneration_ = 0;
    bool pendingRelease_ = false;
    uint64_t pendingReleaseGeneration_ = 0;
    bool pendingClearSurface_ = false;
    uint64_t pendingClearSurfaceGeneration_ = 0;
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
    bool inputFrameDirty_ = false;
    uint64_t chaseGeneration_ = 0;
    BookTurnPose pose_;
    Settlement settlement_ = Settlement::NONE;
    SettlementCurve settlementCurve_ = SettlementCurve::LINEAR;
    float settlementTau0_ = 0.0F;
    float settlementTargetTau_ = 0.0F;
    float settlementDuration_ = 0.0F;
    float settlementElapsed_ = 0.0F;
    float settlementStartTheta_ = 0.0F;
    // Render thread and StartAutomaticTimeline serialize these fields through
    // frameMutex_. Waiting holds the initial frame without requesting VSync.
    AutomaticStart automaticStart_ = AutomaticStart::NONE;
    uint64_t automaticStartGeneration_ = 0;
    uint64_t automaticStartSurfaceEpoch_ = 0;
    int32_t automaticStartToken_ = 0;
    int32_t nextAutomaticStartToken_ = 0;
    int64_t automaticTimelineStartNs_ = 0;
    // §7.3 tau_swap: set when this settlement rotated the slots early; the
    // ArkTS commitSlots for the same generation is then a no-op rotation.
    bool settlementSwapped_ = false;
    uint64_t swappedGeneration_ = 0;
    Direction swappedDirection_ = Direction::NEXT;
    // ArkUI presentation barrier state (render thread only unless noted).
    // settledTerminalGeneration_: generation of the last commit settlement
    // that reached its terminal frame. terminalRetainedGeneration_: the
    // generation whose terminal frame is currently held on the surface; the
    // atomic mirror published for the NAPI thread gates stale confirmations.
    uint64_t settledTerminalGeneration_ = 0;
    uint64_t terminalRetainedGeneration_ = 0;
    // Generation whose retain barrier was closed by ReleaseTerminalFrame and
    // is now eligible for the explicit hidden-surface cleanup.
    uint64_t releasedTerminalGeneration_ = 0;
    std::atomic<uint64_t> releasedTerminalGenerationAtomic_ { 0 };
    uint64_t rollbackTerminalGeneration_ = 0;
    std::atomic<uint64_t> rollbackTerminalGenerationAtomic_ { 0 };
    std::atomic<uint64_t> retainedTerminalGenerationAtomic_ { 0 };
    std::atomic<uint64_t> completedTerminalGenerationAtomic_ { 0 };
    std::chrono::steady_clock::time_point retainedSince_ {};
    uint64_t retainTimeoutLoggedGeneration_ = 0;
    // Consecutive Draw() refusals tolerated before the runtime is declared
    // failed. VM/low-end GPU drivers can transiently refuse eglSwapBuffers
    // (fence sync) for the first frames of a surface's life while still
    // presenting the frame; one refusal must not kill a committed turn.
    int consecutiveDrawFailures_ = 0;
    // Render-thread generation latch: emit FRAME_PRESENTED once, after the
    // first successful draw replaces a previous terminal frame.
    uint64_t firstFrameNotifiedGeneration_ = 0;

    // Per-activity-window frame diagnostics (2026-08-30 real-device pacing
    // diagnosis): one hilog line per gesture/settlement window splits wake
    // latency from solve/draw cost. Render thread only.
    struct FrameDiagSample {
        std::chrono::steady_clock::time_point at;
        float wakeMs;
        float solveMs;
        float drawMs;
    };
    std::vector<FrameDiagSample> frameDiag_;
    float currentWakeMs_ = 0.0F;
};

}  // namespace reader::bookturn

#endif  // READER_BOOKTURN_HOST_H
