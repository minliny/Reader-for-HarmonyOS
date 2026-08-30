// Host-test stand-in for the HarmonyOS <hilog/log.h> (SDK-only header).
// Records call counts; never formats. Only the macros bookturn_host.cpp
// consumes are provided. The device build keeps using the real SDK header:
// this directory is only added to the include path by the host test recipe.
#ifndef READER_TEST_MOCKSDK_HILOG_LOG_H
#define READER_TEST_MOCKSDK_HILOG_LOG_H

namespace bookturntest {
void LogInfo(const char* fmt, ...);
void LogWarn(const char* fmt, ...);
int InfoCount();
int WarnCount();
void ResetLogCounts();
}  // namespace bookturntest

#define OH_LOG_INFO(type, ...) bookturntest::LogInfo(__VA_ARGS__)
#define OH_LOG_WARN(type, ...) bookturntest::LogWarn(__VA_ARGS__)

#endif  // READER_TEST_MOCKSDK_HILOG_LOG_H
