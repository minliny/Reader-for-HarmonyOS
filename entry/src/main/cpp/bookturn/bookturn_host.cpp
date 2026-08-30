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

BookTurnHost::BookTurnHost() : renderThread_([this]() { Run(); })
{
    (void)TerminalRetainTimeoutMs();
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

uint64_t BookTurnHost::RetainedTerminalGeneration() const
{
    return retainedTerminalGenerationAtomic_.load(std::memory_order_acquire);
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
        fingerDown_;
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
                pendingCommitSlots_ || pendingRetain_ || pendingRelease_ ||
                pendingTextures_[0].has_value() ||
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
            renderer_.Shutdown();
            rendererReady_.store(false, std::memory_order_release);
            readyMask_.store(0, std::memory_order_release);
            active_ = false;
            terminalCommit_ = false;
            settlement_ = Settlement::NONE;
            settlementSwapped_ = false;
            swappedGeneration_ = 0;
            settledTerminalGeneration_ = 0;
            SetRetainedTerminalGeneration(0);
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
            CheckTerminalRetainTimeout();
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
                    if (terminalRetainedGeneration_ != 0) {
                        CheckTerminalRetainTimeout();
                        // The new gesture takes the surface over: its chase
                        // draw replaces the held terminal frame, so drop the
                        // hold without a clear (a late release for the old
                        // generation is stale-rejected at the barrier).
                        SetRetainedTerminalGeneration(0);
                    }
                    renderer_.SetSheetVisible(true);
                    if (settlementSwapped_) {
                        // A new gesture after an uncommitted early swap: undo
                        // the rotation so the live draw sees its slots again.
                        renderer_.UndoCommitSlots();
                        renderer_.SetSheetVisible(true);
                        readyMask_.store(renderer_.ReadyMask(), std::memory_order_release);
                        settlementSwapped_ = false;
                        swappedGeneration_ = 0;
                    }
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
            if (terminalRetainedGeneration_ != 0) {
                CheckTerminalRetainTimeout();
                SetRetainedTerminalGeneration(0);
            }
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
                kCompleteSeconds :
                SettleDurationSeconds(settlementTau0_, liveInput_.direction, commit);
            settlementElapsed_ = 0.0F;
            settlementStartTheta_ = pose_.theta;
            terminalCommit_ = false;
            if (!commit && settlementSwapped_) {
                // §7.3: a rollback after the early swap replays from the
                // pre-rotation slot layout (bottom = old next, sheet = old
                // current) with the sheet visible again.
                renderer_.UndoCommitSlots();
                renderer_.SetSheetVisible(true);
                readyMask_.store(renderer_.ReadyMask(), std::memory_order_release);
                settlementSwapped_ = false;
                swappedGeneration_ = 0;
            }
            UpdateFrameLoopWanted();
        }

        if (pendingCommitSlots_) {
            const uint64_t generation = pendingCommitGeneration_;
            const Direction direction = pendingCommitDirection_;
            pendingCommitSlots_ = false;
            // §7.3 idempotency: when this settlement already rotated the
            // slots at the coverage-time swap, the business-confirm rotation
            // must not double-rotate; only the frame teardown remains.
            const bool alreadySwapped = settlementSwapped_ && swappedGeneration_ == generation;
            settlementSwapped_ = false;
            swappedGeneration_ = 0;
            lock.unlock();
            if (!alreadySwapped) {
                renderer_.CommitSlots(direction);
            }
            readyMask_.store(renderer_.ReadyMask(), std::memory_order_release);
            // ArkUI presentation barrier: no Clear here. The new-page
            // terminal frame stays presented until the ArkUI presented
            // confirmation releases it (releaseTerminalFrame(generation));
            // clearing now would expose the outgoing ArkUI page.
            CheckTerminalRetainTimeout();
            active_ = false;
            terminalCommit_ = false;
            settlement_ = Settlement::NONE;
            Notify(HostEvent::SLOTS_COMMITTED, generation, static_cast<int32_t>(renderer_.ReadyMask()));
            lock.lock();
        }

        if (pendingRetain_ || pendingRelease_) {
            const uint64_t retainGeneration = pendingRetain_ ? pendingRetainGeneration_ : 0;
            const uint64_t releaseGeneration = pendingRelease_ ? pendingReleaseGeneration_ : 0;
            pendingRetain_ = false;
            pendingRelease_ = false;
            lock.unlock();
            if (retainGeneration != 0) {
                if (terminalRetainedGeneration_ == retainGeneration) {
                    retainedSince_ = std::chrono::steady_clock::now();
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
                if (terminalRetainedGeneration_ == releaseGeneration) {
                    renderer_.Clear();
                    SetRetainedTerminalGeneration(0);
                    Notify(HostEvent::TERMINAL_RELEASED, releaseGeneration, 0);
                } else {
                    OH_LOG_WARN(LOG_APP,
                        "stale arkui presented confirmation gen=%{public}llu retained=%{public}llu; "
                        "no clear",
                        static_cast<unsigned long long>(releaseGeneration),
                        static_cast<unsigned long long>(terminalRetainedGeneration_));
                }
            }
            CheckTerminalRetainTimeout();
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
            if (settlement_ != Settlement::NONE) {
                lock.unlock();
                ProcessSettlementFrame(frameSeconds);
                lock.lock();
            } else if (fingerDown_) {
                lock.unlock();
                const bool trackingAlive = ProcessChaseFrame(frameSeconds, timestamp);
                lock.lock();
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

bool BookTurnHost::ProcessChaseFrame(float frameSeconds, int64_t frameTimeNs)
{
    const BookTurnSample sample = PresentChaseSample(chase_, liveSample_, frameTimeNs);
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
    const std::chrono::steady_clock::time_point solveStart = std::chrono::steady_clock::now();
    pose_ = BookTurnSolver::Solve(liveInput_, &pose_);
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
        active_ = false;
        SetRetainedTerminalGeneration(0);
        renderer_.Clear();
        Notify(HostEvent::RENDER_FAILURE, liveInput_.generation,
            static_cast<int32_t>(renderer_.LastDrawRefusal()));
        return false;
    }
    consecutiveDrawFailures_ = 0;
    return true;
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
    const std::chrono::steady_clock::time_point solveStart = std::chrono::steady_clock::now();
    pose_ = BookTurnSolver::Solve(liveInput_, &pose_);
    // §7.3 tau_swap: fire once per settlement. Without this guard the gate
    // stays true on every remaining frame (tau past the spine end and the
    // hidden sheet has near-zero coverage), re-rotating the slots each VSync
    // until an unready slot lands in CURRENT and the draw fails.
    if (!settlementSwapped_ &&
        SettlementSwapShouldFire(commit, liveInput_.direction, tau, pose_)) {
        // §7.3 tau_swap: first VSync where the sheet is a thin spine strip.
        // Page index, base slot and sheet visibility swap atomically here;
        // the endpoint event semantics stay unchanged.
        renderer_.CommitSlots(Direction::NEXT);
        renderer_.SetSheetVisible(false);
        settlementSwapped_ = true;
        swappedGeneration_ = liveInput_.generation;
        readyMask_.store(renderer_.ReadyMask(), std::memory_order_release);
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
        active_ = false;
        settlement_ = Settlement::NONE;
        SetRetainedTerminalGeneration(0);
        renderer_.Clear();
        Notify(HostEvent::RENDER_FAILURE, liveInput_.generation,
            static_cast<int32_t>(renderer_.LastDrawRefusal()));
        return false;
    }
    consecutiveDrawFailures_ = 0;
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
        retainedSince_ = std::chrono::steady_clock::now();
        Notify(HostEvent::VISUAL_COMMIT_ENDPOINT, liveInput_.generation, 0);
    } else {
        settlement_ = Settlement::NONE;
        active_ = false;
        SetRetainedTerminalGeneration(0);
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
