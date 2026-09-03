// Stage-1 verification suite for the V2 simulated page-turn solver
// (contract: docs/BOOK_PAGE_TURN_CONTRACT_V2_2026-08-29.md, section 13.2).
//
// Pure CPU test: no SDK, no emulator, no hdc. Build & run:
//   cd entry/src/main/cpp
//   clang++ -std=c++17 -Wall -Wextra -Werror -I bookturn \
//       tests/bookturn_solver_test.cpp bookturn/bookturn_solver.cpp -o /tmp/v2_solver_test
//   /tmp/v2_solver_test
//
// Conventions used throughout (from the V2 contract and solver):
//  * Settlement-style input: direction=NEXT, start=pointer={W,H/2}, edge.y=H/2,
//    overrideTheta=true. With settledTheta=0 the pose theta is exactly 0, so
//    FoldScreenX(pose.axis, 0, H) == pose.axis and pose.axis IS the screen fold-x.
//  * PREVIOUS emits the real screen pose directly (contract 6.2: strict time
//    reversal along the same Q(tau) states, NO screen mirroring): FoldScreenX
//    IS the real fold and sweeps 0->W as edge.x chases 0->W.
//
// Stage-2 semantic correction (2026-08-29): stage 1 rendered PREVIOUS as the
// screen-mirrored NEXT turn (solver mirrored inputs, renderer mirrored the
// projection + texture u). That makes the previous sheet lie flat face-up
// covering the screen at gesture start — the current page's behavior, not the
// contract's (3: previous page curls IN; 6.2: time reversal, no screen
// mirror; HW reference: mirror-symmetric fold sweep, unmirrored content).
// Fixed by driving the canonical solve with the raw inputs (tau = s^-1(e/W),
// fold = W*xNorm = edge 1:1, pure-schedule axis — the grip-equation fit is a
// NEXT free-edge device) and consuming the pose unmirrored. The flat branch
// of p(q) is the identity map, so content orientation is automatic.
//
// Resolved contract findings (2026-08-29 stage-1 gate, user ruling):
//  * T10(b): contract 6.3 text was self-contradictory — with the C1 seam and
//    the drape branch frozen verbatim (f_n=-(d-pi*r), f_z=2*r), taper r'<0
//    forces <p_sigma,p_d> = r'*(sin(phi)-phi) throughout the curl (chain rule
//    on phi = d/r(sigma); monotone from 0 at phi=0 to -pi*r' at the seam),
//    while isometry needs F'.m = pi*r' — mutually exclusive when r'!=0.
//    u-edges stretch ~0.5*sin(2*psi)*|r'|*|sin(phi)-phi|: 0.07% at phi=pi/4,
//    0.5% at phi=pi/2, ~1% breach at phi~=2.0, 2.9% saturated at the
//    seam/drape (psi>=54deg). Ruling: domain-split gate — strict on the
//    shallow curl (phi<=pi/4, conservative: measured max 0.072%), B-tolerance
//    3.5% for the band phi>pi/4 through drape (analytic bound + margin). The
//    ruling's literal boundary (curl = d<pi*r strict) was refined to
//    phi<=pi/4 on recomputation (same intent: strict where clean, tolerance
//    where the C1 cross term lives); recorded in the contract 6.3 / 13.2
//    dated addendum. Readability of the tolerance band is judged at the
//    stage-4 device A/B.
//
// Fixed during stage 1:
//  * T11(b): the fit-regime grip equation emitted axis < 0 for tilted poses,
//    lifting the binding edge (worst ~142vp), violating contract 6.4
//    priority-1. Fixed by the legal-domain projection in ResolveSheet
//    (axis floored at max(0, -H*sin(theta)), grip lags per priority-4).
//
// Documented scope interpretations (not solver findings):
//  * T09: the 0.05 rad/step gripPhi continuity bound holds only in the regular
//    region (tau <= 0.9, gripPhi >= 1.5 rad); the grip equation has a
//    cube-root onset (d_g ~ (6R^2*dDelta)^(1/3)) with unbounded
//    d(phi)/d(delta) at delta->0 (inherited from V1 by contract 6.4), and the
//    S5 collapse is schedule-driven (beta dives pi -> 0, worst ~0.157 rad per
//    0.975vp step) — the S5 step gets its own schedule-smoothness bound. The
//    onset worst step is measured and reported.
//  * T12: the solver's targetError is a 3D distance including the physical curl
//    lift z=R*(1-cos(phi_grip)) (up to 2R ~= 44.5vp at full wrap), so the literal
//    "targetError <= 1vp" is unsatisfiable for any curled pose. The contract
//    invariant tested here is the screen-plane landing of the free edge on the
//    target (guaranteed by the grip equation when the grip is mid-page, i.e. the
//    tangential vStar clamp is inactive). The z-inclusive targetError is printed.
//  * T08: the stated tolerance "0.2*100*h" contradicts its own examples
//    (2vp@h=0.01); the examples are used: tol = 200*h vp.

#include "../bookturn/bookturn_solver.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <initializer_list>
#include <vector>

namespace {

using reader::bookturn::BookTurnInput;
using reader::bookturn::BookTurnPose;
using reader::bookturn::BookTurnSolver;
using reader::bookturn::CurlStage;
using reader::bookturn::Direction;
using reader::bookturn::SetConeApexDist;
using reader::bookturn::Vec2;
using reader::bookturn::Vec3;

constexpr float kPi = 3.14159265358979323846F;
constexpr float kHalfPi = 0.5F * kPi;
constexpr float kW = 390.0F;
constexpr float kH = 780.0F;
constexpr float kMidY = 0.5F * kH;

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

void CheckLE(const char* name, double actual, double bound)
{
    ++g_checks;
    if (!(actual <= bound)) {
        char buffer[192];
        std::snprintf(buffer, sizeof(buffer), "expected <= %.10g, actual %.10g", bound, actual);
        Fail(name, buffer);
    }
}

void CheckGE(const char* name, double actual, double bound)
{
    ++g_checks;
    if (!(actual >= bound)) {
        char buffer[192];
        std::snprintf(buffer, sizeof(buffer), "expected >= %.10g, actual %.10g", bound, actual);
        Fail(name, buffer);
    }
}

float DegToRad(float degrees)
{
    return degrees * kPi / 180.0F;
}

float Dist3(const Vec3& left, const Vec3& right)
{
    const float dx = left.x - right.x;
    const float dy = left.y - right.y;
    const float dz = left.z - right.z;
    return std::sqrt(dx * dx + dy * dy + dz * dz);
}

BookTurnInput MakeInput(Direction direction, float startX, float startY,
    float pointerX, float pointerY, float edgeX, float edgeY)
{
    BookTurnInput input;
    input.generation = 1;
    input.direction = direction;
    input.width = kW;
    input.height = kH;
    input.start = { startX, startY };
    input.pointer = { pointerX, pointerY };
    input.edge = { edgeX, edgeY };
    return input;
}

// Settlement-style input (theta forced, pure Q(tau) geometry probe).
BookTurnInput Settlement(float edgeX, float settledThetaRadians)
{
    BookTurnInput input = MakeInput(Direction::NEXT, kW, kMidY, kW, kMidY, edgeX, kMidY);
    input.overrideTheta = true;
    input.settledTheta = settledThetaRadians;
    return input;
}

float EdgeForTau(float tau)
{
    float xNorm = 1.0F;
    float beta = 0.0F;
    float scale = 1.0F;
    BookTurnSolver::Schedule(tau, xNorm, beta, scale);
    return xNorm * kW;
}

// Screen fold-x of the pose (the real screen fold in both directions).
float FoldX(const BookTurnPose& pose)
{
    return BookTurnSolver::FoldScreenX(pose.axis, pose.theta, pose.height);
}

// ---------------------------------------------------------------- T01
void TestRollRadius()
{
    const int before = g_fails;
    // R-ROLL = clamp(0.11W, 28, 64) vp (contract §12 recalibration 2026-08-30).
    CheckNear("T01 radius(390)", BookTurnSolver::RollRadius(390.0F), 42.9, 1e-3);
    CheckNear("T01 radius(200)", BookTurnSolver::RollRadius(200.0F), 28.0, 1e-3);
    CheckNear("T01 radius(1000)", BookTurnSolver::RollRadius(1000.0F), 64.0, 1e-3);
    std::printf("T01 roll-radius %s (390->%.4f, 200->%.4f, 1000->%.4f)\n",
        g_fails == before ? "PASS" : "FAIL",
        BookTurnSolver::RollRadius(390.0F), BookTurnSolver::RollRadius(200.0F),
        BookTurnSolver::RollRadius(1000.0F));
}

// ---------------------------------------------------------------- T02
void TestScheduleBijection()
{
    const int before = g_fails;
    float worstRoundtrip = 0.0F;
    bool monotone = true;
    float previousTau = 2.0F;
    for (int i = 0; i <= 1000; ++i) {
        const float x = static_cast<float>(i) / 1000.0F;
        const float tau = BookTurnSolver::ScheduleInverse(x);
        float xNorm = 1.0F;
        float beta = 0.0F;
        float scale = 1.0F;
        BookTurnSolver::Schedule(tau, xNorm, beta, scale);
        worstRoundtrip = std::max(worstRoundtrip, std::abs(xNorm - x));
        // xNorm falls as tau rises, so the inverse must be decreasing in x.
        if (i > 0 && tau > previousTau + 1.0e-6F) {
            monotone = false;
        }
        previousTau = tau;
    }
    CheckLE("T02 schedule roundtrip", worstRoundtrip, 1e-4);
    CheckTrue(monotone, "T02 schedule inverse monotone (decreasing in x)",
        "tau increased while xNorm rose");

    struct ScheduleCase { float tau; float xNorm; float beta; float scale; };
    const ScheduleCase scheduleCases[] = {
        { 0.0F, 1.0F, 0.0F, 0.55F },
        { 0.18F, 0.8F, kHalfPi, 0.85F },
        { 0.5F, 0.5F, kPi, 1.0F },
        { 0.75F, 0.25F, kPi, 1.0F },
        { 0.9F, 0.05F, kPi, 0.6F },
        { 1.0F, 0.0F, 0.0F, 0.0F },
    };
    for (const ScheduleCase& expected : scheduleCases) {
        float xNorm = -1.0F;
        float beta = -1.0F;
        float scale = -1.0F;
        BookTurnSolver::Schedule(expected.tau, xNorm, beta, scale);
        CheckNear("T02 schedule boundary xNorm", xNorm, expected.xNorm, 1e-4);
        CheckNear("T02 schedule boundary beta", beta, expected.beta, 1e-4);
        CheckNear("T02 schedule boundary scale", scale, expected.scale, 1e-4);
    }

    struct InverseCase { float xNorm; float tau; };
    const InverseCase inverseCases[] = {
        { 1.0F, 0.0F }, { 0.8F, 0.18F }, { 0.5F, 0.5F },
        { 0.25F, 0.75F }, { 0.05F, 0.9F }, { 0.0F, 1.0F },
    };
    for (const InverseCase& expected : inverseCases) {
        CheckNear("T02 schedule inverse boundary",
            BookTurnSolver::ScheduleInverse(expected.xNorm), expected.tau, 1e-4);
    }
    std::printf("T02 schedule bijection+boundaries %s (worst roundtrip %.2e over 1001 samples)\n",
        g_fails == before ? "PASS" : "FAIL", worstRoundtrip);
}

// ---------------------------------------------------------------- T03
void TestInv1NoFreeze()
{
    const int before = g_fails;

    // NEXT: edge.x chases 390 -> 0; canonical fold-x strictly decreasing.
    float leastDecrease = 1e9F;
    float previousFold = FoldX(BookTurnSolver::Solve(Settlement(kW, 0.0F)));
    for (int i = 1; i <= 400; ++i) {
        const float edgeX = kW * (400.0F - static_cast<float>(i)) / 400.0F;
        const float current = FoldX(BookTurnSolver::Solve(Settlement(edgeX, 0.0F)));
        leastDecrease = std::min(leastDecrease, previousFold - current);
        previousFold = current;
    }
    const float finalFoldNext = previousFold;
    CheckTrue(leastDecrease > 1.0e-4F, "T03 next strict monotone",
        "some step decreased the fold by <= 1e-4vp");
    CheckLE("T03 next final fold", finalFoldNext, 2.0);

    // PREVIOUS: edge.x chases 0 -> 390; the pose is the real screen pose, so
    // FoldScreenX itself strictly increases from 0 (1:1 fold-to-touch).
    const float initialFoldPrev = FoldX(
        BookTurnSolver::Solve(MakeInput(Direction::PREVIOUS, 0.0F, kMidY, 0.0F, kMidY, 0.0F, kMidY)));
    float leastIncrease = 1e9F;
    float previousReal = initialFoldPrev;
    for (int i = 1; i <= 400; ++i) {
        const float edgeX = kW * static_cast<float>(i) / 400.0F;
        const BookTurnPose pose = BookTurnSolver::Solve(
            MakeInput(Direction::PREVIOUS, 0.0F, kMidY, 0.0F, kMidY, edgeX, kMidY));
        const float realFold = FoldX(pose);
        leastIncrease = std::min(leastIncrease, realFold - previousReal);
        previousReal = realFold;
    }
    CheckTrue(leastIncrease > 1.0e-4F, "T03 previous strict monotone",
        "some step raised the real fold by <= 1e-4vp");
    CheckLE("T03 previous initial fold", initialFoldPrev, 2.0);

    std::printf("T03 INV-1 no-freeze %s (next: least step %.3fvp, final fold %.3fvp; "
        "previous: least step %.3fvp, initial fold %.3fvp)\n",
        g_fails == before ? "PASS" : "FAIL",
        leastDecrease, finalFoldNext, leastIncrease, initialFoldPrev);
}

// ---------------------------------------------------------------- T04
namespace {

float MaxMappedX(const BookTurnPose& pose, float stepU, float stepV)
{
    float worst = -1e9F;
    for (int iu = 0; iu * stepU <= pose.width + 0.5F * stepU; ++iu) {
        const float u = std::min(pose.width, static_cast<float>(iu) * stepU);
        for (int iv = 0; iv * stepV <= pose.height + 0.5F * stepV; ++iv) {
            const float v = std::min(pose.height, static_cast<float>(iv) * stepV);
            worst = std::max(worst, BookTurnSolver::MapMaterial(pose, { u, v }).x);
        }
    }
    return worst;
}

}  // namespace

void TestInv2NoCommitPop()
{
    const int before = g_fails;

    // tau=1 degenerate state: sheet fully mirrored behind the spine.
    const BookTurnPose committed = BookTurnSolver::Solve(Settlement(0.0F, 0.0F));
    float maxX = -1e9F;
    float maxZ = 0.0F;
    for (int iu = 0; iu <= 65; ++iu) {
        const float u = 6.0F * static_cast<float>(iu);
        for (int iv = 0; iv <= 130; ++iv) {
            const float v = 6.0F * static_cast<float>(iv);
            const Vec3 mapped = BookTurnSolver::MapMaterial(committed, { u, v });
            maxX = std::max(maxX, mapped.x);
            maxZ = std::max(maxZ, std::abs(mapped.z));
        }
    }
    CheckLE("T04 committed max screen-x", maxX, 0.03 * kW);
    CheckLE("T04 committed max |z|", maxZ, 0.5);

    // PREVIOUS commit (edge W): the unrolled previous sheet must cover the
    // revealed page flat front-up before the slot swap (T-SWAP-COVER).
    const BookTurnPose prevCommit = BookTurnSolver::Solve(
        MakeInput(Direction::PREVIOUS, 0.0F, kMidY, kW, kMidY, kW, kMidY));
    float prevMaxX = -1e9F;
    float prevMaxZ = 0.0F;
    for (int iu = 0; iu <= 65; ++iu) {
        const float u = 6.0F * static_cast<float>(iu);
        for (int iv = 0; iv <= 130; ++iv) {
            const float v = 6.0F * static_cast<float>(iv);
            const Vec3 mapped = BookTurnSolver::MapMaterial(prevCommit, { u, v });
            prevMaxX = std::max(prevMaxX, mapped.x);
            prevMaxZ = std::max(prevMaxZ, std::abs(mapped.z));
        }
    }
    CheckGE("T04 previous commit coverage", prevMaxX, 0.97 * kW);
    CheckLE("T04 previous commit max |z|", prevMaxZ, 0.5);

    // Coverage non-increasing over the last quarter (tau in [0.75, 1], 26 samples).
    float worstIncrease = -1e9F;
    float previousCoverage = MaxMappedX(BookTurnSolver::Solve(Settlement(EdgeForTau(0.75F), 0.0F)), 3.0F, 3.0F);
    for (int i = 1; i <= 25; ++i) {
        const float tau = 0.75F + 0.25F * static_cast<float>(i) / 25.0F;
        const float coverage = MaxMappedX(BookTurnSolver::Solve(Settlement(EdgeForTau(tau), 0.0F)), 3.0F, 3.0F);
        worstIncrease = std::max(worstIncrease, coverage - previousCoverage);
        previousCoverage = coverage;
    }
    CheckLE("T04 coverage monotone last quarter", worstIncrease, 1e-3);

    std::printf("T04 INV-2 no-commit-pop %s (next tau=1: maxX %.3fvp <= %.2f, maxZ %.3f; "
        "prev commit maxX %.3fvp, maxZ %.3f; worst coverage step %+.3fvp over tau 0.75..1)\n",
        g_fails == before ? "PASS" : "FAIL",
        maxX, 0.03 * kW, maxZ, prevMaxX, prevMaxZ, worstIncrease);
}

// ---------------------------------------------------------------- T05
void TestInv3CancelReversal()
{
    const int before = g_fails;
    float worstDiff = 0.0F;
    bool allMonotone = true;
    for (float tau0 : { 0.2F, 0.4F, 0.6F, 0.8F }) {
        const float turnEdge = EdgeForTau(tau0);
        std::vector<float> edges;
        edges.reserve(101);
        for (int i = 0; i <= 100; ++i) {
            edges.push_back(kW + (turnEdge - kW) * (static_cast<float>(i) / 100.0F));
        }
        std::vector<float> forward(101);
        for (int i = 0; i <= 100; ++i) {
            forward[i] = FoldX(BookTurnSolver::Solve(Settlement(edges[i], 0.0F)));
        }
        // Reverse traversal re-visits the identical edge.x ladder, back to W.
        float previous = forward[100];
        for (int j = 1; j <= 100; ++j) {
            const float edgeX = edges[100 - j];
            const float fold = FoldX(BookTurnSolver::Solve(Settlement(edgeX, 0.0F)));
            worstDiff = std::max(worstDiff, std::abs(fold - forward[100 - j]));
            if (fold < previous - 1.0e-4F) {
                allMonotone = false;
            }
            previous = fold;
        }
    }
    CheckLE("T05 reverse matches forward", worstDiff, 1e-3);
    CheckTrue(allMonotone, "T05 reverse fold non-decreasing", "fold dipped during cancel");
    std::printf("T05 INV-3 cancel-reversal %s (worst |reverse-forward| %.2e vp over tau0 0.2/0.4/0.6/0.8)\n",
        g_fails == before ? "PASS" : "FAIL", worstDiff);
}

// ---------------------------------------------------------------- T06
void TestMirrorPointwise()
{
    const int before = g_fails;

    // Same-edge schedule identity (contract 6.2 strict time reversal): tau =
    // s^-1(edge.x/W) for BOTH directions, so at the same chased edge the
    // schedule state must coincide exactly (same Q(tau) state), and the
    // previous fold follows the chased edge 1:1 (pure-schedule axis; NEXT's
    // S1/S2 fold is the grip fit, so only schedule outputs are compared).
    float worstDiff = 0.0F;
    for (int k = 0; k <= 30; ++k) {
        const float e = 13.0F * static_cast<float>(k);
        const BookTurnPose poseP = BookTurnSolver::Solve(
            MakeInput(Direction::PREVIOUS, 0.0F, kMidY, e, kMidY, e, kMidY));
        const BookTurnPose poseN = BookTurnSolver::Solve(
            MakeInput(Direction::NEXT, kW, kMidY, e, kMidY, e, kMidY));
        worstDiff = std::max(worstDiff, std::abs(poseP.tau - poseN.tau));
        worstDiff = std::max(worstDiff, std::abs(poseP.beta - poseN.beta));
        worstDiff = std::max(worstDiff, std::abs(poseP.radius - poseN.radius));
        worstDiff = std::max(worstDiff, std::abs(poseP.rollRadius - poseN.rollRadius));
        CheckTrue(poseP.stage == poseN.stage, "T06 same-edge stage equal", "stage differs");
        CheckTrue(poseP.direction == Direction::PREVIOUS, "T06 previous direction kept",
            "poseP.direction != PREVIOUS");
        CheckTrue(poseN.direction == Direction::NEXT, "T06 next direction kept",
            "poseN.direction != NEXT");
        CheckNear("T06 previous fold 1:1", FoldX(poseP), e, 1e-3);
    }
    CheckLE("T06 same-edge schedule fields", worstDiff, 1e-3);

    // Gesture start (edge 0): tau 1, radius 0, the sheet is the flat flip
    // about the fold line at x=0 and lies entirely at [-W, 0] — invisible
    // (regression for the V1 previous-start drape defect).
    const BookTurnPose startP = BookTurnSolver::Solve(
        MakeInput(Direction::PREVIOUS, 0.0F, kMidY, 0.0F, kMidY, 0.0F, kMidY));
    CheckNear("T06 e=0 previous tau", startP.tau, 1.0, 1e-6);
    CheckTrue(startP.stage == CurlStage::COLLAPSE, "T06 e=0 previous stage COLLAPSE",
        "previous gesture must start at the reversed schedule end");
    float startMaxX = -1e9F;
    float startMaxZ = 0.0F;
    for (int iu = 0; iu <= 65; ++iu) {
        const float u = 6.0F * static_cast<float>(iu);
        for (int iv = 0; iv <= 130; ++iv) {
            const float v = 6.0F * static_cast<float>(iv);
            const Vec3 mapped = BookTurnSolver::MapMaterial(startP, { u, v });
            startMaxX = std::max(startMaxX, mapped.x);
            startMaxZ = std::max(startMaxZ, std::abs(mapped.z));
        }
    }
    CheckLE("T06 e=0 previous sheet off-screen", startMaxX, 0.03 * kW);
    CheckLE("T06 e=0 previous sheet flat", startMaxZ, 0.5);

    // Commit (edge W): tau 0, the previous sheet lies flat over [0, W]
    // front-up — swap-safe coverage of the revealed page.
    const BookTurnPose commitP = BookTurnSolver::Solve(
        MakeInput(Direction::PREVIOUS, 0.0F, kMidY, kW, kMidY, kW, kMidY));
    CheckNear("T06 e=W previous tau", commitP.tau, 0.0, 1e-6);
    CheckTrue(commitP.stage == CurlStage::FLAT, "T06 e=W previous stage FLAT",
        "previous commit must land on the flat schedule start");
    float commitMaxX = -1e9F;
    float commitMaxZ = 0.0F;
    for (int iu = 0; iu <= 65; ++iu) {
        const float u = 6.0F * static_cast<float>(iu);
        for (int iv = 0; iv <= 130; ++iv) {
            const float v = 6.0F * static_cast<float>(iv);
            const Vec3 mapped = BookTurnSolver::MapMaterial(commitP, { u, v });
            commitMaxX = std::max(commitMaxX, mapped.x);
            commitMaxZ = std::max(commitMaxZ, std::abs(mapped.z));
        }
    }
    CheckGE("T06 e=W previous coverage", commitMaxX, 0.97 * kW);
    CheckLE("T06 e=W previous sheet flat", commitMaxZ, 0.5);

    // Flat-branch identity (contract 6.3): for d<=0 p(q) is the identity map,
    // so the unmirrored previous content lands material u at screen x=u with
    // the binding edge pinned at x=0 — no texture flip needed.
    const BookTurnPose midP = BookTurnSolver::Solve(
        MakeInput(Direction::PREVIOUS, 0.0F, kMidY, 200.0F, kMidY, 200.0F, kMidY));
    bool identity = true;
    for (float u : { 0.0F, 10.0F, 60.0F, 120.0F, 180.0F, 199.0F }) {
        for (float v : { 0.0F, kMidY, kH }) {
            const Vec3 mapped = BookTurnSolver::MapMaterial(midP, { u, v });
            if (std::abs(mapped.x - u) > 1e-3 || std::abs(mapped.z) > 1e-3) {
                identity = false;
            }
        }
    }
    CheckTrue(identity, "T06 flat-branch identity map", "p(q) != q in the flat region");

    // Mirror-symmetric pointer geometry (same |dx|, same dy, both gates
    // saturated at 200vp travel): inclination flips sign with direction.
    const BookTurnPose tiltP = BookTurnSolver::Solve(
        MakeInput(Direction::PREVIOUS, 0.0F, kMidY, 200.0F, kMidY - 80.0F, 200.0F, kMidY));
    const BookTurnPose tiltN = BookTurnSolver::Solve(
        MakeInput(Direction::NEXT, kW, kMidY, 190.0F, kMidY - 80.0F, 190.0F, kMidY));
    CheckNear("T06 tilt mirror theta", tiltP.theta, -tiltN.theta, 1e-5);

    std::printf("T06 previous semantics %s (31 same-edge points worst schedule diff %.2e; "
        "start maxX %.3fvp, commit maxX %.3fvp)\n",
        g_fails == before ? "PASS" : "FAIL", worstDiff, startMaxX, commitMaxX);
}

// ---------------------------------------------------------------- T07
void TestScheduleDeviation()
{
    const int before = g_fails;
    float worstBeta = 0.0F;
    float worstRadius = 0.0F;
    float worstPhiBeta = 0.0F;
    for (int k = 0; k < 8; ++k) {
        const float tau = 0.55F + 0.05F * static_cast<float>(k);
        const BookTurnPose pose = BookTurnSolver::Solve(Settlement(EdgeForTau(tau), 0.0F));
        float xNorm = 1.0F;
        float beta = 0.0F;
        float scale = 1.0F;
        BookTurnSolver::Schedule(tau, xNorm, beta, scale);
        worstBeta = std::max(worstBeta, std::abs(pose.beta - beta));
        worstRadius = std::max(worstRadius,
            std::abs(pose.radius - pose.rollRadius * scale));
        worstPhiBeta = std::max(worstPhiBeta, std::abs(pose.gripPhi - pose.beta));
    }
    CheckLE("T07 beta schedule deviation", worstBeta, DegToRad(0.5F));
    CheckLE("T07 radius schedule deviation", worstRadius, 1.0);
    CheckLE("T07 gripPhi equals beta", worstPhiBeta, 1e-4);
    std::printf("T07 S3/S4 schedule deviation %s (worst beta %.2e rad <= %.2e, worst radius %.2e vp, "
        "worst |gripPhi-beta| %.2e)\n",
        g_fails == before ? "PASS" : "FAIL",
        worstBeta, DegToRad(0.5F), worstRadius, worstPhiBeta);
}

// ---------------------------------------------------------------- T08
void TestSeamC1()
{
    const int before = g_fails;
    float worstAxisStep = 0.0F;
    float worstPhiError = 0.0F;
    for (float h : { 0.01F, 0.005F, 0.0025F }) {
        const BookTurnPose beforeSeam = BookTurnSolver::Solve(Settlement(EdgeForTau(0.5F - h), 0.0F));
        const BookTurnPose afterSeam = BookTurnSolver::Solve(Settlement(EdgeForTau(0.5F + h), 0.0F));
        worstAxisStep = std::max(worstAxisStep, std::abs(afterSeam.axis - beforeSeam.axis));
        worstPhiError = std::max(worstPhiError, std::abs(beforeSeam.gripPhi - kPi));
        worstPhiError = std::max(worstPhiError, std::abs(afterSeam.gripPhi - kPi));
        CheckLE("T08 seam axis jump", std::abs(afterSeam.axis - beforeSeam.axis), 200.0 * h);
    }
    CheckLE("T08 seam gripPhi = pi both sides", worstPhiError, 1e-3);
    std::printf("T08 C1 seam at tau=0.5 %s (worst |dAxis| %.4f vp (bounds 2/1/0.5), worst |phi-pi| %.2e)\n",
        g_fails == before ? "PASS" : "FAIL", worstAxisStep, worstPhiError);
}

// ---------------------------------------------------------------- T09
void TestMilestone()
{
    const int before = g_fails;

    // Per-step gripPhi continuity over the full 400-step settlement sweep.
    // Regular region = grip-equation segment + frozen-beta S3/S4 (tau <= 0.9,
    // phi >= 1.5 to skip the cube-root onset). The S5 collapse (tau > 0.9) is
    // schedule-driven: beta dives pi -> 0 over ~19.5vp of edge.x, so its
    // per-step slope (~0.157 rad max) is a frozen Q(tau) property, asserted
    // separately with its own bound. See the file header scope note.
    float worstRegular = 0.0F;
    float worstOnset = 0.0F;
    float worstCollapse = 0.0F;
    float previousPhi = BookTurnSolver::Solve(Settlement(kW, 0.0F)).gripPhi;
    float previousTau = 0.0F;
    for (int i = 1; i <= 400; ++i) {
        const float edgeX = kW * (400.0F - static_cast<float>(i)) / 400.0F;
        const BookTurnPose pose = BookTurnSolver::Solve(Settlement(edgeX, 0.0F));
        const float step = std::abs(pose.gripPhi - previousPhi);
        worstOnset = std::max(worstOnset, step);
        if (pose.tau <= 0.9F && previousTau <= 0.9F) {
            if (pose.gripPhi >= 1.5F && previousPhi >= 1.5F) {
                worstRegular = std::max(worstRegular, step);
            }
        } else {
            worstCollapse = std::max(worstCollapse, step);
        }
        previousPhi = pose.gripPhi;
        previousTau = pose.tau;
    }
    // Regular region only: the grip equation's cube-root onset (delta -> 0) has
    // unbounded d(phi)/d(delta); see the file header scope note.
    CheckLE("T09 gripPhi step (regular: tau <= 0.9, phi >= 1.5)", worstRegular, 0.05);
    CheckLE("T09 gripPhi step (S5 schedule descent)", worstCollapse, 0.2);

    // Milestone phi = pi/2 crossing: delta = W - edge.x = r(tau)*(pi/2 - 1)
    // where r(tau) = R-ROLL * scale(tau) rides the S1 ramp (0.55 -> 0.85), so
    // the expected value is folded through the schedule at the crossing tau.
    const float rollRadius = BookTurnSolver::RollRadius(kW);
    float crossingDelta = -1.0F;
    float crossingPreviousPhi = BookTurnSolver::Solve(Settlement(385.0F, 0.0F)).gripPhi;
    float previousEdge = 385.0F;
    for (float edgeX = 384.95F; edgeX >= 369.9F; edgeX -= 0.05F) {
        const float phi = BookTurnSolver::Solve(Settlement(edgeX, 0.0F)).gripPhi;
        if (crossingPreviousPhi < kHalfPi && phi >= kHalfPi) {
            const float delta0 = kW - previousEdge;
            const float delta1 = kW - edgeX;
            crossingDelta = delta0 +
                (kHalfPi - crossingPreviousPhi) * (delta1 - delta0) / (phi - crossingPreviousPhi);
            break;
        }
        crossingPreviousPhi = phi;
        previousEdge = edgeX;
    }
    float crossingXNorm = 1.0F;
    float crossingBeta = 0.0F;
    float crossingScale = 1.0F;
    BookTurnSolver::Schedule(BookTurnSolver::ScheduleInverse((kW - crossingDelta) / kW),
        crossingXNorm, crossingBeta, crossingScale);
    const float expectedDelta = rollRadius * crossingScale * (kHalfPi - 1.0F);
    CheckGE("T09 crossing found", crossingDelta, 0.0);
    CheckNear("T09 crossing delta", crossingDelta, expectedDelta, 0.5);
    CheckGE("T09 crossing edge.x in fit regime", kW - crossingDelta, 320.0);
    CheckLE("T09 crossing delta within pi*R", crossingDelta, kPi * rollRadius);

    std::printf("T09 milestone phi=pi/2 + continuity %s (crossing delta %.3f vp vs %.3f expected, "
        "edge.x %.1f; regular worst %.4f rad, S5 schedule worst %.3f rad <= 0.2, "
        "onset worst %.3f rad [documented scope])\n",
        g_fails == before ? "PASS" : "FAIL",
        crossingDelta, expectedDelta, kW - crossingDelta, worstRegular, worstCollapse, worstOnset);
}

// ---------------------------------------------------------------- T10
void TestMaterialMetric()
{
    const int before = g_fails;

    // (a) A-grade cylinder (apexDist = 0 -> r' = 0): exactly isometric along
    // u-hat and v-hat on every branch (wrap = cylinder isometry, mirror =
    // pure reflection). Restores the default calibration before returning.
    SetConeApexDist(0.0F);
    float worstCylinder = 0.0F;
    for (int k = 1; k <= 9; ++k) {
        const float tau = 0.1F * static_cast<float>(k);
        const BookTurnPose pose = BookTurnSolver::Solve(Settlement(EdgeForTau(tau), 0.0F));
        CheckNear("T10a apexDist A-grade", pose.apexDist, 0.0, 0.0);
        for (float u = 0.0F; u <= kW - 1.0F; u += 8.0F) {
            for (float v = 0.0F; v <= kH - 1.0F; v += 8.0F) {
                const Vec3 base = BookTurnSolver::MapMaterial(pose, { u, v });
                const Vec3 alongU = BookTurnSolver::MapMaterial(pose, { u + 1.0F, v });
                const Vec3 alongV = BookTurnSolver::MapMaterial(pose, { u, v + 1.0F });
                worstCylinder = std::max(worstCylinder,
                    std::abs(Dist3(base, alongU) - 1.0F));
                worstCylinder = std::max(worstCylinder,
                    std::abs(Dist3(base, alongV) - 1.0F));
            }
        }
    }
    CheckLE("T10a cylinder metric", worstCylinder, 1e-3);
    SetConeApexDist(-1.0F);

    // (b) B-grade cone (default apexDist = 8W; settledTheta = 60deg ->
    // theta ~= 54deg). Isometry gates re-derived 2026-08-30 from the apex
    // law r' = R / apexDist = 42.9/3120 = 1.375e-2 (R-ROLL = 0.11W = 42.9):
    //   strict region (phi <= pi/4): the only r'-driven distortion is the
    //     sigma-coupling of f/z inside the wrap; worst measured 0.21% at
    //     phi=pi/4 tilted (cross terms cos(phi)*dd*r'*(sin-phi*cos-phi)*ds) ->
    //     gates p95 1e-3 / max 5e-3.
    //   band (phi > pi/4 through the mirror plate): the plate is the sheared
    //     reflection d -> pi*r(sigma) - d at height 2r(sigma); its metric is
    //     [[1,0],[a,-1]]^T[[1,0],[a,-1]] with a = pi*r' = 4.3e-2, singular
    //     values sqrt(1 + a^2/2 +- a*sqrt(1 + a^2/4)) -> stretch <= 2.2% at
    //     the 8W apex (old taper law measured 4.5-5.7%) -> gate 2.5e-2.
    // A-grade (r' = 0) is exactly isometric everywhere (T10a).
    std::vector<float> strictErrors;
    std::vector<float> bandErrors;
    float worstTheta = 0.0F;
    float worstApex = 0.0F;
    for (int k = 1; k <= 9; ++k) {
        const float tau = 0.1F * static_cast<float>(k);
        const BookTurnPose pose = BookTurnSolver::Solve(Settlement(EdgeForTau(tau), DegToRad(60.0F)));
        worstTheta = std::max(worstTheta, std::abs(pose.theta - DegToRad(54.0F)));
        worstApex = std::max(worstApex, std::abs(pose.apexDist - 8.0F * kW));
        for (float u = 0.0F; u <= kW - 1.0F; u += 8.0F) {
            for (float v = 0.0F; v <= kH - 1.0F; v += 8.0F) {
                const Vec3 base = BookTurnSolver::MapMaterial(pose, { u, v });
                const Vec3 alongU = BookTurnSolver::MapMaterial(pose, { u + 1.0F, v });
                const Vec3 alongV = BookTurnSolver::MapMaterial(pose, { u, v + 1.0F });
                const float error = std::max(
                    std::abs(Dist3(base, alongU) - 1.0F),
                    std::abs(Dist3(base, alongV) - 1.0F));
                // Same cone law as the solver's ConeRadius (public pose fields).
                const float sigma = u * pose.tangent.x + v * pose.tangent.y;
                const float d = u * pose.normal.x + v * pose.normal.y - pose.axis;
                const float radius = pose.radius *
                    (sigma - (pose.sigmaGrip - pose.apexDist)) / pose.apexDist;
                const float phi = d > 0.0F ?
                    std::min(d / std::max(radius, 1.0F), kPi) : 0.0F;
                if (phi <= 0.25F * kPi) {
                    strictErrors.push_back(error);
                } else {
                    bandErrors.push_back(error);
                }
            }
        }
    }
    CheckNear("T10b cone theta", worstTheta, 0.0, 1e-4);
    CheckNear("T10b apexDist identity", worstApex, 0.0, 1e-3);

    auto percentile95 = [](std::vector<float>& values) {
        std::sort(values.begin(), values.end());
        const size_t index = static_cast<size_t>(0.95 * static_cast<double>(values.size() - 1) + 0.5);
        return values[index];
    };
    const float strictP95 = percentile95(strictErrors);
    const float strictMax = strictErrors.empty() ? 0.0F : *std::max_element(strictErrors.begin(), strictErrors.end());
    const float bandP95 = percentile95(bandErrors);
    const float bandMax = bandErrors.empty() ? 0.0F : *std::max_element(bandErrors.begin(), bandErrors.end());
    CheckLE("T10b cone strict p95 (phi<=pi/4)", strictP95, 1e-3);
    CheckLE("T10b cone strict max (phi<=pi/4)", strictMax, 5e-3);
    CheckLE("T10b cone band p95 (B-tolerance)", bandP95, 2.5e-2);
    CheckLE("T10b cone band max (B-tolerance)", bandMax, 2.5e-2);

    std::printf("T10 developability %s (a: A-grade cylinder worst %.2e <= 1e-3; "
        "b: strict phi<=pi/4 p95 %.3e max %.3e vs 1e-3/5e-3; band p95 %.3e max %.3e vs 2.5e-2 "
        "[2026-08-30 apex-law recalibration, pi*r'=%.4f])\n",
        g_fails == before ? "PASS" : "FAIL", worstCylinder, strictP95, strictMax, bandP95, bandMax,
        kPi * 42.9F / (8.0F * kW));
}

// ---------------------------------------------------------------- T11
void TestBindingEdge()
{
    const int before = g_fails;

    // (a) theta = 0: binding edge is exactly (0, v, 0) over the whole sweep.
    float worstX = 0.0F;
    float worstZ = 0.0F;
    float worstY = 0.0F;
    for (int i = 0; i <= 25; ++i) {
        const float tau = static_cast<float>(i) / 25.0F;
        const BookTurnPose pose = BookTurnSolver::Solve(Settlement(EdgeForTau(tau), 0.0F));
        for (int k = 0; k <= 32; ++k) {
            const float v = static_cast<float>(k) * kH / 32.0F;
            const Vec3 mapped = BookTurnSolver::MapMaterial(pose, { 0.0F, v });
            worstX = std::max(worstX, std::abs(mapped.x));
            worstZ = std::max(worstZ, std::abs(mapped.z));
            worstY = std::max(worstY, std::abs(mapped.y - v));
        }
    }
    CheckLE("T11a binding x (theta=0)", worstX, 0.5);
    CheckLE("T11a binding z (theta=0)", worstZ, 1e-3);
    CheckLE("T11a binding y (theta=0)", worstY, 1e-3);

    // (b) theta ~= 54deg: contract 6.4 requires the identity to still hold.
    float worstError = 0.0F;
    float worstErrorTau = 0.0F;
    for (int i = 0; i <= 25; ++i) {
        const float tau = static_cast<float>(i) / 25.0F;
        const BookTurnPose pose = BookTurnSolver::Solve(Settlement(EdgeForTau(tau), DegToRad(60.0F)));
        for (int k = 0; k <= 32; ++k) {
            const float v = static_cast<float>(k) * kH / 32.0F;
            const Vec3 mapped = BookTurnSolver::MapMaterial(pose, { 0.0F, v });
            const Vec3 exact = { 0.0F, v, 0.0F };
            const float error = Dist3(mapped, exact);
            if (error > worstError) {
                worstError = error;
                worstErrorTau = pose.tau;
            }
        }
    }
    // Fixed by the contract 6.4 legal-domain projection in ResolveSheet: the
    // fit-regime grip equation used to emit axis < 0 for tilted poses,
    // lifting the binding edge up to ~142vp; axis is now floored at
    // max(0, -H*sin(theta)) and the binding identity holds exactly.
    CheckLE("T11b binding exact (theta=54deg)", worstError, 1e-3);

    std::printf("T11 binding-edge %s (a: theta=0 worst x %.2e, y %.2e, z %.2e; "
        "b: theta=54deg worst %.3f vp at tau=%.2f)\n",
        g_fails == before ? "PASS" : "FAIL", worstX, worstY, worstZ, worstError, worstErrorTau);
}

// ---------------------------------------------------------------- T12
void TestTouchError()
{
    const int before = g_fails;
    float worstPlane = 0.0F;
    float worstTargetError = 0.0F;
    for (int k = 1; k <= 9; ++k) {
        const float tau = 0.05F * static_cast<float>(k);
        const BookTurnPose pose = BookTurnSolver::Solve(Settlement(EdgeForTau(tau), 0.0F));
        const float planeError = std::sqrt(
            (pose.projectedGrip.x - pose.target.x) * (pose.projectedGrip.x - pose.target.x) +
            (pose.projectedGrip.y - pose.target.y) * (pose.projectedGrip.y - pose.target.y));
        worstPlane = std::max(worstPlane, planeError);
        worstTargetError = std::max(worstTargetError, pose.targetError);
    }
    // Screen-plane landing (see header scope note: the solver's targetError also
    // includes the physical curl lift z, up to 2R at full wrap).
    CheckLE("T12 free edge lands on target (screen plane)", worstPlane, 1.0);
    std::printf("T12 touch error (fit segment) %s (worst screen-plane err %.2e vp <= 1.0; "
        "solver targetError incl. curl z up to %.2f vp — scope note)\n",
        g_fails == before ? "PASS" : "FAIL", worstPlane, worstTargetError);
}

// ---------------------------------------------------------------- T13
void TestFreeEdgeInsidePage()
{
    const int before = g_fails;
    float worstMin = 1e9F;
    float worstMax = -1e9F;
    for (int k = 1; k <= 9; ++k) {
        const float tau = 0.05F * static_cast<float>(k);
        const BookTurnPose pose = BookTurnSolver::Solve(Settlement(EdgeForTau(tau), 0.0F));
        for (int iu = 0; iu <= 48; ++iu) {
            const float u = 8.0F * static_cast<float>(iu);
            for (int iv = 0; iv <= 97; ++iv) {
                const float v = 8.0F * static_cast<float>(iv);
                const float x = BookTurnSolver::MapMaterial(pose, { u, v }).x;
                worstMin = std::min(worstMin, x);
                worstMax = std::max(worstMax, x);
            }
            const float xFree = BookTurnSolver::MapMaterial(pose, { u, kH }).x;
            worstMin = std::min(worstMin, xFree);
            worstMax = std::max(worstMax, xFree);
        }
        for (int iv = 0; iv <= 97; ++iv) {
            const float v = 8.0F * static_cast<float>(iv);
            const float x = BookTurnSolver::MapMaterial(pose, { kW, v }).x;
            worstMin = std::min(worstMin, x);
            worstMax = std::max(worstMax, x);
        }
        worstMin = std::min(worstMin, BookTurnSolver::MapMaterial(pose, { kW, kH }).x);
        worstMax = std::max(worstMax, BookTurnSolver::MapMaterial(pose, { kW, kH }).x);
    }
    CheckGE("T13 free-edge min screen-x", worstMin, -0.26);
    CheckLE("T13 free-edge max screen-x", worstMax, kW + 0.26);
    std::printf("T13 free-edge inside page (fit segment) %s (min %.3f >= -0.26, max %.3f <= %.2f)\n",
        g_fails == before ? "PASS" : "FAIL", worstMin, worstMax, kW + 0.26);
}

// Field-wise equality: BookTurnPose carries unnamed padding bytes (after the
// bool verticalPrevious), so memcmp compares uninitialized storage. Exact ==
// per field is the correct purity check; all compared values are bit-copies.
bool PosesEqual(const BookTurnPose& left, const BookTurnPose& right)
{
    return left.generation == right.generation &&
        left.direction == right.direction &&
        left.verticalPrevious == right.verticalPrevious &&
        left.width == right.width && left.height == right.height &&
        left.theta == right.theta &&
        left.tangent.x == right.tangent.x && left.tangent.y == right.tangent.y &&
        left.normal.x == right.normal.x && left.normal.y == right.normal.y &&
        left.axis == right.axis && left.radius == right.radius &&
        left.rollRadius == right.rollRadius &&
        left.gripDistance == right.gripDistance &&
        left.gripPhi == right.gripPhi && left.beta == right.beta &&
        left.tau == right.tau &&
        left.gripMaterial.x == right.gripMaterial.x &&
        left.gripMaterial.y == right.gripMaterial.y &&
        left.target.x == right.target.x && left.target.y == right.target.y &&
        left.projectedGrip.x == right.projectedGrip.x &&
        left.projectedGrip.y == right.projectedGrip.y &&
        left.projectedGrip.z == right.projectedGrip.z &&
        left.targetError == right.targetError &&
        left.sigmaGrip == right.sigmaGrip &&
        left.apexDist == right.apexDist && left.stage == right.stage;
}

// ---------------------------------------------------------------- T14
void TestPurity()
{
    const int before = g_fails;
    const BookTurnInput input = Settlement(195.0F, 0.0F);
    const BookTurnPose first = BookTurnSolver::Solve(input);
    const BookTurnPose second = BookTurnSolver::Solve(input);
    CheckTrue(PosesEqual(first, second),
        "T14 same input bit-identical", "repeated Solve differed");

    const BookTurnPose previous = first;  // generation matches input.generation
    const BookTurnPose third = BookTurnSolver::Solve(input, &previous);
    const BookTurnPose fourth = BookTurnSolver::Solve(input, &previous);
    CheckTrue(PosesEqual(third, fourth),
        "T14 with previous bit-identical", "repeated Solve with previous differed");

    std::printf("T14 purity %s (field-exact repeats, with and without previous)\n",
        g_fails == before ? "PASS" : "FAIL");
}

// ---------------------------------------------------------------- T15
void TestStageBoundaries()
{
    const int before = g_fails;
    struct StageCase { float edgeX; CurlStage stage; const char* label; };
    const StageCase cases[] = {
        { kW, CurlStage::FLAT, "FLAT" },
        { EdgeForTau(0.09F), CurlStage::LIFT, "LIFT" },
        { EdgeForTau(0.3F), CurlStage::FLIP, "FLIP" },
        { EdgeForTau(0.6F), CurlStage::ROLL, "ROLL" },
        { EdgeForTau(0.8F), CurlStage::SPINE, "SPINE" },
        { EdgeForTau(0.95F), CurlStage::COLLAPSE, "COLLAPSE" },
    };
    for (const StageCase& expected : cases) {
        const BookTurnPose pose = BookTurnSolver::Solve(Settlement(expected.edgeX, 0.0F));
        CheckTrue(pose.stage == expected.stage, "T15 stage boundary", expected.label);
    }
    std::printf("T15 stage boundaries %s (FLAT@W, LIFT@x(0.09), FLIP@x(0.3), ROLL@x(0.6), "
        "SPINE@x(0.8), COLLAPSE@x(0.95))\n", g_fails == before ? "PASS" : "FAIL");
}

// ---------------------------------------------------------------- T16
void TestTiltRegressions()
{
    const int before = g_fails;

    // (a) Extreme vertical displacement engages the 60-degree resistance.
    const BookTurnPose steep = BookTurnSolver::Solve(
        MakeInput(Direction::NEXT, kW, 390.0F, 190.0F, 4390.0F, 190.0F, 390.0F));
    CheckGE("T16a tilt engaged", std::abs(steep.theta), DegToRad(30.0F));
    CheckLE("T16a tilt cap", std::abs(steep.theta), DegToRad(60.0001F));

    // (b) One-vp pointer jitter at fixed edge.x in the fit regime.
    float worstJitter = 0.0F;
    float previousTheta = 0.0F;
    for (int i = 0; i < 12; ++i) {
        const float dy = (i % 2 == 0) ? 1.0F : -1.0F;
        const BookTurnPose pose = BookTurnSolver::Solve(
            MakeInput(Direction::NEXT, kW, kMidY, 300.0F, kMidY + dy, 300.0F, kMidY));
        if (i > 0) {
            worstJitter = std::max(worstJitter, std::abs(pose.theta - previousTheta));
        }
        previousTheta = pose.theta;
    }
    CheckLE("T16b jitter step", worstJitter, DegToRad(2.0F));

    // (c) Tilt continuity over a 0.25vp pointer.y sweep of +/-300.
    float worstSweep = 0.0F;
    BookTurnPose previous = BookTurnSolver::Solve(
        MakeInput(Direction::NEXT, kW, kMidY, 300.0F, kMidY - 300.0F, 300.0F, kMidY));
    for (int i = 1; i <= 2400; ++i) {
        const float dy = -300.0F + 0.25F * static_cast<float>(i);
        BookTurnInput input = MakeInput(
            Direction::NEXT, kW, kMidY, 300.0F, kMidY + dy, 300.0F, kMidY);
        input.generation = static_cast<uint64_t>(i) + 1;
        const BookTurnPose current = BookTurnSolver::Solve(input, &previous);
        worstSweep = std::max(worstSweep, std::abs(current.theta - previous.theta));
        previous = current;
    }
    CheckLE("T16c tilt continuity", worstSweep, 0.02);

    // (d) Zero-sign preservation at the singular thetaVector == 0 tie.
    BookTurnInput tieInput = MakeInput(Direction::NEXT, kW, kMidY, kW, kMidY, EdgeForTau(0.3F), kMidY);
    tieInput.generation = 42;
    BookTurnPose plusPrevious;
    plusPrevious.generation = 42;
    plusPrevious.theta = 0.0F;
    BookTurnPose minusPrevious;
    minusPrevious.generation = 42;
    minusPrevious.theta = -0.0F;
    const BookTurnPose plusOut = BookTurnSolver::Solve(tieInput, &plusPrevious);
    const BookTurnPose minusOut = BookTurnSolver::Solve(tieInput, &minusPrevious);
    CheckTrue(!std::signbit(plusOut.theta), "T16d zero-sign plus",
        "previous +0.0f did not preserve the +0 signbit");
    CheckTrue(std::signbit(minusOut.theta), "T16d zero-sign minus",
        "previous -0.0f did not preserve the -0 signbit");
    CheckTrue(PosesEqual(plusOut, minusOut) &&
        std::signbit(plusOut.theta) != std::signbit(minusOut.theta),
        "T16d signbits actually differ", "outputs identical incl. sign or fields diverge");

    std::printf("T16 tilt regressions %s (cap %.3f deg <= 60.0001, jitter %.3f deg <= 2, "
        "sweep worst %.5f rad <= 0.02, zero-signbit +0/-0 honored)\n",
        g_fails == before ? "PASS" : "FAIL",
        std::abs(steep.theta) * 180.0F / kPi, worstJitter * 180.0F / kPi, worstSweep);
}

// ---------------------------------------------------------------- T17
void TestVerticalPreviousSmoke()
{
    const int before = g_fails;
    for (float edgeX : { kW, 200.0F, 0.0F }) {
        BookTurnInput input = MakeInput(
            Direction::PREVIOUS, 200.0F, 700.0F, 200.0F, 400.0F, edgeX, 400.0F);
        input.verticalPrevious = true;
        const BookTurnPose pose = BookTurnSolver::Solve(input);
        CheckTrue(std::isfinite(pose.theta) && std::isfinite(pose.axis) &&
            std::isfinite(pose.tau) && std::isfinite(pose.radius),
            "T17 finite pose", "non-finite field in verticalPrevious solve");
        CheckLE("T17 verticalPrevious tilt cap", std::abs(pose.theta), DegToRad(60.0001F));
    }
    std::printf("T17 verticalPrevious smoke %s (edge.x W/200/0 all finite, tilt within cap)\n",
        g_fails == before ? "PASS" : "FAIL");
}

// ---------------------------------------------------------------- T18
// Strict three-branch regression gates (2026-08-30 rework): the old
// ext-wrap/S-arc/pile post-wrap construction produced (1) a wavy back face
// (curvature sign flips along d) and (2) a |vPhi| discontinuity at the arc1
// boundary that the fragment shading turned into a dark band. These gates pin
// the replacement geometry.
void TestStrictThreeBranchGeometry()
{
    const int before = g_fails;

    // (a) Anti-M: along a fixed-sigma ray (tangent . normal = 0, so the cone
    // radius is constant on the ray) f_n is concave on the wrap
    // (f'' = -sin(phi)/r <= 0) and linear on the mirror plate; the second
    // difference must never turn positive. A positive run = M silhouette.
    float worstSecondDiff = -1e9F;
    for (int k = 1; k <= 9; ++k) {
        const float tau = 0.1F * static_cast<float>(k);
        const BookTurnPose pose =
            BookTurnSolver::Solve(Settlement(EdgeForTau(tau), DegToRad(30.0F)));
        const float step = 1.0F;
        constexpr int kSamples = 340;
        auto foldNormalAt = [&](float d) {
            const Vec2 material = { 90.0F + d * pose.normal.x, 420.0F + d * pose.normal.y };
            if (material.x < 0.0F || material.x > kW || material.y < 0.0F ||
                material.y > kH) {
                return std::nanf("");  // skip via std::isnan below
            }
            const Vec3 mapped = BookTurnSolver::MapMaterial(pose, material);
            return mapped.x * pose.normal.x + mapped.y * pose.normal.y - pose.axis;
        };
        for (int i = 1; i < kSamples - 1; ++i) {
            const float d = -60.0F + static_cast<float>(i) * step;
            const float left = foldNormalAt(d - step);
            const float mid = foldNormalAt(d);
            const float right = foldNormalAt(d + step);
            if (std::isnan(left) || std::isnan(mid) || std::isnan(right)) {
                continue;
            }
            worstSecondDiff = std::max(worstSecondDiff, left - 2.0F * mid + right);
        }
    }
    CheckLE("T18 anti-M second difference", worstSecondDiff, 1e-4);

    // (b) phi seam C1: f_n and z sampled across d = pi*r must both be 1-
    // Lipschitz in d (|f'| = |cos phi| <= 1 on the wrap, = -1 on the plate;
    // |z'| = sin phi <= 1 then 0). Any arc-boundary jump shows up as a step
    // exceeding the material step size.
    float worstFStep = 0.0F;
    float worstZStep = 0.0F;
    for (int k = 1; k <= 9; ++k) {
        const float tau = 0.1F * static_cast<float>(k);
        const BookTurnPose pose =
            BookTurnSolver::Solve(Settlement(EdgeForTau(tau), DegToRad(30.0F)));
        const float step = 0.5F;
        constexpr int kSamples = 680;
        auto surfaceAt = [&](float d) {
            const Vec2 material = { 90.0F + d * pose.normal.x, 420.0F + d * pose.normal.y };
            if (material.x < 0.0F || material.x > kW || material.y < 0.0F ||
                material.y > kH) {
                return Vec3 { 0.0F, 0.0F, std::nanf("") };
            }
            return BookTurnSolver::MapMaterial(pose, material);
        };
        Vec3 previous = surfaceAt(-60.0F);
        for (int i = 1; i < kSamples; ++i) {
            const float d = -60.0F + static_cast<float>(i) * step;
            const Vec3 current = surfaceAt(d);
            if (std::isnan(current.z) || std::isnan(previous.z)) {
                previous = current;
                continue;
            }
            worstFStep = std::max(worstFStep, std::abs(
                (current.x - previous.x) * pose.normal.x +
                (current.y - previous.y) * pose.normal.y));
            worstZStep = std::max(worstZStep, std::abs(current.z - previous.z));
            previous = current;
        }
    }
    CheckLE("T18 seam f Lipschitz", worstFStep, 0.501F);
    CheckLE("T18 seam z Lipschitz", worstZStep, 0.501F);

    std::printf("T18 strict three-branch %s (anti-M second diff %.3e <= 1e-4; "
        "seam steps f %.4f z %.4f <= 0.501 at step 0.5)\n",
        g_fails == before ? "PASS" : "FAIL", worstSecondDiff, worstFStep, worstZStep);
}

}  // namespace

int main()
{
    TestRollRadius();          // T01
    TestScheduleBijection();   // T02
    TestInv1NoFreeze();        // T03
    TestInv2NoCommitPop();     // T04
    TestInv3CancelReversal();  // T05
    TestMirrorPointwise();     // T06
    TestScheduleDeviation();   // T07
    TestSeamC1();              // T08
    TestMilestone();           // T09
    TestMaterialMetric();      // T10
    TestBindingEdge();         // T11
    TestTouchError();          // T12
    TestFreeEdgeInsidePage();  // T13
    TestPurity();              // T14
    TestStageBoundaries();     // T15
    TestTiltRegressions();     // T16
    TestVerticalPreviousSmoke();  // T17
    TestStrictThreeBranchGeometry();  // T18

    std::printf("%d checks, %d failures\n", g_checks, g_fails);
    return g_fails == 0 ? 0 : 1;
}
