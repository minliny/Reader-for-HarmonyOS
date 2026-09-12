#ifndef READER_BOOKTURN_TRACE_H
#define READER_BOOKTURN_TRACE_H

#include <hitrace/trace.h>

namespace reader::bookturn {
// Static labels only. No book content, pointer coordinates or per-MOVE logging.
// These spans describe CPU work/submission; they do not prove GPU completion.
class BookTurnTrace final {
public:
    explicit BookTurnTrace(const char* name) { OH_HiTrace_StartTrace(name); }
    ~BookTurnTrace() { OH_HiTrace_FinishTrace(); }
    BookTurnTrace(const BookTurnTrace&) = delete;
    BookTurnTrace& operator=(const BookTurnTrace&) = delete;
};
} // namespace reader::bookturn
#endif
