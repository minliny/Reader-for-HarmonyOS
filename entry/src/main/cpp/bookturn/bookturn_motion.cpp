#include "bookturn_motion.h"

#include <algorithm>
#include <cmath>

namespace reader::bookturn {
namespace {

float Clamp(float value, float low, float high)
{
    return std::max(low, std::min(high, value));
}

float SmoothStep01(float low, float high, float value)
{
    if (high <= low) return value >= high ? 1.0F : 0.0F;
    const float ratio = Clamp((value - low) / (high - low), 0.0F, 1.0F);
    return ratio * ratio * (3.0F - 2.0F * ratio);
}

float Sign(float value)
{
    return value > 0.0F ? 1.0F : (value < 0.0F ? -1.0F : 0.0F);
}

float DirectionSign(Direction direction)
{
    return direction == Direction::NEXT ? -1.0F : 1.0F;
}

}  // namespace

float SourceEdgeX(Direction direction, float width)
{
    return direction == Direction::NEXT ? width : 0.0F;
}

void ResetChase(BookTurnChaseState& state, const BookTurnSample& sample)
{
    state.edgeX = SourceEdgeX(sample.direction, sample.width);
    state.previousPointerX = sample.startX;
    state.previousPointerY = sample.startY;
    state.previousSampleTimeNs = std::max<int64_t>(0, sample.eventTimeNs - kPresentationDelayNs);
    state.lastPointerX = sample.startX;
    state.lastPointerY = sample.startY;
    state.lastSampleTimeNs = state.previousSampleTimeNs;
    state.fingerVelocityX = 0.0F;
    state.fingerVelocityY = 0.0F;
    state.seeded = false;
}

void RecordChaseSample(BookTurnChaseState& state, const BookTurnSample& sample)
{
    state.previousPointerX = state.lastPointerX;
    state.previousPointerY = state.lastPointerY;
    state.previousSampleTimeNs = state.lastSampleTimeNs;
    const float elapsedSeconds =
        static_cast<float>(static_cast<double>(sample.eventTimeNs - state.lastSampleTimeNs) * 1.0e-9);
    if (elapsedSeconds > 0.0F) {
        const float velocityX = (sample.pointerX - state.lastPointerX) / elapsedSeconds;
        const float velocityY = (sample.pointerY - state.lastPointerY) / elapsedSeconds;
        state.fingerVelocityX = std::isfinite(velocityX) ? velocityX : 0.0F;
        state.fingerVelocityY = std::isfinite(velocityY) ? velocityY : 0.0F;
    }
    state.lastPointerX = sample.pointerX;
    state.lastPointerY = sample.pointerY;
    state.lastSampleTimeNs = sample.eventTimeNs;
    state.seeded = true;
}

BookTurnSample PresentChaseSample(const BookTurnChaseState& state, const BookTurnSample& sample,
    int64_t frameTimeNs)
{
    if (!state.seeded || frameTimeNs <= 0 || sample.eventTimeNs <= state.previousSampleTimeNs) {
        return sample;
    }
    const int64_t presentationTimeNs = std::max<int64_t>(0, frameTimeNs - kPresentationDelayNs);
    const double intervalNs = static_cast<double>(sample.eventTimeNs - state.previousSampleTimeNs);
    const float phase = Clamp(static_cast<float>(
        static_cast<double>(presentationTimeNs - state.previousSampleTimeNs) / intervalNs), 0.0F, 1.0F);
    BookTurnSample presented = sample;
    presented.pointerX = state.previousPointerX + phase * (sample.pointerX - state.previousPointerX);
    presented.pointerY = state.previousPointerY + phase * (sample.pointerY - state.previousPointerY);
    return presented;
}

float ChaseTargetX(const BookTurnSample& sample)
{
    const float width = sample.width;
    if (sample.verticalPrevious) {
        const float upward = std::max(0.0F, sample.startY - sample.pointerY);
        const float gate = SmoothStep01(0.0F, kVerticalPreviousStartVp, upward);
        return Clamp(gate * sample.pointerX, 0.0F, width);
    }
    const float displacement = sample.pointerX - sample.startX;
    const float progress = std::max(0.0F, DirectionSign(sample.direction) * displacement);
    const float gate = SmoothStep01(0.0F, kHorizontalStartVp, progress);
    const float source = SourceEdgeX(sample.direction, width);
    return Clamp(source + gate * (sample.pointerX - source), 0.0F, width);
}

float ChaseGap(const BookTurnChaseState& state, const BookTurnSample& sample)
{
    const float inwardSign = sample.direction == Direction::NEXT ? -1.0F : 1.0F;
    const float source = SourceEdgeX(sample.direction, sample.width);
    const float edgeProgress = inwardSign * (state.edgeX - source);
    const float targetProgress = inwardSign * (ChaseTargetX(sample) - source);
    return targetProgress - edgeProgress;
}

float ChaseAdvance(BookTurnChaseState& state, const BookTurnSample& sample, float frameSeconds)
{
    const float followX = ChaseTargetX(sample);
    if (frameSeconds <= 0.0F) return state.edgeX;

    // Gestures starting inside the edge-origin band track x_follow directly
    // once ownership progress locks; interior starts run the catch dynamics.
    const float source = SourceEdgeX(sample.direction, sample.width);
    const bool edgeOrigin = std::abs(sample.startX - source) <= kEdgeOriginBandVp;
    const bool lockedProgress = sample.verticalPrevious ?
        std::max(0.0F, sample.startY - sample.pointerY) >= kVerticalPreviousStartVp :
        std::max(0.0F, DirectionSign(sample.direction) * (sample.pointerX - sample.startX)) >=
            kHorizontalStartVp;
    if (edgeOrigin && lockedProgress) {
        state.edgeX = followX;
        return followX;
    }

    const float inwardSign = sample.direction == Direction::NEXT ? -1.0F : 1.0F;
    const float edgeProgress = inwardSign * (state.edgeX - source);
    const float targetProgress = inwardSign * (followX - source);
    const float gap = targetProgress - edgeProgress;
    const float gapMagnitude = std::abs(gap);
    if (gapMagnitude <= kCatchLockVp) {
        state.edgeX = followX;
        return followX;
    }

    const float near = std::max(kCatchLockVp,
        std::min(kCatchNearMaxVp, kCatchNearViewporRatio * sample.width));
    const float fast = kCatchSpeedViewportsPerSecond * sample.width * Sign(gap);
    const float fingerInwardVelocity = inwardSign * state.fingerVelocityX;
    const float k = gapMagnitude > near ? 1.0F : gapMagnitude / near;
    const float edgeVelocity = gapMagnitude > near ? fast :
        fingerInwardVelocity + k * (fast - fingerInwardVelocity);
    float step = edgeVelocity * frameSeconds;
    if (Sign(step) != Sign(gap) && gapMagnitude > kCatchLockVp) {
        // A reversing finger may request a negative target velocity. It must
        // not create a new lag while the edge is still on the other side of
        // target.
        step = 0.0F;
    }
    if (std::abs(step) >= gapMagnitude) {
        state.edgeX = followX;
        return followX;
    }
    state.edgeX = Clamp(source + inwardSign * (edgeProgress + step), 0.0F, sample.width);
    return state.edgeX;
}

float SettleTargetTau(Direction direction, bool commit)
{
    if (direction == Direction::NEXT) return commit ? 1.0F : 0.0F;
    return commit ? 0.0F : 1.0F;
}

float SettleDurationSeconds(float tau0, Direction direction, bool commit)
{
    const float remaining = std::abs(SettleTargetTau(direction, commit) - tau0);
    return std::max(kSettleMinSeconds, kCompleteSeconds * remaining);
}

float SettleTauAt(float tau0, float targetTau, float elapsedSeconds, float durationSeconds,
    bool easeOut)
{
    const float progress =
        durationSeconds > 0.0F ? Clamp(elapsedSeconds / durationSeconds, 0.0F, 1.0F) : 1.0F;
    const float shaped = easeOut ?
        1.0F - (1.0F - progress) * (1.0F - progress) * (1.0F - progress) : progress;
    return tau0 + (targetTau - tau0) * shaped;
}

float SettleThetaAt(float theta0, float elapsedSeconds, float durationSeconds)
{
    const float progress = durationSeconds > 0.0F ?
        Clamp(elapsedSeconds / durationSeconds, 0.0F, 1.0F) : 1.0F;
    const float shaped = progress * progress * (3.0F - 2.0F * progress);
    return theta0 * (1.0F - shaped);
}

bool SettlementSwapShouldFire(bool commit, Direction direction, float tau,
    const BookTurnPose& pose)
{
    if (!commit || direction != Direction::NEXT || tau < kStageSpineEnd) return false;
    return !BookTurnSolver::SheetCoverageExceeds(pose, kSwapCoverRatio);
}

}  // namespace reader::bookturn
