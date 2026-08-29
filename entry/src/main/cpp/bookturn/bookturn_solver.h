#ifndef READER_BOOKTURN_SOLVER_H
#define READER_BOOKTURN_SOLVER_H

#include <cstdint>

namespace reader::bookturn {

// Gesture constants (V2 contract §4.1, inherited from V1 §4.1).
constexpr float kHorizontalStartVp = 8.0F;
constexpr float kVerticalPreviousStartVp = 24.0F;
constexpr float kThetaSoftDegrees = 48.0F;
constexpr float kThetaCapDegrees = 60.0F;

// Geometry constants (V2 contract §4.1 / §6).
constexpr float kRollRadiusRatio = 0.057F;
constexpr float kRollRadiusMinVp = 18.0F;
constexpr float kRollRadiusMaxVp = 32.0F;
// CONE-TAPER-M: A/B calibration pair (contract §12). Both constants stay
// compiled until the acceptance branch freezes one; the solver consumes the
// B (full-cone) value by default because the contract geometry is the cone.
constexpr float kConeTaperA = 0.0F;
constexpr float kConeTaperB = 0.4F;
constexpr float kConeTaperDefault = kConeTaperB;
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
    /** Chase-controller output: the fold/free-edge target along the locked
     *  direction (V1 §5.3 x_follow). Drives tau = s^-1(x_follow/W). For
     *  PREVIOUS the solver mirrors x internally, so the raw host value stays
     *  in real screen coordinates (0 at gesture start, W at commit). */
    Vec2 edge;
    float pointerVelocityX = 0.0F;
    int64_t eventTimeNs = 0;
    /** Settlement-only controls; live pointer inputs retain the defaults.
     *  overrideTheta also selects the schedule-driven fold line: the tilt is
     *  settledPsi and tau advances from the clamped edge position. */
    bool overrideTheta = false;
    float settledTheta = 0.0F;
    float radiusScale = 1.0F;
};

/** One canonical pose consumed unchanged by the shader and diagnostics.
 *  All geometric fields live in the canonical frame (NEXT-like): the fold
 *  sweeps W -> 0 and the curl lies right of the fold. For Direction::PREVIOUS
 *  the real screen pose is the mirror x -> W - x (the renderer flips the
 *  projection and the texture u), so the real fold is at
 *  W - FoldScreenX(axis, theta, height) and sweeps 0 -> W. */
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
    /** Tangential coordinate of the grip; anchors the cone taper. */
    float sigmaGrip = 0.0F;
    /** Signed cone taper M*sin(psi) consumed by the vertex mapping. */
    float coneTaper = 0.0F;
    CurlStage stage = CurlStage::FLAT;
};

class BookTurnSolver final {
public:
    static BookTurnPose Solve(const BookTurnInput& input, const BookTurnPose* previous = nullptr);
    static Vec3 MapMaterial(const BookTurnPose& pose, const Vec2& material);
    static Vec3 SurfaceNormal(const BookTurnPose& pose, const Vec2& material);
    static float RollRadius(float width);

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

}  // namespace reader::bookturn

#endif  // READER_BOOKTURN_SOLVER_H
