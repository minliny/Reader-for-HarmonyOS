#include "bookturn_host.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <utility>
#include <vector>

namespace reader::bookturn {
namespace {

constexpr float kCatchSpeedViewportsPerSecond = 5.0F;
constexpr float kTiltZeroSeconds = 0.080F;
constexpr float kEndRadiusRatio = 0.12F;
constexpr auto kFrameInterval = std::chrono::microseconds(16667);

float Clamp(float value, float low, float high)
{
    return std::max(low, std::min(high, value));
}

size_t PayloadIndex(TextureSlot slot)
{
    return static_cast<size_t>(slot);
}

}  // namespace

BookTurnHost::BookTurnHost() : renderThread_([this]() { Run(); })
{
}

BookTurnHost::~BookTurnHost()
{
    {
        std::lock_guard<std::mutex> lock(mutex_);
        stop_ = true;
        condition_.notify_all();
    }
    if (renderThread_.joinable()) renderThread_.join();
}

void BookTurnHost::AttachSurface(void* nativeWindow, uint64_t width, uint64_t height)
{
    std::lock_guard<std::mutex> lock(mutex_);
    pendingWindow_ = nativeWindow;
    pendingSurfaceWidth_ = width;
    pendingSurfaceHeight_ = height;
    attachRequested_ = true;
    detachRequested_ = false;
    condition_.notify_all();
}

void BookTurnHost::ResizeSurface(uint64_t width, uint64_t height)
{
    std::lock_guard<std::mutex> lock(mutex_);
    pendingSurfaceWidth_ = width;
    pendingSurfaceHeight_ = height;
    resizeRequested_ = true;
    condition_.notify_all();
}

void BookTurnHost::DetachSurface()
{
    std::unique_lock<std::mutex> lock(mutex_);
    detachRequested_ = true;
    const uint64_t serial = ++detachRequestSerial_;
    condition_.notify_all();
    surfaceCondition_.wait(lock, [this, serial]() {
        return detachCompleteSerial_ >= serial || stop_;
    });
}

void BookTurnHost::Configure(float widthVp, float heightVp)
{
    std::lock_guard<std::mutex> lock(mutex_);
    configuredWidthVp_ = std::isfinite(widthVp) && widthVp > 0.0F ? widthVp : 0.0F;
    configuredHeightVp_ = std::isfinite(heightVp) && heightVp > 0.0F ? heightVp : 0.0F;
}

bool BookTurnHost::QueueTexture(TexturePayload&& payload)
{
    const size_t index = PayloadIndex(payload.slot);
    if (index >= pendingTextures_.size() || payload.pixels.empty()) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    // A replacement is not ready until the render thread has completed its
    // upload. Clearing the bit here prevents a gesture from consuming the old
    // texture during the short NAPI-to-GL handoff window.
    readyMask_.fetch_and(~(1U << index), std::memory_order_acq_rel);
    pendingTextures_[index] = std::move(payload);
    condition_.notify_all();
    return true;
}

bool BookTurnHost::UpdateInput(const BookTurnInput& input)
{
    if (!CanStart(input.direction)) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    pendingInput_ = input;
    ++inputSerial_;
    condition_.notify_all();
    return true;
}

bool BookTurnHost::Settle(uint64_t generation, bool commit)
{
    if (!rendererReady_.load(std::memory_order_acquire)) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    pendingSettlement_ = commit ? Settlement::COMMIT : Settlement::ROLLBACK;
    pendingSettlementGeneration_ = generation;
    condition_.notify_all();
    return true;
}

bool BookTurnHost::StartProgrammatic(uint64_t generation, Direction direction)
{
    if (!CanStart(direction)) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    pendingInput_ = ProgrammaticInput(generation, direction);
    ++inputSerial_;
    pendingSettlement_ = Settlement::COMMIT;
    pendingSettlementGeneration_ = generation;
    condition_.notify_all();
    return true;
}

bool BookTurnHost::CommitSlots(uint64_t generation, Direction direction)
{
    if (!rendererReady_.load(std::memory_order_acquire)) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    pendingCommitSlots_ = true;
    pendingCommitGeneration_ = generation;
    pendingCommitDirection_ = direction;
    condition_.notify_all();
    return true;
}

bool BookTurnHost::CanStart(Direction direction) const
{
    return rendererReady_.load(std::memory_order_acquire) && RequiredTexturesReady(direction);
}

bool BookTurnHost::IsReady() const
{
    return rendererReady_.load(std::memory_order_acquire);
}

uint32_t BookTurnHost::ReadyMask() const
{
    return readyMask_.load(std::memory_order_acquire);
}

void BookTurnHost::SetEventCallback(HostEventCallback callback)
{
    std::lock_guard<std::mutex> lock(callbackMutex_);
    callback_ = std::move(callback);
}

void BookTurnHost::Run()
{
    std::unique_lock<std::mutex> lock(mutex_);
    while (!stop_) {
        const bool settling = settlement_ != Settlement::NONE;
        if (settling) {
            condition_.wait_until(lock, settlementLastFrame_ + kFrameInterval, [this]() {
                return stop_ || attachRequested_ || detachRequested_ || resizeRequested_ ||
                    pendingInput_.has_value() || pendingSettlement_ != Settlement::NONE ||
                    pendingCommitSlots_ || pendingTextures_[0].has_value() ||
                    pendingTextures_[1].has_value() || pendingTextures_[2].has_value();
            });
        } else {
            condition_.wait(lock, [this]() {
                return stop_ || attachRequested_ || detachRequested_ || resizeRequested_ ||
                    pendingInput_.has_value() || pendingSettlement_ != Settlement::NONE ||
                    pendingCommitSlots_ || pendingTextures_[0].has_value() ||
                    pendingTextures_[1].has_value() || pendingTextures_[2].has_value();
            });
        }
        if (stop_) break;

        if (detachRequested_) {
            detachRequested_ = false;
            renderer_.Shutdown();
            rendererReady_.store(false, std::memory_order_release);
            readyMask_.store(0, std::memory_order_release);
            active_ = false;
            terminalCommit_ = false;
            settlement_ = Settlement::NONE;
            inputLastFrame_ = {};
            const uint64_t serial = detachRequestSerial_;
            detachCompleteSerial_ = serial;
            lock.unlock();
            Notify(HostEvent::SURFACE_LOST, pose_.generation, 0);
            surfaceCondition_.notify_all();
            lock.lock();
            continue;
        }

        if (attachRequested_) {
            void* window = pendingWindow_;
            const uint64_t width = pendingSurfaceWidth_;
            const uint64_t height = pendingSurfaceHeight_;
            attachRequested_ = false;
            lock.unlock();
            const bool initialized = renderer_.Initialize(window, width, height);
            rendererReady_.store(initialized, std::memory_order_release);
            readyMask_.store(initialized ? renderer_.ReadyMask() : 0, std::memory_order_release);
            inputLastFrame_ = {};
            Notify(initialized ? HostEvent::SURFACE_READY : HostEvent::RENDER_FAILURE, 0, 0);
            lock.lock();
            continue;
        }

        if (resizeRequested_) {
            const uint64_t width = pendingSurfaceWidth_;
            const uint64_t height = pendingSurfaceHeight_;
            resizeRequested_ = false;
            lock.unlock();
            renderer_.Resize(width, height);
            lock.lock();
        }

        std::vector<TexturePayload> uploads;
        for (std::optional<TexturePayload>& pending : pendingTextures_) {
            if (pending.has_value()) {
                uploads.push_back(std::move(*pending));
                pending.reset();
            }
        }
        if (!uploads.empty()) {
            lock.unlock();
            bool success = true;
            for (TexturePayload& payload : uploads) success = renderer_.Upload(std::move(payload)) && success;
            const uint32_t mask = renderer_.ReadyMask();
            readyMask_.store(mask, std::memory_order_release);
            Notify(success ? HostEvent::TEXTURE_READY : HostEvent::RENDER_FAILURE, 0,
                static_cast<int32_t>(mask));
            lock.lock();
        }

        if (pendingInput_.has_value()) {
            // MOVE can arrive faster than the display. Keep only the newest
            // sample and never draw it more often than 60 Hz. A release
            // settlement is allowed through immediately so its last pointer
            // sample cannot be discarded behind the pacing deadline.
            const auto inputDeadline = inputLastFrame_ + kFrameInterval;
            if (pendingSettlement_ == Settlement::NONE && inputLastFrame_.time_since_epoch().count() != 0 &&
                std::chrono::steady_clock::now() < inputDeadline) {
                const bool priorityEvent = condition_.wait_until(lock, inputDeadline, [this]() {
                    return stop_ || attachRequested_ || detachRequested_ || resizeRequested_ ||
                        pendingSettlement_ != Settlement::NONE || pendingCommitSlots_ ||
                        pendingTextures_[0].has_value() || pendingTextures_[1].has_value() ||
                        pendingTextures_[2].has_value();
                });
                if (priorityEvent) continue;
            }
            liveInput_ = *pendingInput_;
            pendingInput_.reset();
            consumedInputSerial_ = inputSerial_;
            settlement_ = Settlement::NONE;
            terminalCommit_ = false;
            active_ = true;
            lock.unlock();
            pose_ = BookTurnSolver::Solve(liveInput_, &pose_);
            if (!renderer_.Draw(pose_)) {
                active_ = false;
                renderer_.Clear();
                Notify(HostEvent::RENDER_FAILURE, liveInput_.generation, 0);
            }
            inputLastFrame_ = std::chrono::steady_clock::now();
            lock.lock();
        }

        if (pendingSettlement_ != Settlement::NONE) {
            settlement_ = pendingSettlement_;
            pendingSettlement_ = Settlement::NONE;
            if (!active_ && settlement_ == Settlement::COMMIT) {
                liveInput_ = ProgrammaticInput(pendingSettlementGeneration_, liveInput_.direction);
                pose_ = BookTurnSolver::Solve(liveInput_, nullptr);
                active_ = true;
            }
            liveInput_.generation = pendingSettlementGeneration_;
            pose_.generation = pendingSettlementGeneration_;
            settlementStart_ = std::chrono::steady_clock::now();
            settlementLastFrame_ = settlementStart_;
            settlementStartTheta_ = pose_.theta;
            terminalCommit_ = false;
        }

        if (pendingCommitSlots_) {
            const uint64_t generation = pendingCommitGeneration_;
            const Direction direction = pendingCommitDirection_;
            pendingCommitSlots_ = false;
            lock.unlock();
            renderer_.CommitSlots(direction);
            readyMask_.store(renderer_.ReadyMask(), std::memory_order_release);
            renderer_.Clear();
            active_ = false;
            terminalCommit_ = false;
            settlement_ = Settlement::NONE;
            Notify(HostEvent::SLOTS_COMMITTED, generation, static_cast<int32_t>(renderer_.ReadyMask()));
            lock.lock();
        }

        if (settlement_ != Settlement::NONE) {
            const auto now = std::chrono::steady_clock::now();
            if (now >= settlementLastFrame_ + kFrameInterval) {
                lock.unlock();
                ProcessSettlementFrame(now);
                lock.lock();
            }
        }
    }
    lock.unlock();
    renderer_.Shutdown();
    rendererReady_.store(false, std::memory_order_release);
    readyMask_.store(0, std::memory_order_release);
}

void BookTurnHost::Notify(HostEvent event, uint64_t generation, int32_t detail)
{
    HostEventCallback callback;
    {
        std::lock_guard<std::mutex> lock(callbackMutex_);
        callback = callback_;
    }
    if (callback) callback(event, generation, detail);
}

bool BookTurnHost::ProcessSettlementFrame(std::chrono::steady_clock::time_point now)
{
    if (!active_ || terminalCommit_ || settlement_ == Settlement::NONE) return false;
    const float dt = std::chrono::duration<float>(now - settlementLastFrame_).count();
    const float elapsed = std::chrono::duration<float>(now - settlementStart_).count();
    settlementLastFrame_ = now;
    const float width = std::max(1.0F, liveInput_.width);
    const float source = liveInput_.direction == Direction::NEXT ? width : 0.0F;
    const float destination = settlement_ == Settlement::COMMIT ?
        (liveInput_.direction == Direction::NEXT ? 0.0F : width) : source;
    const float direction = destination >= liveInput_.edge.x ? 1.0F : -1.0F;
    const float step = kCatchSpeedViewportsPerSecond * width * std::max(0.0F, dt);
    if (std::abs(destination - liveInput_.edge.x) <= step) {
        liveInput_.edge.x = destination;
    } else {
        liveInput_.edge.x += direction * step;
    }
    liveInput_.overrideTheta = true;
    liveInput_.settledTheta = settlementStartTheta_ *
        (1.0F - Clamp(elapsed / kTiltZeroSeconds, 0.0F, 1.0F));
    liveInput_.radiusScale = 1.0F;
    if (settlement_ == Settlement::COMMIT) {
        const float remaining = std::abs(destination - liveInput_.edge.x);
        liveInput_.radiusScale = Clamp(remaining / (kEndRadiusRatio * width), 0.0F, 1.0F);
    }
    pose_ = BookTurnSolver::Solve(liveInput_, &pose_);
    if (!renderer_.Draw(pose_)) {
        active_ = false;
        settlement_ = Settlement::NONE;
        renderer_.Clear();
        Notify(HostEvent::RENDER_FAILURE, liveInput_.generation, 0);
        return false;
    }
    const bool edgeFinished = liveInput_.edge.x == destination;
    const bool tiltFinished = std::abs(liveInput_.settledTheta) <= 1.0e-4F;
    if (!edgeFinished || !tiltFinished) return true;
    if (settlement_ == Settlement::COMMIT) {
        terminalCommit_ = true;
        settlement_ = Settlement::NONE;
        Notify(HostEvent::VISUAL_COMMIT_ENDPOINT, liveInput_.generation, 0);
    } else {
        settlement_ = Settlement::NONE;
        active_ = false;
        renderer_.Clear();
        Notify(HostEvent::ROLLBACK_COMPLETE, liveInput_.generation, 0);
    }
    return true;
}

BookTurnInput BookTurnHost::ProgrammaticInput(uint64_t generation, Direction direction) const
{
    BookTurnInput input;
    input.generation = generation;
    input.direction = direction;
    input.width = configuredWidthVp_;
    input.height = configuredHeightVp_;
    const float source = direction == Direction::NEXT ? input.width : 0.0F;
    input.start = { source, 0.5F * input.height };
    input.pointer = input.start;
    input.edge = input.start;
    input.overrideTheta = true;
    input.settledTheta = 0.0F;
    return input;
}

bool BookTurnHost::RequiredTexturesReady(Direction direction) const
{
    const uint32_t mask = readyMask_.load(std::memory_order_acquire);
    const uint32_t current = 1U << static_cast<uint32_t>(TextureSlot::CURRENT);
    const uint32_t adjacent = direction == Direction::NEXT ?
        1U << static_cast<uint32_t>(TextureSlot::NEXT) :
        1U << static_cast<uint32_t>(TextureSlot::PREVIOUS);
    return (mask & current) != 0 && (mask & adjacent) != 0;
}

}  // namespace reader::bookturn
