#include "reader_core.h"

#include "napi/native_api.h"

#include <chrono>
#include <condition_variable>
#include <cstring>
#include <mutex>
#include <string>

namespace {

// CapturedEvent is a minimal thread-safe sink that retains the FIRST event
// Core emits for a given command. Core's v1 protocol guarantees one terminal
// event per request for core.info / runtime.ping / unknown method, and emits a
// host.request event first for runtime.hostSmoke — so capturing the first event
// is enough for the NAPI runtime smoke (toolchain + ABI + protocol shape).
struct CapturedEvent {
    std::mutex mutex;
    std::condition_variable cv;
    std::string json;
};

void CaptureEvent(void *context, const uint8_t *json, size_t json_length)
{
    auto *captured = static_cast<CapturedEvent *>(context);
    {
        std::lock_guard<std::mutex> lock(captured->mutex);
        // Only keep the first event; later events (e.g. the result that
        // eventually follows a host.request once the host completes it) are
        // not needed for the smoke and are dropped on the floor here.
        if (captured->json.empty()) {
            captured->json.assign(reinterpret_cast<const char *>(json), json_length);
        }
    }
    captured->cv.notify_one();
}

napi_value ThrowError(napi_env env, const char *message)
{
    napi_throw_error(env, nullptr, message);
    return nullptr;
}

// Send a JSON command to a freshly-created Core runtime and return the JSON of
// the first event Core emits back. Throws a JS error on any C ABI failure or if
// no event arrives within the timeout. This is the generic JSON-protocol entry
// point; the ArkTS bridge wraps it for core.info / runtime.ping / unknown
// method / runtime.hostSmoke.
napi_value SendJsonCommand(napi_env env, napi_callback_info info)
{
    size_t argc = 1;
    napi_value args[1] = { nullptr };
    napi_status status = napi_get_cb_info(env, info, &argc, args, nullptr, nullptr);
    if (status != napi_ok || argc < 1) {
        return ThrowError(env, "sendJsonCommand requires a command string");
    }

    size_t command_length = 0;
    status = napi_get_value_string_utf8(env, args[0], nullptr, 0, &command_length);
    if (status != napi_ok) {
        return ThrowError(env, "sendJsonCommand: command must be a string");
    }
    std::string command(command_length, '\0');
    status = napi_get_value_string_utf8(env, args[0], &command[0], command_length + 1, &command_length);
    if (status != napi_ok) {
        return ThrowError(env, "sendJsonCommand: failed to read command string");
    }

    CapturedEvent captured;
    rc_runtime_t *runtime = nullptr;
    const char *config = "{}";
    int32_t code = rc_runtime_create(reinterpret_cast<const uint8_t *>(config), std::strlen(config), CaptureEvent,
        &captured, &runtime);
    if (code != 0 || runtime == nullptr) {
        return ThrowError(env, "rc_runtime_create failed");
    }

    code = rc_runtime_send(runtime, reinterpret_cast<const uint8_t *>(command.data()), command.size());
    if (code != 0) {
        rc_runtime_destroy(runtime);
        return ThrowError(env, "rc_runtime_send failed");
    }

    {
        std::unique_lock<std::mutex> lock(captured.mutex);
        captured.cv.wait_for(lock, std::chrono::seconds(2), [&captured] { return !captured.json.empty(); });
    }

    rc_runtime_destroy(runtime);

    if (captured.json.empty()) {
        return ThrowError(env, "sendJsonCommand: no event captured within timeout");
    }

    napi_value result = nullptr;
    status = napi_create_string_utf8(env, captured.json.c_str(), captured.json.size(), &result);
    if (status != napi_ok) {
        return ThrowError(env, "sendJsonCommand: failed to create result value");
    }
    return result;
}

napi_value AbiVersion(napi_env env, napi_callback_info /*info*/)
{
    napi_value result = nullptr;
    napi_status status = napi_create_uint32(env, rc_abi_version(), &result);
    if (status != napi_ok) {
        return ThrowError(env, "failed to create ABI version value");
    }
    return result;
}

// Legacy convenience: send core.ping and return the first event JSON. Kept so
// the existing FFI/Harmony smoke binaries and the POC validator can keep
// proving ABI loadability while the bridge migrates to runtime.ping.
napi_value PingSmoke(napi_env env, napi_callback_info /*info*/)
{
    CapturedEvent captured;
    rc_runtime_t *runtime = nullptr;
    const char *config = "{}";
    int32_t code = rc_runtime_create(reinterpret_cast<const uint8_t *>(config), std::strlen(config), CaptureEvent,
        &captured, &runtime);
    if (code != 0 || runtime == nullptr) {
        return ThrowError(env, "rc_runtime_create failed");
    }

    const char *command = "{\"protocolVersion\":1,\"requestId\":42,\"method\":\"core.ping\",\"params\":{}}";
    code = rc_runtime_send(runtime, reinterpret_cast<const uint8_t *>(command), std::strlen(command));
    if (code != 0) {
        rc_runtime_destroy(runtime);
        return ThrowError(env, "rc_runtime_send failed");
    }

    {
        std::unique_lock<std::mutex> lock(captured.mutex);
        captured.cv.wait_for(lock, std::chrono::seconds(1), [&captured] { return !captured.json.empty(); });
    }

    rc_runtime_destroy(runtime);

    if (captured.json.empty()) {
        return ThrowError(env, "no event captured");
    }

    napi_value result = nullptr;
    napi_status status = napi_create_string_utf8(env, captured.json.c_str(), captured.json.size(), &result);
    if (status != napi_ok) {
        return ThrowError(env, "failed to create ping result value");
    }
    return result;
}

napi_value Init(napi_env env, napi_value exports)
{
    napi_property_descriptor desc[] = {
        { "abiVersion", nullptr, AbiVersion, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "pingSmoke", nullptr, PingSmoke, nullptr, nullptr, nullptr, napi_default, nullptr },
        { "sendJsonCommand", nullptr, SendJsonCommand, nullptr, nullptr, nullptr, napi_default, nullptr },
    };
    napi_status status = napi_define_properties(env, exports, sizeof(desc) / sizeof(desc[0]), desc);
    if (status != napi_ok) {
        return ThrowError(env, "failed to define reader_core_napi exports");
    }
    return exports;
}

} // namespace

static napi_module readerCoreModule = {
    .nm_version = 1,
    .nm_flags = 0,
    .nm_filename = nullptr,
    .nm_register_func = Init,
    .nm_modname = "reader_core_napi",
    .nm_priv = nullptr,
    .reserved = { 0 },
};

extern "C" __attribute__((constructor)) void RegisterReaderCoreNapiModule(void)
{
    napi_module_register(&readerCoreModule);
}
