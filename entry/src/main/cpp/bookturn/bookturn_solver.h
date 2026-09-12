#ifndef READER_BOOKTURN_SOLVER_H
#define READER_BOOKTURN_SOLVER_H

#include <cstdint>

namespace reader::bookturn {

// Gesture constants (V2 contract §4.1, inherited from V1 §4.1).
constexpr float kHorizontalStartVp = 8.0F;
constexpr float kVerticalPreviousStartVp = 24.0F;
constexpr float kThetaSoftDegrees = 48.0F;
constexpr float kThetaCapDegrees = 60.0F;

// Geometry constants (V2 contract §4.1 / §6, recalibrated 2026-08-30 against
// the Huawei recording: the roll band grows through the drag and its wrap
// radius is far larger than the original 0.057W; r varies ~1.4:1 along the
// fold, so the sheet is a true developable cone, not a cylinder).
constexpr float kRollRadiusRatio = 0.11F;
constexpr float kRollRadiusMinVp = 28.0F;
constexpr float kRollRadiusMaxVp = 64.0F;
// APEX-DIST A/B calibration pair (contract §12). r(sigma) = R * (sigma -
// sigmaApex) / (sigmaGrip - sigmaApex) with the apex on the fold axis;
// apexDist = sigmaGrip - sigmaApex as a ratio of the viewport width. A grade
// = cylinder (apexDist disabled); B grade default 8W reproduces the measured
// ~1.4:1 taper across a full-height fold. Both constants stay compiled until
// the acceptance branch freezes one.
constexpr float kConeApexDistRatioB = 8.0F;
constexpr float kConeApexDistRatioDefault = kConeApexDistRatioB;
constexpr float kSpineTaper = 0.6F;
constexpr float kDragRadiusMinRatio = 0.35F;

// Q(tau) stage schedule (V2 contract §6.2). xNorm is the fold-line position
// normalized to W measured from the binding edge (1.0 = free-edge side).
constexpr float kStageLiftEnd = 0.18F;
constexpr float kStageFlipEnd = 0.50F;
constexpr float kStageRollEnd = 0.75F;
constexpr float kStageSpineEnd = 0.90F;
constexpr float kFoldXLiftEnd = 0.80F;
constexpr float kFoldXFlipEnd = 0.50F;
constexpr float kFoldXRollEnd = 0.25F;
constexpr float kFoldXSpineEnd = 0.05F;

// §7.3 tau_swap: the moving sheet may take over the base slot once its
// on-screen coverage drops to this ratio of the viewport width (T-SWAP-COVER
// <= 3%W as a thin spine strip).
constexpr float kSwapCoverRatio = 0.03F;

enum class Direction : int32_t {
    NEXT = -1,
    PREVIOUS = 1,
};

enum class CurlStage : int32_t {
    FLAT = 0,
    LIFT = 1,
    FLIP = 2,
    ROLL = 3,
    SPINE = 4,
    COLLAPSE = 5,
};

struct Vec2 {
    float x = 0.0F;
    float y = 0.0F;
};

struct Vec3 {
    float x = 0.0F;
    float y = 0.0F;
    float z = 0.0F;
};

/** Latest immutable input produced by the ArkTS presentation motion state. */
struct BookTurnInput {
    uint64_t generation = 0;
    Direction direction = Direction::NEXT;
    bool verticalPrevious = false;
    float width = 0.0F;
    float height = 0.0F;
    Vec2 start;
    Vec2 pointer;
    /** Chase-controller output: the moving-edge target along the locked
     *  direction (V1 §5.3 x_follow). Drives tau = s^-1(x_follow/W) in raw
     *  screen coordinates for both directions: NEXT sweeps W -> 0 (the free
     *  edge is chased), PREVIOUS sweeps 0 -> W (the fold/unroll front is
     *  chased); the pose folds at W*xNorm either way. */
    Vec2 edge;
    float pointerVelocityX = 0.0F;
    int64_t eventTimeNs = 0;
    /** Settlement-only controls; live pointer inputs retain the defaults.
     *  overrideTheta also selects the schedule-driven fold line: the tilt is
     *  settledPsi and tau advances from the clamped edge position. */
    bool overrideTheta = false;
    float settledTheta = 0.0F;
    // A submitted pose is already limited; applying the nonlinear limit twice jumps.
    bool settledThetaIsPresented = false;
    float radiusScale = 1.0F;
};

/** One pose consumed unchanged by the shader and diagnostics. The pose is the
 *  real screen pose for both directions (contract §6.2: PREVIOUS is the
 *  strict time reversal along the same Q(tau) states, NO screen mirroring):
 *  the fold sweeps W -> 0 for NEXT and 0 -> W for PREVIOUS, the flat branch
 *  of p(q) is the identity map (material u lands at screen x=u, content
 *  unmirrored, no texture flip), and PREVIOUS reverses the stage sequence
 *  (gesture start = tau 1 COLLAPSE, commit = tau 0 FLAT). */
struct BookTurnPose {
    uint64_t generation = 0;
    Direction direction = Direction::NEXT;
    bool verticalPrevious = false;
    float width = 0.0F;
    float height = 0.0F;
    /** Tilt psi in radians (V1 field name kept for the renderer uniforms). */
    float theta = 0.0F;
    Vec2 tangent;
    Vec2 normal;
    /** Fold-line offset along the page normal. */
    float axis = 0.0F;
    /** Local cylinder/cone radius R in vp (schedule value). */
    float radius = 0.0F;
    /** Nominal roll radius R-ROLL for this viewport width. */
    float rollRadius = 0.0F;
    /** Material distance from the fold line to the grip point. */
    float gripDistance = 0.0F;
    /** Material wrap angle at the grip (S1/S2: solved; S3+: schedule beta). */
    float gripPhi = 0.0F;
    /** Schedule beta(tau) in radians. */
    float beta = 0.0F;
    /** Canonical progress tau in [0,1]. */
    float tau = 0.0F;
    Vec2 gripMaterial;
    Vec2 target;
    Vec3 projectedGrip;
    float targetError = 0.0F;
    /** Tangential coordinate of the grip; anchors the cone radius law. */
    float sigmaGrip = 0.0F;
    /** Developable-cone apex distance (sigmaGrip - sigmaApex) in vp; <= 0
     *  selects the A-grade cylinder (r constant = radius). */
    float apexDist = 0.0F;
    CurlStage stage = CurlStage::FLAT;
};

class BookTurnSolver final {
public:
    static BookTurnPose Solve(const BookTurnInput& input, const BookTurnPose* previous = nullptr);
    static Vec3 MapMaterial(const BookTurnPose& pose, const Vec2& material);
    static Vec3 SurfaceNormal(const BookTurnPose& pose, const Vec2& material);
    static float RollRadius(float width);
    /** §7.3 tau_swap coverage probe: screen-x extent of the drawn sheet mesh
     *  intersected with the viewport, as a ratio of the width. Sampled on the
     *  same 65x129 grid the renderer draws; the x-range is a conservative
     *  upper bound of the covered area, so the swap can only fire late. */
    static float SheetCoverage(const BookTurnPose& pose);
    /** Fast predicate for the swap gate. It first checks the exact boundary
     *  vertices of that mesh and evaluates the full grid only near the band. */
    static bool SheetCoverageExceeds(const BookTurnPose& pose, float ratio);

    /** Q(tau): canonical schedule evaluation (contract §6.2). */
    static void Schedule(float tau, float& xNorm, float& beta, float& radiusScale);
    /** s^-1: piecewise closed-form inverse of the xNorm schedule. */
    static float ScheduleInverse(float xNorm);
    /** Screen-x of a fold line at material offset `axis` for tilt `theta`. */
    static float FoldScreenX(float axis, float theta, float height);
    /** Inverse of FoldScreenX: material axis for a desired fold screen-x. */
    static float AxisFromFoldX(float foldX, float theta, float height);

private:
    static float FoldNormal(float distance, float radius);
    static float FoldDepth(float distance, float radius);
};

/** §12 A/B calibration hook: overrides kConeApexDistRatioDefault at runtime
 *  (BOOKTURN_APEX_DIST=0 selects the A-grade cylinder, <0 restores the
 *  default, >0 is the apex distance as a ratio of the viewport width). Stays
 *  compiled until the stage-4 device A/B freezes one grade. */
void SetConeApexDist(float ratio);

}  // namespace reader::bookturn

#endif  // READER_BOOKTURN_SOLVER_H
