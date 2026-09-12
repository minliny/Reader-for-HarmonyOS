#include "bookturn_host.h"

#include <hilog/log.h>
#include <native_vsync/native_vsync.h>
#include <pthread.h>
#include <qos/qos.h>

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdlib>
#include <utility>
#include <vector>

#undef LOG_DOMAIN
#define LOG_DOMAIN 0x5244
#undef LOG_TAG
#define LOG_TAG "BookTurn"

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

// Observed on the emulator: the first ~5 swaps of a fresh surface return
// failure from the driver fence while still presenting. Eight frames of
// grace (~130ms at 60Hz) ride the glitch out; a truly dead surface keeps
// refusing past it and fails closed as before.
constexpr int kMaxConsecutiveDrawFailures = 8;

constexpr size_t kFrameDiagCapacity = 512;

// ArkUI presented-confirmation watchdog. Diagnostic only: a timeout keeps the
// terminal frame retained (it can never expose the outgoing page) and logs
// once. Host tests shrink it via BOOKTURN_RETAIN_TIMEOUT_MS.
double TerminalRetainTimeoutMs()
{
    static const double value = []() {
        const char* raw = std::getenv("BOOKTURN_RETAIN_TIMEOUT_MS");
        if (raw == nullptr) return 2000.0;
        const double parsed = std::atof(raw);
        return parsed >= 50.0 && parsed <= 60000.0 ? parsed : 2000.0;
    }();
    return value;
}

float Percentile(std::vector<float>& values, float fraction)
{
    if (values.empty()) return 0.0F;
    const size_t index = std::min(values.size() - 1,
        static_cast<size_t>(fraction * static_cast<float>(values.size() - 1) + 0.5F));
    std::nth_element(values.begin(), values.begin() + static_cast<std::ptrdiff_t>(index), values.end());
    return values[index];
}

}  // namespace

BookTurnHost::BookTurnHost()
{
    (void)TerminalRetainTimeoutMs();
    // Start only after every mailbox, callback and renderer member exists.
    renderThread_ = std::thread([this]() { Run(); });
}

BookTurnHost::~BookTurnHost()
{
    {
        std::lock_guard<std::mutex> lock(mutex_);
        stop_ = true;
        ++surfaceRequestSerial_;
        surfaceLifecycleSerialAtomic_.store(surfaceRequestSerial_, std::memory_order_release);
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
    pendingAttachSerial_ = ++surfaceRequestSerial_;
    surfaceLifecycleSerialAtomic_.store(surfaceRequestSerial_, std::memory_order_release);
    attachRequested_ = true;
    // Do not cancel a detach that is already queued.  The render thread owns
    // EGL teardown and must complete it before this (newer) attach can be
    // initialized; otherwise a delayed OnSurfaceCreated wakeup can race the
    // old window's destruction and expose a black/transparent buffer.
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
    const uint64_t serial = ++surfaceRequestSerial_;
    surfaceLifecycleSerialAtomic_.store(serial, std::memory_order_release);
    detachRequestSerial_ = serial;
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

uint64_t BookTurnHost::SurfaceEpoch() const
{
    return surfaceLifecycleSerialAtomic_.load(std::memory_order_acquire);
}

bool BookTurnHost::QueueTexture(TexturePayload&& payload)
{
    const size_t index = PayloadIndex(payload.slot);
    if (index >= pendingTextures_.size() || payload.pixels.empty()) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    if (inputOwnerGeneration_ != 0 || payload.surfaceEpoch == 0 ||
        payload.surfaceEpoch != surfaceRequestSerial_ || detachRequested_ || !rendererReady_.load()) return false;
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
    if (sample.generation == 0) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    if (!CanStart(sample.direction)) return false;
    if (inputOwnerGeneration_ != 0 &&
        (inputOwnerGeneration_ != sample.generation || inputEnded_)) return false;
    inputOwnerGeneration_ = sample.generation;
    inputOwnerGenerationAtomic_.store(sample.generation, std::memory_order_release);
    pendingSample_ = sample;
    ++sampleSerial_;
    condition_.notify_all();
    return true;
}

std::optional<BookTurnFrameState> BookTurnHost::Regrab(const BookTurnSample& sample,
    uint64_t previousGeneration)
{
    std::lock_guard<std::mutex> lock(mutex_);
    if (!rendererReady_.load(std::memory_order_acquire) || sample.generation <= previousGeneration ||
        inputOwnerGeneration_ != previousGeneration || !inputEnded_ || pendingCommitSlots_ ||
        committedSlotsGenerationAtomic_.load(std::memory_order_acquire) == previousGeneration) return std::nullopt;
    // Serialize this rare control operation with the currently submitting
    // frame. MOVE remains a non-blocking mailbox update. No implicit target
    // or speculative future pose is returned to the new pointer.
    std::lock_guard<std::mutex> frameLock(frameMutex_);
    if (submittedFrame_.generation != previousGeneration || submittedFrame_.direction != sample.direction ||
        submittedFrame_.surfaceEpoch != surfaceRequestSerial_ || submittedFrame_.width != sample.width ||
        submittedFrame_.height != sample.height) return std::nullopt;
    const BookTurnFrameState frame = submittedFrame_;
    inputOwnerGeneration_ = sample.generation;
    inputOwnerGenerationAtomic_.store(sample.generation, std::memory_order_release);
    inputEnded_ = false;
    pendingRegrabFrame_ = frame;
    pendingSample_ = sample;
    ++sampleSerial_;
    pendingSettlement_ = Settlement::NONE;
    pendingProgrammaticDirection_.reset();
    condition_.notify_all();
    return frame;
}

bool BookTurnHost::EndGesture(const BookTurnSample& sample, bool commit)
{
    if (!rendererReady_.load(std::memory_order_acquire)) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    if (sample.generation == 0 || inputOwnerGeneration_ != sample.generation || inputEnded_) return false;
    // The final coordinates and terminal decision occupy one mailbox update.
    // A late MOVE cannot overwrite this sample after the pointer has ended.
    pendingSample_ = sample;
    ++sampleSerial_;
    inputEnded_ = true;
    pendingSettlement_ = commit ? Settlement::COMMIT : Settlement::ROLLBACK;
    pendingSettlementEased_ = false;
    pendingSettlementGeneration_ = sample.generation;
    condition_.notify_all();
    return true;
}

bool BookTurnHost::Settle(uint64_t generation, bool commit)
{
    if (!rendererReady_.load(std::memory_order_acquire)) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    if (generation == 0 || inputOwnerGeneration_ != generation || pendingCommitSlots_ ||
        committedSlotsGenerationAtomic_.load(std::memory_order_acquire) == generation) return false;
    inputEnded_ = true;
    pendingSettlement_ = commit ? Settlement::COMMIT : Settlement::ROLLBACK;
    pendingSettlementEased_ = false;
    pendingSettlementGeneration_ = generation;
    condition_.notify_all();
    return true;
}

bool BookTurnHost::StartProgrammatic(uint64_t generation, Direction direction, bool rapid)
{
    if (generation == 0) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    if (!CanStart(direction)) return false;
    if (inputOwnerGeneration_ != 0) return false;
    inputOwnerGeneration_ = generation;
    inputOwnerGenerationAtomic_.store(generation, std::memory_order_release);
    inputEnded_ = true;
    pendingProgrammaticDirection_ = direction;
    pendingSettlement_ = Settlement::COMMIT;
    pendingSettlementEased_ = true;
    pendingSettlementRapid_ = rapid;
    pendingSettlementGeneration_ = generation;
    condition_.notify_all();
    return true;
}

bool BookTurnHost::CommitSlots(uint64_t generation, Direction direction)
{
    if (!rendererReady_.load(std::memory_order_acquire)) return false;
    // Slot promotion belongs to the terminal generation currently held by
    // the presentation barrier. A late callback from an older turn must not
    // rotate the live texture ring underneath a newer page.
    if (retainedTerminalGenerationAtomic_.load(std::memory_order_acquire) != generation) return false;
    if (committedSlotsGenerationAtomic_.load(std::memory_order_acquire) == generation) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    if (inputOwnerGeneration_ != generation) return false;
    pendingCommitSlots_ = true;
    pendingCommitGeneration_ = generation;
    pendingCommitDirection_ = direction;
    condition_.notify_all();
    return true;
}

bool BookTurnHost::RetainTerminalFrame(uint64_t generation)
{
    if (generation == 0) return false;
    const uint64_t retained = retainedTerminalGenerationAtomic_.load(std::memory_order_acquire);
    // Synchronous stale gate: a hold request for any generation other than
    // the currently retained one must not touch the newer hold.
    if (retained != 0 && retained != generation) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    pendingRetain_ = true;
    pendingRetainGeneration_ = generation;
    condition_.notify_all();
    return true;
}

bool BookTurnHost::ReleaseTerminalFrame(uint64_t generation)
{
    if (generation == 0) return false;
    // Synchronous stale gate: a presented confirmation only clears the exact
    // generation it confirms (contract: stale confirms never clear).
    if (retainedTerminalGenerationAtomic_.load(std::memory_order_acquire) != generation) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    pendingRelease_ = true;
    pendingReleaseGeneration_ = generation;
    condition_.notify_all();
    return true;
}

bool BookTurnHost::ClearSurface(uint64_t generation)
{
    if (generation == 0) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    const uint64_t retained = retainedTerminalGenerationAtomic_.load(std::memory_order_acquire);
    const uint64_t released = releasedTerminalGenerationAtomic_.load(std::memory_order_acquire);
    const uint64_t rollback = rollbackTerminalGenerationAtomic_.load(std::memory_order_acquire);
    // Accept the request while ReleaseTerminalFrame is still queued (the
    // retained generation plus pending request is the proof), or after the
    // render thread has closed the barrier (the released generation is the
    // proof). A direct clear before release is rejected synchronously.
    if ((retained != generation && released != generation && rollback != generation) ||
        (retained == generation && released != generation && rollback != generation &&
            (!pendingRelease_ || pendingReleaseGeneration_ != generation))) {
        return false;
    }
    // The ArkUI side supplies the hidden-surface proof by calling this only
    // after its opacity transition and an extra frame. Queueing is still
    // generation-bound so a stale callback cannot clear a newer terminal
    // frame. The render thread performs the final released-generation gate.
    pendingClearSurface_ = true;
    pendingClearSurfaceGeneration_ = generation;
    condition_.notify_all();
    return true;
}

uint64_t BookTurnHost::RetainedTerminalGeneration() const
{
    return retainedTerminalGenerationAtomic_.load(std::memory_order_acquire);
}

uint64_t BookTurnHost::CommittedSlotsGeneration() const
{
    return committedSlotsGenerationAtomic_.load(std::memory_order_acquire);
}

uint64_t BookTurnHost::CompletedTerminalGeneration() const
{
    return completedTerminalGenerationAtomic_.load(std::memory_order_acquire);
}

bool BookTurnHost::SetDynamicHighlights(DynamicHighlights&& highlights)
{
    if (highlights.identity.empty() || highlights.rects.size() > 64 || highlights.rects.size() != highlights.colors.size()) return false;
    std::lock_guard<std::mutex> lock(mutex_);
    pendingHighlights_ = std::move(highlights);
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
            vsyncTickPostedAt_ = std::chrono::steady_clock::now();
            condition_.notify_all();
        }
    }
    vsyncBusy_.store(false, std::memory_order_release);
    // Re-arm while a gesture or settlement owns the presentation timeline.
    // Tracking stays VSync-driven even after the edge catches the latest raw
    // sample, so sparse MOVE delivery cannot collapse presentation to the
    // platform input cadence. UP/CANCEL returns the loop to the idle baseline.
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
    const bool was = frameLoopWanted_.load(std::memory_order_acquire);
    const bool wanted = settlement_ != Settlement::NONE || pendingSettlement_ != Settlement::NONE ||
        (fingerDown_ && inputFrameDirty_) || pendingSample_.has_value() ||
        (highlightFrameDirty_ && terminalRetainedGeneration_ != 0);
    frameLoopWanted_.store(wanted, std::memory_order_release);
    if (wanted && !was) {
        // Never integrate the idle interval into the first tracking frame.
        lastFrameTimestampNs_ = 0;
        frameDiag_.clear();
    } else if (!wanted && was) {
        EmitFrameDiag();
    }
    if (wanted) RequestFrameIfWanted();
}

void BookTurnHost::Run()
{
#ifdef __APPLE__
    // Host-test builds (macOS) take the single-argument pthread_setname_np;
    // the device build uses the pthread+name form below.
    (void)pthread_setname_np("reader-bookturn");
#else
    (void)pthread_setname_np(pthread_self(), "reader-bookturn");
#endif
    // Real-device pacing (2026-08-30 diagnosis): without an explicit QoS the
    // render thread wakes on a LITTLE core at background priority and the
    // per-frame condvar hop alone costs tens of ms during a turn.
    (void)OH_QoS_SetThreadQoS(QOS_USER_INTERACTIVE);
    std::unique_lock<std::mutex> lock(mutex_);
    while (!stop_) {
        condition_.wait(lock, [this]() {
            return stop_ || attachRequested_ || detachRequested_ || resizeRequested_ ||
                pendingSample_.has_value() || pendingSettlement_ != Settlement::NONE ||
                pendingHighlights_.has_value() || pendingCommitSlots_ || pendingRetain_ || pendingRelease_ || pendingClearSurface_ ||
                (inputOwnerGeneration_ == 0 && (pendingTextures_[0].has_value() ||
                pendingTextures_[1].has_value() || pendingTextures_[2].has_value())) ||
                vsyncTickPending_;
        });
        if (stop_) break;

        if (detachRequested_) {
            const uint64_t serial = detachRequestSerial_;
            const uint64_t lostGeneration = pose_.generation;
            // An attach queued before this detach belongs to the window that
            // is being destroyed (or to a create callback that never reached
            // EGL).  Drop it and every other mailbox item at this lifecycle
            // boundary.  An attach with a later request serial is a genuine
            // replacement surface and is carried across teardown so it is
            // initialized only after SURFACE_LOST has been published.
            const bool preserveAttach = attachRequested_ &&
                pendingAttachSerial_ > serial;
            void* replacementWindow = preserveAttach ? pendingWindow_ : nullptr;
            const uint64_t replacementWidth = preserveAttach ? pendingSurfaceWidth_ : 0;
            const uint64_t replacementHeight = preserveAttach ? pendingSurfaceHeight_ : 0;
            const uint64_t replacementAttachSerial = preserveAttach ? pendingAttachSerial_ : 0;

            detachRequested_ = false;
            attachRequested_ = false;
            resizeRequested_ = false;
            pendingWindow_ = nullptr;
            pendingSurfaceWidth_ = 0;
            pendingSurfaceHeight_ = 0;
            pendingAttachSerial_ = 0;
            // Texture payloads own potentially multi-megabyte PixelMap
            // copies.  Releasing them here is both a memory fence and an
            // invalidation of uploads captured for the destroyed surface.
            for (std::optional<TexturePayload>& pending : pendingTextures_) {
                pending.reset();
            }
            pendingSample_.reset();
            consumedSampleSerial_ = sampleSerial_;
            pendingSettlement_ = Settlement::NONE;
            pendingSettlementEased_ = false;
            pendingProgrammaticDirection_.reset();
            pendingSettlementGeneration_ = 0;
            pendingCommitSlots_ = false;
            pendingCommitGeneration_ = 0;
            pendingCommitDirection_ = Direction::NEXT;
            pendingRetain_ = false;
            pendingRetainGeneration_ = 0;
            pendingRelease_ = false;
            pendingReleaseGeneration_ = 0;
            pendingClearSurface_ = false;
            pendingClearSurfaceGeneration_ = 0;

            if (preserveAttach) {
                pendingWindow_ = replacementWindow;
                pendingSurfaceWidth_ = replacementWidth;
                pendingSurfaceHeight_ = replacementHeight;
                pendingAttachSerial_ = replacementAttachSerial;
                attachRequested_ = true;
            }

            frameLoopWanted_.store(false, std::memory_order_release);
            vsyncTickPending_ = false;
            vsyncTickTimestampNs_ = 0;
            lastFrameTimestampNs_ = 0;
            vsyncTickPostedAt_ = std::chrono::steady_clock::time_point {};
            fingerDown_ = false;
            renderer_.Shutdown();
            rendererReady_.store(false, std::memory_order_release);
            readyMask_.store(0, std::memory_order_release);
            active_ = false;
            terminalCommit_ = false;
            liveInput_ = BookTurnInput {};
            liveSample_ = BookTurnSample {};
            chase_ = BookTurnChaseState {};
            chaseGeneration_ = 0;
            pose_ = BookTurnPose {};
            settlement_ = Settlement::NONE;
            settlementEased_ = false;
            settlementTau0_ = 0.0F;
            settlementTargetTau_ = 0.0F;
            settlementDuration_ = 0.0F;
            pendingSettlementRapid_ = false;
            settlementElapsed_ = 0.0F;
            settlementStartTheta_ = 0.0F;
            inputOwnerGeneration_ = 0;
            inputOwnerGenerationAtomic_.store(0, std::memory_order_release);
            pendingRegrabFrame_.reset();
            inputEnded_ = false;
            inputFrameDirty_ = false;
            settlementSwapped_ = false;
            swappedGeneration_ = 0;
            swappedDirection_ = Direction::NEXT;
            settledTerminalGeneration_ = 0;
            committedSlotsGenerationAtomic_.store(0, std::memory_order_release);
            releasedTerminalGeneration_ = 0;
            releasedTerminalGenerationAtomic_.store(0, std::memory_order_release);
            rollbackTerminalGeneration_ = 0;
            rollbackTerminalGenerationAtomic_.store(0, std::memory_order_release);
            SetRetainedTerminalGeneration(0);
            retainedSince_ = std::chrono::steady_clock::time_point {};
            retainTimeoutLoggedGeneration_ = 0;
            { std::lock_guard<std::mutex> frameLock(frameMutex_); submittedFrame_ = {}; }
            pendingHighlights_.reset();
            highlightFrameDirty_ = false;
            consecutiveDrawFailures_ = 0;
            firstFrameNotifiedGeneration_ = 0;
            detachCompleteSerial_ = serial;
            lock.unlock();
            Notify(HostEvent::SURFACE_LOST, lostGeneration, 0);
            surfaceCondition_.notify_all();
            lock.lock();
            continue;
        }

        if (attachRequested_) {
            void* window = pendingWindow_;
            const uint64_t width = pendingSurfaceWidth_;
            const uint64_t height = pendingSurfaceHeight_;
            const uint64_t lifecycleSerial = pendingAttachSerial_;
            attachRequested_ = false;
            pendingAttachSerial_ = 0;
            lastFrameTimestampNs_ = 0;
            lock.unlock();
            const bool initialized = renderer_.Initialize(window, width, height);
            lock.lock();
            // A detach/new attach may have superseded this initialization
            // while EGL was being created.  Do not publish the old result;
            // the next loop iteration owns the current lifecycle.
            if (!IsSurfaceLifecycleCurrent(lifecycleSerial) || detachRequested_ || stop_) {
                rendererReady_.store(false, std::memory_order_release);
                readyMask_.store(0, std::memory_order_release);
                continue;
            }
            rendererReady_.store(initialized, std::memory_order_release);
            readyMask_.store(initialized ? renderer_.ReadyMask() : 0, std::memory_order_release);
            const HostEvent event = initialized ? HostEvent::SURFACE_READY : HostEvent::RENDER_FAILURE;
            lock.unlock();
            NotifySurfaceEvent(lifecycleSerial, event, 0, 0);
            lock.lock();
            continue;
        }

        if (resizeRequested_) {
            const uint64_t width = pendingSurfaceWidth_;
            const uint64_t height = pendingSurfaceHeight_;
            const uint64_t lifecycleSerial = surfaceLifecycleSerialAtomic_.load(std::memory_order_acquire);
            resizeRequested_ = false;
            lock.unlock();
            renderer_.Resize(width, height);
            lock.lock();
            if (!IsSurfaceLifecycleCurrent(lifecycleSerial) || detachRequested_ || stop_) {
                // A later lifecycle owns the renderer dimensions; its attach
                // or detach branch will apply the authoritative state.
                continue;
            }
        }

        if (pendingHighlights_.has_value()) {
            renderer_.SetDynamicHighlights(std::move(*pendingHighlights_));
            pendingHighlights_.reset();
            highlightFrameDirty_ = true;
            if (fingerDown_) inputFrameDirty_ = true;
            UpdateFrameLoopWanted();
        }

        // At admission, any remaining off-direction upload belongs to the
        // old ring. Freeze all bindings until the hidden-surface barrier ends.
        if (inputOwnerGeneration_ != 0) {
            for (auto& pending : pendingTextures_) pending.reset();
        }
        std::vector<TexturePayload> uploads;
        // Yield admission between uploads. CURRENT is required by either
        // direction; no batch of three full pages may precede a new pointer.
        for (const size_t index : { size_t { 1 }, size_t { 2 }, size_t { 0 } }) {
            auto& pending = pendingTextures_[index];
            if (pending.has_value() && pending->surfaceEpoch != surfaceRequestSerial_) pending.reset();
            if (pending.has_value()) {
                uploads.push_back(std::move(*pending));
                pending.reset();
                break;
            }
        }
        if (!uploads.empty()) {
            const uint64_t lifecycleSerial = surfaceLifecycleSerialAtomic_.load(std::memory_order_acquire);
            lock.unlock();
            bool success = true;
            for (TexturePayload& payload : uploads) {
                const TextureSlot slot = payload.slot;
                if (!renderer_.Upload(std::move(payload))) {
                    // Failed replacement cannot make its old resident pixels
                    // look ready under the replacement identity in ArkUI.
                    renderer_.Invalidate(slot);
                    success = false;
                }
            }
            uint32_t mask = renderer_.ReadyMask();
            lock.lock();
            // Upload may have crossed a detach/re-attach while the PixelMap
            // bytes were compacted on the render thread.  Discard both the
            // readiness publication and its callback for the old surface;
            // the replacement lifecycle will request fresh textures.
            if (!IsSurfaceLifecycleCurrent(lifecycleSerial) || detachRequested_ || stop_) {
                readyMask_.store(0, std::memory_order_release);
                continue;
            }
            // Renderer readiness describes resident pixels, not queued replacements.
            // Another slot (or this same slot) can be replaced while GL runs
            // without the mailbox lock. Never re-admit its old pixels here.
            for (size_t index = 0; index < pendingTextures_.size(); ++index) {
                if (pendingTextures_[index].has_value()) mask &= ~(1U << index);
            }
            readyMask_.store(mask, std::memory_order_release);
            CheckTerminalRetainTimeout();
            const HostEvent event = success ? HostEvent::TEXTURE_READY : HostEvent::RENDER_FAILURE;
            lock.unlock();
            NotifySurfaceEvent(lifecycleSerial, event, 0, static_cast<int32_t>(mask));
            lock.lock();
        }

        if (pendingSample_.has_value()) {
            const BookTurnSample sample = *pendingSample_;
            pendingSample_.reset();
            consumedSampleSerial_ = sampleSerial_;
            const std::optional<BookTurnFrameState> regrab = pendingRegrabFrame_;
            pendingRegrabFrame_.reset();
            if (regrab.has_value()) settlement_ = Settlement::NONE;
            // Only an explicitly admitted Regrab can replace settlement ownership.
            // Ordinary late samples cannot interrupt the current transaction.
            if (settlement_ == Settlement::NONE && (pendingSettlement_ == Settlement::NONE ||
                pendingSettlementGeneration_ == sample.generation)) {
                if (sample.generation != chaseGeneration_) {
                    chaseGeneration_ = sample.generation;
                    fingerDown_ = true;
                    if (terminalRetainedGeneration_ != 0) {
                        CheckTerminalRetainTimeout();
                        // The new gesture takes the surface over: its chase
                        // draw replaces the held terminal frame, so drop the
                        // hold without a clear (a late release for the old
                        // generation is stale-rejected at the barrier).
                        SetRetainedTerminalGeneration(0);
                    }
                    // A new gesture owns the surface and invalidates any
                    // previously released cleanup token.
                    releasedTerminalGeneration_ = 0;
                    releasedTerminalGenerationAtomic_.store(0, std::memory_order_release);
                    committedSlotsGenerationAtomic_.store(0, std::memory_order_release);
                    rollbackTerminalGeneration_ = 0;
                    rollbackTerminalGenerationAtomic_.store(0, std::memory_order_release);
                    renderer_.SetSheetVisible(true);
                    ResetChase(chase_, sample);
                    if (regrab.has_value()) {
                        chase_.originEdgeX = regrab->edgeX;
                        chase_.originEdgeY = regrab->edgeY;
                        chase_.edgeX = regrab->edgeX;
                        chase_.regrabTheta = regrab->theta;
                        chase_.regrabbed = true;
                    }
                    firstFrameNotifiedGeneration_ = 0;
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
                liveInput_.settledThetaIsPresented = false;
                liveInput_.settledTheta = 0.0F;
                liveInput_.radiusScale = 1.0F;
                active_ = true;
                inputFrameDirty_ = true;
                // Settle must start at the final input, even if no VSync ran
                // between the last MOVE/UP and the end command.
                if (pendingSettlement_ != Settlement::NONE) {
                    liveInput_.edge = { ChaseAdvance(chase_, sample, 0.0F), chase_.originEdgeY + sample.pointerY - sample.startY };
                    liveInput_.pointerVelocityX = chase_.fingerVelocityX;
                    if (chase_.regrabbed) {
                        liveInput_.overrideTheta = true;
                        liveInput_.settledThetaIsPresented = true;
                        const float sign = sample.direction == Direction::NEXT ? -1.0F : 1.0F;
                        const float lever = std::max(32.0F, std::abs(chase_.originEdgeX - SourceEdgeX(sample.direction, sample.width)));
                        liveInput_.settledTheta = chase_.regrabTheta + std::atan2(-sign * (sample.pointerY - sample.startY), lever);
                    }
                    pose_ = BookTurnSolver::Solve(liveInput_, &pose_);
                }
                UpdateFrameLoopWanted();
            }
        }

        if (pendingSettlement_ != Settlement::NONE &&
            pendingSettlementGeneration_ != inputOwnerGeneration_) {
            pendingSettlement_ = Settlement::NONE;
            pendingProgrammaticDirection_.reset();
        }
        if (pendingSettlement_ != Settlement::NONE) {
            const bool commit = pendingSettlement_ == Settlement::COMMIT;
            settlement_ = pendingSettlement_;
            settlementEased_ = pendingSettlementEased_;
            pendingSettlement_ = Settlement::NONE;
            pendingSettlementEased_ = false;
            fingerDown_ = false;
            if (terminalRetainedGeneration_ != 0) {
                CheckTerminalRetainTimeout();
                SetRetainedTerminalGeneration(0);
            }
            releasedTerminalGeneration_ = 0;
            releasedTerminalGenerationAtomic_.store(0, std::memory_order_release);
            rollbackTerminalGeneration_ = 0;
            rollbackTerminalGenerationAtomic_.store(0, std::memory_order_release);
            committedSlotsGenerationAtomic_.store(0, std::memory_order_release);
            renderer_.SetSheetVisible(true);
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
                (pendingSettlementRapid_ ? kRapidCompleteSeconds : kCompleteSeconds) :
                SettleDurationSeconds(settlementTau0_, liveInput_.direction, commit,
                    -chase_.fingerVelocityX / std::max(1.0F, liveInput_.width));
            pendingSettlementRapid_ = false;
            settlementElapsed_ = 0.0F;
            settlementStartTheta_ = pose_.theta;
            terminalCommit_ = false;
            UpdateFrameLoopWanted();
        }

        if (pendingCommitSlots_) {
            const uint64_t generation = pendingCommitGeneration_;
            const Direction direction = pendingCommitDirection_;
            const uint64_t lifecycleSerial = surfaceLifecycleSerialAtomic_.load(std::memory_order_acquire);
            pendingCommitSlots_ = false;
            if (inputOwnerGeneration_ != generation ||
                terminalRetainedGeneration_ != generation ||
                liveInput_.generation != generation || liveInput_.direction != direction ||
                committedSlotsGenerationAtomic_.load(std::memory_order_acquire) == generation) continue;
            lock.unlock();
            renderer_.CommitSlots(direction);
            renderer_.ShowTerminalPage(TextureSlot::CURRENT);
            lock.lock();
            // A detach or replacement attach superseded the slot operation
            // while GL was rotating the ring.  Do not publish a commit for a
            // surface that is no longer current; teardown resets the ring.
            if (!IsSurfaceLifecycleCurrent(lifecycleSerial) || detachRequested_ || stop_) {
                readyMask_.store(0, std::memory_order_release);
                continue;
            }
            readyMask_.store(renderer_.ReadyMask(), std::memory_order_release);
            // ArkUI presentation barrier: no Clear here. The new-page
            // terminal frame stays presented until the ArkUI presented
            // confirmation releases it (releaseTerminalFrame(generation));
            // clearing now would expose the outgoing ArkUI page.
            CheckTerminalRetainTimeout();
            active_ = false;
            terminalCommit_ = false;
            committedSlotsGenerationAtomic_.store(generation, std::memory_order_release);
            settlement_ = Settlement::NONE;
            const int32_t mask = static_cast<int32_t>(renderer_.ReadyMask());
            lock.unlock();
            NotifySurfaceEvent(lifecycleSerial, HostEvent::SLOTS_COMMITTED, generation, mask);
            lock.lock();
        }

        if (pendingRetain_ || pendingRelease_ || pendingClearSurface_) {
            const uint64_t retainGeneration = pendingRetain_ ? pendingRetainGeneration_ : 0;
            const uint64_t releaseGeneration = pendingRelease_ ? pendingReleaseGeneration_ : 0;
            const bool clearRequested = pendingClearSurface_;
            const uint64_t clearGeneration = pendingClearSurfaceGeneration_;
            const uint64_t lifecycleSerial = surfaceLifecycleSerialAtomic_.load(std::memory_order_acquire);
            pendingRetain_ = false;
            pendingRelease_ = false;
            pendingClearSurface_ = false;
            pendingClearSurfaceGeneration_ = 0;
            lock.unlock();
            if (!IsSurfaceLifecycleCurrent(lifecycleSerial)) {
                lock.lock();
                continue;
            }
            if (retainGeneration != 0) {
                if (terminalRetainedGeneration_ == retainGeneration) {
                    CheckTerminalRetainTimeout();
                } else if (terminalRetainedGeneration_ == 0 &&
                    settledTerminalGeneration_ == retainGeneration) {
                    SetRetainedTerminalGeneration(retainGeneration);
                    retainedSince_ = std::chrono::steady_clock::now();
                } else {
                    OH_LOG_WARN(LOG_APP,
                        "stale terminal retain request gen=%{public}llu retained=%{public}llu; ignored",
                        static_cast<unsigned long long>(retainGeneration),
                        static_cast<unsigned long long>(terminalRetainedGeneration_));
                }
            }
            if (releaseGeneration != 0) {
                if (!IsSurfaceLifecycleCurrent(lifecycleSerial)) {
                    lock.lock();
                    continue;
                }
                if (terminalRetainedGeneration_ == releaseGeneration) {
                    SetRetainedTerminalGeneration(0);
                    settledTerminalGeneration_ = 0;
                    releasedTerminalGeneration_ = releaseGeneration;
                    releasedTerminalGenerationAtomic_.store(releaseGeneration, std::memory_order_release);
                } else {
                    OH_LOG_WARN(LOG_APP,
                        "stale arkui presented confirmation gen=%{public}llu retained=%{public}llu; "
                        "no clear",
                        static_cast<unsigned long long>(releaseGeneration),
                        static_cast<unsigned long long>(terminalRetainedGeneration_));
                }
            }
            if (clearRequested) {
                if (!IsSurfaceLifecycleCurrent(lifecycleSerial)) {
                    lock.lock();
                    continue;
                }
                if ((releasedTerminalGeneration_ == clearGeneration ||
                    rollbackTerminalGeneration_ == clearGeneration) &&
                    terminalRetainedGeneration_ == 0) {
                    // This is the only post-settlement clear path. ArkUI has
                    // already hidden the XComponent when it issues the
                    // generation-matched request, so the transparent buffer
                    // never participates in the visible composition.
                    const bool cleared = renderer_.ClearSurface();
                    if (!IsSurfaceLifecycleCurrent(lifecycleSerial)) {
                        lock.lock();
                        continue;
                    }
                    if (cleared) {
                        // Publish completion only after the input lease is
                        // released, so an immediate next DOWN cannot race it.
                        lock.lock();
                        if (inputOwnerGeneration_ == clearGeneration) {
                            inputOwnerGeneration_ = 0;
                            inputOwnerGenerationAtomic_.store(0, std::memory_order_release);
                            inputEnded_ = false;
                            chaseGeneration_ = 0;
                        }
                        completedTerminalGenerationAtomic_.store(clearGeneration, std::memory_order_release);
                        lock.unlock();
                    }
                    if (cleared) {
                        releasedTerminalGeneration_ = 0;
                        settledTerminalGeneration_ = 0;
                        releasedTerminalGenerationAtomic_.store(0, std::memory_order_release);
                        rollbackTerminalGeneration_ = 0;
                        rollbackTerminalGenerationAtomic_.store(0, std::memory_order_release);
                    }
                    NotifySurfaceEvent(lifecycleSerial,
                        cleared ? HostEvent::TERMINAL_RELEASED : HostEvent::RENDER_FAILURE,
                        clearGeneration, cleared ? 0 : static_cast<int32_t>(renderer_.LastDrawRefusal()));
                } else {
                    OH_LOG_WARN(LOG_APP,
                        "stale hidden-surface clear gen=%{public}llu released=%{public}llu; no clear",
                        static_cast<unsigned long long>(clearGeneration),
                        static_cast<unsigned long long>(releasedTerminalGeneration_));
                }
            }
            if (IsSurfaceLifecycleCurrent(lifecycleSerial)) CheckTerminalRetainTimeout();
            lock.lock();
        }

        if (vsyncTickPending_) {
            vsyncTickPending_ = false;
            const std::chrono::steady_clock::time_point tickStart = std::chrono::steady_clock::now();
            currentWakeMs_ = std::max(0.0F,
                std::chrono::duration<float, std::milli>(tickStart - vsyncTickPostedAt_).count());
            const long long timestamp = vsyncTickTimestampNs_;
            float frameSeconds = 1.0F / 60.0F;
            if (lastFrameTimestampNs_ != 0 && timestamp > lastFrameTimestampNs_) {
                frameSeconds = Clamp(
                    static_cast<float>(static_cast<double>(timestamp - lastFrameTimestampNs_) * 1.0e-9),
                    1.0e-4F, 0.1F);
            }
            lastFrameTimestampNs_ = timestamp;
            const uint64_t lifecycleSerial = surfaceLifecycleSerialAtomic_.load(std::memory_order_acquire);
            if (highlightFrameDirty_ && terminalRetainedGeneration_ != 0 && settlement_ == Settlement::NONE) {
                highlightFrameDirty_ = false;
                lock.unlock();
                {
                    std::lock_guard<std::mutex> frameLock(frameMutex_);
                    if (IsSurfaceLifecycleCurrent(lifecycleSerial)) renderer_.Draw(pose_);
                }
                lock.lock();
                UpdateFrameLoopWanted();
            }
            if (settlement_ != Settlement::NONE) {
                lock.unlock();
                ProcessSettlementFrame(frameSeconds, lifecycleSerial);
                lock.lock();
                if (!IsSurfaceLifecycleCurrent(lifecycleSerial) || detachRequested_ || stop_) {
                    frameLoopWanted_.store(false, std::memory_order_release);
                    fingerDown_ = false;
                    active_ = false;
                    settlement_ = Settlement::NONE;
                    continue;
                }
            } else if (fingerDown_ && inputFrameDirty_) {
                lock.unlock();
                const bool trackingAlive = ProcessChaseFrame(frameSeconds, timestamp, lifecycleSerial);
                lock.lock();
                if (!IsSurfaceLifecycleCurrent(lifecycleSerial) || detachRequested_ || stop_) {
                    frameLoopWanted_.store(false, std::memory_order_release);
                    fingerDown_ = false;
                    active_ = false;
                    settlement_ = Settlement::NONE;
                    continue;
                }
                if (!trackingAlive) fingerDown_ = false;
                UpdateFrameLoopWanted();
            } else {
                // §11.3: settlement ended (or was torn down) and no gesture is
                // live — re-evaluate the gate so one-shot re-arms stop here
                // instead of ticking the worker every VSync at idle.
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

void BookTurnHost::SetRetainedTerminalGeneration(uint64_t generation)
{
    if (terminalRetainedGeneration_ == generation) return;
    terminalRetainedGeneration_ = generation;
    retainTimeoutLoggedGeneration_ = 0;
    retainedTerminalGenerationAtomic_.store(generation, std::memory_order_release);
}

void BookTurnHost::CheckTerminalRetainTimeout()
{
    if (terminalRetainedGeneration_ == 0 ||
        retainTimeoutLoggedGeneration_ == terminalRetainedGeneration_) {
        return;
    }
    const double elapsedMs = std::chrono::duration<double, std::milli>(
        std::chrono::steady_clock::now() - retainedSince_).count();
    if (elapsedMs < TerminalRetainTimeoutMs()) return;
    retainTimeoutLoggedGeneration_ = terminalRetainedGeneration_;
    OH_LOG_WARN(LOG_APP,
        "arkui presented confirmation timeout gen=%{public}llu elapsed=%{public}.0fms; "
        "terminal frame retained (no outgoing-page exposure)",
        static_cast<unsigned long long>(terminalRetainedGeneration_), elapsedMs);
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

bool BookTurnHost::IsSurfaceLifecycleCurrent(uint64_t serial) const
{
    return serial != 0 &&
        surfaceLifecycleSerialAtomic_.load(std::memory_order_acquire) == serial;
}

void BookTurnHost::NotifySurfaceEvent(uint64_t serial, HostEvent event, uint64_t generation,
    int32_t detail)
{
    // The serial is advanced synchronously by AttachSurface/DetachSurface (and
    // by host shutdown) before either operation can invalidate the old EGL
    // surface.  A stale worker completion therefore cannot enqueue a READY,
    // TEXTURE, FRAME, SLOTS or failure event for the replacement surface.
    if (IsSurfaceLifecycleCurrent(serial)) Notify(event, generation, detail);
}

void BookTurnHost::RecordFrameDiag(float solveMs, float drawMs)
{
    if (frameDiag_.size() >= kFrameDiagCapacity) return;
    frameDiag_.push_back({ std::chrono::steady_clock::now(), currentWakeMs_, solveMs, drawMs });
}

void BookTurnHost::EmitFrameDiag()
{
    if (frameDiag_.empty()) return;
    std::vector<float> wake;
    std::vector<float> solve;
    std::vector<float> draw;
    std::vector<float> gaps;
    wake.reserve(frameDiag_.size());
    solve.reserve(frameDiag_.size());
    draw.reserve(frameDiag_.size());
    gaps.reserve(frameDiag_.size());
    for (const FrameDiagSample& sample : frameDiag_) {
        wake.push_back(sample.wakeMs);
        solve.push_back(sample.solveMs);
        draw.push_back(sample.drawMs);
    }
    for (std::size_t index = 1; index < frameDiag_.size(); ++index) {
        gaps.push_back(std::chrono::duration<float, std::milli>(
            frameDiag_[index].at - frameDiag_[index - 1].at).count());
    }
    const float windowMs = gaps.empty() ? 0.0F :
        std::chrono::duration<float, std::milli>(
            frameDiag_.back().at - frameDiag_.front().at).count();
    // gap percentiles are the rendered frame interval: a healthy loop shows
    // p50 at one display vsync (8.33 ms @ 120 Hz); anything above is pacing,
    // not draw cost (draw is reported separately).
    OH_LOG_INFO(LOG_APP,
        "frames=%{public}zu dur=%{public}.0fms gap p50=%{public}.2f p95=%{public}.2f max=%{public}.2f | "
        "wake p50=%{public}.2f p95=%{public}.2f max=%{public}.2f | "
        "solve max=%{public}.2f | draw p50=%{public}.2f p95=%{public}.2f max=%{public}.2f ms",
        frameDiag_.size(), windowMs, Percentile(gaps, 0.5F), Percentile(gaps, 0.95F),
        Percentile(gaps, 1.0F), Percentile(wake, 0.5F), Percentile(wake, 0.95F),
        Percentile(wake, 1.0F), Percentile(solve, 1.0F), Percentile(draw, 0.5F),
        Percentile(draw, 0.95F), Percentile(draw, 1.0F));
    frameDiag_.clear();
}

bool BookTurnHost::ProcessChaseFrame(float frameSeconds, int64_t frameTimeNs,
    uint64_t surfaceSerial)
{
    std::lock_guard<std::mutex> frameLock(frameMutex_);
    if (!IsSurfaceLifecycleCurrent(surfaceSerial) ||
        inputOwnerGenerationAtomic_.load(std::memory_order_acquire) != liveInput_.generation) return false;
    const BookTurnSample sample = PresentChaseSample(chase_, liveSample_, frameTimeNs);
    liveInput_.pointer = { sample.pointerX, sample.pointerY };
    liveInput_.pointerVelocityX = chase_.fingerVelocityX;
    liveInput_.eventTimeNs = sample.eventTimeNs;
    const float edgeX = ChaseAdvance(chase_, sample, frameSeconds);
    // The fold-line vertical follows the newest pointer sample, advanced at
    // frame cadence like the edge x (the V1 MOVE-time snap is gone with the
    // ArkTS edge state).
    liveInput_.edge = { edgeX, chase_.originEdgeY + sample.pointerY - sample.startY };
    liveInput_.overrideTheta = chase_.regrabbed;
    liveInput_.settledThetaIsPresented = chase_.regrabbed;
    const float sign = sample.direction == Direction::NEXT ? -1.0F : 1.0F;
    const float lever = std::max(32.0F, std::abs(chase_.originEdgeX - SourceEdgeX(sample.direction, sample.width)));
    liveInput_.settledTheta = chase_.regrabbed ? chase_.regrabTheta +
        std::atan2(-sign * (sample.pointerY - sample.startY), lever) : 0.0F;
    liveInput_.radiusScale = 1.0F;
    if (!IsSurfaceLifecycleCurrent(surfaceSerial)) return false;
    const std::chrono::steady_clock::time_point solveStart = std::chrono::steady_clock::now();
    pose_ = BookTurnSolver::Solve(liveInput_, &pose_);
    if (!IsSurfaceLifecycleCurrent(surfaceSerial)) return false;
    const float solveMs = std::chrono::duration<float, std::milli>(
        std::chrono::steady_clock::now() - solveStart).count();
    const std::chrono::steady_clock::time_point drawStart = std::chrono::steady_clock::now();
    const bool drew = renderer_.Draw(pose_);
    RecordFrameDiag(solveMs, std::chrono::duration<float, std::milli>(
        std::chrono::steady_clock::now() - drawStart).count());
    if (!drew) {
        if (++consecutiveDrawFailures_ <= kMaxConsecutiveDrawFailures) {
            return true;
        }
        if (!IsSurfaceLifecycleCurrent(surfaceSerial)) return false;
        active_ = false;
        SetRetainedTerminalGeneration(0);
        NotifySurfaceEvent(surfaceSerial, HostEvent::RENDER_FAILURE, liveInput_.generation,
            static_cast<int32_t>(renderer_.LastDrawRefusal()));
        return false;
    }
    if (!IsSurfaceLifecycleCurrent(surfaceSerial)) return false;
    submittedFrame_ = { pose_.generation, pose_.direction, pose_.target.x, pose_.target.y, pose_.theta, surfaceSerial, liveInput_.width, liveInput_.height };
    consecutiveDrawFailures_ = 0;
    inputFrameDirty_ = false;
    if (firstFrameNotifiedGeneration_ != liveInput_.generation) {
        firstFrameNotifiedGeneration_ = liveInput_.generation;
        NotifySurfaceEvent(surfaceSerial, HostEvent::FRAME_PRESENTED, liveInput_.generation, 0);
    }
    return true;
}

bool BookTurnHost::ProcessSettlementFrame(float frameSeconds, uint64_t surfaceSerial)
{
    std::lock_guard<std::mutex> frameLock(frameMutex_);
    if (!IsSurfaceLifecycleCurrent(surfaceSerial) ||
        inputOwnerGenerationAtomic_.load(std::memory_order_acquire) != liveInput_.generation) return false;
    if (terminalCommit_ || settlement_ == Settlement::NONE) return false;
    if (!active_) {
        // Defensive §7.4 closure: nothing visual to settle.
        settlement_ = Settlement::NONE;
        NotifySurfaceEvent(surfaceSerial, HostEvent::ROLLBACK_COMPLETE, liveInput_.generation, 0);
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
    liveInput_.settledThetaIsPresented = true;
    liveInput_.settledTheta = SettleThetaAt(settlementStartTheta_, settlementElapsed_,
        settlementDuration_);
    liveInput_.radiusScale = scale;
    if (!IsSurfaceLifecycleCurrent(surfaceSerial)) return false;
    const std::chrono::steady_clock::time_point solveStart = std::chrono::steady_clock::now();
    pose_ = BookTurnSolver::Solve(liveInput_, &pose_);
    if (!IsSurfaceLifecycleCurrent(surfaceSerial)) return false;
    if (SettlementSwapShouldFire(commit, liveInput_.direction, tau, pose_)) {
        renderer_.ShowTerminalPage(TextureSlot::NEXT);
    }
    if (settlementElapsed_ >= settlementDuration_) {
        const TextureSlot destination = !commit ? TextureSlot::CURRENT :
            (liveInput_.direction == Direction::NEXT ? TextureSlot::NEXT : TextureSlot::PREVIOUS);
        renderer_.ShowTerminalPage(destination);
    }
    // Include the swap-coverage predicate in solve diagnostics. Previously the
    // only dense geometry probe was invisible in the timing split.
    const float solveMs = std::chrono::duration<float, std::milli>(
        std::chrono::steady_clock::now() - solveStart).count();
    const std::chrono::steady_clock::time_point drawStart = std::chrono::steady_clock::now();
    const bool drew = renderer_.Draw(pose_);
    RecordFrameDiag(solveMs, std::chrono::duration<float, std::milli>(
        std::chrono::steady_clock::now() - drawStart).count());
    if (!drew) {
        if (++consecutiveDrawFailures_ <= kMaxConsecutiveDrawFailures) {
            return true;
        }
        if (!IsSurfaceLifecycleCurrent(surfaceSerial)) return false;
        active_ = false;
        settlement_ = Settlement::NONE;
        SetRetainedTerminalGeneration(0);
        NotifySurfaceEvent(surfaceSerial, HostEvent::RENDER_FAILURE, liveInput_.generation,
            static_cast<int32_t>(renderer_.LastDrawRefusal()));
        return false;
    }
    if (!IsSurfaceLifecycleCurrent(surfaceSerial)) return false;
    submittedFrame_ = { pose_.generation, pose_.direction, pose_.target.x, pose_.target.y, pose_.theta, surfaceSerial, liveInput_.width, liveInput_.height };
    consecutiveDrawFailures_ = 0;
    if (firstFrameNotifiedGeneration_ != liveInput_.generation) {
        firstFrameNotifiedGeneration_ = liveInput_.generation;
        NotifySurfaceEvent(surfaceSerial, HostEvent::FRAME_PRESENTED, liveInput_.generation, 0);
    }
    const bool tauFinished = settlementElapsed_ >= settlementDuration_;
    const bool tiltFinished = std::abs(liveInput_.settledTheta) <= 1.0e-4F;
    if (!tauFinished || !tiltFinished) return true;
    if (commit) {
        terminalCommit_ = true;
        settlement_ = Settlement::NONE;
        settledTerminalGeneration_ = liveInput_.generation;
        // Presentation barrier opens at the terminal frame: the surface keeps
        // showing the new page until ArkUI confirms the promoted content
        // (releaseTerminalFrame) — never the outgoing page.
        SetRetainedTerminalGeneration(liveInput_.generation);
        releasedTerminalGeneration_ = 0;
        releasedTerminalGenerationAtomic_.store(0, std::memory_order_release);
        rollbackTerminalGeneration_ = 0;
        rollbackTerminalGenerationAtomic_.store(0, std::memory_order_release);
        retainedSince_ = std::chrono::steady_clock::now();
        NotifySurfaceEvent(surfaceSerial, HostEvent::VISUAL_COMMIT_ENDPOINT,
            liveInput_.generation, 0);
    } else {
        settlement_ = Settlement::NONE;
        active_ = false;
        // Rollback still has a real terminal frame: keep the restored native
        // page visible until ArkUI has put its page tree back at offset 0.
        // The ArkUI side then follows the same hide -> release -> clear
        // barrier as a successful commit, so rollback cannot expose a
        // transparent EGL swap while the page tree is being reconciled.
        settledTerminalGeneration_ = liveInput_.generation;
        releasedTerminalGeneration_ = 0;
        releasedTerminalGenerationAtomic_.store(0, std::memory_order_release);
        rollbackTerminalGeneration_ = liveInput_.generation;
        rollbackTerminalGenerationAtomic_.store(liveInput_.generation, std::memory_order_release);
        SetRetainedTerminalGeneration(liveInput_.generation);
        retainedSince_ = std::chrono::steady_clock::now();
        NotifySurfaceEvent(surfaceSerial, HostEvent::ROLLBACK_COMPLETE, liveInput_.generation, 0);
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
