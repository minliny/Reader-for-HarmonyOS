#include "bookturn_host.h"

#include <ace/xcomponent/native_interface_xcomponent.h>
#include <multimedia/image_framework/image/pixelmap_native.h>
#include <napi/native_api.h>
#include <node_api.h>

#include <algorithm>
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

struct EventPayload {
    HostEvent event;
    uint64_t generation;
    int32_t detail;
};

struct CallbackBridge {
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

Direction DecodeDirection(int32_t value)
{
    return value < 0 ? Direction::NEXT : Direction::PREVIOUS;
}

bool ReadPixelMap(napi_env env, napi_value value, TexturePayload& payload)
{
    OH_PixelmapNative* pixelMap = nullptr;
    if (OH_PixelmapNative_ConvertPixelmapNativeFromNapi(env, value, &pixelMap) != IMAGE_SUCCESS ||
        pixelMap == nullptr) {
        return false;
    }
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
    OH_PixelmapNative_Release(pixelMap);
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

napi_value UploadTexture(napi_env env, napi_callback_info info)
{
    size_t count = 4;
    napi_value arguments[4] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    std::string identity;
    int32_t slot = -1;
    if (count != 4 || !GetString(env, arguments[0], id) || !GetInt32(env, arguments[1], slot) ||
        slot < 0 || slot > 2 || !GetString(env, arguments[3], identity)) {
        return Boolean(env, false);
    }
    const std::shared_ptr<BookTurnHost> host = HostForId(id);
    if (host == nullptr) return Boolean(env, false);
    TexturePayload payload;
    payload.slot = static_cast<TextureSlot>(slot);
    payload.identity = std::move(identity);
    return Boolean(env, ReadPixelMap(env, arguments[2], payload) && host->QueueTexture(std::move(payload)));
}

napi_value UpdateInput(napi_env env, napi_callback_info info)
{
    size_t count = 14;
    napi_value arguments[14] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    double values[11] = {};
    int32_t direction = -1;
    bool vertical = false;
    if (count != 14 || !GetString(env, arguments[0], id) || !GetDouble(env, arguments[1], values[0]) ||
        !GetInt32(env, arguments[2], direction) || !GetBool(env, arguments[3], vertical)) {
        return Boolean(env, false);
    }
    for (size_t index = 4; index < count; ++index) {
        if (!GetDouble(env, arguments[index], values[index - 3])) return Boolean(env, false);
    }
    const std::shared_ptr<BookTurnHost> host = HostForId(id);
    if (host == nullptr) return Boolean(env, false);
    BookTurnInput input;
    input.generation = static_cast<uint64_t>(std::max(0.0, values[0]));
    input.direction = DecodeDirection(direction);
    input.verticalPrevious = vertical;
    input.width = static_cast<float>(values[1]);
    input.height = static_cast<float>(values[2]);
    input.start = { static_cast<float>(values[3]), static_cast<float>(values[4]) };
    input.pointer = { static_cast<float>(values[5]), static_cast<float>(values[6]) };
    input.edge = { static_cast<float>(values[7]), static_cast<float>(values[8]) };
    input.pointerVelocityX = static_cast<float>(values[9]);
    input.eventTimeNs = static_cast<int64_t>(values[10] * 1000000.0);
    return Boolean(env, host->UpdateInput(input));
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
    size_t count = 3;
    napi_value arguments[3] = {};
    napi_get_cb_info(env, info, &count, arguments, nullptr, nullptr);
    std::string id;
    double generation = 0;
    int32_t direction = -1;
    const std::shared_ptr<BookTurnHost> host = count == 3 && GetString(env, arguments[0], id) &&
        GetDouble(env, arguments[1], generation) && GetInt32(env, arguments[2], direction) ? HostForId(id) : nullptr;
    return Boolean(env, host != nullptr &&
        host->StartProgrammatic(static_cast<uint64_t>(generation), DecodeDirection(direction)));
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
        g_callbacks[id] = bridge;
    }
    host->SetEventCallback([bridge](HostEvent event, uint64_t generation, int32_t detail) {
        auto payload = std::make_unique<EventPayload>(EventPayload { event, generation, detail });
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
        { "settle", nullptr, Settle, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "startProgrammatic", nullptr, StartProgrammatic, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "commitSlots", nullptr, CommitSlots, nullptr, nullptr, nullptr, napi_default, nullptr },
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
