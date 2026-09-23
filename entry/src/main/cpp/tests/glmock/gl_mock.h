// Shared log API for the glmock recording layer. Thread-safe by value copy:
// the host-level barrier test drives BookTurnHost on its render thread while
// the test thread reads the log.
#ifndef READER_TEST_GLMOCK_MOCK_H
#define READER_TEST_GLMOCK_MOCK_H

#include <cstdint>
#include <functional>
#include <vector>

namespace glmock {

struct Entry {
    const char* name;
    int64_t a;
    int64_t b;
};

void Reset();
void SetTextureUploadHook(std::function<void()> hook);
void SetSwapFailureCount(int count);
std::vector<Entry> Log();
void Record(const char* name, int64_t a, int64_t b);

}  // namespace glmock

#endif  // READER_TEST_GLMOCK_MOCK_H
