// Stage-3 verification suite for the native input-chain motion math
// (contract: docs/BOOK_PAGE_TURN_CONTRACT_V2_2026-08-29.md, sections 5.3,
// 7.2, 11.3, 13.4).
//
// Pure CPU test: no SDK, no emulator, no hdc. Build & run:
//   cd entry/src/main/cpp
//   clang++ -std=c++17 -Wall -Wextra -Werror -I bookturn \
//       tests/bookturn_motion_test.cpp bookturn/bookturn_motion.cpp \
//       bookturn/bookturn_solver.cpp -o /tmp/v2_motion_test
//   /tmp/v2_motion_test
//
// Covers the V1-inherited chase semantics ported to native (FAST/NEAR/LOCK,
// step clamping, edge-origin 1:1 ownership, reversing-finger guard) and the
// frozen V2 settlement schedule (direction-symmetric durations, linear-in-tau
// settle/cancel, ease-out programmatic, INV-3 time reversal).

#include "../bookturn/bookturn_motion.h"

#include <algorithm>
#include <cstdio>
#include <string>

namespace {

using reader::bookturn::BookTurnChaseState;
using reader::bookturn::BookTurnInput;
using reader::bookturn::BookTurnPose;
using reader::bookturn::BookTurnSample;
using reader::bookturn::BookTurnSolver;
using reader::bookturn::ChaseAdvance;
using reader::bookturn::ChaseGap;
using reader::bookturn::ChaseTargetX;
using reader::bookturn::Direction;
using reader::bookturn::RecordChaseSample;
using reader::bookturn::ResetChase;
using reader::bookturn::SettleDurationSeconds;
using reader::bookturn::SettleTauAt;
using reader::bookturn::SettleTargetTau;
using reader::bookturn::SettlementSwapShouldFire;

constexpr float kW = 390.0F;
constexpr float kH = 780.0F;
constexpr float kMidY = 0.5F * kH;
constexpr float kFrame = 1.0F / 60.0F;
constexpr float kNear = std::min(reader::bookturn::kCatchNearMaxVp,
    reader::bookturn::kCatchNearViewporRatio * kW);
constexpr float kFastStep = reader::bookturn::kCatchSpeedViewportsPerSecond * kW * kFrame;

int g_checks = 0;
int g_fails = 0;

void Fail(const char* name, const char* detail)
{
    std::printf("    FAIL %s: %s\n", name, detail);
    ++g_fails;
}

void CheckTrue(bool condition, const char* name, const char* detail)
{
    ++g_checks;
    if (!condition) {
        Fail(name, detail);
    }
}

void CheckNear(const char* name, double actual, double expected, double tolerance)
{
    ++g_checks;
    const double diff = actual - expected;
    if (!(diff <= tolerance && -diff <= tolerance)) {
        char buffer[192];
        std::snprintf(buffer, sizeof(buffer), "expected %.10g +/- %.3g, actual %.10g (err %.3g)",
            expected, tolerance, actual, diff);
        Fail(name, buffer);
    }
}

BookTurnSample Sample(Direction direction, float startX, float pointerX, float pointerY = kMidY,
    bool verticalPrevious = false, float startY = kMidY, int64_t timeNs = 0)
{
    BookTurnSample sample;
    sample.generation = 7;
    sample.direction = direction;
    sample.verticalPrevious = verticalPrevious;
    sample.width = kW;
    sample.height = kH;
    sample.startX = startX;
    sample.startY = startY;
    sample.pointerX = pointerX;
    sample.pointerY = pointerY;
    sample.eventTimeNs = timeNs;
    return sample;
}

// One settlement trajectory frame exactly as the host advances it (§7.2):
// tau from SettleTauAt, schedule outputs into edge.x/radiusScale, zero tilt.
BookTurnPose SettlementPose(const BookTurnInput& base, float tau)
{
    float xNorm = 1.0F;
    float beta = 0.0F;
    float scale = 1.0F;
    BookTurnSolver::Schedule(tau, xNorm, beta, scale);
    (void)beta;
    BookTurnInput input = base;
    input.edge.x = kW * xNorm;
    input.overrideTheta = true;
    input.settledTheta = 0.0F;
    input.radiusScale = scale;
    return BookTurnSolver::Solve(input);
}

void TestFollowXGating()
{
    // NEXT rest: no progress -> follow sits on the source edge.
    const BookTurnSample rest = Sample(Direction::NEXT, kW, kW);
    CheckNear("follow/next-rest-at-source", ChaseTargetX(rest), kW, 1e-4);

    // NEXT edge-origin start with locked progress: follow == pointer 1:1.
    const BookTurnSample edgePull = Sample(Direction::NEXT, kW, kW - 100.0F);
    CheckNear("follow/next-edge-origin-1to1", ChaseTargetX(edgePull), kW - 100.0F, 1e-4);

    // NEXT edge-origin start below the horizontal threshold: gate still closed.
    const BookTurnSample edgeMicro = Sample(Direction::NEXT, kW, kW - 4.0F);
    CheckTrue(ChaseTargetX(edgeMicro) < kW - 1.0F, "follow/next-micro-gate-partial",
        "gate must open smoothly below 8vp, not jump to source");
    CheckTrue(ChaseTargetX(edgeMicro) > kW - 4.0F - 0.5F, "follow/next-micro-gate-bounded",
        "partial gate must keep the follow near the pointer side");

    // NEXT interior start: same gated formula from the source edge.
    const BookTurnSample interior = Sample(Direction::NEXT, kW - 200.0F, kW - 260.0F);
    CheckNear("follow/next-interior-1to1", ChaseTargetX(interior), kW - 260.0F, 1e-4);

    // Pointer clamped to the viewport.
    const BookTurnSample overshoot = Sample(Direction::NEXT, kW, kW + 500.0F);
    CheckNear("follow/next-clamp", ChaseTargetX(overshoot), kW, 1e-4);

    // PREVIOUS mirrors from the left edge.
    const BookTurnSample prevPull = Sample(Direction::PREVIOUS, 0.0F, 100.0F);
    CheckNear("follow/previous-1to1", ChaseTargetX(prevPull), 100.0F, 1e-4);

    // verticalPrevious: follow = smoothstep gate * pointerX.
    const float halfGate = 0.5F * 0.5F * (3.0F - 2.0F * 0.5F);
    const BookTurnSample verticalHalf = Sample(Direction::PREVIOUS, 200.0F, 200.0F, kMidY - 12.0F,
        true);
    CheckNear("follow/vertical-half-gate", ChaseTargetX(verticalHalf), halfGate * 200.0F, 1e-3);
    const BookTurnSample verticalDown = Sample(Direction::PREVIOUS, 200.0F, 200.0F, kMidY + 30.0F,
        true);
    CheckNear("follow/vertical-downward-zero", ChaseTargetX(verticalDown), 0.0F, 1e-4);
    const BookTurnSample verticalFull = Sample(Direction::PREVIOUS, 200.0F, 200.0F, kMidY - 30.0F,
        true);
    CheckNear("follow/vertical-full-gate", ChaseTargetX(verticalFull), 200.0F, 1e-3);
}

void TestChaseSegments()
{
    // All chase-dynamics cases use interior starts: an edge-origin start with
    // locked progress takes the 1:1 ownership branch instead.

    // M-CATCH-FAST: gap above the NEAR band advances at 5 viewport/s.
    BookTurnChaseState state;
    const BookTurnSample fast = Sample(Direction::NEXT, kW - 200.0F, kW - 300.0F);
    ResetChase(state, fast);
    RecordChaseSample(state, fast);
    const float advanced = ChaseAdvance(state, fast, kFrame);
    CheckNear("chase/fast-step", kW - advanced, kFastStep, 1e-3);

    // M-CATCH-NEAR: inside the band the velocity blends finger velocity
    // toward fast with k = gap/near (stationary finger -> k*fast).
    const BookTurnSample near = Sample(Direction::NEXT, kW - 200.0F, kW - 235.0F);
    ResetChase(state, near);
    RecordChaseSample(state, near);
    state.edgeX = kW - 230.0F;  // gap = 5
    const float before = state.edgeX;
    const float stepped = ChaseAdvance(state, near, kFrame);
    const float k = 5.0F / kNear;
    CheckNear("chase/near-step", before - stepped, k * reader::bookturn::kCatchSpeedViewportsPerSecond *
        kW * kFrame, 1e-3);

    // M-CATCH-LOCK: gap within the lock band snaps to the follow target.
    const BookTurnSample lock = Sample(Direction::NEXT, kW - 100.0F, kW - 140.0F);
    ResetChase(state, lock);
    RecordChaseSample(state, lock);
    state.edgeX = kW - 137.0F;  // gap = 3 <= 4
    const float snapped = ChaseAdvance(state, lock, kFrame);
    CheckNear("chase/lock-snap", snapped, kW - 140.0F, 1e-4);
    CheckNear("chase/lock-state", state.edgeX, kW - 140.0F, 1e-4);

    // Overshoot: step >= gap snaps exactly, never passes the target.
    const BookTurnSample overshoot = Sample(Direction::NEXT, kW - 100.0F, kW - 115.0F);
    ResetChase(state, overshoot);
    RecordChaseSample(state, overshoot);
    state.edgeX = kW - 110.0F;  // gap = 5, same sign as the big inward step
    state.fingerVelocityX = -20000.0F;  // fast inward finger, NEAR blend saturates high
    const float overshot = ChaseAdvance(state, overshoot, kFrame);
    CheckNear("chase/overshoot-snap", overshot, kW - 115.0F, 1e-3);

    // Reversing finger: negative edge velocity must not create new lag.
    const BookTurnSample reversing = Sample(Direction::NEXT, kW - 100.0F, kW - 120.0F);
    ResetChase(state, reversing);
    RecordChaseSample(state, reversing);
    state.edgeX = kW - 110.0F;  // gap = 10
    state.fingerVelocityX = 20000.0F;  // finger moving outward (+x)
    const float beforeReverse = state.edgeX;
    const float held = ChaseAdvance(state, reversing, kFrame);
    CheckNear("chase/reversing-guard", held, beforeReverse, 1e-4);

    // dt <= 0: edge unchanged.
    const BookTurnSample frozen = Sample(Direction::NEXT, kW - 100.0F, kW - 150.0F);
    ResetChase(state, frozen);
    RecordChaseSample(state, frozen);
    state.edgeX = kW - 11.0F;
    CheckNear("chase/dt-zero", ChaseAdvance(state, frozen, 0.0F), kW - 11.0F, 1e-6);
    CheckNear("chase/dt-negative", ChaseAdvance(state, frozen, -kFrame), kW - 11.0F, 1e-6);

    // PREVIOUS fast segment mirrors the direction sign.
    const BookTurnSample prevFast = Sample(Direction::PREVIOUS, 100.0F, 200.0F);
    ResetChase(state, prevFast);
    RecordChaseSample(state, prevFast);
    const float prevAdvanced = ChaseAdvance(state, prevFast, kFrame);
    CheckNear("chase/previous-fast-step", prevAdvanced, kFastStep, 1e-3);
}

void TestChaseGap()
{
    const BookTurnSample next = Sample(Direction::NEXT, kW, kW - 100.0F);
    BookTurnChaseState state;
    ResetChase(state, next);
    CheckNear("gap/next-rest", ChaseGap(state, next), 100.0F, 1e-3);
    const BookTurnSample prev = Sample(Direction::PREVIOUS, 0.0F, 100.0F);
    ResetChase(state, prev);
    CheckNear("gap/previous-rest", ChaseGap(state, prev), 100.0F, 1e-3);
}

void TestEdgeOriginOwnership()
{
    // Edge-origin gestures with locked progress track x_follow 1:1: no chase
    // dynamics, exact snap in one frame regardless of dt.
    BookTurnChaseState state;
    const BookTurnSample owned = Sample(Direction::NEXT, kW, kW - 100.0F);
    ResetChase(state, owned);
    const float tracked = ChaseAdvance(state, owned, kFrame);
    CheckNear("ownership/next-1to1", tracked, kW - 100.0F, 1e-4);

    // Interior starts run the catch dynamics: the edge leaves the source and
    // needs multiple frames to reach the follow target.
    const BookTurnSample interior = Sample(Direction::NEXT, kW - 100.0F, kW - 110.0F);
    ResetChase(state, interior);
    RecordChaseSample(state, interior);
    const float first = ChaseAdvance(state, interior, kFrame);
    CheckTrue(first > (kW - 110.0F) + 1.0F, "ownership/interior-chases",
        "interior start must not teleport to the follow target in one frame");

    // verticalPrevious ownership gates on 24vp upward travel AND an
    // edge-origin start (same horizontal band as the other directions).
    BookTurnChaseState verticalState;
    const BookTurnSample verticalOwned = Sample(Direction::PREVIOUS, 8.0F, 200.0F, kMidY - 30.0F,
        true);
    ResetChase(verticalState, verticalOwned);
    RecordChaseSample(verticalState, verticalOwned);
    CheckNear("ownership/vertical-1to1", ChaseAdvance(verticalState, verticalOwned, kFrame), 200.0F,
        1e-3);

    // Same vertical travel from a mid-screen start: chase dynamics instead.
    const BookTurnSample verticalInterior = Sample(Direction::PREVIOUS, 200.0F, 200.0F,
        kMidY - 30.0F, true);
    ResetChase(verticalState, verticalInterior);
    RecordChaseSample(verticalState, verticalInterior);
    const float verticalFirst = ChaseAdvance(verticalState, verticalInterior, kFrame);
    CheckTrue(verticalFirst > 1.0F && verticalFirst < 200.0F - kFastStep - 1.0F,
        "ownership/vertical-interior-chases",
        "mid-screen vertical start must chase from the left edge, not teleport");
}

void TestSampleVelocity()
{
    BookTurnChaseState state;
    const BookTurnSample first = Sample(Direction::NEXT, kW, kW, kMidY, false, kMidY, 0);
    ResetChase(state, first);
    RecordChaseSample(state, first);
    CheckNear("velocity/seed-zero", state.fingerVelocityX, 0.0F, 1e-6);

    const BookTurnSample second = Sample(Direction::NEXT, kW, kW - 50.0F, kMidY, false, kMidY,
        100'000'000);
    RecordChaseSample(state, second);
    CheckNear("velocity/fifty-vp-per-100ms", state.fingerVelocityX, -500.0F, 1e-3);

    // Zero-dt samples keep the previous velocity.
    const BookTurnSample third = Sample(Direction::NEXT, kW, kW - 60.0F, kMidY, false, kMidY,
        100'000'000);
    RecordChaseSample(state, third);
    CheckNear("velocity/dt-zero-holds", state.fingerVelocityX, -500.0F, 1e-3);
}

void TestSettleTargetsAndDurations()
{
    CheckNear("target/next-commit", SettleTargetTau(Direction::NEXT, true), 1.0F, 1e-6);
    CheckNear("target/next-rollback", SettleTargetTau(Direction::NEXT, false), 0.0F, 1e-6);
    CheckNear("target/previous-commit", SettleTargetTau(Direction::PREVIOUS, true), 0.0F, 1e-6);
    CheckNear("target/previous-rollback", SettleTargetTau(Direction::PREVIOUS, false), 1.0F, 1e-6);

    // NEXT commit: T-COMPLETE * remaining, floored at T-SETTLE-MIN.
    CheckNear("duration/next-commit-half", SettleDurationSeconds(0.5F, Direction::NEXT, true),
        0.300F, 1e-6);
    CheckNear("duration/next-commit-rest", SettleDurationSeconds(0.0F, Direction::NEXT, true),
        0.600F, 1e-6);
    CheckNear("duration/next-commit-floor", SettleDurationSeconds(0.9F, Direction::NEXT, true),
        0.240F, 1e-6);

    // NEXT rollback: remaining = tau0 (back to rest tau 0).
    CheckNear("duration/next-rollback-70", SettleDurationSeconds(0.7F, Direction::NEXT, false),
        0.420F, 1e-6);
    CheckNear("duration/next-rollback-floor", SettleDurationSeconds(0.3F, Direction::NEXT, false),
        0.240F, 1e-6);

    // PREVIOUS is the same geometry: commit runs tau -> 0 (remaining = tau0),
    // rollback runs tau -> 1 (remaining = 1 - tau0).
    CheckNear("duration/previous-commit-70", SettleDurationSeconds(0.7F, Direction::PREVIOUS, true),
        0.420F, 1e-6);
    CheckNear("duration/previous-commit-floor", SettleDurationSeconds(0.3F, Direction::PREVIOUS,
        true), 0.240F, 1e-6);
    CheckNear("duration/previous-rollback-half", SettleDurationSeconds(0.5F, Direction::PREVIOUS,
        false), 0.300F, 1e-6);

    // INV-3 symmetry: a NEXT rollback from tau0 and a PREVIOUS commit from the
    // mirrored rest share the same duration.
    CheckNear("duration/inv3-symmetry", SettleDurationSeconds(0.7F, Direction::NEXT, false),
        SettleDurationSeconds(0.7F, Direction::PREVIOUS, true), 1e-6);
}

void TestSettleTauAt()
{
    // Linear settle: exact endpoints and midpoint.
    CheckNear("tau/linear-start", SettleTauAt(0.2F, 1.0F, 0.0F, 0.4F, false), 0.2F, 1e-6);
    CheckNear("tau/linear-mid", SettleTauAt(0.2F, 1.0F, 0.2F, 0.4F, false), 0.6F, 1e-6);
    CheckNear("tau/linear-end", SettleTauAt(0.2F, 1.0F, 0.4F, 0.4F, false), 1.0F, 1e-6);
    CheckNear("tau/linear-past-end-clamped", SettleTauAt(0.2F, 1.0F, 10.0F, 0.4F, false), 1.0F,
        1e-6);

    // Ease-out (programmatic): starts at tau0, lands on target, monotone.
    CheckNear("tau/eased-start", SettleTauAt(0.0F, 1.0F, 0.0F, 0.6F, true), 0.0F, 1e-6);
    CheckNear("tau/eased-end", SettleTauAt(0.0F, 1.0F, 0.6F, 0.6F, true), 1.0F, 1e-6);
    CheckNear("tau/eased-mid", SettleTauAt(0.0F, 1.0F, 0.3F, 0.6F, true),
        1.0F - (1.0F - 0.5F) * (1.0F - 0.5F) * (1.0F - 0.5F), 1e-6);
    float previous = -1.0F;
    bool monotone = true;
    for (int step = 0; step <= 60; ++step) {
        const float tau = SettleTauAt(0.0F, 1.0F, 0.01F * step, 0.6F, true);
        if (tau < previous - 1e-6) monotone = false;
        previous = tau;
    }
    CheckTrue(monotone, "tau/eased-monotone", "ease-out must be non-decreasing");

    // Direction reversal exercises the same interpolation downward.
    CheckNear("tau/downward-linear", SettleTauAt(0.8F, 0.0F, 0.2F, 0.4F, false), 0.4F, 1e-6);

    // Zero duration lands on the target immediately.
    CheckNear("tau/zero-duration", SettleTauAt(0.3F, 0.0F, 0.0F, 0.0F, false), 0.0F, 1e-6);
}

void TestSwapCoverageGate()
{
    // Stage-geometry sanity for SheetCoverage itself: the canonical stage
    // endpoints have known coverage (tau 0 FLAT = full width, tau 1
    // COLLAPSE = nothing on screen).
    BookTurnInput base;
    base.generation = 7;
    base.width = kW;
    base.height = kH;
    base.start = { kW, kMidY };
    base.pointer = base.start;
    base.edge = base.start;
    base.direction = Direction::NEXT;
    CheckNear("coverage/next-rest-flat", BookTurnSolver::SheetCoverage(SettlementPose(base, 0.0F)),
        1.0F, 1e-3);
    CheckTrue(BookTurnSolver::SheetCoverage(SettlementPose(base, 1.0F)) <=
            reader::bookturn::kSwapCoverRatio,
        "coverage/next-end-collapsed", "tau 1 sheet must be within the swap cover band");
    CheckTrue(BookTurnSolver::SheetCoverage(SettlementPose(base, 0.5F)) > 0.3F,
        "coverage/mid-flip-wide", "mid-flip sheet must cover a wide x-range");
    base.direction = Direction::PREVIOUS;
    base.start = { 0.0F, kMidY };
    base.pointer = base.start;
    base.edge = base.start;
    CheckNear("coverage/previous-end-flat",
        BookTurnSolver::SheetCoverage(SettlementPose(base, 0.0F)), 1.0F, 1e-3);

    // 13.1 INV-2 tau-scan: over full commit/rollback trajectories, the swap
    // decision fires at most once, only for NEXT commits, only inside the S5
    // window, and the firing frame satisfies coverage <= 3%W.
    const float tau0s[] = { 0.0F, 0.35F, 0.62F, 0.85F, 0.93F };
    const float frame = 1.0F / 60.0F;
    for (const int directionIndex : { 0, 1 }) {
        const Direction direction = directionIndex == 0 ? Direction::NEXT : Direction::PREVIOUS;
        base.direction = direction;
        const float source = direction == Direction::NEXT ? kW : 0.0F;
        base.start = { source, kMidY };
        base.pointer = base.start;
        base.edge = base.start;
        for (const bool commit : { true, false }) {
            for (const float tau0 : tau0s) {
                const float target = SettleTargetTau(direction, commit);
                const float duration = SettleDurationSeconds(tau0, direction, commit);
                bool fired = false;
                int postFireWiden = 0;
                float fireTau = -1.0F;
                float fireCoverage = 1.0F;
                float elapsed = 0.0F;
                for (int step = 0; step <= 240; ++step) {
                    const float tau = SettleTauAt(tau0, target, elapsed, duration, false);
                    const BookTurnPose pose = SettlementPose(base, tau);
                    if (!fired && SettlementSwapShouldFire(commit, direction, tau, pose)) {
                        fired = true;
                        fireTau = tau;
                        fireCoverage = BookTurnSolver::SheetCoverage(pose);
                    } else if (fired && tau >= reader::bookturn::kStageSpineEnd &&
                        BookTurnSolver::SheetCoverage(pose) > reader::bookturn::kSwapCoverRatio) {
                        ++postFireWiden;
                    }
                    if (elapsed >= duration) break;
                    elapsed += frame;
                }
                const std::string label = (direction == Direction::NEXT ? "next" : "previous") +
                    std::string(commit ? "-commit-" : "-rollback-") + std::to_string(tau0);
                const bool expectFire = direction == Direction::NEXT && commit;
                if (expectFire) {
                    CheckTrue(fired, ("swap/" + label + "-fires").c_str(),
                        "NEXT commit must reach the swap criterion before the endpoint");
                    CheckTrue(fireTau >= reader::bookturn::kStageSpineEnd,
                        ("swap/" + label + "-in-s5").c_str(),
                        "swap must not fire before the S5 window");
                    CheckTrue(fireTau <= 1.0F + 1e-6, ("swap/" + label + "-before-endpoint").c_str(),
                        "swap must not fire past tau 1");
                    CheckTrue(fireCoverage <= reader::bookturn::kSwapCoverRatio + 1e-6,
                        ("swap/" + label + "-inv2-cover").c_str(),
                        "13.1 INV-2: swap frame coverage must stay within 3%W");
                    CheckTrue(postFireWiden == 0, ("swap/" + label + "-no-reexpand").c_str(),
                        "the collapsed strip must never re-expand inside S5");
                } else {
                    CheckTrue(!fired, ("swap/" + label + "-never").c_str(),
                        "PREVIOUS commits and every rollback keep the endpoint swap");
                }
            }
        }
    }
}

}  // namespace

int main()
{
    TestFollowXGating();
    TestChaseSegments();
    TestChaseGap();
    TestEdgeOriginOwnership();
    TestSampleVelocity();
    TestSettleTargetsAndDurations();
    TestSettleTauAt();
    TestSwapCoverageGate();
    std::printf("bookturn_motion_test: %d checks, %d failures\n", g_checks, g_fails);
    return g_fails == 0 ? 0 : 1;
}
