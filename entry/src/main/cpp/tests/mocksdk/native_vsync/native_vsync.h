// Host-test stand-in for the HarmonyOS <native_vsync/native_vsync.h>
// (SDK-only header). RequestFrame records the latest callback so the test can
// drive VSync frames deterministically via PumpVsync. The device build keeps
// using the real SDK header.
#ifndef READER_TEST_MOCKSDK_NATIVE_VSYNC_H
#define READER_TEST_MOCKSDK_NATIVE_VSYNC_H

#ifdef __cplusplus
extern "C" {
#endif

typedef struct OH_NativeVSync OH_NativeVSync;
typedef void (*OH_NativeVSync_FrameCallback)(long long timestamp, void* data);

OH_NativeVSync* OH_NativeVSync_Create(const char* name, unsigned int length);
void OH_NativeVSync_Destroy(OH_NativeVSync* vsync);
int OH_NativeVSync_RequestFrame(OH_NativeVSync* vsync, OH_NativeVSync_FrameCallback callback, void* data);

#ifdef __cplusplus
}
#endif

namespace bookturntest {

// Invoke the latest requested frame callback once (test-side VSync tick).
void PumpVsync(long long timestampNs);
int RequestCount();
void ResetVsync();

}  // namespace bookturntest

#endif  // READER_TEST_MOCKSDK_NATIVE_VSYNC_H
