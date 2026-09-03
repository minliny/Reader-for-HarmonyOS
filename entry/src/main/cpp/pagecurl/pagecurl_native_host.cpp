#include "pagecurl_native_host.h"

#include <multimedia/image_framework/image_pixel_map_mdk.h>

#include <algorithm>
#include <cstring>

namespace reader::pagecurl {
namespace {
pc_struct_header Header(size_t size)
{
    return {static_cast<uint32_t>(size), PC_ABI_VERSION};
}

pc_engine_config DefaultConfig()
{
    pc_engine_config config {};
    config.header = Header(sizeof(pc_engine_config));
    config.curl_radius_ratio = 0.085F;
    config.complete_threshold = 0.28F;
    config.velocity_threshold_pages_per_second = 0.8F;
    config.complete_duration_seconds = 0.28F;
    config.cancel_duration_seconds = 0.22F;
    return config;
}
} // namespace

PageCurlNativeHost& PageCurlNativeHost::Instance()
{
    static PageCurlNativeHost host;
    return host;
}

PageCurlNativeHost::PageCurlNativeHost() : engine_(std::make_unique<PageCurlEngine>(DefaultConfig()))
{
    callbacks_.OnSurfaceCreated = OnSurfaceCreated;
    callbacks_.OnSurfaceChanged = OnSurfaceChanged;
    callbacks_.OnSurfaceDestroyed = OnSurfaceDestroyed;
    callbacks_.DispatchTouchEvent = OnTouch;
}

PageCurlNativeHost::~PageCurlNativeHost()
{
    HandleSurfaceDestroyed();
}

void PageCurlNativeHost::Register(OH_NativeXComponent* component)
{
    if (component != nullptr) OH_NativeXComponent_RegisterCallback(component, &callbacks_);
}

bool PageCurlNativeHost::PrimePage(
    napi_env env,
    const std::string& texture_key,
    napi_value page)
{
    if (texture_key.empty()) return false;
    {
        std::lock_guard lock(mutex_);
        if (renderer_.HasCachedPage(texture_key)) return true;
        const auto pending = std::find_if(pending_page_uploads_.begin(), pending_page_uploads_.end(),
            [&texture_key](const PendingPageUpload& upload) { return upload.key == texture_key; });
        if (pending != pending_page_uploads_.end()) return true;
    }
    PixelBuffer page_pixels;
    if (!CopyPixelMap(env, page, page_pixels)) return false;
    std::lock_guard lock(mutex_);
    if (renderer_.HasCachedPage(texture_key)) return true;
    const auto pending = std::find_if(pending_page_uploads_.begin(), pending_page_uploads_.end(),
        [&texture_key](const PendingPageUpload& upload) { return upload.key == texture_key; });
    if (pending != pending_page_uploads_.end()) return true;
    pending_page_uploads_.push_back(PendingPageUpload {texture_key, std::move(page_pixels)});
    RequestFrameLocked();
    return true;
}

bool PageCurlNativeHost::IsPageReady(const std::string& texture_key) const
{
    // Input admission must never wait behind an upload/draw/swap and then jump
    // from a stale first MOVE to the latest pointer. A busy renderer is treated
    // as cold for this gesture; ArkTS fixes the already-mounted flat fallback
    // for the same pointer stream.
    std::unique_lock lock(mutex_, std::try_to_lock);
    if (!lock.owns_lock()) return false;
    return renderer_.HasCachedPage(texture_key);
}

bool PageCurlNativeHost::Prepare(
    const std::string& moving_texture_key,
    const std::string& under_texture_key,
    pc_direction direction,
    pc_session_id session_id)
{
    // The first admitted page-drag sample chooses native or the mounted flat
    // fallback synchronously. Never block this callback behind GL work: that
    // produces the visible "slow start, sudden catch-up" discontinuity.
    std::unique_lock lock(mutex_, std::try_to_lock);
    if (!lock.owns_lock()) return false;
    // The Host resolves semantic page roles before crossing this boundary:
    // NEXT moves current over next; PREVIOUS moves previous over current.
    if (!renderer_.IsReady() || !renderer_.SelectPages(moving_texture_key, under_texture_key) ||
        engine_->Prepare(session_id, direction) != PC_RESULT_OK ||
        engine_->RendererReady(session_id) != PC_RESULT_OK) return false;
    clear_pending_ = false;
    session_id_ = session_id;
    phase_ = PC_PHASE_ARMED;
    event_mask_ = 0;
    // Nothing is drawable until Begin supplies the physical DOWN anchor.
    // Avoid racing an unnecessary VSync against the immediately following
    // Begin call on the input thread.
    return true;
}

bool PageCurlNativeHost::Begin(pc_session_id session_id, float x, float y, int64_t event_time_ns)
{
    std::lock_guard lock(mutex_);
    pc_pointer pointer {};
    pointer.header = Header(sizeof(pc_pointer));
    pointer.x_normalized = x;
    pointer.y_normalized = y;
    pointer.event_time_ns = event_time_ns;
    const bool success = engine_->Begin(session_id, pointer) == PC_RESULT_OK;
    if (success) {
        phase_ = PC_PHASE_DRAGGING;
        RequestFrameLocked();
    }
    return success;
}

bool PageCurlNativeHost::Update(pc_session_id session_id, float x, float y, int64_t event_time_ns)
{
    pc_pointer pointer {};
    pointer.header = Header(sizeof(pc_pointer));
    pointer.x_normalized = x;
    pointer.y_normalized = y;
    pointer.event_time_ns = event_time_ns;
    // Begin already owns a continuous NativeVSync loop for PC_PHASE_DRAGGING.
    // Updating the Engine's independently synchronized latest pointer must not
    // wait behind full-screen GL upload/draw/swap work on the Host mutex.
    return engine_->UpdatePointer(session_id, pointer) == PC_RESULT_OK;
}

int PageCurlNativeHost::Release(
    pc_session_id session_id,
    bool can_commit,
    float velocity_x,
    float velocity_y,
    int64_t event_time_ns)
{
    std::lock_guard lock(mutex_);
    pc_release_info release {};
    release.header = Header(sizeof(pc_release_info));
    release.can_commit = can_commit;
    release.velocity_x_pages_per_second = velocity_x;
    release.velocity_y_pages_per_second = velocity_y;
    release.event_time_ns = event_time_ns;
    bool commit = false;
    const bool success = engine_->Release(session_id, release, &commit) == PC_RESULT_OK;
    if (success) {
        phase_ = commit ? PC_PHASE_SETTLING_COMPLETE : PC_PHASE_SETTLING_CANCEL;
        RequestFrameLocked();
    }
    return success ? (commit ? 1 : 0) : -1;
}

bool PageCurlNativeHost::HostCommitted(pc_session_id session_id)
{
    std::lock_guard lock(mutex_);
    const bool success = engine_->HostCommitted(session_id) == PC_RESULT_OK;
    if (success && phase_ == PC_PHASE_AWAITING_HOST_COMMIT) phase_ = PC_PHASE_AWAITING_HOST_PRESENT;
    return success;
}

bool PageCurlNativeHost::HostPresented(pc_session_id session_id)
{
    std::lock_guard lock(mutex_);
    const bool success = engine_->HostPresented(session_id) == PC_RESULT_OK;
    if (success) {
        phase_ = PC_PHASE_IDLE;
        session_id_ = 0;
        clear_pending_ = true;
        RequestFrameLocked();
    }
    return success;
}

void PageCurlNativeHost::Cancel(pc_session_id session_id)
{
    std::lock_guard lock(mutex_);
    engine_->Cancel(session_id);
    phase_ = PC_PHASE_IDLE;
    session_id_ = 0;
    clear_pending_ = true;
    DrainEventsLocked();
    RequestFrameLocked();
}

pc_phase PageCurlNativeHost::Phase() const
{
    std::lock_guard lock(mutex_);
    return phase_;
}

pc_session_id PageCurlNativeHost::SessionId() const
{
    std::lock_guard lock(mutex_);
    return session_id_;
}

uint32_t PageCurlNativeHost::TakeEventMask()
{
    std::lock_guard lock(mutex_);
    DrainEventsLocked();
    const uint32_t value = event_mask_;
    event_mask_ = 0;
    return value;
}

void PageCurlNativeHost::OnSurfaceCreated(OH_NativeXComponent* component, void* window)
{
    Instance().HandleSurfaceCreated(component, window);
}

void PageCurlNativeHost::OnSurfaceChanged(OH_NativeXComponent* component, void* window)
{
    Instance().HandleSurfaceChanged(component, window);
}

void PageCurlNativeHost::OnSurfaceDestroyed(OH_NativeXComponent*, void*)
{
    Instance().HandleSurfaceDestroyed();
}

void PageCurlNativeHost::OnTouch(OH_NativeXComponent*, void*)
{
    // ArkTS owns gesture conflict arbitration and forwards only admitted page
    // turns through the binary NAPI methods. Native XComponent touch is not
    // allowed to bypass text selection, links, controls or system gestures.
}

void PageCurlNativeHost::OnVSync(long long timestamp, void* data)
{
    if (data != nullptr) static_cast<PageCurlNativeHost*>(data)->RenderFrame(timestamp);
}

void PageCurlNativeHost::HandleSurfaceCreated(OH_NativeXComponent* component, void* window)
{
    uint64_t width = 0;
    uint64_t height = 0;
    if (component == nullptr || window == nullptr ||
        OH_NativeXComponent_GetXComponentSize(component, window, &width, &height) !=
            OH_NATIVEXCOMPONENT_RESULT_SUCCESS) return;
    std::lock_guard lock(mutex_);
    if (!renderer_.Initialize(window, static_cast<uint32_t>(width), static_cast<uint32_t>(height))) return;
    pc_viewport viewport {};
    viewport.header = Header(sizeof(pc_viewport));
    viewport.width_px = static_cast<uint32_t>(width);
    viewport.height_px = static_cast<uint32_t>(height);
    viewport.display_scale = 1.0F;
    engine_->SetViewport(viewport);
    constexpr char kName[] = "reader-pagecurl";
    vsync_ = OH_NativeVSync_Create(kName, sizeof(kName) - 1);
}

void PageCurlNativeHost::HandleSurfaceChanged(OH_NativeXComponent* component, void* window)
{
    uint64_t width = 0;
    uint64_t height = 0;
    if (component == nullptr || window == nullptr ||
        OH_NativeXComponent_GetXComponentSize(component, window, &width, &height) !=
            OH_NATIVEXCOMPONENT_RESULT_SUCCESS) return;
    std::lock_guard lock(mutex_);
    renderer_.Resize(static_cast<uint32_t>(width), static_cast<uint32_t>(height));
    pc_viewport viewport {};
    viewport.header = Header(sizeof(pc_viewport));
    viewport.width_px = static_cast<uint32_t>(width);
    viewport.height_px = static_cast<uint32_t>(height);
    viewport.display_scale = 1.0F;
    engine_->SetViewport(viewport);
    phase_ = PC_PHASE_IDLE;
    session_id_ = 0;
    clear_pending_ = true;
    RequestFrameLocked();
}

void PageCurlNativeHost::HandleSurfaceDestroyed()
{
    std::lock_guard lock(mutex_);
    frame_requested_ = false;
    if (vsync_ != nullptr) {
        OH_NativeVSync_Destroy(vsync_);
        vsync_ = nullptr;
    }
    renderer_.Destroy();
    engine_->Cancel(session_id_);
    phase_ = PC_PHASE_IDLE;
    session_id_ = 0;
    clear_pending_ = false;
    pending_page_uploads_.clear();
}

void PageCurlNativeHost::RenderFrame(int64_t frame_time_ns)
{
    std::lock_guard lock(mutex_);
    frame_requested_ = false;
    if (!renderer_.IsReady()) return;
    if (clear_pending_) {
        renderer_.ClearTransparent();
        clear_pending_ = false;
    }
    if (!pending_page_uploads_.empty()) {
        PendingPageUpload upload = std::move(pending_page_uploads_.front());
        pending_page_uploads_.erase(pending_page_uploads_.begin());
        if (!renderer_.CachePage(upload.key, upload.pixels)) {
            event_mask_ |= 1U << PC_EVENT_RENDER_FAILED;
        }
    }
    pc_curl_frame frame {};
    frame.header = Header(sizeof(pc_curl_frame));
    const bool needs_draw = engine_->Tick(frame_time_ns, frame);
    if (frame.draw_frame && !renderer_.Draw(frame)) {
        event_mask_ |= 1U << PC_EVENT_RENDER_FAILED;
        engine_->Cancel(session_id_);
        phase_ = PC_PHASE_IDLE;
        clear_pending_ = true;
    } else {
        phase_ = frame.phase;
    }
    DrainEventsLocked();
    if (needs_draw && (phase_ == PC_PHASE_DRAGGING || phase_ == PC_PHASE_SETTLING_COMPLETE ||
        phase_ == PC_PHASE_SETTLING_CANCEL)) RequestFrameLocked();
    if (!pending_page_uploads_.empty()) RequestFrameLocked();
    if (clear_pending_) RequestFrameLocked();
}

void PageCurlNativeHost::RequestFrameLocked()
{
    if (vsync_ == nullptr || frame_requested_) return;
    if (OH_NativeVSync_RequestFrame(vsync_, OnVSync, this) == 0) frame_requested_ = true;
}

void PageCurlNativeHost::DrainEventsLocked()
{
    pc_event event {};
    event.header = Header(sizeof(pc_event));
    while (engine_->PollEvent(event)) {
        event_mask_ |= 1U << event.type;
        if (event.type == PC_EVENT_TURN_CANCELLED) {
            // A settled rollback ends the renderer's current/target role
            // ownership inside the Engine, without going through Cancel().
            // Clear on the following VSync so those old keys stop being LRU
            // protected before the idle previous/current/next window uploads
            // its next composed textures.
            clear_pending_ = true;
        }
        event.header = Header(sizeof(pc_event));
    }
}

bool PageCurlNativeHost::CopyPixelMap(napi_env env, napi_value value, PixelBuffer& output)
{
    if (env == nullptr || value == nullptr) return false;
    NativePixelMap* native = OH_PixelMap_InitNativePixelMap(env, value);
    if (native == nullptr) return false;
    OhosPixelMapInfos info {};
    constexpr int32_t kRgba8888PixelFormat = 3;
    if (OH_PixelMap_GetImageInfo(native, &info) != 0 || info.width == 0 || info.height == 0 ||
        info.rowSize < info.width * 4 || info.pixelFormat != kRgba8888PixelFormat) return false;
    void* address = nullptr;
    if (OH_PixelMap_AccessPixels(native, &address) != 0 || address == nullptr) return false;
    output.width = info.width;
    output.height = info.height;
    output.rgba.resize(static_cast<size_t>(info.width) * info.height * 4);
    const auto* source = static_cast<const uint8_t*>(address);
    const size_t target_row = static_cast<size_t>(info.width) * 4;
    for (uint32_t row = 0; row < info.height; ++row) {
        std::memcpy(output.rgba.data() + static_cast<size_t>(row) * target_row,
            source + static_cast<size_t>(row) * info.rowSize, target_row);
    }
    OH_PixelMap_UnAccessPixels(native);
    return output.IsValid();
}

} // namespace reader::pagecurl
