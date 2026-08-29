#include "bookturn_solver.h"

#include <algorithm>
#include <cmath>

namespace reader::bookturn {
namespace {

constexpr float kPi = 3.14159265358979323846F;
constexpr float kHalfPi = 0.5F * kPi;
constexpr float kEpsilon = 1.0e-5F;
constexpr int kRootIterations = 32;

struct ScheduleSegment {
    float tauStart;
    float tauEnd;
    float xStart;
    float xEnd;
    float betaStart;
    float betaEnd;
    float scaleStart;
    float scaleEnd;
};

// Q(tau) stages S1-S5 (V2 contract §6.2). xNorm decreases monotonically from
// 1 (flat, fold at the free edge) to 0 (fold at the binding edge); every
// column is smoothstep-eased inside its segment so tau<->xNorm is a bijection.
constexpr ScheduleSegment kSegments[5] = {
    { 0.0F, kStageLiftEnd, 1.0F, kFoldXLiftEnd, 0.0F, kHalfPi, 1.0F, 1.0F },
    { kStageLiftEnd, kStageFlipEnd, kFoldXLiftEnd, kFoldXFlipEnd, kHalfPi, kPi, 1.0F, 1.0F },
    { kStageFlipEnd, kStageRollEnd, kFoldXFlipEnd, kFoldXRollEnd, kPi, kPi, 1.0F, 1.0F },
    { kStageRollEnd, kStageSpineEnd, kFoldXRollEnd, kFoldXSpineEnd, kPi, kPi, 1.0F, kSpineTaper },
    { kStageSpineEnd, 1.0F, kFoldXSpineEnd, 0.0F, kPi, 0.0F, kSpineTaper, 0.0F },
};

float Clamp(float value, float low, float high)
{
    return std::max(low, std::min(high, value));
}

float SmoothStep(float low, float high, float value)
{
    if (high <= low) {
        return value >= high ? 1.0F : 0.0F;
    }
    const float ratio = Clamp((value - low) / (high - low), 0.0F, 1.0F);
    return ratio * ratio * (3.0F - 2.0F * ratio);
}

float Dot(const Vec2& left, const Vec2& right)
{
    return left.x * right.x + left.y * right.y;
}

float Distance(const Vec3& left, const Vec2& right)
{
    const float dx = left.x - right.x;
    const float dy = left.y - right.y;
    return std::sqrt(dx * dx + dy * dy + left.z * left.z);
}

float DegreesToRadians(float degrees)
{
    return degrees * kPi / 180.0F;
}

float LimitTheta(float theta, float hardLimit = DegreesToRadians(kThetaCapDegrees))
{
    const float sign = theta < 0.0F ? -1.0F : 1.0F;
    const float magnitude = std::abs(theta);
    const float limit = Clamp(hardLimit, 0.0F, DegreesToRadians(kThetaCapDegrees));
    if (limit <= kEpsilon) {
        return std::copysign(0.0F, theta);
    }
    const float soft = std::min(DegreesToRadians(kThetaSoftDegrees), 0.8F * limit);
    if (magnitude <= soft) {
        return theta;
    }
    const float band = limit - soft;
    const float resisted = soft + band * (magnitude - soft) / (magnitude - soft + band);
    return sign * std::min(resisted, limit);
}

float SolveGripDistance(float delta, float radius)
{
    if (delta <= kEpsilon) {
        return 0.0F;
    }
    if (radius <= kEpsilon) {
        return 0.5F * delta;
    }
    if (delta >= kPi * radius) {
        return 0.5F * (delta + kPi * radius);
    }
    // On [0, pi], phi - sin(phi) is continuous and monotone. A fixed
    // iteration budget keeps the hot path deterministic.
    float low = 0.0F;
    float high = kPi;
    const float normalizedDelta = delta / radius;
    for (int iteration = 0; iteration < kRootIterations; ++iteration) {
        const float mid = 0.5F * (low + high);
        if (mid - std::sin(mid) < normalizedDelta) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return radius * 0.5F * (low + high);
}

float FoldNormalFor(float distance, float radius)
{
    if (distance <= 0.0F) {
        return distance;
    }
    if (radius <= kEpsilon) {
        return -distance;
    }
    if (distance < kPi * radius) {
        return radius * std::sin(distance / radius);
    }
    return -(distance - kPi * radius);
}

float FoldDepthFor(float distance, float radius)
{
    if (distance <= 0.0F || radius <= kEpsilon) {
        return 0.0F;
    }
    if (distance < kPi * radius) {
        return radius * (1.0F - std::cos(distance / radius));
    }
    return 2.0F * radius;
}

// Closed-form inverse of s(r) = 3r^2 - 2r^3 on [0,1]: substituting u = 2r - 1
// gives u^3 - 3u + (4y - 2) = 0, i.e. cos(3a) = 1 - 2y with u = 2cos(a).
// The branch a in [4pi/3, 5pi/3] is the monotone one.
float SmoothStepInverse(float y)
{
    y = Clamp(y, 0.0F, 1.0F);
    const float angle = std::acos(1.0F - 2.0F * y);
    const float u = 2.0F * std::cos((angle + 4.0F * kPi) / 3.0F);
    return 0.5F * (u + 1.0F);
}

// Cone radius r(sigma) = R * clamp(1 - coneTaper * (sigma - sigmaGrip) / W,
// 0.5, 1.5). sigmaGrip sits at the grip, so r(sigmaGrip) == R exactly and the
// grip equation can keep using R directly.
float ConeRadius(const BookTurnPose& pose, float sigma)
{
    if (pose.radius <= kEpsilon || pose.width <= kEpsilon || pose.coneTaper == 0.0F) {
        return pose.radius;
    }
    const float taper = 1.0F - pose.coneTaper * (sigma - pose.sigmaGrip) / pose.width;
    return pose.radius * Clamp(taper, 0.5F, 1.5F);
}

CurlStage StageFromTau(float tau)
{
    if (tau <= kEpsilon) {
        return CurlStage::FLAT;
    }
    if (tau <= kStageLiftEnd) {
        return CurlStage::LIFT;
    }
    if (tau <= kStageFlipEnd) {
        return CurlStage::FLIP;
    }
    if (tau <= kStageRollEnd) {
        return CurlStage::ROLL;
    }
    if (tau <= kStageSpineEnd) {
        return CurlStage::SPINE;
    }
    return CurlStage::COLLAPSE;
}

bool FiniteInput(const BookTurnInput& input)
{
    return std::isfinite(input.width) && input.width > 0.0F &&
        std::isfinite(input.height) && input.height > 0.0F &&
        std::isfinite(input.start.x) && std::isfinite(input.start.y) &&
        std::isfinite(input.pointer.x) && std::isfinite(input.pointer.y) &&
        std::isfinite(input.edge.x) && std::isfinite(input.edge.y);
}

// Fold-line placement shared by both regimes. In S0-S2 the fold follows the
// chased target through the grip equation (V1 §6.2); in S3-S5 the schedule
// owns the fold line and the fit solve is blended out smoothly so the
// takeover frame is position-continuous (contract §6.4 seam rule).
void ResolveSheet(BookTurnPose& pose, const BookTurnInput& input, float xNorm)
{
    pose.tangent = { std::sin(pose.theta), std::cos(pose.theta) };
    pose.normal = { std::cos(pose.theta), -std::sin(pose.theta) };

    const float tangentY = std::max(0.5F, pose.tangent.y);
    const float vStar = (Dot(pose.target, pose.tangent) - input.width * pose.tangent.x) / tangentY;
    pose.gripMaterial = { input.width, Clamp(vStar, 0.0F, input.height) };

    const float gripNormal = Dot(pose.gripMaterial, pose.normal);
    const float targetNormal = Dot(pose.target, pose.normal);
    const float delta = std::max(0.0F, gripNormal - targetNormal);
    const float gripDistance = SolveGripDistance(delta, pose.radius);
    const float catchAxis = gripNormal - gripDistance;

    pose.sigmaGrip = Dot(pose.gripMaterial, pose.tangent);
    if (pose.tau < kStageFlipEnd) {
        pose.axis = catchAxis;
        pose.gripDistance = gripDistance;
        pose.gripPhi = pose.radius <= kEpsilon ? kPi :
            Clamp(gripDistance / pose.radius, 0.0F, kPi);
    } else {
        const float foldX = xNorm * input.width;
        const float scheduledAxis = BookTurnSolver::AxisFromFoldX(foldX, pose.theta, input.height);
        const float blend = SmoothStep(kStageFlipEnd, 1.0F, pose.tau);
        pose.axis = blend * scheduledAxis + (1.0F - blend) * catchAxis;
        pose.gripDistance = pose.beta * pose.radius;
        pose.gripPhi = Clamp(pose.beta, 0.0F, kPi);
    }

    // Contract §6.4 legal-domain projection (binding-edge fixed is priority 1):
    // p(0,v)=(0,v,0) for all v requires axis >= max(0, -H*sin(theta)); below
    // that floor the fold line passes the binding edge in material space and
    // tears the binding off the spine. Project continuously when the grip
    // solve (or a low-blend schedule seam) asks for a fold beyond the spine;
    // the grip then lags the target (priority 4: closest reachable pose).
    const float axisFloor = std::max(0.0F, -input.height * std::sin(pose.theta));
    if (pose.axis < axisFloor) {
        pose.axis = axisFloor;
        if (pose.tau < kStageFlipEnd) {
            pose.gripDistance = std::max(0.0F, Dot(pose.gripMaterial, pose.normal) - axisFloor);
            pose.gripPhi = pose.radius <= kEpsilon ? kPi :
                Clamp(pose.gripDistance / pose.radius, 0.0F, kPi);
        }
    }

    pose.projectedGrip = BookTurnSolver::MapMaterial(pose, pose.gripMaterial);
    pose.targetError = Distance(pose.projectedGrip, pose.target);
}

}  // namespace

BookTurnPose BookTurnSolver::Solve(const BookTurnInput& input, const BookTurnPose* previous)
{
    BookTurnPose pose;
    pose.generation = input.generation;
    pose.direction = input.direction;
    pose.verticalPrevious = input.verticalPrevious;
    if (!FiniteInput(input)) {
        return pose;
    }

    // PREVIOUS runs the identical canonical geometry in mirrored screen
    // coordinates (x' = W - x): the previous sheet un-folds exactly like a
    // NEXT turn reflected about the vertical center line. The emitted pose is
    // canonical (fold sweeps W -> 0, curl right of the fold); the renderer
    // mirrors the projection and the texture u for PREVIOUS, so the real fold
    // sweeps 0 -> W and the real tilt is -theta. This also makes tau=0 flat
    // in both directions, which fixes the V1 previous-start drape defect.
    BookTurnInput canonical = input;
    canonical.direction = Direction::NEXT;
    if (input.direction == Direction::PREVIOUS) {
        canonical.start.x = input.width - input.start.x;
        canonical.pointer.x = input.width - input.pointer.x;
        canonical.edge.x = input.width - input.edge.x;
    }

    pose.width = input.width;
    pose.height = input.height;
    pose.rollRadius = RollRadius(input.width);
    pose.target = {
        Clamp(canonical.edge.x, 0.0F, input.width),
        Clamp(canonical.edge.y, 0.0F, input.height),
    };

    const float direction = canonical.direction == Direction::NEXT ? -1.0F : 1.0F;
    const float dx = canonical.pointer.x - canonical.start.x;
    const float dy = canonical.pointer.y - canonical.start.y;
    const float horizontal = std::max(0.0F, direction * dx);
    const float sourceX = canonical.width;
    const float exposed = std::abs(pose.target.x - sourceX);
    float thetaVector = 0.0F;
    float intentGate = 0.0F;
    if (input.verticalPrevious) {
        const float upward = std::max(0.0F, canonical.start.y - canonical.pointer.y);
        thetaVector = std::atan2(upward, std::max(canonical.pointer.x, 1.0F));
        intentGate = SmoothStep(0.0F, kVerticalPreviousStartVp, upward);
    } else {
        thetaVector = std::atan2(-direction * dy, std::max(horizontal, kEpsilon));
        // Ownership still locks at the 8vp gesture threshold. Inclination
        // needs a physical lever long enough to avoid amplifying sub-vp
        // pointer jitter while the sheet is only being lifted.
        intentGate = SmoothStep(0.0F, kHalfPi * pose.rollRadius, horizontal);
    }
    const float exposureGate = SmoothStep(0.0F, kHalfPi * pose.rollRadius, exposed);
    const float visibleGate = input.overrideTheta ? 1.0F : intentGate * exposureGate;
    const float thetaSource = input.overrideTheta ? input.settledTheta : thetaVector;
    pose.theta = LimitTheta(thetaSource) * visibleGate;

    // Preserve the current signed branch at the singular zero crossing. This
    // only resolves an exact floating-point tie and never filters a sample.
    if (previous != nullptr && std::abs(pose.theta) <= kEpsilon &&
        std::abs(thetaVector) <= kEpsilon && previous->generation == input.generation) {
        pose.theta = std::copysign(0.0F, previous->theta);
    }

    // tau derives from the chased free-edge target (V1 §5.3 x_follow), so
    // commit and rollback traverse Q(tau) forward and backward for free.
    const float edgeNorm = pose.target.x / input.width;
    pose.tau = ScheduleInverse(edgeNorm);

    float xNorm = 1.0F;
    float beta = 0.0F;
    float scale = 1.0F;
    Schedule(pose.tau, xNorm, beta, scale);
    pose.beta = beta;
    pose.radius = pose.rollRadius * scale;
    pose.stage = StageFromTau(pose.tau);
    pose.coneTaper = kConeTaperDefault * std::sin(pose.theta);

    ResolveSheet(pose, canonical, xNorm);
    return pose;
}

Vec3 BookTurnSolver::MapMaterial(const BookTurnPose& pose, const Vec2& material)
{
    const float sigma = Dot(material, pose.tangent);
    const float distance = Dot(material, pose.normal) - pose.axis;
    const float radius = ConeRadius(pose, sigma);
    const float foldedNormal = FoldNormal(distance, radius);
    const float depth = FoldDepth(distance, radius);
    return {
        sigma * pose.tangent.x + (pose.axis + foldedNormal) * pose.normal.x,
        sigma * pose.tangent.y + (pose.axis + foldedNormal) * pose.normal.y,
        depth,
    };
}

Vec3 BookTurnSolver::SurfaceNormal(const BookTurnPose& pose, const Vec2& material)
{
    const float sigma = Dot(material, pose.tangent);
    const float distance = Dot(material, pose.normal) - pose.axis;
    float phi = 0.0F;
    if (distance > 0.0F) {
        const float radius = ConeRadius(pose, sigma);
        phi = radius <= kEpsilon ? kPi : Clamp(distance / radius, 0.0F, kPi);
    }
    return {
        -std::sin(phi) * pose.normal.x,
        -std::sin(phi) * pose.normal.y,
        std::cos(phi),
    };
}

float BookTurnSolver::RollRadius(float width)
{
    return Clamp(kRollRadiusRatio * std::max(0.0F, width), kRollRadiusMinVp, kRollRadiusMaxVp);
}

void BookTurnSolver::Schedule(float tau, float& xNorm, float& beta, float& radiusScale)
{
    xNorm = 1.0F;
    beta = 0.0F;
    radiusScale = 1.0F;
    tau = Clamp(tau, 0.0F, 1.0F);
    for (const ScheduleSegment& segment : kSegments) {
        if (tau <= segment.tauEnd) {
            const float span = segment.tauEnd - segment.tauStart;
            const float ratio = span > kEpsilon ?
                Clamp((tau - segment.tauStart) / span, 0.0F, 1.0F) : 1.0F;
            const float eased = ratio * ratio * (3.0F - 2.0F * ratio);
            xNorm = segment.xStart + (segment.xEnd - segment.xStart) * eased;
            beta = segment.betaStart + (segment.betaEnd - segment.betaStart) * eased;
            radiusScale = segment.scaleStart + (segment.scaleEnd - segment.scaleStart) * eased;
            return;
        }
    }
    xNorm = 0.0F;
    beta = 0.0F;
    radiusScale = 0.0F;
}

float BookTurnSolver::ScheduleInverse(float xNorm)
{
    xNorm = Clamp(xNorm, 0.0F, 1.0F);
    if (xNorm >= 1.0F) {
        return 0.0F;
    }
    for (const ScheduleSegment& segment : kSegments) {
        if (xNorm >= segment.xEnd) {
            const float span = segment.xStart - segment.xEnd;
            const float ratio = span > kEpsilon ?
                Clamp((segment.xStart - xNorm) / span, 0.0F, 1.0F) : 0.0F;
            return segment.tauStart + (segment.tauEnd - segment.tauStart) * SmoothStepInverse(ratio);
        }
    }
    return 1.0F;
}

float BookTurnSolver::FoldScreenX(float axis, float theta, float height)
{
    const float cosine = std::max(0.5F, std::cos(theta));
    return (axis + std::min(0.0F, height * std::sin(theta))) / cosine;
}

float BookTurnSolver::AxisFromFoldX(float foldX, float theta, float height)
{
    const float cosine = std::max(0.5F, std::cos(theta));
    return foldX * cosine - std::min(0.0F, height * std::sin(theta));
}

float BookTurnSolver::FoldNormal(float distance, float radius)
{
    return FoldNormalFor(distance, radius);
}

float BookTurnSolver::FoldDepth(float distance, float radius)
{
    return FoldDepthFor(distance, radius);
}

}  // namespace reader::bookturn
