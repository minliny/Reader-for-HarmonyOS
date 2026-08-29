#include "bookturn_host.h"

#include <native_vsync/native_vsync.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <utility>
#include <vector>

namespace reader::bookturn {
namespace {

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
    frameLoopWanted_.store(false, std::memory_order_release);
    if (renderThread_.joinable()) renderThread_.join();
    // nativeVsync_ is intentionally not destroyed: the last one-shot callback
    // may still be queued on the vsync dispatcher while no API exists to
    // cancel it, and host lifetimes already span the process (g_hosts never
    // erases entries). The OS reclaims the connection at exit.
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

bool BookTurnHost::UpdateInput(const BookTurnSample& sample)
{
    if (!CanStart(sample.direction)) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    pendingSample_ = sample;
    ++sampleSerial_;
    condition_.notify_all();
    UpdateFrameLoopWanted();
    return true;
}

bool BookTurnHost::Settle(uint64_t generation, bool commit)
{
    if (!rendererReady_.load(std::memory_order_acquire)) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    pendingSettlement_ = commit ? Settlement::COMMIT : Settlement::ROLLBACK;
    pendingSettlementEased_ = false;
    pendingSettlementGeneration_ = generation;
    condition_.notify_all();
    UpdateFrameLoopWanted();
    return true;
}

bool BookTurnHost::StartProgrammatic(uint64_t generation, Direction direction)
{
    if (!CanStart(direction)) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    pendingProgrammaticDirection_ = direction;
    pendingSettlement_ = Settlement::COMMIT;
    pendingSettlementEased_ = true;
    pendingSettlementGeneration_ = generation;
    condition_.notify_all();
    UpdateFrameLoopWanted();
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

void BookTurnHost::VsyncEntry(long long timestamp, void* data)
{
    static_cast<BookTurnHost*>(data)->OnVsyncFrame(timestamp);
}

void BookTurnHost::OnVsyncFrame(long long timestamp)
{
    vsyncBusy_.store(true, std::memory_order_release);
    {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!stop_) {
            vsyncTickPending_ = true;
            vsyncTickTimestampNs_ = timestamp;
            condition_.notify_all();
        }
    }
    vsyncBusy_.store(false, std::memory_order_release);
    // Re-arm only while the frame loop is wanted: once the chase catches up
    // with no new samples (or settlement ends) the requests stop and power
    // returns to the idle baseline (contract §11.3).
    if (frameLoopWanted_.load(std::memory_order_acquire)) {
        RequestFrameIfWanted();
    }
}

void BookTurnHost::RequestFrameIfWanted()
{
    if (stop_ || !frameLoopWanted_.load(std::memory_order_acquire)) return;
    if (nativeVsync_ == nullptr) {
        nativeVsync_ = OH_NativeVSync_Create("reader-bookturn", 15);
    }
    // RequestFrame coalesces per frame ("only the last callback" runs), so
    // redundant requests from any thread are harmless.
    if (nativeVsync_ != nullptr) {
        OH_NativeVSync_RequestFrame(nativeVsync_, VsyncEntry, this);
    }
}

void BookTurnHost::UpdateFrameLoopWanted()
{
    const bool wanted = settlement_ != Settlement::NONE || pendingSettlement_ != Settlement::NONE ||
        (fingerDown_ && chaseRunning_);
    frameLoopWanted_.store(wanted, std::memory_order_release);
    if (wanted) RequestFrameIfWanted();
}

void BookTurnHost::Run()
{
    std::unique_lock<std::mutex> lock(mutex_);
    while (!stop_) {
        condition_.wait(lock, [this]() {
            return stop_ || attachRequested_ || detachRequested_ || resizeRequested_ ||
                pendingSample_.has_value() || pendingSettlement_ != Settlement::NONE ||
                pendingCommitSlots_ || pendingTextures_[0].has_value() ||
                pendingTextures_[1].has_value() || pendingTextures_[2].has_value() ||
                vsyncTickPending_;
        });
        if (stop_) break;

        if (detachRequested_) {
            detachRequested_ = false;
            frameLoopWanted_.store(false, std::memory_order_release);
            vsyncTickPending_ = false;
            lastFrameTimestampNs_ = 0;
            fingerDown_ = false;
            chaseRunning_ = false;
            renderer_.Shutdown();
            rendererReady_.store(false, std::memory_order_release);
            readyMask_.store(0, std::memory_order_release);
            active_ = false;
            terminalCommit_ = false;
            settlement_ = Settlement::NONE;
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
            lastFrameTimestampNs_ = 0;
            lock.unlock();
            const bool initialized = renderer_.Initialize(window, width, height);
            rendererReady_.store(initialized, std::memory_order_release);
            readyMask_.store(initialized ? renderer_.ReadyMask() : 0, std::memory_order_release);
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

        if (pendingSample_.has_value()) {
            const BookTurnSample sample = *pendingSample_;
            pendingSample_.reset();
            consumedSampleSerial_ = sampleSerial_;
            // §7.4: settlement is not interruptible and ArkTS owns the
            // pending-segment deferral, so samples arriving mid-settlement
            // are dropped here.
            if (settlement_ == Settlement::NONE && pendingSettlement_ == Settlement::NONE) {
                if (sample.generation != chaseGeneration_) {
                    chaseGeneration_ = sample.generation;
                    fingerDown_ = true;
                    ResetChase(chase_, sample);
                }
                RecordChaseSample(chase_, sample);
                liveSample_ = sample;
                liveInput_.generation = sample.generation;
                liveInput_.direction = sample.direction;
                liveInput_.verticalPrevious = sample.verticalPrevious;
                liveInput_.width = sample.width;
                liveInput_.height = sample.height;
                liveInput_.start = { sample.startX, sample.startY };
                liveInput_.pointer = { sample.pointerX, sample.pointerY };
                liveInput_.eventTimeNs = sample.eventTimeNs;
                liveInput_.overrideTheta = false;
                liveInput_.settledTheta = 0.0F;
                liveInput_.radiusScale = 1.0F;
                active_ = true;
                chaseRunning_ = std::abs(ChaseGap(chase_, sample)) > kCatchLockVp;
                UpdateFrameLoopWanted();
            }
        }

        if (pendingSettlement_ != Settlement::NONE) {
            const bool commit = pendingSettlement_ == Settlement::COMMIT;
            settlement_ = pendingSettlement_;
            settlementEased_ = pendingSettlementEased_;
            pendingSettlement_ = Settlement::NONE;
            pendingSettlementEased_ = false;
            fingerDown_ = false;
            chaseRunning_ = false;
            if (settlementEased_ && pendingProgrammaticDirection_.has_value()) {
                liveInput_ = ProgrammaticInput(pendingSettlementGeneration_,
                    *pendingProgrammaticDirection_);
                pose_ = BookTurnSolver::Solve(liveInput_, nullptr);
                active_ = true;
                pendingProgrammaticDirection_.reset();
            }
            liveInput_.generation = pendingSettlementGeneration_;
            pose_.generation = pendingSettlementGeneration_;
            settlementTau0_ = pose_.tau;
            settlementTargetTau_ = SettleTargetTau(liveInput_.direction, commit);
            settlementDuration_ = settlementEased_ ?
                kCompleteSeconds :
                SettleDurationSeconds(settlementTau0_, liveInput_.direction, commit);
            settlementElapsed_ = 0.0F;
            settlementStartTheta_ = pose_.theta;
            terminalCommit_ = false;
            UpdateFrameLoopWanted();
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

        if (vsyncTickPending_) {
            vsyncTickPending_ = false;
            const long long timestamp = vsyncTickTimestampNs_;
            float frameSeconds = 1.0F / 60.0F;
            if (lastFrameTimestampNs_ != 0 && timestamp > lastFrameTimestampNs_) {
                frameSeconds = Clamp(
                    static_cast<float>(static_cast<double>(timestamp - lastFrameTimestampNs_) * 1.0e-9),
                    1.0e-4F, 0.1F);
            }
            lastFrameTimestampNs_ = timestamp;
            if (settlement_ != Settlement::NONE) {
                lock.unlock();
                ProcessSettlementFrame(frameSeconds);
                lock.lock();
            } else if (fingerDown_) {
                lock.unlock();
                ProcessChaseFrame(frameSeconds);
                lock.lock();
                UpdateFrameLoopWanted();
            }
        }
    }
    lock.unlock();
    frameLoopWanted_.store(false, std::memory_order_release);
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

void BookTurnHost::ProcessChaseFrame(float frameSeconds)
{
    const BookTurnSample sample = liveSample_;
    liveInput_.pointer = { sample.pointerX, sample.pointerY };
    liveInput_.pointerVelocityX = chase_.fingerVelocityX;
    liveInput_.eventTimeNs = sample.eventTimeNs;
    const float edgeX = ChaseAdvance(chase_, sample, frameSeconds);
    // The fold-line vertical follows the newest pointer sample, advanced at
    // frame cadence like the edge x (the V1 MOVE-time snap is gone with the
    // ArkTS edge state).
    liveInput_.edge = { edgeX, sample.pointerY };
    liveInput_.overrideTheta = false;
    liveInput_.settledTheta = 0.0F;
    liveInput_.radiusScale = 1.0F;
    pose_ = BookTurnSolver::Solve(liveInput_, &pose_);
    if (!renderer_.Draw(pose_)) {
        active_ = false;
        chaseRunning_ = false;
        renderer_.Clear();
        Notify(HostEvent::RENDER_FAILURE, liveInput_.generation, 0);
        return;
    }
    chaseRunning_ = std::abs(ChaseGap(chase_, sample)) > kCatchLockVp;
}

bool BookTurnHost::ProcessSettlementFrame(float frameSeconds)
{
    if (terminalCommit_ || settlement_ == Settlement::NONE) return false;
    if (!active_) {
        // Defensive §7.4 closure: nothing visual to settle.
        settlement_ = Settlement::NONE;
        Notify(HostEvent::ROLLBACK_COMPLETE, liveInput_.generation, 0);
        return false;
    }
    settlementElapsed_ += frameSeconds;
    const bool commit = settlement_ == Settlement::COMMIT;
    const float tau = SettleTauAt(settlementTau0_, settlementTargetTau_, settlementElapsed_,
        settlementDuration_, settlementEased_);
    float xNorm = 1.0F;
    float beta = 0.0F;
    float scale = 1.0F;
    BookTurnSolver::Schedule(tau, xNorm, beta, scale);
    (void)beta;
    const float width = std::max(1.0F, liveInput_.width);
    liveInput_.edge.x = width * xNorm;
    liveInput_.overrideTheta = true;
    liveInput_.settledTheta = settlementStartTheta_ *
        (1.0F - Clamp(settlementElapsed_ / kTiltZeroSeconds, 0.0F, 1.0F));
    liveInput_.radiusScale = scale;
    pose_ = BookTurnSolver::Solve(liveInput_, &pose_);
    if (!renderer_.Draw(pose_)) {
        active_ = false;
        settlement_ = Settlement::NONE;
        renderer_.Clear();
        Notify(HostEvent::RENDER_FAILURE, liveInput_.generation, 0);
        return false;
    }
    const bool tauFinished = settlementElapsed_ >= settlementDuration_;
    const bool tiltFinished = std::abs(liveInput_.settledTheta) <= 1.0e-4F;
    if (!tauFinished || !tiltFinished) return true;
    if (commit) {
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
