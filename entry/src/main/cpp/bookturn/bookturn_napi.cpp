#include "bookturn_host.h"
#include "bookturn_trace.h"

#include <ace/xcomponent/native_interface_xcomponent.h>
#include <multimedia/image_framework/image/pixelmap_native.h>
#include <napi/native_api.h>
#include <node_api.h>

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

namespace reader::bookturn {
namespace {

constexpr uint64_t kMaximumTexturePixels = 3'000'000ULL;

struct CallbackBridge;

struct EventPayload {
    HostEvent event;
    uint64_t generation;
    int32_t detail;
    uint64_t surfaceEpoch;
    std::weak_ptr<BookTurnHost> host;
    std::weak_ptr<CallbackBridge> bridge;
};

struct CallbackBridge {
    std::atomic<bool> active { true };
    napi_threadsafe_function function = nullptr;
    ~CallbackBridge()
    {
        if (function != nullptr) napi_release_threadsafe_function(function, napi_tsfn_abort);
    }
};

std::mutex g_registryMutex;
std::unordered_map<std::string, std::shared_ptr<BookTurnHost>> g_hosts;
std::unordered_map<std::string, std::shared_ptr<CallbackBridge>> g_callbacks;

std::string ComponentId(OH_NativeXComponent* component)
{
    if (component == nullptr) return {};
    char id[OH_XCOMPONENT_ID_LEN_MAX + 1] = {};
    uint64_t size = sizeof(id);
    if (OH_NativeXComponent_GetXComponentId(component, id, &size) != OH_NATIVEXCOMPONENT_RESULT_SUCCESS) {
        return {};
    }
    return std::string(id);
}

std::shared_ptr<BookTurnHost> HostForId(const std::string& id, bool create = false)
{
    if (id.empty()) return nullptr;
    std::lock_guard<std::mutex> lock(g_registryMutex);
    const auto found = g_hosts.find(id);
    if (found != g_hosts.end()) return found->second;
    if (!create) return nullptr;
    auto host = std::make_shared<BookTurnHost>();
    g_hosts.emplace(id, host);
    return host;
}

void OnSurfaceCreated(OH_NativeXComponent* component, void* window)
{
    const std::shared_ptr<BookTurnHost> host = HostForId(ComponentId(component), true);
    if (host == nullptr) return;
    uint64_t width = 0;
    uint64_t height = 0;
    OH_NativeXComponent_GetXComponentSize(component, window, &width, &height);
    host->AttachSurface(window, width, height);
}

void OnSurfaceChanged(OH_NativeXComponent* component, void* window)
{
    const std::shared_ptr<BookTurnHost> host = HostForId(ComponentId(component));
    if (host == nullptr) return;
    uint64_t width = 0;
    uint64_t height = 0;
    OH_NativeXComponent_GetXComponentSize(component, window, &width, &height);
    host->ResizeSurface(width, height);
}

void OnSurfaceDestroyed(OH_NativeXComponent* component, void*)
{
    const std::shared_ptr<BookTurnHost> host = HostForId(ComponentId(component));
    if (host != nullptr) host->DetachSurface();
}

OH_NativeXComponent_Callback g_xcomponentCallbacks {
    OnSurfaceCreated,
    OnSurfaceChanged,
    OnSurfaceDestroyed,
    // ReaderPageInteractionLayer is the sole raw input owner. Registering an
    // empty Native touch callback still admits XComponent into device event
    // dispatch on some releases, so the visual surface exposes none at all.
    nullptr,
};

bool GetString(napi_env env, napi_value value, std::string& result)
{
    size_t length = 0;
    if (napi_get_value_string_utf8(env, value, nullptr, 0, &length) != napi_ok) return false;
    std::vector<char> buffer(length + 1, 0);
    if (napi_get_value_string_utf8(env, value, buffer.data(), buffer.size(), &length) != napi_ok) return false;
    result.assign(buffer.data(), length);
    return true;
}

bool GetDouble(napi_env env, napi_value value, double& result)
{
    return napi_get_value_double(env, value, &result) == napi_ok;
}

bool GetInt32(napi_env env, napi_value value, int32_t& result)
{
    return napi_get_value_int32(env, value, &result) == napi_ok;
}

bool GetBool(napi_env env, napi_value value, bool& result)
{
    return napi_get_value_bool(env, value, &result) == napi_ok;
}

napi_value Undefined(napi_env env)
{
    napi_value result = nullptr;
    napi_get_undefined(env, &result);
    return result;
}

napi_value Boolean(napi_env env, bool value)
{
    napi_value result = nullptr;
    napi_get_boolean(env, value, &result);
    return result;
}

napi_value Uint32(napi_env env, uint32_t value)
{
    napi_value result = nullptr;
    napi_create_uint32(env, value, &result);
    return result;
}

napi_value Double(napi_env env, double value)
{
    napi_value result = nullptr;
    napi_create_double(env, value, &result);
    return result;
}

Direction DecodeDirection(int32_t value)
{
    return value < 0 ? Direction::NEXT : Direction::PREVIOUS;
}

bool ReadPixelMap(OH_PixelmapNative* pixelMap, TexturePayload& payload)
{
    const BookTurnTrace trace("ReaderBookTurn.CopyPixelMap");
    OH_Pixelmap_ImageInfo* info = nullptr;
    bool success = OH_PixelmapImageInfo_Create(&info) == IMAGE_SUCCESS && info != nullptr &&
        OH_PixelmapNative_GetImageInfo(pixelMap, info) == IMAGE_SUCCESS;
    uint32_t width = 0;
    uint32_t height = 0;
    uint32_t rowStride = 0;
    int32_t format = PIXEL_FORMAT_UNKNOWN;
    success = success && OH_PixelmapImageInfo_GetWidth(info, &width) == IMAGE_SUCCESS &&
        OH_PixelmapImageInfo_GetHeight(info, &height) == IMAGE_SUCCESS &&
        OH_PixelmapImageInfo_GetRowStride(info, &rowStride) == IMAGE_SUCCESS &&
        OH_PixelmapImageInfo_GetPixelFormat(info, &format) == IMAGE_SUCCESS;
    const bool supportedFormat = format == PIXEL_FORMAT_RGBA_8888 || format == PIXEL_FORMAT_BGRA_8888 ||
        format == PIXEL_FORMAT_RGB_565 || format == PIXEL_FORMAT_RGB_888;
    success = success && supportedFormat;
    const uint32_t sourceBytes = format == PIXEL_FORMAT_RGB_565 ? 2U :
        (format == PIXEL_FORMAT_RGB_888 ? 3U : 4U);
    if (rowStride == 0) rowStride = width * sourceBytes;
    const uint64_t pixelCount = static_cast<uint64_t>(width) * height;
    if (success && width > 0 && height > 0 && pixelCount <= kMaximumTexturePixels &&
        rowStride >= width * sourceBytes) {
        payload.pixels.resize(static_cast<size_t>(rowStride) * height);
        size_t bufferSize = payload.pixels.size();
        success = OH_PixelmapNative_ReadPixels(pixelMap, payload.pixels.data(), &bufferSize) == IMAGE_SUCCESS &&
            bufferSize >= payload.pixels.size();
    } else {
        success = false;
    }
    if (info != nullptr) OH_PixelmapImageInfo_Release(info);
    if (!success) return false;

    payload.width = width;
    payload.height = height;
    payload.rowStride = rowStride;
    payload.sourceFormat = format == PIXEL_FORMAT_BGRA_8888 ? TextureSourceFormat::BGRA_8888 :
        (format == PIXEL_FORMAT_RGB_565 ? TextureSourceFormat::RGB_565 :
        (format == PIXEL_FORMAT_RGB_888 ? TextureSourceFormat::RGB_888 : TextureSourceFormat::RGBA_8888));
    return true;
}

void CallJsEvent(napi_env env, napi_value jsCallback, void*, void* data)
{
    std::unique_ptr<EventPayload> payload(static_cast<EventPayload*>(data));
    if (env == nullptr || jsCallback == nullptr || payload == nullptr) return;
    const auto host = payload->host.lock();
    const auto bridge = payload->bridge.lock();
    if (host == nullptr || bridge == nullptr || !bridge->active.load(std::memory_order_acquire) ||
        payload->surfaceEpoch == 0 || host->SurfaceEpoch() != payload->surfaceEpoch) return;
    napi_value undefined = nullptr;
    napi_get_undefined(env, &undefined);
    napi_value arguments[3] = {};
    napi_create_int32(env, static_cast<int32_t>(payload->event), &arguments[0]);
    napi_create_double(env, static_cast<double>(payload->generation), &arguments[1]);
    napi_create_int32(env, payload->detail, &arguments[2]);
    napi_call_function(env, undefined, jsCallback, 3, arguments, nullptr);
}

napi_value Configure(napi_env env, napi_callback_info info)
{
    size_t count = 3;
    napi_value arguments[3] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    double width = 0;
    double height = 0;
    const std::shared_ptr<BookTurnHost> host = count == 3 && GetString(env, arguments[0], id) &&
        GetDouble(env, arguments[1], width) && GetDouble(env, arguments[2], height) ? HostForId(id) : nullptr;
    if (host == nullptr) return Boolean(env, false);
    host->Configure(static_cast<float>(width), static_cast<float>(height));
    return Boolean(env, true);
}

napi_value IsReady(napi_env env, napi_callback_info info)
{
    size_t count = 1;
    napi_value argument = nullptr;
    napi_get_cb_info(env, info, &count, &argument, nullptr, nullptr);
    std::string id;
    const std::shared_ptr<BookTurnHost> host = count == 1 && GetString(env, argument, id) ? HostForId(id) : nullptr;
    return Boolean(env, host != nullptr && host->IsReady());
}

napi_value ReadyMask(napi_env env, napi_callback_info info)
{
    size_t count = 1;
    napi_value argument = nullptr;
    napi_get_cb_info(env, info, &count, &argument, nullptr, nullptr);
    std::string id;
    const std::shared_ptr<BookTurnHost> host = count == 1 && GetString(env, argument, id) ? HostForId(id) : nullptr;
    return Uint32(env, host == nullptr ? 0 : host->ReadyMask());
}

napi_value CanStart(napi_env env, napi_callback_info info)
{
    size_t count = 2;
    napi_value arguments[2] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    int32_t direction = -1;
    const std::shared_ptr<BookTurnHost> host = count == 2 && GetString(env, arguments[0], id) &&
        GetInt32(env, arguments[1], direction) ? HostForId(id) : nullptr;
    return Boolean(env, host != nullptr && host->CanStart(DecodeDirection(direction)));
}

struct TextureCopyWork {
    napi_async_work work = nullptr;
    napi_deferred deferred = nullptr;
    napi_ref pixelMapRef = nullptr;
    napi_ref admissionRef = nullptr;
    OH_PixelmapNative* pixelMap = nullptr;
    std::shared_ptr<BookTurnHost> host;
    TexturePayload payload;
    bool copied = false;
};

void ReleaseTextureCopy(napi_env env, TextureCopyWork& request)
{
    if (request.pixelMap != nullptr) OH_PixelmapNative_Release(request.pixelMap);
    if (env == nullptr) return;
    if (request.pixelMapRef != nullptr) napi_delete_reference(env, request.pixelMapRef);
    if (request.admissionRef != nullptr) napi_delete_reference(env, request.admissionRef);
    if (request.work != nullptr) napi_delete_async_work(env, request.work);
}

void ExecuteTextureCopy(napi_env, void* data)
{
    auto& request = *static_cast<TextureCopyWork*>(data);
    // Native PixelMap ownership stays alive through completion. Only this
    // worker reads it; all NAPI values and calls stay on the event-loop thread.
    try { request.copied = ReadPixelMap(request.pixelMap, request.payload); }
    catch (...) { request.copied = false; }
}

void CompleteTextureCopy(napi_env env, napi_status status, void* data)
{
    std::unique_ptr<TextureCopyWork> request(static_cast<TextureCopyWork*>(data));
    bool admitted = false;
    if (env != nullptr && status == napi_ok && request->copied) {
        napi_value callback = nullptr;
        napi_value result = nullptr;
        if (napi_get_reference_value(env, request->admissionRef, &callback) == napi_ok &&
            napi_call_function(env, Undefined(env), callback, 0, nullptr, &result) == napi_ok) {
            GetBool(env, result, admitted);
        } else {
            bool pending = false;
            napi_is_exception_pending(env, &pending);
            if (pending) { napi_value error; napi_get_and_clear_last_exception(env, &error); }
        }
    }
    // Revalidate the ArkUI capture generation on the event loop BEFORE the
    // mailbox write. A new gesture, clock, layout or teardown discards work.
    // QueueTexture independently checks the original surface epoch and owner.
    const bool queued = admitted && request->host->QueueTexture(std::move(request->payload));
    if (env != nullptr) napi_resolve_deferred(env, request->deferred, Boolean(env, queued));
    ReleaseTextureCopy(env, *request);
}

napi_value UploadTexture(napi_env env, napi_callback_info info)
{
    auto request = std::make_unique<TextureCopyWork>();
    napi_value promise = nullptr;
    if (napi_create_promise(env, &request->deferred, &promise) != napi_ok) return Undefined(env);
    size_t count = 5;
    napi_value arguments[5] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    std::string identity;
    int32_t slot = -1;
    napi_valuetype admissionType = napi_undefined;
    const bool valid = count == 5 && GetString(env, arguments[0], id) && GetInt32(env, arguments[1], slot) &&
        slot >= 0 && slot <= 2 && GetString(env, arguments[3], identity) &&
        napi_typeof(env, arguments[4], &admissionType) == napi_ok && admissionType == napi_function;
    if (valid) request->host = HostForId(id);
    bool prepared = valid && request->host != nullptr;
    if (prepared) {
        request->payload.surfaceEpoch = request->host->SurfaceEpoch();
        request->payload.slot = static_cast<TextureSlot>(slot);
        request->payload.identity = std::move(identity);
        const BookTurnTrace trace("ReaderBookTurn.BindPixelMap");
        prepared = OH_PixelmapNative_ConvertPixelmapNativeFromNapi(env, arguments[2], &request->pixelMap) ==
            IMAGE_SUCCESS && request->pixelMap != nullptr &&
            napi_create_reference(env, arguments[2], 1, &request->pixelMapRef) == napi_ok &&
            napi_create_reference(env, arguments[4], 1, &request->admissionRef) == napi_ok;
    }
    napi_value name = nullptr;
    prepared = prepared && napi_create_string_utf8(env, "ReaderBookTurn.TextureCopy", NAPI_AUTO_LENGTH, &name) == napi_ok &&
        napi_create_async_work(env, nullptr, name, ExecuteTextureCopy, CompleteTextureCopy,
            request.get(), &request->work) == napi_ok && napi_queue_async_work(env, request->work) == napi_ok;
    if (!prepared) {
        napi_resolve_deferred(env, request->deferred, Boolean(env, false));
        ReleaseTextureCopy(env, *request);
    } else {
        request.release(); // complete owns cleanup, including stale/failed work
    }
    return promise;
}

napi_value UpdateInput(napi_env env, napi_callback_info info)
{
    size_t count = 11;
    napi_value arguments[11] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    double values[8] = {};
    int32_t direction = -1;
    bool vertical = false;
    if (count != 11 || !GetString(env, arguments[0], id) || !GetDouble(env, arguments[1], values[0]) ||
        !GetInt32(env, arguments[2], direction) || !GetBool(env, arguments[3], vertical)) {
        return Boolean(env, false);
    }
    for (size_t index = 4; index < count; ++index) {
        if (!GetDouble(env, arguments[index], values[index - 3])) return Boolean(env, false);
    }
    const std::shared_ptr<BookTurnHost> host = HostForId(id);
    if (host == nullptr) return Boolean(env, false);
    // Raw gesture sample only (contract V2 §5.3): the chased edge is native
    // state advanced on VSync, so ArkTS no longer sends edge/velocity fields.
    BookTurnSample sample;
    sample.generation = static_cast<uint64_t>(std::max(0.0, values[0]));
    sample.direction = DecodeDirection(direction);
    sample.verticalPrevious = vertical;
    sample.width = static_cast<float>(values[1]);
    sample.height = static_cast<float>(values[2]);
    sample.startX = static_cast<float>(values[3]);
    sample.startY = static_cast<float>(values[4]);
    sample.pointerX = static_cast<float>(values[5]);
    sample.pointerY = static_cast<float>(values[6]);
    sample.eventTimeNs = static_cast<int64_t>(values[7] * 1000000.0);
    return Boolean(env, host->UpdateInput(sample));
}

napi_value EndGesture(napi_env env, napi_callback_info info)
{
    size_t count = 12;
    napi_value arguments[12] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    double values[8] = {};
    int32_t direction = -1;
    bool vertical = false;
    if (count != 12 || !GetString(env, arguments[0], id) || !GetDouble(env, arguments[1], values[0]) ||
        !GetInt32(env, arguments[2], direction) || !GetBool(env, arguments[3], vertical)) {
        return Boolean(env, false);
    }
    for (size_t index = 4; index < 11; ++index) {
        if (!GetDouble(env, arguments[index], values[index - 3])) return Boolean(env, false);
    }
    const std::shared_ptr<BookTurnHost> host = HostForId(id);
    if (host == nullptr) return Boolean(env, false);
    // Raw gesture sample only (contract V2 §5.3): the chased edge is native
    // state advanced on VSync, so ArkTS no longer sends edge/velocity fields.
    BookTurnSample sample;
    sample.generation = static_cast<uint64_t>(std::max(0.0, values[0]));
    sample.direction = DecodeDirection(direction);
    sample.verticalPrevious = vertical;
    sample.width = static_cast<float>(values[1]);
    sample.height = static_cast<float>(values[2]);
    sample.startX = static_cast<float>(values[3]);
    sample.startY = static_cast<float>(values[4]);
    sample.pointerX = static_cast<float>(values[5]);
    sample.pointerY = static_cast<float>(values[6]);
    sample.eventTimeNs = static_cast<int64_t>(values[7] * 1000000.0);
    bool commit = false;
    if (!GetBool(env, arguments[11], commit)) return Boolean(env, false);
    return Boolean(env, host->EndGesture(sample, commit));
}

napi_value Regrab(napi_env env, napi_callback_info info)
{
    size_t count = 12;
    napi_value arguments[12] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    double values[8] = {};
    int32_t direction = -1;
    bool vertical = false;
    if (count != 12 || !GetString(env, arguments[0], id) || !GetDouble(env, arguments[1], values[0]) ||
        !GetInt32(env, arguments[2], direction) || !GetBool(env, arguments[3], vertical)) {
        return Undefined(env);
    }
    for (size_t index = 4; index < 11; ++index) {
        if (!GetDouble(env, arguments[index], values[index - 3])) return Undefined(env);
    }
    const std::shared_ptr<BookTurnHost> host = HostForId(id);
    if (host == nullptr) return Undefined(env);
    // Raw gesture sample only (contract V2 §5.3): the chased edge is native
    // state advanced on VSync, so ArkTS no longer sends edge/velocity fields.
    BookTurnSample sample;
    sample.generation = static_cast<uint64_t>(std::max(0.0, values[0]));
    sample.direction = DecodeDirection(direction);
    sample.verticalPrevious = vertical;
    sample.width = static_cast<float>(values[1]);
    sample.height = static_cast<float>(values[2]);
    sample.startX = static_cast<float>(values[3]);
    sample.startY = static_cast<float>(values[4]);
    sample.pointerX = static_cast<float>(values[5]);
    sample.pointerY = static_cast<float>(values[6]);
    sample.eventTimeNs = static_cast<int64_t>(values[7] * 1000000.0);
    double previousGeneration = 0;
    if (!GetDouble(env, arguments[11], previousGeneration)) return Undefined(env);
    const auto frame = host->Regrab(sample, static_cast<uint64_t>(previousGeneration));
    if (!frame.has_value()) return Undefined(env);
    napi_value result = nullptr;
    napi_create_object(env, &result);
    napi_set_named_property(env, result, "generation", Double(env, frame->generation));
    napi_set_named_property(env, result, "edgeX", Double(env, frame->edgeX));
    napi_set_named_property(env, result, "edgeY", Double(env, frame->edgeY));
    napi_set_named_property(env, result, "theta", Double(env, frame->theta));
    return result;
}

napi_value SetDynamicHighlights(napi_env env, napi_callback_info info)
{
    size_t count = 3;
    napi_value args[3] = {};
    napi_get_cb_info(env, info, &count, args, nullptr, nullptr);
    std::string id;
    reader::bookturn::DynamicHighlights highlights;
    uint32_t length = 0;
    if (count != 3 || !GetString(env, args[0], id) || !GetString(env, args[1], highlights.identity) ||
        napi_get_array_length(env, args[2], &length) != napi_ok || length % 8 != 0 || length > 64 * 8) return Boolean(env, false);
    for (uint32_t index = 0; index < length; index += 8) {
        std::array<float, 8> values {};
        for (uint32_t part = 0; part < 8; ++part) {
            napi_value value = nullptr;
            double number = 0;
            if (napi_get_element(env, args[2], index + part, &value) != napi_ok || !GetDouble(env, value, number) ||
                !std::isfinite(number) || number > 1.0 || number < (part == 7 ? -1.0 : 0.0)) return Boolean(env, false);
            values[part] = static_cast<float>(number);
        }
        if (values[2] <= values[0] || values[3] <= values[1]) return Boolean(env, false);
        highlights.rects.push_back({values[0], values[1], values[2], values[3]});
        highlights.colors.push_back({values[4], values[5], values[6], values[7]});
    }
    const auto host = HostForId(id);
    return Boolean(env, host != nullptr && host->SetDynamicHighlights(std::move(highlights)));
}

napi_value Settle(napi_env env, napi_callback_info info)
{
    size_t count = 3;
    napi_value arguments[3] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    double generation = 0;
    bool commit = false;
    const std::shared_ptr<BookTurnHost> host = count == 3 && GetString(env, arguments[0], id) &&
        GetDouble(env, arguments[1], generation) && GetBool(env, arguments[2], commit) ? HostForId(id) : nullptr;
    return Boolean(env, host != nullptr && host->Settle(static_cast<uint64_t>(generation), commit));
}

napi_value StartProgrammatic(napi_env env, napi_callback_info info)
{
    size_t count = 4;
    napi_value arguments[4] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    double generation = 0;
    int32_t direction = -1;
    bool rapid = false;
    if (count == 4 && !GetBool(env, arguments[3], rapid)) return Boolean(env, false);
    const std::shared_ptr<BookTurnHost> host = (count == 3 || count == 4) && GetString(env, arguments[0], id) &&
        GetDouble(env, arguments[1], generation) && GetInt32(env, arguments[2], direction) ? HostForId(id) : nullptr;
    return Boolean(env, host != nullptr &&
        host->StartProgrammatic(static_cast<uint64_t>(generation), DecodeDirection(direction), rapid));
}

napi_value CommitSlots(napi_env env, napi_callback_info info)
{
    size_t count = 3;
    napi_value arguments[3] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    double generation = 0;
    int32_t direction = -1;
    const std::shared_ptr<BookTurnHost> host = count == 3 && GetString(env, arguments[0], id) &&
        GetDouble(env, arguments[1], generation) && GetInt32(env, arguments[2], direction) ? HostForId(id) : nullptr;
    return Boolean(env, host != nullptr &&
        host->CommitSlots(static_cast<uint64_t>(generation), DecodeDirection(direction)));
}

napi_value RetainTerminalFrame(napi_env env, napi_callback_info info)
{
    size_t count = 2;
    napi_value arguments[2] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    double generation = 0;
    const std::shared_ptr<BookTurnHost> host = count == 2 && GetString(env, arguments[0], id) &&
        GetDouble(env, arguments[1], generation) ? HostForId(id) : nullptr;
    return Boolean(env, host != nullptr && host->RetainTerminalFrame(static_cast<uint64_t>(generation)));
}

napi_value ReleaseTerminalFrame(napi_env env, napi_callback_info info)
{
    size_t count = 2;
    napi_value arguments[2] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    double generation = 0;
    const std::shared_ptr<BookTurnHost> host = count == 2 && GetString(env, arguments[0], id) &&
        GetDouble(env, arguments[1], generation) ? HostForId(id) : nullptr;
    return Boolean(env, host != nullptr && host->ReleaseTerminalFrame(static_cast<uint64_t>(generation)));
}

napi_value ClearSurface(napi_env env, napi_callback_info info)
{
    size_t count = 2;
    napi_value arguments[2] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    double generation = 0;
    const std::shared_ptr<BookTurnHost> host = count == 2 && GetString(env, arguments[0], id) &&
        GetDouble(env, arguments[1], generation) ? HostForId(id) : nullptr;
    return Boolean(env, host != nullptr && host->ClearSurface(static_cast<uint64_t>(generation)));
}

napi_value RetainedTerminalGeneration(napi_env env, napi_callback_info info)
{
    size_t count = 1;
    napi_value arguments[1] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    const std::shared_ptr<BookTurnHost> host = count == 1 && GetString(env, arguments[0], id) ? HostForId(id) : nullptr;
    // Generations stay far below 2^53, so a double carries the uint64 exactly.
    return Double(env, host != nullptr ? static_cast<double>(host->RetainedTerminalGeneration()) : 0.0);
}

napi_value CommittedSlotsGeneration(napi_env env, napi_callback_info info)
{
    size_t count = 1;
    napi_value arguments[1] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    const std::shared_ptr<BookTurnHost> host = count == 1 && GetString(env, arguments[0], id) ? HostForId(id) : nullptr;
    // Generations stay far below 2^53, so a double carries the uint64 exactly.
    return Double(env, host != nullptr ? static_cast<double>(host->CommittedSlotsGeneration()) : 0.0);
}

napi_value CompletedTerminalGeneration(napi_env env, napi_callback_info info)
{
    size_t count = 1;
    napi_value arguments[1] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    const std::shared_ptr<BookTurnHost> host = count == 1 && GetString(env, arguments[0], id) ? HostForId(id) : nullptr;
    // Generations stay far below 2^53, so a double carries the uint64 exactly.
    return Double(env, host != nullptr ? static_cast<double>(host->CompletedTerminalGeneration()) : 0.0);
}

napi_value SetEventCallback(napi_env env, napi_callback_info info)
{
    size_t count = 2;
    napi_value arguments[2] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    napi_valuetype type = napi_undefined;
    if (count != 2 || !GetString(env, arguments[0], id) ||
        napi_typeof(env, arguments[1], &type) != napi_ok || type != napi_function) {
        return Boolean(env, false);
    }
    const std::shared_ptr<BookTurnHost> host = HostForId(id, true);
    auto bridge = std::make_shared<CallbackBridge>();
    napi_value resourceName = nullptr;
    napi_create_string_utf8(env, "reader.bookturn.events", NAPI_AUTO_LENGTH, &resourceName);
    if (napi_create_threadsafe_function(env, arguments[1], nullptr, resourceName, 0, 1,
        nullptr, nullptr, nullptr, CallJsEvent, &bridge->function) != napi_ok) {
        return Boolean(env, false);
    }
    {
        std::lock_guard<std::mutex> lock(g_registryMutex);
        const auto previous = g_callbacks.find(id);
        if (previous != g_callbacks.end()) previous->second->active.store(false, std::memory_order_release);
        g_callbacks[id] = bridge;
    }
    const std::weak_ptr<BookTurnHost> weakHost = host;
    host->SetEventCallback([bridge, weakHost](HostEvent event, uint64_t generation, int32_t detail, uint64_t surfaceEpoch) {
        if (!bridge->active.load(std::memory_order_acquire)) return;
        auto payload = std::make_unique<EventPayload>(EventPayload { event, generation, detail, surfaceEpoch, weakHost, bridge });
        if (napi_call_threadsafe_function(bridge->function, payload.get(), napi_tsfn_nonblocking) == napi_ok) {
            payload.release();
        }
    });
    return Boolean(env, true);
}

napi_value Init(napi_env env, napi_value exports)
{
    const napi_property_descriptor descriptors[] = {
        { "configure", nullptr, Configure, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "isReady", nullptr, IsReady, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "readyMask", nullptr, ReadyMask, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "canStart", nullptr, CanStart, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "uploadTexture", nullptr, UploadTexture, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "updateInput", nullptr, UpdateInput, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "regrab", nullptr, Regrab, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "endGesture", nullptr, EndGesture, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "setDynamicHighlights", nullptr, SetDynamicHighlights, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "settle", nullptr, Settle, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "startProgrammatic", nullptr, StartProgrammatic, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "commitSlots", nullptr, CommitSlots, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "retainTerminalFrame", nullptr, RetainTerminalFrame, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "releaseTerminalFrame", nullptr, ReleaseTerminalFrame, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "clearSurface", nullptr, ClearSurface, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "retainedTerminalGeneration", nullptr, RetainedTerminalGeneration, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "committedSlotsGeneration", nullptr, CommittedSlotsGeneration, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "completedTerminalGeneration", nullptr, CompletedTerminalGeneration, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "setEventCallback", nullptr, SetEventCallback, nullptr, nullptr, nullptr, napi_default, nullptr },
    };
    napi_define_properties(env, exports, sizeof(descriptors) / sizeof(descriptors[0]), descriptors);

    bool hasNativeComponent = false;
    if (napi_has_named_property(env, exports, OH_NATIVE_XCOMPONENT_OBJ, &hasNativeComponent) == napi_ok &&
        hasNativeComponent) {
        napi_value nativeValue = nullptr;
        OH_NativeXComponent* component = nullptr;
        if (napi_get_named_property(env, exports, OH_NATIVE_XCOMPONENT_OBJ, &nativeValue) == napi_ok &&
            napi_unwrap(env, nativeValue, reinterpret_cast<void**>(&component)) == napi_ok && component != nullptr) {
            HostForId(ComponentId(component), true);
            OH_NativeXComponent_RegisterCallback(component, &g_xcomponentCallbacks);
        }
    }
    return exports;
}

}  // namespace
}  // namespace reader::bookturn

NAPI_MODULE(reader_bookturn_napi, reader::bookturn::Init)
