#ifndef READER_PAGECURL_NATIVE_HOST_H
#define READER_PAGECURL_NATIVE_HOST_H

#include "pagecurl_c.h"
#include "pagecurl_engine.h"
#include "pagecurl_pixel_buffer.h"
#include "pagecurl_renderer.h"

#include <ace/xcomponent/native_interface_xcomponent.h>
#include <js_native_api.h>
#include <native_vsync/native_vsync.h>

#include <memory>
#include <mutex>
#include <string>
#include <vector>

namespace reader::pagecurl {

class PageCurlNativeHost final {
public:
    static PageCurlNativeHost& Instance();

    void Register(OH_NativeXComponent* component);
    bool PrimePage(
        napi_env env,
        const std::string& texture_key,
        napi_value page);
    bool IsPageReady(const std::string& texture_key) const;
    bool Prepare(
        const std::string& moving_texture_key,
        const std::string& under_texture_key,
        pc_direction direction,
        pc_session_id session_id);
    bool Begin(pc_session_id session_id, float x, float y, int64_t event_time_ns);
    bool Update(pc_session_id session_id, float x, float y, int64_t event_time_ns);
    /** -1 rejected, 0 rollback, 1 commit. */
    int Release(
        pc_session_id session_id,
        bool can_commit,
        float velocity_x,
        float velocity_y,
        int64_t event_time_ns);
    bool HostCommitted(pc_session_id session_id);
    bool HostPresented(pc_session_id session_id);
    void Cancel(pc_session_id session_id);
    pc_phase Phase() const;
    pc_session_id SessionId() const;
    uint32_t TakeEventMask();

private:
    PageCurlNativeHost();
    ~PageCurlNativeHost();

    static void OnSurfaceCreated(OH_NativeXComponent* component, void* window);
    static void OnSurfaceChanged(OH_NativeXComponent* component, void* window);
    static void OnSurfaceDestroyed(OH_NativeXComponent* component, void* window);
    static void OnTouch(OH_NativeXComponent* component, void* window);
    static void OnVSync(long long timestamp, void* data);

    void HandleSurfaceCreated(OH_NativeXComponent* component, void* window);
    void HandleSurfaceChanged(OH_NativeXComponent* component, void* window);
    void HandleSurfaceDestroyed();
    void RenderFrame(int64_t frame_time_ns);
    void RequestFrameLocked();
    void DrainEventsLocked();
    bool CopyPixelMap(napi_env env, napi_value value, PixelBuffer& output);

    struct PendingPageUpload {
        std::string key;
        PixelBuffer pixels;
    };

    mutable std::mutex mutex_;
    std::unique_ptr<PageCurlEngine> engine_;
    PageCurlRenderer renderer_;
    OH_NativeVSync* vsync_ = nullptr;
    OH_NativeXComponent_Callback callbacks_ {};
    std::vector<PendingPageUpload> pending_page_uploads_;
    bool clear_pending_ = false;
    bool frame_requested_ = false;
    pc_phase phase_ = PC_PHASE_IDLE;
    pc_session_id session_id_ = 0;
    uint32_t event_mask_ = 0;
};

} // namespace reader::pagecurl

#endif
