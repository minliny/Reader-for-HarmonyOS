#ifndef READER_PAGECURL_MOTION_H
#define READER_PAGECURL_MOTION_H

#include "pagecurl_c.h"

namespace reader::pagecurl {

struct Vec2 {
    float x = 0.0F;
    float y = 0.0F;
};

struct MotionProfile {
    float radius_ratio = 0.085F;
    float complete_threshold = 0.28F;
    float velocity_threshold_pages_per_second = 0.8F;
    float complete_duration_seconds = 0.28F;
    float cancel_duration_seconds = 0.22F;
};

struct MotionFrame {
    Vec2 pointer;
    Vec2 anchor;
    Vec2 fold_origin;
    Vec2 fold_direction;
    float radius = 0.0F;
    float crease_curvature = 0.0F;
    float progress = 0.0F;
};

class PageCurlMotion final {
public:
    explicit PageCurlMotion(MotionProfile profile = {});

    void SetAspectRatio(float height_over_width);
    void Begin(pc_direction direction, float pointer_x, float pointer_y);
    void UpdatePointer(float pointer_x, float pointer_y);
    bool BeginSettlement(
        bool can_commit,
        float velocity_x_pages_per_second,
        float velocity_y_pages_per_second,
        int64_t frame_time_ns);
    bool TickSettlement(int64_t frame_time_ns);
    void Reset();

    [[nodiscard]] MotionFrame Frame() const;
    [[nodiscard]] Vec2 Pointer() const;
    [[nodiscard]] bool SettlementCommit() const;

private:
    [[nodiscard]] Vec2 ToCanonical(float x, float y) const;
    [[nodiscard]] Vec2 FromCanonical(Vec2 value) const;
    void ResolveFrame();

    MotionProfile profile_;
    float aspect_ratio_ = 1.0F;
    pc_direction direction_ = PC_DIRECTION_NEXT;
    Vec2 pointer_ = {1.0F, 0.5F};
    Vec2 anchor_ = {1.0F, 0.5F};
    Vec2 input_origin_ = {1.0F, 0.5F};
    MotionFrame frame_;
    bool settling_ = false;
    bool settlement_commit_ = false;
    int64_t settlement_start_ns_ = 0;
    Vec2 settlement_source_;
    Vec2 settlement_target_;
    Vec2 settlement_velocity_;
    float settlement_duration_seconds_ = 0.0F;
};

} // namespace reader::pagecurl

#endif
