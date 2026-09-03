#ifndef READER_PAGECURL_ENGINE_H
#define READER_PAGECURL_ENGINE_H

#include "pagecurl_c.h"
#include "pagecurl_motion.h"

#include <deque>
#include <mutex>

namespace reader::pagecurl {

class PageCurlEngine final {
public:
    explicit PageCurlEngine(const pc_engine_config& config);

    pc_result SetViewport(const pc_viewport& viewport);
    pc_result Prepare(pc_session_id session_id, pc_direction direction);
    pc_result RendererReady(pc_session_id session_id);
    pc_result Begin(pc_session_id session_id, const pc_pointer& pointer);
    pc_result UpdatePointer(pc_session_id session_id, const pc_pointer& pointer);
    pc_result Release(pc_session_id session_id, const pc_release_info& release, bool* out_commit = nullptr);
    bool Tick(int64_t frame_time_ns, pc_curl_frame& output);
    pc_result HostCommitted(pc_session_id session_id);
    pc_result HostPresented(pc_session_id session_id);
    pc_result Cancel(pc_session_id session_id);
    bool PollEvent(pc_event& output);

private:
    [[nodiscard]] bool IsCurrent(pc_session_id session_id) const;
    void PushEvent(pc_event_type type, pc_result result = PC_RESULT_OK);
    void FillFrame(pc_curl_frame& output) const;

    mutable std::mutex mutex_;
    pc_engine_config config_ {};
    pc_viewport viewport_ {};
    pc_session_id session_id_ = 0;
    pc_phase phase_ = PC_PHASE_IDLE;
    pc_direction direction_ = PC_DIRECTION_NEXT;
    PageCurlMotion motion_;
    pc_pointer latest_pointer_ {};
    bool host_committed_ = false;
    std::deque<pc_event> events_;
};

bool IsValidHeader(const pc_struct_header& header, size_t minimum_size);

} // namespace reader::pagecurl

#endif
