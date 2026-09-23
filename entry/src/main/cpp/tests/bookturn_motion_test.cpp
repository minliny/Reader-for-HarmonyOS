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
using reader::bookturn::PresentChaseSample;
using reader::bookturn::RecordChaseSample;
using reader::bookturn::ResetChase;
using reader::bookturn::SettleDurationSeconds;
using reader::bookturn::SettleTauAt;
using reader::bookturn::SettleThetaAt;
using reader::bookturn::SettleTargetTau;
using reader::bookturn::SettlementSwapShouldFire;
using reader::bookturn::SettlementCurve;
using reader::bookturn::ProgrammaticProfile;
using reader::bookturn::ProgrammaticDurationSeconds;
using reader::bookturn::ProgrammaticSettlementCurve;

constexpr float kW = 390.0F;
constexpr float kH = 780.0F;
constexpr float kMidY = 0.5F * kH;
constexpr float kFrame = 1.0F / 60.0F;
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

void TestDirectDisplacement()
{
    for (const auto direction : { Direction::NEXT, Direction::PREVIOUS }) {
        const float sign = direction == Direction::NEXT ? -1.0F : 1.0F;
        const float source = direction == Direction::NEXT ? kW : 0.0F;
        for (const float origin : { 10.0F, 150.0F, 300.0F, 380.0F }) {
            BookTurnChaseState state;
            auto sample = Sample(direction, origin, origin);
            ResetChase(state, sample);
            for (const float distance : { 0.0F, 4.0F, 60.0F, 180.0F, 90.0F, 0.0F }) {
                sample.pointerX = origin + sign * distance;
                CheckNear("input/origin-independent-displacement", ChaseTargetX(sample), source + sign * distance, 1e-4);
                CheckNear("input/no-pursuit-on-first-frame", ChaseAdvance(state, sample, kFrame), source + sign * distance, 1e-4);
                CheckNear("input/stationary-no-drift", ChaseAdvance(state, sample, kFrame), state.edgeX, 1e-4);
                CheckNear("input/no-residual-gap", ChaseGap(state, sample), 0, 1e-4);
            }
        }
    }
    CheckNear("vertical/upward-displacement", ChaseTargetX(Sample(Direction::PREVIOUS, 200, 200,
        kMidY - 90, true)), 90, 1e-4);
    CheckNear("vertical/downward-rest", ChaseTargetX(Sample(Direction::PREVIOUS, 200, 200,
        kMidY + 30, true)), 0, 1e-4);
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

void TestSparseSamplePresentation()
{
    BookTurnChaseState state;
    auto sample = Sample(Direction::NEXT, 200, 120, kMidY - 20, false, kMidY, 1'000'000'000);
    ResetChase(state, sample);
    RecordChaseSample(state, sample);
    for (int frame = 0; frame < 60; ++frame) {
        const auto point = PresentChaseSample(state, sample, sample.eventTimeNs + frame * 8'000'000);
        CheckNear("present/latest-immediate-and-quiet-hold-x", point.pointerX, sample.pointerX, 1e-4);
        CheckNear("present/latest-immediate-and-quiet-hold-y", point.pointerY, sample.pointerY, 1e-4);
    }
    sample.pointerX = 180;
    RecordChaseSample(state, sample);
    CheckNear("present/reversal-without-inertia", PresentChaseSample(state, sample, sample.eventTimeNs).pointerX,
        180, 1e-4);
}

void TestSettleTargetsAndDurations()
{
    CheckNear("target/next-commit", SettleTargetTau(Direction::NEXT, true), 1.0F, 1e-6);
    CheckNear("target/next-rollback", SettleTargetTau(Direction::NEXT, false), 0.0F, 1e-6);
    CheckNear("target/previous-commit", SettleTargetTau(Direction::PREVIOUS, true), 0.0F, 1e-6);
    CheckNear("target/previous-rollback", SettleTargetTau(Direction::PREVIOUS, false), 1.0F, 1e-6);

    CheckNear("duration/half", SettleDurationSeconds(.5F, Direction::NEXT, true), .2F, 1e-6);
    CheckNear("duration/full-capped", SettleDurationSeconds(0, Direction::NEXT, true), .32F, 1e-6);
    CheckNear("duration/near-end", SettleDurationSeconds(.95F, Direction::NEXT, true), .08F, 1e-6);
    CheckNear("duration/at-end-zero", SettleDurationSeconds(1, Direction::NEXT, true), 0, 1e-6);
    CheckNear("duration/release-speed", SettleDurationSeconds(.5F, Direction::NEXT, true, 5), .1F, 1e-6);
    CheckNear("duration/opposing-speed", SettleDurationSeconds(.5F, Direction::NEXT, true, -5), .2F, 1e-6);
    CheckNear("duration/direction-symmetry", SettleDurationSeconds(.7F, Direction::NEXT, false),
        SettleDurationSeconds(.7F, Direction::PREVIOUS, true), 1e-6);
}

void TestSettleTauAt()
{
    // Linear settle: exact endpoints and midpoint.
    CheckNear("tau/linear-start", SettleTauAt(0.2F, 1.0F, 0.0F, 0.4F, SettlementCurve::LINEAR), 0.2F, 1e-6);
    CheckNear("tau/linear-mid", SettleTauAt(0.2F, 1.0F, 0.2F, 0.4F, SettlementCurve::LINEAR), 0.6F, 1e-6);
    CheckNear("tau/linear-end", SettleTauAt(0.2F, 1.0F, 0.4F, 0.4F, SettlementCurve::LINEAR), 1.0F, 1e-6);
    CheckNear("tau/linear-past-end-clamped", SettleTauAt(0.2F, 1.0F, 10.0F, 0.4F, SettlementCurve::LINEAR), 1.0F,
        1e-6);

    // Ease-out (programmatic): starts at tau0, lands on target, monotone.
    CheckNear("tau/eased-start", SettleTauAt(0.0F, 1.0F, 0.0F, 0.6F, SettlementCurve::EASE_OUT), 0.0F, 1e-6);
    CheckNear("tau/eased-end", SettleTauAt(0.0F, 1.0F, 0.6F, 0.6F, SettlementCurve::EASE_OUT), 1.0F, 1e-6);
    CheckNear("tau/eased-mid", SettleTauAt(0.0F, 1.0F, 0.3F, 0.6F, SettlementCurve::EASE_OUT),
        1.0F - (1.0F - 0.5F) * (1.0F - 0.5F) * (1.0F - 0.5F), 1e-6);
    float previous = -1.0F;
    bool monotone = true;
    for (int step = 0; step <= 60; ++step) {
        const float tau = SettleTauAt(0.0F, 1.0F, 0.01F * step, 0.6F, SettlementCurve::EASE_OUT);
        if (tau < previous - 1e-6) monotone = false;
        previous = tau;
    }
    CheckTrue(monotone, "tau/eased-monotone", "ease-out must be non-decreasing");

    // Direction reversal exercises the same interpolation downward.
    CheckNear("tau/downward-linear", SettleTauAt(0.8F, 0.0F, 0.2F, 0.4F, SettlementCurve::LINEAR), 0.4F, 1e-6);

    // Zero duration lands on the target immediately.
    CheckNear("tau/zero-duration", SettleTauAt(0.3F, 0.0F, 0.0F, 0.0F, SettlementCurve::LINEAR), 0.0F, 1e-6);
}

void TestAutomaticProfile()
{
    CheckNear("profile/manual-320", ProgrammaticDurationSeconds(ProgrammaticProfile::MANUAL), .320F, 1e-6);
    CheckNear("profile/rapid-30", ProgrammaticDurationSeconds(ProgrammaticProfile::RAPID), .030F, 1e-6);
    CheckNear("profile/automatic-500", ProgrammaticDurationSeconds(ProgrammaticProfile::AUTOMATIC), .500F, 1e-6);
    CheckTrue(ProgrammaticSettlementCurve(ProgrammaticProfile::MANUAL) == SettlementCurve::EASE_OUT,
        "profile/manual-ease-out", "manual timing must stay unchanged");
    CheckTrue(ProgrammaticSettlementCurve(ProgrammaticProfile::RAPID) == SettlementCurve::EASE_OUT,
        "profile/rapid-ease-out", "rapid timing must stay unchanged");
    CheckTrue(!reader::bookturn::IsProgrammaticProfileValid(static_cast<ProgrammaticProfile>(3)),
        "profile/unknown-rejected", "unknown profile must not silently select a timeline");
    const auto curve = ProgrammaticSettlementCurve(ProgrammaticProfile::AUTOMATIC);
    CheckTrue(curve == SettlementCurve::SMOOTHSTEP, "profile/automatic-smoothstep", "automatic profile curve");
    const float times[] = {0, .1F, .2F, .25F, .3F, .4F, .5F, 1.0F};
    const float expected[] = {0, .104F, .352F, .5F, .648F, .896F, 1, 1};
    for (size_t i = 0; i < sizeof(times) / sizeof(times[0]); ++i) {
        CheckNear("automatic/next", SettleTauAt(0, 1, times[i], .5F, curve), expected[i], 1e-6);
        CheckNear("automatic/previous", SettleTauAt(1, 0, times[i], .5F, curve), 1 - expected[i], 1e-6);
    }
    float previous = 0;
    for (int i = 0; i <= 500; ++i) {
        const float tau = SettleTauAt(0, 1, static_cast<float>(i) / 1000, .5F, curve);
        CheckTrue(tau >= previous && tau <= 1, "automatic/monotone", "no overshoot or reverse motion");
        previous = tau;
    }
}

void TestSettleThetaAt()
{
    constexpr float theta0 = 1.0F;
    constexpr float duration = 0.240F;
    CheckNear("theta/start-continuous", SettleThetaAt(theta0, 0.0F, duration), theta0, 1e-6);
    CheckNear("theta/smooth-mid", SettleThetaAt(theta0, 0.120F, duration), 0.5F, 1e-6);
    CheckNear("theta/end-zero", SettleThetaAt(theta0, duration, duration), 0.0F, 1e-6);
    CheckNear("theta/past-end-zero", SettleThetaAt(theta0, 1.0F, duration), 0.0F, 1e-6);
    CheckNear("theta/zero-duration", SettleThetaAt(theta0, 0.0F, 0.0F), 0.0F, 1e-6);

    // Regression: the former fixed 80ms window had already flattened the
    // page here. At the shortest legal settlement, most of the release angle
    // must still remain after 80ms so takeover reads as continuous.
    CheckNear("theta/old-80ms-retains-posture", SettleThetaAt(theta0, 0.080F, duration),
        20.0F / 27.0F, 1e-6);

    float previousMagnitude = std::abs(theta0);
    for (int frame = 1; frame <= 24; ++frame) {
        const float theta = SettleThetaAt(-theta0, duration * frame / 24.0F, duration);
        CheckTrue(theta <= 1e-6F, "theta/sign-preserved", "negative tilt must not flip sign");
        CheckTrue(std::abs(theta) <= previousMagnitude + 1e-6F, "theta/monotone-magnitude",
            "settlement tilt magnitude must decrease monotonically");
        previousMagnitude = std::abs(theta);
    }
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
    for (int step = 0; step <= 100; ++step) {
        const float tau = static_cast<float>(step) / 100.0F;
        const BookTurnPose pose = SettlementPose(base, tau);
        const bool exhaustive = BookTurnSolver::SheetCoverage(pose) > reader::bookturn::kSwapCoverRatio;
        CheckTrue(BookTurnSolver::SheetCoverageExceeds(pose, reader::bookturn::kSwapCoverRatio) == exhaustive,
            "coverage/fast-predicate-equivalence",
            "boundary fast-reject must remain exactly equivalent to the renderer-grid coverage gate");
    }
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
                    const float tau = SettleTauAt(tau0, target, elapsed, duration, SettlementCurve::LINEAR);
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
    TestDirectDisplacement();
    TestSampleVelocity();
    TestSparseSamplePresentation();
    TestSettleTargetsAndDurations();
    TestSettleTauAt();
    TestAutomaticProfile();
    TestSettleThetaAt();
    TestSwapCoverageGate();
    std::printf("bookturn_motion_test: %d checks, %d failures\n", g_checks, g_fails);
    return g_fails == 0 ? 0 : 1;
}
