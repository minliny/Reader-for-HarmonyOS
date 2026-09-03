#include "bookturn_solver.h"

#include <algorithm>
#include <cmath>

namespace reader::bookturn {
namespace {

// §12 A/B fixture override; negative = kConeTaperDefault (host never sets it).
float g_coneTaperCalibration = -1.0F;

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

// Inverse of g(r) = r - N(r) for the grip landing equation, with N the
// amended post-wrap drape projection (see MapMaterial): roll-extension arc
// (x + sin x), S-arc (angle - tilt - sin angle), and on-pile piece are each
// monotone in r; the first two need bisection, the pile piece is linear.
// At tilt = pi the whole drape degenerates to the legacy mirrored hang.
float SolveGripDistance(float delta, float radius, float tilt)
{
    if (delta <= kEpsilon) {
        return 0.0F;
    }
    if (radius <= kEpsilon) {
        return 0.5F * delta;
    }
    if (delta < kPi * radius) {
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
    const float sinTilt = std::sin(tilt);
    const float cosTilt = std::cos(tilt);
    if (sinTilt > kEpsilon) {
        const float arc1 = radius * (kPi - tilt);
        // tan^2(tilt/2) via (1-cos)/sin: stays finite as tilt -> pi, where
        // the S-arc radius diverges and the drape converges to the hang.
        const float tanHalf = (1.0F - cosTilt) / sinTilt;
        const float rho = radius * tanHalf * tanHalf;
        const float landS = arc1 + rho * (kPi - tilt);
        const float landN = -(radius + rho) * sinTilt;
        const float extWrapEnd = kPi * radius + radius * (kPi - tilt + sinTilt);
        if (delta <= extWrapEnd) {
            // Roll extension: x + sin(x) = (delta - pi*R)/R on [0, pi-tilt],
            // monotone (derivative 1 + cos(x) >= 1 - cos(tilt) > 0).
            float low = 0.0F;
            float high = kPi - tilt;
            const float normalizedDelta = (delta - kPi * radius) / radius;
            for (int iteration = 0; iteration < kRootIterations; ++iteration) {
                const float mid = 0.5F * (low + high);
                if (mid + std::sin(mid) < normalizedDelta) {
                    low = mid;
                } else {
                    high = mid;
                }
            }
            return kPi * radius + radius * 0.5F * (low + high);
        }
        if (delta <= extWrapEnd + rho * (kPi - tilt + sinTilt)) {
            // S-arc inverse in arc-material m: G(m) = m - 2*rho*cos(tilt +
            // m/(2 rho))*sin(m/(2 rho)), monotone (G' = 1 - cos(tilt +
            // m/rho) >= 1 - cos(tilt) > 0). The product form stays exact
            // as rho diverges (tilt -> pi hang limit), where a bisection
            // over the turn angle would lose all resolution.
            float low = 0.0F;
            float high = rho * (kPi - tilt);
            const float normalizedDelta = delta - extWrapEnd;
            for (int iteration = 0; iteration < kRootIterations; ++iteration) {
                const float mid = 0.5F * (low + high);
                const float half = mid / (2.0F * rho);
                const float g = mid - 2.0F * rho * std::cos(tilt + half) * std::sin(half);
                if (g < normalizedDelta) {
                    low = mid;
                } else {
                    high = mid;
                }
            }
            return kPi * radius + arc1 + 0.5F * (low + high);
        }
        // On-pile piece: g = 2r - (pi*R + landS + landN), linear in r.
        return 0.5F * (delta + kPi * radius + landS + landN);
    }
    // Pure hang (tilt = 0 or pi): N(r) = cos(tilt)*(r - pi*R). The tilt = 0
    // limit is degenerate (g constant); fall back to the legacy form to keep
    // the solve deterministic.
    const float slope = 1.0F - cosTilt;
    if (slope <= kEpsilon) {
        return 0.5F * (delta + kPi * radius);
    }
    return (delta - cosTilt * kPi * radius) / slope;
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

// Fold-line placement shared by both regimes. NEXT: in S0-S2 the fold follows
// the chased target through the grip equation (V1 §6.2), in S3-S5 the
// schedule owns the fold line and the fit solve is blended out smoothly so
// the takeover frame is position-continuous (contract §6.4 seam rule).
// PREVIOUS: the chased target IS the fold (the unroll front follows the
// finger 1:1), so the schedule owns the axis across the whole gesture and the
// grip-equation fit — a NEXT free-edge device — must never lag the fold.
void ResolveSheet(BookTurnPose& pose, const BookTurnInput& input, float xNorm)
{
    pose.tangent = { std::sin(pose.theta), std::cos(pose.theta) };
    pose.normal = { std::cos(pose.theta), -std::sin(pose.theta) };

    const float tangentY = std::max(0.5F, pose.tangent.y);
    const float vStar = (Dot(pose.target, pose.tangent) - input.width * pose.tangent.x) / tangentY;
    pose.gripMaterial = { input.width, Clamp(vStar, 0.0F, input.height) };

    pose.sigmaGrip = Dot(pose.gripMaterial, pose.tangent);
    if (pose.direction == Direction::PREVIOUS) {
        const float foldX = xNorm * input.width;
        pose.axis = BookTurnSolver::AxisFromFoldX(foldX, pose.theta, input.height);
        pose.gripDistance = pose.beta * pose.radius;
        pose.gripPhi = Clamp(pose.beta, 0.0F, kPi);
    } else {
        const float gripNormal = Dot(pose.gripMaterial, pose.normal);
        const float targetNormal = Dot(pose.target, pose.normal);
        const float delta = std::max(0.0F, gripNormal - targetNormal);
        const float gripDistance =
            SolveGripDistance(delta, pose.radius, BookTurnSolver::PostWrapTilt(pose));
        const float catchAxis = gripNormal - gripDistance;

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
        if (pose.direction == Direction::NEXT && pose.tau < kStageFlipEnd) {
            pose.gripDistance = std::max(0.0F, Dot(pose.gripMaterial, pose.normal) - axisFloor);
            pose.gripPhi = pose.radius <= kEpsilon ? kPi :
                Clamp(pose.gripDistance / pose.radius, 0.0F, kPi);
        }
    }

    pose.projectedGrip = BookTurnSolver::MapMaterial(pose, pose.gripMaterial);
    if (pose.direction == Direction::PREVIOUS) {
        // The target is the fold itself; report the perpendicular distance of
        // the target from the fold line as the follow-error diagnostic.
        pose.targetError = std::abs(Dot(pose.target, pose.normal) - pose.axis);
    } else {
        pose.targetError = Distance(pose.projectedGrip, pose.target);
    }
}

}  // namespace

void SetConeTaperCalibration(float m)
{
    g_coneTaperCalibration = m;
}

BookTurnPose BookTurnSolver::Solve(const BookTurnInput& input, const BookTurnPose* previous)
{
    BookTurnPose pose;
    pose.generation = input.generation;
    pose.direction = input.direction;
    pose.verticalPrevious = input.verticalPrevious;
    if (!FiniteInput(input)) {
        return pose;
    }

    // PREVIOUS is the strict time reversal of the same canonical trajectory
    // (contract §6.2: same Q(tau) states played backward, front/back and
    // occlusion order swapped, NO screen mirroring). The raw real-screen
    // inputs therefore drive the canonical solve directly: tau =
    // s^-1(edge.x/W) runs 1 -> 0 over the gesture, the schedule fold sweeps
    // 0 -> W, and the emitted pose IS the real screen pose (the flat branch
    // of p(q) is the identity map, so material u lands at screen x=u and the
    // page content stays unmirrored with no texture flip). At gesture start
    // (edge 0, tau 1, radius 0) the sheet is the flat flip about the fold
    // line and lies at [-W, 0] — invisible, which is the V2 fix for the V1
    // previous-start drape defect.
    const BookTurnInput& canonical = input;

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
    // The exposure lever measures how far the moving edge has travelled from
    // its rest position: NEXT rests at the free edge (W), PREVIOUS at the
    // spine (0).
    const float sourceX = canonical.direction == Direction::NEXT ? canonical.width : 0.0F;
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
    pose.coneTaper = (g_coneTaperCalibration >= 0.0F ? g_coneTaperCalibration : kConeTaperDefault) *
        std::sin(pose.theta);

    ResolveSheet(pose, canonical, xNorm);
    return pose;
}

Vec3 BookTurnSolver::MapMaterial(const BookTurnPose& pose, const Vec2& material)
{
    const float sigma = Dot(material, pose.tangent);
    const float distance = Dot(material, pose.normal) - pose.axis;
    const float radius = ConeRadius(pose, sigma);
    float foldedNormal = FoldNormal(distance, radius);
    float depth = FoldDepth(distance, radius);
    // §6.3 projection amendment (2026-08-30): past the roll the free part
    // drapes like paper instead of the legacy rigid slab at height 2R. With
    // effective tilt tilt = PostWrapTilt(pose) it (1) continues around the
    // roll to phi = 2pi - tilt (tangent-continuous exit), (2) bends back on
    // an S-arc of radius r*tan^2(tilt/2) that lands exactly on the revealed
    // page, (3) lies flat with a 1:1 footprint. Every piece is unit-speed
    // and tangent-continuous, which keeps the per-column mapping isometric
    // (T10) and kills the roll-exit crease. At tilt = pi this degenerates to
    // the legacy mirrored hang exactly (S3+ unchanged). MapMaterial stays
    // the exact CPU twin of the sheet vertex shader (SheetCoverage / tau_swap
    // rely on it).
    if (distance > kPi * radius && radius > kEpsilon) {
        const float tilt = PostWrapTilt(pose);
        const float sinTilt = std::sin(tilt);
        const float cosTilt = std::cos(tilt);
        const float beyond = distance - kPi * radius;
        if (sinTilt <= kEpsilon) {
            foldedNormal = cosTilt * beyond;
            depth = 2.0F * radius;
        } else {
            const float arc1 = radius * (kPi - tilt);
            // tan^2(tilt/2) via (1-cos)/sin: finite as tilt -> pi, where the
            // S-arc radius diverges and the drape converges to the hang.
            const float tanHalf = (1.0F - cosTilt) / sinTilt;
            const float rho = radius * tanHalf * tanHalf;
            const float arc2 = rho * (kPi - tilt);
            if (beyond < arc1) {
                const float phi = kPi + beyond / radius;
                foldedNormal = radius * std::sin(phi);
                depth = radius * (1.0F - std::cos(phi));
            } else if (beyond < arc1 + arc2) {
                // Product forms of sin(beta + s2/rho) - sin(beta) and
                // rho*(1 + cos(beta + s2/rho)); exact as rho diverges, where
                // the difference forms lose all precision in float.
                const float s2 = beyond - arc1;
                const float half = s2 / (2.0F * rho);
                foldedNormal = -radius * sinTilt
                    + 2.0F * rho * std::cos(tilt + half) * std::sin(half);
                const float apex = tilt * 0.5F + half;
                depth = 2.0F * rho * std::cos(apex) * std::cos(apex);
            } else {
                foldedNormal = -(radius + rho) * sinTilt - (beyond - arc1 - arc2);
                depth = 0.0F;
            }
        }
    }
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

float BookTurnSolver::SheetCoverage(const BookTurnPose& pose)
{
    const float width = std::max(1.0F, pose.width);
    const float height = std::max(1.0F, pose.height);
    constexpr int kColumns = 64;
    constexpr int kRows = 128;
    float minX = 0.0F;
    float maxX = 0.0F;
    bool sampled = false;
    for (int row = 0; row <= kRows; ++row) {
        const float v = static_cast<float>(row) / static_cast<float>(kRows);
        for (int column = 0; column <= kColumns; ++column) {
            const float u = static_cast<float>(column) / static_cast<float>(kColumns);
            const Vec3 projected = MapMaterial(pose, {u * width, v * height});
            if (!sampled) {
                minX = projected.x;
                maxX = projected.x;
                sampled = true;
            } else {
                minX = std::min(minX, projected.x);
                maxX = std::max(maxX, projected.x);
            }
        }
    }
    if (!sampled) return 0.0F;
    const float low = Clamp(minX, 0.0F, width);
    const float high = Clamp(maxX, 0.0F, width);
    return Clamp((high - low) / width, 0.0F, 1.0F);
}

float BookTurnSolver::PostWrapTilt(const BookTurnPose& pose)
{
    // SPINE onward the tilt is pinned at pi: the S5 beta unwind is roll
    // bookkeeping (the collapsing radius absorbs the sheet), not a physical
    // re-tilt. The pin keeps collapse coverage monotone (T04) and the
    // PREVIOUS start sheet mirrored off-screen; one definition feeds
    // MapMaterial, the grip fit, and the renderer's uBeta upload.
    return pose.stage >= CurlStage::SPINE ? kPi : Clamp(pose.beta, 0.0F, kPi);
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
