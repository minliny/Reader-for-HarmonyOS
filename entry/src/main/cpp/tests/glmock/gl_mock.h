// Shared log API for the glmock recording layer.
#ifndef READER_TEST_GLMOCK_MOCK_H
#define READER_TEST_GLMOCK_MOCK_H

#include <cstdint>
#include <vector>

namespace glmock {

struct Entry {
    const char* name;
    int64_t a;
    int64_t b;
};

void Reset();
const std::vector<Entry>& Log();
void Record(const char* name, int64_t a, int64_t b);

}  // namespace glmock

#endif  // READER_TEST_GLMOCK_MOCK_H
