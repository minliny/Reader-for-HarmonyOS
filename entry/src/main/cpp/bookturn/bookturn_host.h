#ifndef READER_BOOKTURN_HOST_H
#define READER_BOOKTURN_HOST_H

#include "bookturn_renderer.h"

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

/** Latest-input mailbox plus the single event-driven renderer thread. */
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
    bool UpdateInput(const BookTurnInput& input);
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
    bool ProcessSettlementFrame(std::chrono::steady_clock::time_point now);
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
    std::optional<BookTurnInput> pendingInput_;
    uint64_t inputSerial_ = 0;
    uint64_t consumedInputSerial_ = 0;
    Settlement pendingSettlement_ = Settlement::NONE;
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

    // Render-thread-only state below this line.
    BookTurnRenderer renderer_;
    bool active_ = false;
    bool terminalCommit_ = false;
    BookTurnInput liveInput_;
    BookTurnPose pose_;
    std::chrono::steady_clock::time_point inputLastFrame_ {};
    Settlement settlement_ = Settlement::NONE;
    std::chrono::steady_clock::time_point settlementStart_;
    std::chrono::steady_clock::time_point settlementLastFrame_;
    float settlementStartTheta_ = 0.0F;
};

}  // namespace reader::bookturn

#endif  // READER_BOOKTURN_HOST_H
