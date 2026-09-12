#include "bookturn_motion.h"

#include <algorithm>
#include <cmath>

namespace reader::bookturn {
namespace {

float Clamp(float value, float low, float high)
{
    return std::max(low, std::min(high, value));
}

}  // namespace

float SourceEdgeX(Direction direction, float width)
{
    return direction == Direction::NEXT ? width : 0.0F;
}

void ResetChase(BookTurnChaseState& state, const BookTurnSample& sample)
{
    state.edgeX = SourceEdgeX(sample.direction, sample.width);
    state.originEdgeX = state.edgeX;
    state.originEdgeY = sample.startY;
    state.regrabTheta = 0.0F;
    state.regrabbed = false;
    state.previousPointerX = sample.startX;
    state.previousPointerY = sample.startY;
    state.previousSampleTimeNs = std::max<int64_t>(0, sample.eventTimeNs);
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
    (void)state;
    (void)frameTimeNs;
    return sample;
}

float ChaseTargetX(const BookTurnSample& sample)
{
    const float displacement = sample.verticalPrevious ?
        std::max(0.0F, sample.startY - sample.pointerY) : sample.pointerX - sample.startX;
    return Clamp(SourceEdgeX(sample.direction, sample.width) + displacement, 0.0F, sample.width);
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
    (void)frameSeconds;
    const float displacement = sample.verticalPrevious ?
        std::max(0.0F, sample.startY - sample.pointerY) : sample.pointerX - sample.startX;
    state.edgeX = Clamp(state.originEdgeX + displacement, 0.0F, sample.width);
    return state.edgeX;
}

float SettleTargetTau(Direction direction, bool commit)
{
    if (direction == Direction::NEXT) return commit ? 1.0F : 0.0F;
    return commit ? 0.0F : 1.0F;
}

float SettleDurationSeconds(float tau0, Direction direction, bool commit, float velocityPagesPerSecond)
{
    const float remaining = std::abs(SettleTargetTau(direction, commit) - tau0);
    if (remaining <= 1.0e-5F) return 0.0F;
    const float towardTarget = (SettleTargetTau(direction, commit) - tau0) * velocityPagesPerSecond;
    const float speed = towardTarget > 0.0F ? std::abs(velocityPagesPerSecond) : 0.0F;
    const float duration = remaining / std::max(2.5F, speed);
    return Clamp(duration, kSettleMinSeconds, kCompleteSeconds);
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
