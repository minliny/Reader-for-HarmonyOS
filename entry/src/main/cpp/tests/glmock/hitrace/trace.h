// Host-only no-op tracing. The actual NDK implementation is linked in the HAP.
#ifndef READER_TEST_TRACE_H
#define READER_TEST_TRACE_H
inline void OH_HiTrace_StartTrace(const char*) {}
inline void OH_HiTrace_FinishTrace() {}
#endif
