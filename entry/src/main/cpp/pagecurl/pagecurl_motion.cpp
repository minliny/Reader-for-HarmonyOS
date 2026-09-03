#include "pagecurl_motion.h"

#include <algorithm>
#include <cmath>

namespace reader::pagecurl {
namespace {
constexpr float kPi = 3.14159265358979323846F;
constexpr float kEpsilon = 0.00001F;
constexpr float kMaximumFingerDragProgress = 0.75F;

float Clamp01(float value)
{
    return std::clamp(value, 0.0F, 1.0F);
}

float Length(Vec2 value)
{
    return std::sqrt(value.x * value.x + value.y * value.y);
}

Vec2 Normalize(Vec2 value)
{
    const float length = Length(value);
    if (length <= kEpsilon) return {1.0F, 0.0F};
    return {value.x / length, value.y / length};
}

Vec2 Hermite(Vec2 from, Vec2 initial_velocity, Vec2 to, float duration, float amount)
{
    const float t = Clamp01(amount);
    const float t2 = t * t;
    const float t3 = t2 * t;
    const float h00 = 2.0F * t3 - 3.0F * t2 + 1.0F;
    const float h10 = t3 - 2.0F * t2 + t;
    const float h01 = -2.0F * t3 + 3.0F * t2;
    return {
        h00 * from.x + h10 * initial_velocity.x * duration + h01 * to.x,
        h00 * from.y + h10 * initial_velocity.y * duration + h01 * to.y,
    };
}

/** Solve s - r sin(s / r) = drag for an exactly anchored grab point. */
float SolveGrabDistance(float drag, float radius)
{
    const float curl_length = kPi * radius;
    if (drag >= curl_length) return (drag + curl_length) * 0.5F;
    float lower = 0.0F;
    float upper = curl_length;
    for (int iteration = 0; iteration < 24; ++iteration) {
        const float middle = (lower + upper) * 0.5F;
        const float displacement = middle - radius * std::sin(middle / radius);
        if (displacement < drag) {
            lower = middle;
        } else {
            upper = middle;
        }
    }
    return (lower + upper) * 0.5F;
}

float RadiusForProgress(float base_radius, float horizontal_progress)
{
    const float radius_scale = 0.58F + 0.42F * std::sqrt(Clamp01(horizontal_progress));
    return std::clamp(base_radius * radius_scale, 0.018F, base_radius);
}

} // namespace

PageCurlMotion::PageCurlMotion(MotionProfile profile) : profile_(profile)
{
    profile_.radius_ratio = std::clamp(profile_.radius_ratio, 0.025F, 0.18F);
    profile_.complete_threshold = std::clamp(profile_.complete_threshold, 0.15F, 0.7F);
    profile_.velocity_threshold_pages_per_second =
        std::clamp(profile_.velocity_threshold_pages_per_second, 0.2F, 3.0F);
    profile_.complete_duration_seconds = std::clamp(profile_.complete_duration_seconds, 0.16F, 0.42F);
    profile_.cancel_duration_seconds = std::clamp(profile_.cancel_duration_seconds, 0.14F, 0.42F);
    Reset();
}

void PageCurlMotion::SetAspectRatio(float height_over_width)
{
    aspect_ratio_ = std::clamp(height_over_width, 0.25F, 4.0F);
    ResolveFrame();
}

void PageCurlMotion::Begin(pc_direction direction, float pointer_x, float pointer_y)
{
    direction_ = direction == PC_DIRECTION_PREVIOUS ? PC_DIRECTION_PREVIOUS : PC_DIRECTION_NEXT;
    const Vec2 physical_down = ToCanonical(pointer_x, pointer_y);
    // A page turn controls the free sheet edge, not an arbitrary interior mesh
    // vertex. Keeping this virtual grip on canonical x=1 gives the fold a
    // stable lever arm and removes the atan2 singularity which used to mirror
    // the crease angle when the finger crossed the DOWN height by a few pixels.
    // The physical DOWN y is still frozen for the complete pointer stream.
    input_origin_ = {
        std::clamp(physical_down.x, 0.0F, 1.0F),
        std::clamp(physical_down.y, 0.0F, 1.0F),
    };
    anchor_ = {1.0F, input_origin_.y};
    pointer_ = anchor_;
    settling_ = false;
    settlement_commit_ = false;
    settlement_start_ns_ = 0;
    settlement_velocity_ = {};
    ResolveFrame();
}

void PageCurlMotion::UpdatePointer(float pointer_x, float pointer_y)
{
    const Vec2 raw = ToCanonical(pointer_x, pointer_y);
    // The controlled free edge keeps the exact DOWN-to-MOVE displacement of
    // the physical finger. Mapping the absolute interior x onto the free edge
    // would make the first admitted MOVE jump by (1 - DOWN.x), recreating the
    // slow-start/sudden-catch-up defect this solver is intended to remove.
    const Vec2 followed = {
        anchor_.x + raw.x - input_origin_.x,
        anchor_.y + raw.y - input_origin_.y,
    };
    pointer_ = {
        std::clamp(
            std::min(followed.x, anchor_.x),
            1.0F - kMaximumFingerDragProgress,
            anchor_.x),
        std::clamp(followed.y, -0.18F, 1.18F),
    };
    ResolveFrame();
}

bool PageCurlMotion::BeginSettlement(
    bool can_commit,
    float velocity_x_pages_per_second,
    float velocity_y_pages_per_second,
    int64_t frame_time_ns)
{
    const float canonical_velocity_x = direction_ == PC_DIRECTION_PREVIOUS ?
        -velocity_x_pages_per_second : velocity_x_pages_per_second;
    // The virtual free-edge grip carries the exact physical DOWN-to-MOVE
    // displacement, so this remains the real horizontal drag even though the
    // controlled material point itself lives on canonical x=1.
    const float horizontal_drag = anchor_.x - pointer_.x;
    const bool distance_commit = horizontal_drag >= profile_.complete_threshold;
    const bool velocity_commit = horizontal_drag >= 0.06F &&
        canonical_velocity_x <= -profile_.velocity_threshold_pages_per_second;

    settling_ = true;
    // Page order is one-dimensional. Vertical release velocity changes the
    // settling fold path, but can neither force nor veto a page commit.
    settlement_commit_ = can_commit && horizontal_drag > 0.0F && (distance_commit || velocity_commit);
    settlement_start_ns_ = std::max<int64_t>(0, frame_time_ns);
    settlement_source_ = pointer_;
    const float constrained_velocity_x = std::clamp(canonical_velocity_x, -3.2F, 3.2F);
    settlement_velocity_ = {
        constrained_velocity_x,
        std::clamp(velocity_y_pages_per_second, -3.2F, 3.2F),
    };
    if (settlement_commit_) {
        const float projected_y = pointer_.y + settlement_velocity_.y * 0.055F;
        settlement_target_ = {-1.12F, std::clamp(projected_y, -0.08F, 1.08F)};
    } else {
        settlement_target_ = anchor_;
    }

    const float remaining = Length({
        settlement_target_.x - settlement_source_.x,
        (settlement_target_.y - settlement_source_.y) * aspect_ratio_,
    });
    const float release_speed = Length({settlement_velocity_.x, settlement_velocity_.y * aspect_ratio_});
    const float base_duration = settlement_commit_ ?
        profile_.complete_duration_seconds : profile_.cancel_duration_seconds;
    const float distance_scale = std::clamp(0.72F + remaining * 0.32F - release_speed * 0.055F, 0.62F, 1.35F);
    settlement_duration_seconds_ = std::clamp(base_duration * distance_scale, 0.16F, 0.42F);
    return settlement_commit_;
}

bool PageCurlMotion::TickSettlement(int64_t frame_time_ns)
{
    if (!settling_) return true;
    if (settlement_start_ns_ == 0) settlement_start_ns_ = std::max<int64_t>(0, frame_time_ns);
    const float elapsed = static_cast<float>(std::max<int64_t>(0, frame_time_ns - settlement_start_ns_)) /
        1'000'000'000.0F;
    const float amount = settlement_duration_seconds_ <= kEpsilon ?
        1.0F : Clamp01(elapsed / settlement_duration_seconds_);
    pointer_ = Hermite(
        settlement_source_, settlement_velocity_, settlement_target_, settlement_duration_seconds_, amount);
    pointer_.x = std::clamp(pointer_.x, -1.35F, 1.25F);
    pointer_.y = std::clamp(pointer_.y, -0.18F, 1.18F);
    ResolveFrame();
    if (amount >= 1.0F) {
        settling_ = false;
        return true;
    }
    return false;
}

void PageCurlMotion::Reset()
{
    direction_ = PC_DIRECTION_NEXT;
    pointer_ = {1.0F, 0.5F};
    anchor_ = pointer_;
    input_origin_ = pointer_;
    settling_ = false;
    settlement_commit_ = false;
    settlement_start_ns_ = 0;
    settlement_source_ = pointer_;
    settlement_target_ = pointer_;
    settlement_velocity_ = {};
    settlement_duration_seconds_ = profile_.cancel_duration_seconds;
    ResolveFrame();
}

MotionFrame PageCurlMotion::Frame() const
{
    MotionFrame output = frame_;
    output.pointer = FromCanonical(output.pointer);
    output.anchor = FromCanonical(output.anchor);
    output.fold_origin = FromCanonical(output.fold_origin);
    if (direction_ == PC_DIRECTION_PREVIOUS) output.fold_direction.x = -output.fold_direction.x;
    return output;
}

Vec2 PageCurlMotion::Pointer() const
{
    return FromCanonical(pointer_);
}

bool PageCurlMotion::SettlementCommit() const
{
    return settlement_commit_;
}

Vec2 PageCurlMotion::ToCanonical(float x, float y) const
{
    return {direction_ == PC_DIRECTION_PREVIOUS ? 1.0F - x : x, y};
}

Vec2 PageCurlMotion::FromCanonical(Vec2 value) const
{
    return {direction_ == PC_DIRECTION_PREVIOUS ? 1.0F - value.x : value.x, value.y};
}

void PageCurlMotion::ResolveFrame()
{
    const Vec2 metric_anchor = {anchor_.x, anchor_.y * aspect_ratio_};
    const Vec2 metric_pointer = {pointer_.x, pointer_.y * aspect_ratio_};
    Vec2 fold_normal = Normalize({
        metric_anchor.x - metric_pointer.x,
        metric_anchor.y - metric_pointer.y,
    });
    const float drag_distance = Length({
        metric_anchor.x - metric_pointer.x,
        metric_anchor.y - metric_pointer.y,
    });
    if (drag_distance <= kEpsilon) fold_normal = {1.0F, 0.0F};

    const float horizontal_progress = Clamp01(anchor_.x - pointer_.x);
    const float radius = RadiusForProgress(profile_.radius_ratio, horizontal_progress);
    const float grab_distance = SolveGrabDistance(drag_distance, radius);
    Vec2 fold_origin_metric = {
        metric_anchor.x - fold_normal.x * grab_distance,
        metric_anchor.y - fold_normal.y * grab_distance,
    };

    frame_.pointer = pointer_;
    frame_.anchor = anchor_;
    frame_.fold_origin = {fold_origin_metric.x, fold_origin_metric.y / aspect_ratio_};
    frame_.fold_direction = fold_normal;
    frame_.radius = radius;
    // A straight cylinder is developable: it bends paper without changing
    // material length. The former quadratic crease changed the local normal
    // along the fold and visibly stretched the page into a fan.
    frame_.crease_curvature = 0.0F;
    frame_.progress = horizontal_progress;
}

} // namespace reader::pagecurl
