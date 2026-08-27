#include "pagecurl_engine.h"

#include <algorithm>
#include <new>

namespace reader::pagecurl {
namespace {
pc_struct_header Header(size_t size)
{
    return {static_cast<uint32_t>(size), PC_ABI_VERSION};
}

pc_engine_config NormalizeConfig(const pc_engine_config& source)
{
    pc_engine_config output = source;
    output.header = Header(sizeof(pc_engine_config));
    output.curl_radius_ratio = std::clamp(source.curl_radius_ratio, 0.025F, 0.18F);
    output.complete_threshold = std::clamp(source.complete_threshold, 0.15F, 0.7F);
    output.velocity_threshold_pages_per_second =
        std::clamp(source.velocity_threshold_pages_per_second, 0.2F, 3.0F);
    output.complete_duration_seconds = std::clamp(source.complete_duration_seconds, 0.12F, 0.7F);
    output.cancel_duration_seconds = std::clamp(source.cancel_duration_seconds, 0.1F, 0.55F);
    return output;
}
} // namespace

bool IsValidHeader(const pc_struct_header& header, size_t minimum_size)
{
    return header.abi_version == PC_ABI_VERSION && header.struct_size >= minimum_size;
}

PageCurlEngine::PageCurlEngine(const pc_engine_config& config)
    : config_(NormalizeConfig(config)),
      motion_(MotionProfile {
          config_.curl_radius_ratio,
          config_.complete_threshold,
          config_.velocity_threshold_pages_per_second,
          config_.complete_duration_seconds,
          config_.cancel_duration_seconds,
      })
{
    viewport_.header = Header(sizeof(pc_viewport));
}

pc_result PageCurlEngine::SetViewport(const pc_viewport& viewport)
{
    std::lock_guard lock(mutex_);
    if (!IsValidHeader(viewport.header, sizeof(pc_viewport)) || viewport.width_px == 0 || viewport.height_px == 0) {
        return PC_RESULT_BAD_ARGUMENT;
    }
    if (phase_ != PC_PHASE_IDLE &&
        (viewport.width_px != viewport_.width_px || viewport.height_px != viewport_.height_px)) {
        PushEvent(PC_EVENT_TURN_CANCELLED);
        phase_ = PC_PHASE_IDLE;
        session_id_ = 0;
        motion_.Reset();
    }
    viewport_ = viewport;
    motion_.SetAspectRatio(static_cast<float>(viewport.height_px) /
        static_cast<float>(viewport.width_px));
    return PC_RESULT_OK;
}

pc_result PageCurlEngine::Prepare(pc_session_id session_id, pc_direction direction)
{
    std::lock_guard lock(mutex_);
    if (session_id == 0 || (direction != PC_DIRECTION_PREVIOUS && direction != PC_DIRECTION_NEXT)) {
        return PC_RESULT_BAD_ARGUMENT;
    }
    if (viewport_.width_px == 0 || viewport_.height_px == 0) {
        return PC_RESULT_SURFACE_UNAVAILABLE;
    }
    session_id_ = session_id;
    direction_ = direction;
    phase_ = PC_PHASE_PREPARING;
    host_committed_ = false;
    events_.clear();
    motion_.Reset();
    return PC_RESULT_OK;
}

pc_result PageCurlEngine::RendererReady(pc_session_id session_id)
{
    std::lock_guard lock(mutex_);
    if (!IsCurrent(session_id)) return PC_RESULT_STALE_SESSION;
    if (phase_ != PC_PHASE_PREPARING) return PC_RESULT_BAD_STATE;
    phase_ = PC_PHASE_ARMED;
    PushEvent(PC_EVENT_RENDERER_READY);
    return PC_RESULT_OK;
}

pc_result PageCurlEngine::Begin(pc_session_id session_id, const pc_pointer& pointer)
{
    std::lock_guard lock(mutex_);
    if (!IsCurrent(session_id)) return PC_RESULT_STALE_SESSION;
    if (!IsValidHeader(pointer.header, sizeof(pc_pointer))) return PC_RESULT_BAD_ARGUMENT;
    if (phase_ != PC_PHASE_ARMED && phase_ != PC_PHASE_DRAGGING) return PC_RESULT_BAD_STATE;
    latest_pointer_ = pointer;
    motion_.Begin(direction_, pointer.x_normalized, pointer.y_normalized);
    phase_ = PC_PHASE_DRAGGING;
    return PC_RESULT_OK;
}

pc_result PageCurlEngine::UpdatePointer(pc_session_id session_id, const pc_pointer& pointer)
{
    std::lock_guard lock(mutex_);
    if (!IsCurrent(session_id)) return PC_RESULT_STALE_SESSION;
    if (!IsValidHeader(pointer.header, sizeof(pc_pointer))) return PC_RESULT_BAD_ARGUMENT;
    if (phase_ != PC_PHASE_DRAGGING && phase_ != PC_PHASE_ARMED) return PC_RESULT_BAD_STATE;
    latest_pointer_ = pointer;
    return PC_RESULT_OK;
}

pc_result PageCurlEngine::Release(pc_session_id session_id, const pc_release_info& release, bool* out_commit)
{
    std::lock_guard lock(mutex_);
    if (!IsCurrent(session_id)) return PC_RESULT_STALE_SESSION;
    if (!IsValidHeader(release.header, sizeof(pc_release_info))) return PC_RESULT_BAD_ARGUMENT;
    if (phase_ != PC_PHASE_DRAGGING && phase_ != PC_PHASE_ARMED) return PC_RESULT_BAD_STATE;
    // Release can arrive between VSync ticks. Resolve the latest physical UP
    // sample before making the native commit decision; otherwise a quick flick
    // is judged using a visibly stale pointer.
    motion_.UpdatePointer(latest_pointer_.x_normalized, latest_pointer_.y_normalized);
    const bool commit = motion_.BeginSettlement(
        release.can_commit,
        release.velocity_x_pages_per_second,
        release.velocity_y_pages_per_second,
        0);
    phase_ = commit ? PC_PHASE_SETTLING_COMPLETE : PC_PHASE_SETTLING_CANCEL;
    // ArkTS gesture timestamps and NativeVSync timestamps are not guaranteed
    // to share an epoch. The first render tick owns the settlement clock so a
    // wall-clock input can never pin the animation at elapsed=0 forever.
    if (out_commit != nullptr) *out_commit = commit;
    return PC_RESULT_OK;
}

bool PageCurlEngine::Tick(int64_t frame_time_ns, pc_curl_frame& output)
{
    std::lock_guard lock(mutex_);
    if (!IsValidHeader(output.header, sizeof(pc_curl_frame))) return false;
    if (phase_ == PC_PHASE_IDLE || phase_ == PC_PHASE_PREPARING || phase_ == PC_PHASE_ARMED ||
        phase_ == PC_PHASE_AWAITING_HOST_PRESENT || phase_ == PC_PHASE_AWAITING_HOST_COMMIT) {
        FillFrame(output);
        return false;
    }
    if (phase_ == PC_PHASE_DRAGGING) {
        // Raw MOVE is already edge-relative when it crosses the NAPI boundary.
        // Render the newest sample on the next VSync; catch-up interpolation
        // creates visible lag and can surface half a page after the finger has
        // stopped.
        motion_.UpdatePointer(latest_pointer_.x_normalized, latest_pointer_.y_normalized);
        FillFrame(output);
        return true;
    }
    const bool finished = motion_.TickSettlement(frame_time_ns);
    FillFrame(output);
    if (finished) {
        if (phase_ == PC_PHASE_SETTLING_CANCEL) {
            PushEvent(PC_EVENT_TURN_CANCELLED);
            phase_ = PC_PHASE_IDLE;
        } else {
            PushEvent(PC_EVENT_TURN_REACHED_END);
            phase_ = host_committed_ ? PC_PHASE_AWAITING_HOST_PRESENT : PC_PHASE_AWAITING_HOST_COMMIT;
        }
        output.phase = phase_;
    }
    return true;
}

pc_result PageCurlEngine::HostCommitted(pc_session_id session_id)
{
    std::lock_guard lock(mutex_);
    if (!IsCurrent(session_id)) return PC_RESULT_STALE_SESSION;
    host_committed_ = true;
    if (phase_ == PC_PHASE_AWAITING_HOST_COMMIT) {
        phase_ = PC_PHASE_AWAITING_HOST_PRESENT;
    }
    return PC_RESULT_OK;
}

pc_result PageCurlEngine::HostPresented(pc_session_id session_id)
{
    std::lock_guard lock(mutex_);
    if (!IsCurrent(session_id)) return PC_RESULT_STALE_SESSION;
    if (phase_ != PC_PHASE_AWAITING_HOST_PRESENT || !host_committed_) return PC_RESULT_BAD_STATE;
    PushEvent(PC_EVENT_HOST_PRESENT_ACKNOWLEDGED);
    phase_ = PC_PHASE_IDLE;
    session_id_ = 0;
    host_committed_ = false;
    motion_.Reset();
    return PC_RESULT_OK;
}

pc_result PageCurlEngine::Cancel(pc_session_id session_id)
{
    std::lock_guard lock(mutex_);
    if (session_id != 0 && !IsCurrent(session_id)) return PC_RESULT_STALE_SESSION;
    if (phase_ != PC_PHASE_IDLE) PushEvent(PC_EVENT_TURN_CANCELLED);
    phase_ = PC_PHASE_IDLE;
    session_id_ = 0;
    host_committed_ = false;
    motion_.Reset();
    return PC_RESULT_OK;
}

bool PageCurlEngine::PollEvent(pc_event& output)
{
    std::lock_guard lock(mutex_);
    if (!IsValidHeader(output.header, sizeof(pc_event)) || events_.empty()) return false;
    output = events_.front();
    events_.pop_front();
    return true;
}

bool PageCurlEngine::IsCurrent(pc_session_id session_id) const
{
    return session_id != 0 && session_id == session_id_;
}

void PageCurlEngine::PushEvent(pc_event_type type, pc_result result)
{
    pc_event event {};
    event.header = Header(sizeof(pc_event));
    event.session_id = session_id_;
    event.type = type;
    event.result = result;
    events_.push_back(event);
}

void PageCurlEngine::FillFrame(pc_curl_frame& output) const
{
    const MotionFrame frame = motion_.Frame();
    output.header = Header(sizeof(pc_curl_frame));
    output.session_id = session_id_;
    output.phase = phase_;
    output.direction = direction_;
    output.pointer_x_normalized = frame.pointer.x;
    output.pointer_y_normalized = frame.pointer.y;
    output.anchor_x_normalized = frame.anchor.x;
    output.anchor_y_normalized = frame.anchor.y;
    output.fold_origin_x = frame.fold_origin.x;
    output.fold_origin_y = frame.fold_origin.y;
    output.fold_direction_x = frame.fold_direction.x;
    output.fold_direction_y = frame.fold_direction.y;
    output.curl_radius = frame.radius;
    output.crease_curvature = frame.crease_curvature;
    output.progress = frame.progress;
    output.settlement_commit = motion_.SettlementCommit();
    output.draw_frame = phase_ != PC_PHASE_IDLE && phase_ != PC_PHASE_PREPARING;
}

} // namespace reader::pagecurl

using reader::pagecurl::IsValidHeader;
using reader::pagecurl::PageCurlEngine;

extern "C" {
pc_result pc_engine_create(const pc_engine_config* config, pc_engine_handle* out_handle)
{
    if (config == nullptr || out_handle == nullptr || !IsValidHeader(config->header, sizeof(pc_engine_config))) {
        return PC_RESULT_BAD_ARGUMENT;
    }
    auto* engine = new (std::nothrow) PageCurlEngine(*config);
    if (engine == nullptr) return PC_RESULT_RENDER_FAILURE;
    *out_handle = reinterpret_cast<pc_engine_handle>(engine);
    return PC_RESULT_OK;
}

void pc_engine_destroy(pc_engine_handle handle)
{
    delete reinterpret_cast<PageCurlEngine*>(handle);
}

pc_result pc_engine_set_viewport(pc_engine_handle handle, const pc_viewport* viewport)
{
    if (handle == 0 || viewport == nullptr) return PC_RESULT_BAD_ARGUMENT;
    return reinterpret_cast<PageCurlEngine*>(handle)->SetViewport(*viewport);
}

pc_result pc_engine_prepare(pc_engine_handle handle, pc_session_id session_id, pc_direction direction)
{
    if (handle == 0) return PC_RESULT_BAD_ARGUMENT;
    return reinterpret_cast<PageCurlEngine*>(handle)->Prepare(session_id, direction);
}

pc_result pc_engine_renderer_ready(pc_engine_handle handle, pc_session_id session_id)
{
    if (handle == 0) return PC_RESULT_BAD_ARGUMENT;
    return reinterpret_cast<PageCurlEngine*>(handle)->RendererReady(session_id);
}

pc_result pc_engine_begin(pc_engine_handle handle, pc_session_id session_id, const pc_pointer* pointer)
{
    if (handle == 0 || pointer == nullptr) return PC_RESULT_BAD_ARGUMENT;
    return reinterpret_cast<PageCurlEngine*>(handle)->Begin(session_id, *pointer);
}

pc_result pc_engine_update_pointer(pc_engine_handle handle, pc_session_id session_id, const pc_pointer* pointer)
{
    if (handle == 0 || pointer == nullptr) return PC_RESULT_BAD_ARGUMENT;
    return reinterpret_cast<PageCurlEngine*>(handle)->UpdatePointer(session_id, *pointer);
}

pc_result pc_engine_release(pc_engine_handle handle, pc_session_id session_id, const pc_release_info* release)
{
    if (handle == 0 || release == nullptr) return PC_RESULT_BAD_ARGUMENT;
    return reinterpret_cast<PageCurlEngine*>(handle)->Release(session_id, *release);
}

bool pc_engine_tick(pc_engine_handle handle, int64_t frame_time_ns, pc_curl_frame* output)
{
    if (handle == 0 || output == nullptr) return false;
    return reinterpret_cast<PageCurlEngine*>(handle)->Tick(frame_time_ns, *output);
}

pc_result pc_engine_host_committed(pc_engine_handle handle, pc_session_id session_id)
{
    if (handle == 0) return PC_RESULT_BAD_ARGUMENT;
    return reinterpret_cast<PageCurlEngine*>(handle)->HostCommitted(session_id);
}

pc_result pc_engine_host_presented(pc_engine_handle handle, pc_session_id session_id)
{
    if (handle == 0) return PC_RESULT_BAD_ARGUMENT;
    return reinterpret_cast<PageCurlEngine*>(handle)->HostPresented(session_id);
}

pc_result pc_engine_cancel(pc_engine_handle handle, pc_session_id session_id)
{
    if (handle == 0) return PC_RESULT_BAD_ARGUMENT;
    return reinterpret_cast<PageCurlEngine*>(handle)->Cancel(session_id);
}

bool pc_engine_poll_event(pc_engine_handle handle, pc_event* output)
{
    if (handle == 0 || output == nullptr) return false;
    return reinterpret_cast<PageCurlEngine*>(handle)->PollEvent(*output);
}
}
