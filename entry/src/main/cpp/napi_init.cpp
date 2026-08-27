#include "pagecurl/pagecurl_native_host.h"

#include <ace/xcomponent/native_interface_xcomponent.h>
#include <js_native_api.h>
#include <js_native_api_types.h>
#include <napi/native_api.h>

#include <cmath>
#include <string>

namespace reader::pagecurl {
namespace {
bool ReadNumber(napi_env env, napi_value value, double& output)
{
    return value != nullptr && napi_get_value_double(env, value, &output) == napi_ok && std::isfinite(output);
}

bool ReadBool(napi_env env, napi_value value, bool& output)
{
    return value != nullptr && napi_get_value_bool(env, value, &output) == napi_ok;
}

napi_value Bool(napi_env env, bool value)
{
    napi_value result = nullptr;
    napi_get_boolean(env, value, &result);
    return result;
}

napi_value Int(napi_env env, int32_t value)
{
    napi_value result = nullptr;
    napi_create_int32(env, value, &result);
    return result;
}

bool ReadString(napi_env env, napi_value value, std::string& output)
{
    if (value == nullptr) return false;
    size_t length = 0;
    if (napi_get_value_string_utf8(env, value, nullptr, 0, &length) != napi_ok || length == 0) return false;
    output.resize(length + 1);
    size_t copied = 0;
    if (napi_get_value_string_utf8(env, value, output.data(), length + 1, &copied) != napi_ok ||
        copied != length) return false;
    output.resize(length);
    return true;
}

napi_value PrimePage(napi_env env, napi_callback_info info)
{
    size_t count = 2;
    napi_value args[2] = {};
    napi_get_cb_info(env, info, &count, args, nullptr, nullptr);
    std::string texture_key;
    return Bool(env, count == 2 && ReadString(env, args[0], texture_key) &&
        PageCurlNativeHost::Instance().PrimePage(env, texture_key, args[1]));
}

napi_value IsPageReady(napi_env env, napi_callback_info info)
{
    size_t count = 1;
    napi_value arg = nullptr;
    napi_get_cb_info(env, info, &count, &arg, nullptr, nullptr);
    std::string texture_key;
    return Bool(env, count == 1 && ReadString(env, arg, texture_key) &&
        PageCurlNativeHost::Instance().IsPageReady(texture_key));
}

napi_value Prepare(napi_env env, napi_callback_info info)
{
    size_t count = 4;
    napi_value args[4] = {};
    napi_get_cb_info(env, info, &count, args, nullptr, nullptr);
    std::string moving_texture_key;
    std::string under_texture_key;
    double direction = 0;
    double session = 0;
    if (count != 4 || !ReadString(env, args[0], moving_texture_key) ||
        !ReadString(env, args[1], under_texture_key) || !ReadNumber(env, args[2], direction) ||
        !ReadNumber(env, args[3], session)) return Bool(env, false);
    const pc_direction native_direction = direction < 0 ? PC_DIRECTION_PREVIOUS : PC_DIRECTION_NEXT;
    return Bool(env, PageCurlNativeHost::Instance().Prepare(
        moving_texture_key, under_texture_key, native_direction, static_cast<pc_session_id>(session)));
}

napi_value PointerCall(napi_env env, napi_callback_info info, bool begin)
{
    size_t count = 4;
    napi_value args[4] = {};
    napi_get_cb_info(env, info, &count, args, nullptr, nullptr);
    double session = 0;
    double x = 0;
    double y = 0;
    double time_ms = 0;
    if (count != 4 || !ReadNumber(env, args[0], session) || !ReadNumber(env, args[1], x) ||
        !ReadNumber(env, args[2], y) || !ReadNumber(env, args[3], time_ms)) return Bool(env, false);
    const int64_t time_ns = static_cast<int64_t>(time_ms * 1'000'000.0);
    const bool result = begin ?
        PageCurlNativeHost::Instance().Begin(static_cast<pc_session_id>(session), x, y, time_ns) :
        PageCurlNativeHost::Instance().Update(static_cast<pc_session_id>(session), x, y, time_ns);
    return Bool(env, result);
}

napi_value Begin(napi_env env, napi_callback_info info)
{
    return PointerCall(env, info, true);
}

napi_value Update(napi_env env, napi_callback_info info)
{
    return PointerCall(env, info, false);
}

napi_value Release(napi_env env, napi_callback_info info)
{
    size_t count = 5;
    napi_value args[5] = {};
    napi_get_cb_info(env, info, &count, args, nullptr, nullptr);
    double session = 0;
    bool can_commit = false;
    double velocity_x = 0;
    double velocity_y = 0;
    double time_ms = 0;
    if (count != 5 || !ReadNumber(env, args[0], session) || !ReadBool(env, args[1], can_commit) ||
        !ReadNumber(env, args[2], velocity_x) || !ReadNumber(env, args[3], velocity_y) ||
        !ReadNumber(env, args[4], time_ms)) return Int(env, -1);
    return Int(env, PageCurlNativeHost::Instance().Release(
        static_cast<pc_session_id>(session), can_commit,
        static_cast<float>(velocity_x), static_cast<float>(velocity_y),
        static_cast<int64_t>(time_ms * 1'000'000.0)));
}

napi_value HostCommitted(napi_env env, napi_callback_info info)
{
    size_t count = 1;
    napi_value arg = nullptr;
    napi_get_cb_info(env, info, &count, &arg, nullptr, nullptr);
    double session = 0;
    return Bool(env, count == 1 && ReadNumber(env, arg, session) &&
        PageCurlNativeHost::Instance().HostCommitted(static_cast<pc_session_id>(session)));
}

napi_value HostPresented(napi_env env, napi_callback_info info)
{
    size_t count = 1;
    napi_value arg = nullptr;
    napi_get_cb_info(env, info, &count, &arg, nullptr, nullptr);
    double session = 0;
    return Bool(env, count == 1 && ReadNumber(env, arg, session) &&
        PageCurlNativeHost::Instance().HostPresented(static_cast<pc_session_id>(session)));
}

napi_value Cancel(napi_env env, napi_callback_info info)
{
    size_t count = 1;
    napi_value arg = nullptr;
    napi_get_cb_info(env, info, &count, &arg, nullptr, nullptr);
    double session = 0;
    if (count == 1 && ReadNumber(env, arg, session)) {
        PageCurlNativeHost::Instance().Cancel(static_cast<pc_session_id>(session));
    } else {
        PageCurlNativeHost::Instance().Cancel(0);
    }
    napi_value result = nullptr;
    napi_get_undefined(env, &result);
    return result;
}

napi_value GetStatus(napi_env env, napi_callback_info)
{
    napi_value result = nullptr;
    napi_create_object(env, &result);
    napi_value phase = nullptr;
    napi_value session = nullptr;
    napi_value events = nullptr;
    napi_create_int32(env, static_cast<int32_t>(PageCurlNativeHost::Instance().Phase()), &phase);
    napi_create_double(env, static_cast<double>(PageCurlNativeHost::Instance().SessionId()), &session);
    napi_create_uint32(env, PageCurlNativeHost::Instance().TakeEventMask(), &events);
    napi_set_named_property(env, result, "phase", phase);
    napi_set_named_property(env, result, "sessionId", session);
    napi_set_named_property(env, result, "eventMask", events);
    return result;
}

napi_value Init(napi_env env, napi_value exports)
{
    const napi_property_descriptor methods[] = {
        {"primePage", nullptr, PrimePage, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"isPageReady", nullptr, IsPageReady, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"prepare", nullptr, Prepare, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"begin", nullptr, Begin, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"updatePointer", nullptr, Update, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"release", nullptr, Release, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"hostCommitted", nullptr, HostCommitted, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"hostPresented", nullptr, HostPresented, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"cancel", nullptr, Cancel, nullptr, nullptr, nullptr, napi_default, nullptr},
        {"getStatus", nullptr, GetStatus, nullptr, nullptr, nullptr, napi_default, nullptr},
    };
    napi_define_properties(env, exports, sizeof(methods) / sizeof(methods[0]), methods);

    napi_value wrapped = nullptr;
    if (napi_get_named_property(env, exports, OH_NATIVE_XCOMPONENT_OBJ, &wrapped) == napi_ok) {
        OH_NativeXComponent* component = nullptr;
        if (napi_unwrap(env, wrapped, reinterpret_cast<void**>(&component)) == napi_ok) {
            PageCurlNativeHost::Instance().Register(component);
        }
    }
    return exports;
}
} // namespace

static napi_module module = {
    .nm_version = 1,
    .nm_flags = 0,
    .nm_filename = nullptr,
    .nm_register_func = Init,
    .nm_modname = "pagecurl",
    .nm_priv = nullptr,
    .reserved = {0},
};

extern "C" __attribute__((constructor)) void RegisterPageCurlModule()
{
    napi_module_register(&module);
}
} // namespace reader::pagecurl
