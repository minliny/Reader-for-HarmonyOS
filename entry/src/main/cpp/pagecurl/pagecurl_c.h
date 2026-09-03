/*
 * Reader PageCurl native ABI.
 *
 * The ABI owns page-turn motion only. Content, pagination, persistence,
 * gestures and PixelMap creation stay in the HarmonyOS host.
 */
#ifndef READER_PAGECURL_C_H
#define READER_PAGECURL_C_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define PC_ABI_VERSION 1u

typedef uint64_t pc_engine_handle;
typedef uint64_t pc_session_id;

typedef enum pc_result {
    PC_RESULT_OK = 0,
    PC_RESULT_BAD_ARGUMENT = 1,
    PC_RESULT_BAD_STATE = 2,
    PC_RESULT_STALE_SESSION = 3,
    PC_RESULT_SURFACE_UNAVAILABLE = 4,
    PC_RESULT_TEXTURE_UNAVAILABLE = 5,
    PC_RESULT_RENDER_FAILURE = 6,
} pc_result;

typedef enum pc_direction {
    PC_DIRECTION_PREVIOUS = -1,
    PC_DIRECTION_NEXT = 1,
} pc_direction;

typedef enum pc_phase {
    PC_PHASE_IDLE = 0,
    PC_PHASE_PREPARING = 1,
    PC_PHASE_ARMED = 2,
    PC_PHASE_DRAGGING = 3,
    PC_PHASE_SETTLING_COMPLETE = 4,
    PC_PHASE_SETTLING_CANCEL = 5,
    PC_PHASE_AWAITING_HOST_COMMIT = 6,
    PC_PHASE_AWAITING_HOST_PRESENT = 7,
} pc_phase;

typedef enum pc_event_type {
    PC_EVENT_NONE = 0,
    PC_EVENT_RENDERER_READY = 1,
    PC_EVENT_TURN_REACHED_END = 2,
    PC_EVENT_TURN_CANCELLED = 3,
    PC_EVENT_HOST_PRESENT_ACKNOWLEDGED = 4,
    PC_EVENT_RENDER_FAILED = 5,
} pc_event_type;

typedef struct pc_struct_header {
    uint32_t struct_size;
    uint32_t abi_version;
} pc_struct_header;

typedef struct pc_engine_config {
    pc_struct_header header;
    float curl_radius_ratio;
    float complete_threshold;
    float velocity_threshold_pages_per_second;
    float complete_duration_seconds;
    float cancel_duration_seconds;
} pc_engine_config;

typedef struct pc_viewport {
    pc_struct_header header;
    uint32_t width_px;
    uint32_t height_px;
    float display_scale;
} pc_viewport;

typedef struct pc_pointer {
    pc_struct_header header;
    float x_normalized;
    float y_normalized;
    float pressure;
    int64_t event_time_ns;
} pc_pointer;

typedef struct pc_release_info {
    pc_struct_header header;
    /** Host availability gate. Native motion still decides commit or rollback. */
    bool can_commit;
    float velocity_x_pages_per_second;
    float velocity_y_pages_per_second;
    int64_t event_time_ns;
} pc_release_info;

typedef struct pc_curl_frame {
    pc_struct_header header;
    pc_session_id session_id;
    pc_phase phase;
    pc_direction direction;
    float pointer_x_normalized;
    float pointer_y_normalized;
    float anchor_x_normalized;
    float anchor_y_normalized;
    float fold_origin_x;
    float fold_origin_y;
    float fold_direction_x;
    float fold_direction_y;
    float curl_radius;
    /** Reserved for ABI compatibility; the isometric cylindrical model emits 0. */
    float crease_curvature;
    float progress;
    /** Native decision for the active settlement. */
    bool settlement_commit;
    bool draw_frame;
} pc_curl_frame;

typedef struct pc_event {
    pc_struct_header header;
    pc_session_id session_id;
    pc_event_type type;
    pc_result result;
} pc_event;

pc_result pc_engine_create(const pc_engine_config* config, pc_engine_handle* out_handle);
void pc_engine_destroy(pc_engine_handle handle);
pc_result pc_engine_set_viewport(pc_engine_handle handle, const pc_viewport* viewport);
pc_result pc_engine_prepare(pc_engine_handle handle, pc_session_id session_id, pc_direction direction);
pc_result pc_engine_renderer_ready(pc_engine_handle handle, pc_session_id session_id);
pc_result pc_engine_begin(pc_engine_handle handle, pc_session_id session_id, const pc_pointer* pointer);
pc_result pc_engine_update_pointer(pc_engine_handle handle, pc_session_id session_id, const pc_pointer* pointer);
pc_result pc_engine_release(pc_engine_handle handle, pc_session_id session_id, const pc_release_info* release);
bool pc_engine_tick(pc_engine_handle handle, int64_t frame_time_ns, pc_curl_frame* output);
pc_result pc_engine_host_committed(pc_engine_handle handle, pc_session_id session_id);
pc_result pc_engine_host_presented(pc_engine_handle handle, pc_session_id session_id);
pc_result pc_engine_cancel(pc_engine_handle handle, pc_session_id session_id);
bool pc_engine_poll_event(pc_engine_handle handle, pc_event* output);

#ifdef __cplusplus
}
#endif

#endif
