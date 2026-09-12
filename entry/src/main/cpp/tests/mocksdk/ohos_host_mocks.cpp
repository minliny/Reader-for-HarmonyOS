// Implementations behind the host-test SDK mocks (hilog / native_vsync / qos).
// Linked only into host-level native tests; never part of the HAP build.
#include "hilog/log.h"
#include "native_vsync/native_vsync.h"
#include "qos/qos.h"

#include <cstdarg>
#include <mutex>

namespace {

std::mutex g_logMutex;
int g_infoCount = 0;
int g_warnCount = 0;

std::mutex g_vsyncMutex;
OH_NativeVSync_FrameCallback g_frameCallback = nullptr;
void* g_frameData = nullptr;
int g_requestCount = 0;

}  // namespace

namespace bookturntest {

void LogInfo(const char*, ...)
{
    std::lock_guard<std::mutex> lock(g_logMutex);
    ++g_infoCount;
}

void LogWarn(const char*, ...)
{
    std::lock_guard<std::mutex> lock(g_logMutex);
    ++g_warnCount;
}

int InfoCount()
{
    std::lock_guard<std::mutex> lock(g_logMutex);
    return g_infoCount;
}

int WarnCount()
{
    std::lock_guard<std::mutex> lock(g_logMutex);
    return g_warnCount;
}

void ResetLogCounts()
{
    std::lock_guard<std::mutex> lock(g_logMutex);
    g_infoCount = 0;
    g_warnCount = 0;
}

void PumpVsync(long long timestampNs)
{
    OH_NativeVSync_FrameCallback callback = nullptr;
    void* data = nullptr;
    {
        std::lock_guard<std::mutex> lock(g_vsyncMutex);
        callback = g_frameCallback;
        data = g_frameData;
        g_frameCallback = nullptr;
        g_frameData = nullptr;
    }
    if (callback != nullptr) callback(timestampNs, data);
}

int RequestCount()
{
    std::lock_guard<std::mutex> lock(g_vsyncMutex);
    return g_requestCount;
}

void ResetVsync()
{
    std::lock_guard<std::mutex> lock(g_vsyncMutex);
    g_frameCallback = nullptr;
    g_frameData = nullptr;
    g_requestCount = 0;
}

}  // namespace bookturntest

OH_NativeVSync* OH_NativeVSync_Create(const char*, unsigned int)
{
    return reinterpret_cast<OH_NativeVSync*>(0x1);
}

void OH_NativeVSync_Destroy(OH_NativeVSync*) { bookturntest::ResetVsync(); }

int OH_NativeVSync_RequestFrame(OH_NativeVSync*, OH_NativeVSync_FrameCallback callback, void* data)
{
    std::lock_guard<std::mutex> lock(g_vsyncMutex);
    g_frameCallback = callback;
    g_frameData = data;
    ++g_requestCount;
    return 0;
}

int OH_QoS_SetThreadQoS(QoS_Level)
{
    return 0;
}
