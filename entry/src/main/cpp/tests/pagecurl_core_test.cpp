#include "pagecurl/pagecurl_c.h"
#include "pagecurl/pagecurl_mesh.h"

#include <algorithm>
#include <cassert>
#include <cmath>
#include <vector>

namespace {
constexpr float kPi = 3.14159265358979323846F;

template <typename T>
void Init(T& value)
{
    value = {};
    value.header.struct_size = sizeof(T);
    value.header.abi_version = PC_ABI_VERSION;
}

float Length(float x, float y)
{
    return std::sqrt(x * x + y * y);
}

float SmoothStep(float edge0, float edge1, float value)
{
    const float amount = std::clamp((value - edge0) / (edge1 - edge0), 0.0F, 1.0F);
    return amount * amount * (3.0F - 2.0F * amount);
}

/** Re-evaluate the V2 shader mapping at an arbitrary material point. */
void DeformMaterial(
    const pc_curl_frame& frame,
    float aspect,
    float physical_material_x,
    float physical_material_y,
    float& output_x,
    float& output_y)
{
    const bool previous = frame.direction == PC_DIRECTION_PREVIOUS;
    const float material_x = previous ? 1.0F - physical_material_x : physical_material_x;
    const float origin_x = previous ? 1.0F - frame.fold_origin_x : frame.fold_origin_x;
    float normal_x = previous ? -frame.fold_direction_x : frame.fold_direction_x;
    float normal_y = frame.fold_direction_y;
    const float normal_length = Length(normal_x, normal_y);
    normal_x /= normal_length;
    normal_y /= normal_length;
    const float relative_x = material_x - origin_x;
    const float relative_y = (physical_material_y - frame.fold_origin_y) * aspect;
    const float signed_distance = relative_x * normal_x + relative_y * normal_y;
    const float radius = frame.curl_radius;
    const float curl_length = kPi * radius;
    float mapped = signed_distance;
    if (signed_distance > 0.0F && signed_distance < curl_length) {
        mapped = radius * std::sin(signed_distance / radius);
    } else if (signed_distance >= curl_length) {
        mapped = -(signed_distance - curl_length);
    }
    const float binding_weight = SmoothStep(0.0F, 0.075F, material_x);
    const float deformed_x = material_x + normal_x * (mapped - signed_distance) * binding_weight;
    const float deformed_y = physical_material_y * aspect +
        normal_y * (mapped - signed_distance) * binding_weight;
    output_x = previous ? 1.0F - deformed_x : deformed_x;
    output_y = deformed_y / aspect;
}

void AssertGrabFollowsPointer(const pc_curl_frame& frame, float aspect)
{
    float output_x = 0.0F;
    float output_y = 0.0F;
    DeformMaterial(
        frame,
        aspect,
        frame.anchor_x_normalized,
        frame.anchor_y_normalized,
        output_x,
        output_y);
    assert(std::abs(output_x - frame.pointer_x_normalized) < 0.002F);
    assert(std::abs(output_y - frame.pointer_y_normalized) < 0.002F);
}

void AssertBindingEdgeFixed(const pc_curl_frame& frame, float aspect)
{
    const float binding_x = frame.direction == PC_DIRECTION_PREVIOUS ? 1.0F : 0.0F;
    for (const float material_y : {0.0F, 0.5F, 1.0F}) {
        float output_x = 0.0F;
        float output_y = 0.0F;
        DeformMaterial(frame, aspect, binding_x, material_y, output_x, output_y);
        assert(std::abs(output_x - binding_x) < 0.002F);
        assert(std::abs(output_y - material_y) < 0.002F);
    }
}
}

int main()
{
    pc_engine_config config;
    Init(config);
    config.curl_radius_ratio = 0.085F;
    config.complete_threshold = 0.28F;
    config.velocity_threshold_pages_per_second = 0.8F;
    config.complete_duration_seconds = 0.28F;
    config.cancel_duration_seconds = 0.22F;

    pc_engine_handle engine = 0;
    assert(pc_engine_create(&config, &engine) == PC_RESULT_OK);

    pc_viewport viewport;
    Init(viewport);
    viewport.width_px = 1170;
    viewport.height_px = 2532;
    viewport.display_scale = 3.0F;
    assert(pc_engine_set_viewport(engine, &viewport) == PC_RESULT_OK);

    std::vector<reader::pagecurl::SheetMeshVertex> vertices;
    std::vector<uint16_t> indices;
    assert(reader::pagecurl::BuildStaticSheetMesh(32, 48, vertices, indices));
    assert(vertices.size() == 32U * 48U);
    assert(indices.size() == 31U * 47U * 6U);
    assert(vertices.front().u == 0.0F && vertices.front().v == 0.0F);
    assert(vertices.back().u == 1.0F && vertices.back().v == 1.0F);

    assert(pc_engine_prepare(engine, 7, PC_DIRECTION_NEXT) == PC_RESULT_OK);
    assert(pc_engine_renderer_ready(engine, 7) == PC_RESULT_OK);
    pc_event event;
    Init(event);
    assert(pc_engine_poll_event(engine, &event));
    assert(event.type == PC_EVENT_RENDERER_READY);

    pc_pointer pointer;
    Init(pointer);
    pointer.x_normalized = 0.76F;
    pointer.y_normalized = 0.91F;
    assert(pc_engine_begin(engine, 7, &pointer) == PC_RESULT_OK);
    pointer.x_normalized = 0.46F;
    pointer.y_normalized = 0.76F;
    assert(pc_engine_update_pointer(engine, 7, &pointer) == PC_RESULT_OK);

    pc_curl_frame frame;
    Init(frame);
    assert(pc_engine_tick(engine, 1'000'000'000LL, &frame));
    assert(frame.phase == PC_PHASE_DRAGGING);
    assert(std::abs(frame.anchor_x_normalized - 1.0F) < 0.001F);
    assert(std::abs(frame.anchor_y_normalized - 0.91F) < 0.001F);
    assert(std::abs(frame.pointer_x_normalized - 0.70F) < 0.001F);
    assert(std::abs(frame.pointer_y_normalized - 0.76F) < 0.001F);
    assert(std::abs(frame.progress - 0.30F) < 0.005F);
    assert(frame.crease_curvature == 0.0F);
    const float aspect = 2532.0F / 1170.0F;
    AssertGrabFollowsPointer(frame, aspect);
    AssertBindingEdgeFixed(frame, aspect);

    pc_release_info release;
    Init(release);
    release.can_commit = true;
    release.velocity_x_pages_per_second = -0.25F;
    release.velocity_y_pages_per_second = -0.08F;
    release.event_time_ns = 1'000'000'000LL;
    assert(pc_engine_release(engine, 7, &release) == PC_RESULT_OK);
    Init(frame);
    assert(pc_engine_tick(engine, 1'000'000'000LL, &frame));
    assert(frame.phase == PC_PHASE_SETTLING_COMPLETE);
    assert(frame.settlement_commit);
    Init(frame);
    assert(pc_engine_tick(engine, 1'500'000'000LL, &frame));
    assert(frame.phase == PC_PHASE_AWAITING_HOST_COMMIT);
    Init(event);
    assert(pc_engine_poll_event(engine, &event));
    assert(event.type == PC_EVENT_TURN_REACHED_END);
    assert(pc_engine_host_committed(engine, 7) == PC_RESULT_OK);
    assert(pc_engine_host_presented(engine, 7) == PC_RESULT_OK);

    // Previous mirrors x only; its physical free edge is the virtual grip.
    assert(pc_engine_prepare(engine, 8, PC_DIRECTION_PREVIOUS) == PC_RESULT_OK);
    assert(pc_engine_renderer_ready(engine, 8) == PC_RESULT_OK);
    Init(pointer);
    pointer.x_normalized = 0.17F;
    pointer.y_normalized = 0.12F;
    assert(pc_engine_begin(engine, 8, &pointer) == PC_RESULT_OK);
    pointer.x_normalized = 0.33F;
    pointer.y_normalized = 0.19F;
    assert(pc_engine_update_pointer(engine, 8, &pointer) == PC_RESULT_OK);
    Init(frame);
    assert(pc_engine_tick(engine, 2'000'000'000LL, &frame));
    assert(std::abs(frame.anchor_x_normalized - 0.0F) < 0.001F);
    assert(std::abs(frame.anchor_y_normalized - 0.12F) < 0.001F);
    assert(std::abs(frame.pointer_x_normalized - 0.16F) < 0.001F);
    assert(std::abs(frame.pointer_y_normalized - 0.19F) < 0.001F);
    AssertGrabFollowsPointer(frame, aspect);
    AssertBindingEdgeFixed(frame, aspect);

    // can_commit=false always rolls back even with a fast release.
    Init(release);
    release.can_commit = false;
    release.velocity_x_pages_per_second = 2.0F;
    release.velocity_y_pages_per_second = 0.2F;
    assert(pc_engine_release(engine, 8, &release) == PC_RESULT_OK);
    Init(frame);
    assert(pc_engine_tick(engine, 2'000'000'000LL, &frame));
    assert(frame.phase == PC_PHASE_SETTLING_CANCEL);
    assert(!frame.settlement_commit);
    Init(frame);
    assert(pc_engine_tick(engine, 2'500'000'000LL, &frame));
    Init(event);
    assert(pc_engine_poll_event(engine, &event));
    if (event.type == PC_EVENT_RENDERER_READY) {
        Init(event);
        assert(pc_engine_poll_event(engine, &event));
    }
    assert(event.type == PC_EVENT_TURN_CANCELLED);

    // A short fast flick commits using Native velocity rather than a Host bool.
    assert(pc_engine_prepare(engine, 9, PC_DIRECTION_NEXT) == PC_RESULT_OK);
    assert(pc_engine_renderer_ready(engine, 9) == PC_RESULT_OK);
    Init(pointer);
    pointer.x_normalized = 0.72F;
    pointer.y_normalized = 0.52F;
    assert(pc_engine_begin(engine, 9, &pointer) == PC_RESULT_OK);
    pointer.x_normalized = 0.63F;
    assert(pc_engine_update_pointer(engine, 9, &pointer) == PC_RESULT_OK);
    Init(release);
    release.can_commit = true;
    release.velocity_x_pages_per_second = -1.1F;
    assert(pc_engine_release(engine, 9, &release) == PC_RESULT_OK);
    Init(frame);
    assert(pc_engine_tick(engine, 3'000'000'000LL, &frame));
    assert(frame.phase == PC_PHASE_SETTLING_COMPLETE);
    assert(frame.settlement_commit);

    assert(pc_engine_cancel(engine, 9) == PC_RESULT_OK);

    // A quarter-page drag remains an admitted curl when the same finger moves
    // sharply upward. The fixed binding edge stays flat, and vertical travel
    // can neither revoke nor force a page commit.
    assert(pc_engine_prepare(engine, 10, PC_DIRECTION_NEXT) == PC_RESULT_OK);
    assert(pc_engine_renderer_ready(engine, 10) == PC_RESULT_OK);
    Init(pointer);
    pointer.x_normalized = 0.76F;
    pointer.y_normalized = 0.91F;
    assert(pc_engine_begin(engine, 10, &pointer) == PC_RESULT_OK);
    pointer.x_normalized = 0.51F;
    float last_pointer_y = 0.91F;
    int64_t drag_frame_time = 3'500'000'000LL;
    for (const float raw_y : {0.82F, 0.68F, 0.52F, 0.36F, 0.18F}) {
        pointer.y_normalized = raw_y;
        assert(pc_engine_update_pointer(engine, 10, &pointer) == PC_RESULT_OK);
        Init(frame);
        assert(pc_engine_tick(engine, drag_frame_time, &frame));
        drag_frame_time += 10'000'000LL;
        assert(std::abs(frame.pointer_y_normalized - raw_y) < 0.0001F);
        assert(frame.pointer_y_normalized <= last_pointer_y + 0.0001F);
        last_pointer_y = frame.pointer_y_normalized;
        AssertGrabFollowsPointer(frame, aspect);
        AssertBindingEdgeFixed(frame, aspect);
    }
    assert(frame.phase == PC_PHASE_DRAGGING);
    assert(std::abs(frame.pointer_x_normalized - 0.75F) < 0.001F);
    assert(std::abs(frame.progress - 0.25F) < 0.005F);
    assert(frame.pointer_y_normalized < frame.anchor_y_normalized);
    Init(release);
    release.can_commit = true;
    release.velocity_x_pages_per_second = 0.0F;
    release.velocity_y_pages_per_second = -2.0F;
    assert(pc_engine_release(engine, 10, &release) == PC_RESULT_OK);
    Init(frame);
    assert(pc_engine_tick(engine, 4'000'000'000LL, &frame));
    assert(frame.phase == PC_PHASE_SETTLING_CANCEL);
    assert(!frame.settlement_commit);

    Init(frame);
    assert(pc_engine_tick(engine, 4'500'000'000LL, &frame));
    Init(event);
    assert(pc_engine_poll_event(engine, &event));
    if (event.type == PC_EVENT_RENDERER_READY) {
        Init(event);
        assert(pc_engine_poll_event(engine, &event));
    }
    assert(event.type == PC_EVENT_TURN_CANCELLED);

    // Raw dragging never transfers more than three quarters of the horizontal
    // axis. The remaining quarter is produced only by native settlement.
    assert(pc_engine_prepare(engine, 11, PC_DIRECTION_NEXT) == PC_RESULT_OK);
    assert(pc_engine_renderer_ready(engine, 11) == PC_RESULT_OK);
    Init(pointer);
    pointer.x_normalized = 0.92F;
    pointer.y_normalized = 0.52F;
    assert(pc_engine_begin(engine, 11, &pointer) == PC_RESULT_OK);
    pointer.x_normalized = -0.50F;
    pointer.y_normalized = 0.45F;
    assert(pc_engine_update_pointer(engine, 11, &pointer) == PC_RESULT_OK);
    Init(frame);
    assert(pc_engine_tick(engine, 5'000'000'000LL, &frame));
    assert(frame.phase == PC_PHASE_DRAGGING);
    assert(frame.progress <= 0.7501F);
    assert(frame.progress >= 0.749F);
    assert(std::abs(frame.pointer_x_normalized - 0.25F) < 0.001F);
    AssertGrabFollowsPointer(frame, aspect);
    AssertBindingEdgeFixed(frame, aspect);

    // With a stable free-edge grip, moving through the DOWN height at a
    // quarter-page transfer rotates the crease continuously instead of
    // jumping to its symmetric angle after a one-pixel sign change.
    assert(pc_engine_cancel(engine, 11) == PC_RESULT_OK);
    assert(pc_engine_prepare(engine, 12, PC_DIRECTION_NEXT) == PC_RESULT_OK);
    assert(pc_engine_renderer_ready(engine, 12) == PC_RESULT_OK);
    Init(pointer);
    pointer.x_normalized = 0.82F;
    pointer.y_normalized = 0.72F;
    assert(pc_engine_begin(engine, 12, &pointer) == PC_RESULT_OK);
    float previous_angle = 0.0F;
    bool has_previous_angle = false;
    int64_t continuity_frame_time = 5'100'000'000LL;
    for (int step = -20; step <= 20; ++step) {
        pointer.x_normalized = 0.57F;
        pointer.y_normalized = 0.72F + static_cast<float>(step) * 0.002F;
        assert(pc_engine_update_pointer(engine, 12, &pointer) == PC_RESULT_OK);
        Init(frame);
        assert(pc_engine_tick(engine, continuity_frame_time, &frame));
        continuity_frame_time += 10'000'000LL;
        const float angle = std::atan2(frame.fold_direction_y, frame.fold_direction_x);
        if (has_previous_angle) assert(std::abs(angle - previous_angle) < 0.04F);
        previous_angle = angle;
        has_previous_angle = true;
        assert(std::abs(frame.pointer_y_normalized - pointer.y_normalized) < 0.0001F);
        AssertGrabFollowsPointer(frame, aspect);
        AssertBindingEdgeFixed(frame, aspect);
    }

    assert(pc_engine_update_pointer(engine, 7, &pointer) == PC_RESULT_STALE_SESSION);
    pc_engine_destroy(engine);
    return 0;
}
