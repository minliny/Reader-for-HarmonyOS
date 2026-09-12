// ArkUI presentation barrier test (2026-08-31 five-line rework). Drives the
// real BookTurnHost on its render thread (glmock EGL/GL + mocked
// hilog/native_vsync/qos) and asserts the commit-order contract:
//
//   VISUAL_ENDPOINT < ARKUI_PROMOTE < ARKUI_PRESENTED < NATIVE_CLEAR
//
// A commit settlement must never clear the XComponent surface; the new-page
// terminal frame stays presented (retain) until the ArkUI presented
// confirmation releases the exact settlementGeneration. Stale confirmations,
// rollbacks, new gestures, detach and resize must never clear a newer
// generation's terminal frame.
//
// Build (from entry/src/main/cpp):
//   c++ -std=c++17 -O2 -Wall -Wextra -Werror \
//       -I bookturn -I tests/glmock -I tests/mocksdk \
//       tests/bookturn_present_barrier_test.cpp tests/mocksdk/ohos_host_mocks.cpp \
//       tests/glmock/gl_mock.cpp bookturn/bookturn_host.cpp bookturn/bookturn_motion.cpp \
//       bookturn/bookturn_renderer.cpp bookturn/bookturn_solver.cpp \
//       -o /tmp/bookturn_barrier_test
// Run:
//   /tmp/bookturn_barrier_test
#include "bookturn_host.h"

#include "gl_mock.h"
#include "hilog/log.h"
#include "native_vsync/native_vsync.h"

#include <atomic>
#include <chrono>
#include <cmath>
#include <condition_variable>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

using namespace reader::bookturn;

namespace {

int g_checks = 0;
int g_failures = 0;

void Check(const char* label, bool condition)
{
    ++g_checks;
    if (!condition) {
        ++g_failures;
        std::printf("FAIL %s\n", label);
    }
}

constexpr uint64_t kAnyGeneration = UINT64_MAX;
constexpr long long kVsyncIntervalNs = 16'600'000LL;

struct EventRecord {
    HostEvent event;
    uint64_t generation;
    int32_t detail;
    size_t glLogSize;
    uint64_t surfaceEpoch;
};

class EventSink {
public:
    void Push(HostEvent event, uint64_t generation, int32_t detail, uint64_t surfaceEpoch)
    {
        std::lock_guard<std::mutex> lock(mutex_);
        records_.push_back({ event, generation, detail, glmock::Log().size(), surfaceEpoch });
        condition_.notify_all();
    }

    bool WaitFor(HostEvent event, uint64_t generation, EventRecord& out, int timeoutMs)
    {
        const auto steadyClock = std::chrono::steady_clock::now();
        std::unique_lock<std::mutex> lock(mutex_);
        const auto found = [this, event, generation]() -> ptrdiff_t {
            for (size_t index = cursor_; index < records_.size(); ++index) {
                if (records_[index].event == event &&
                    (generation == kAnyGeneration || records_[index].generation == generation)) {
                    return static_cast<ptrdiff_t>(index);
                }
            }
            return -1;
        };
        if (found() < 0) {
            (void)condition_.wait_until(lock, steadyClock + std::chrono::milliseconds(timeoutMs), [&]() {
                return found() >= 0;
            });
        }
        const ptrdiff_t match = found();
        if (match < 0) return false;
        cursor_ = static_cast<size_t>(match) + 1;
        out = records_[static_cast<size_t>(match)];
        return true;
    }

private:
    std::mutex mutex_;
    std::condition_variable condition_;
    std::vector<EventRecord> records_;
    size_t cursor_ = 0;
};

size_t CountInRange(const std::vector<glmock::Entry>& log, const char* name, size_t begin, size_t end)
{
    size_t count = 0;
    for (size_t index = begin; index < end && index < log.size(); ++index) {
        if (std::strcmp(log[index].name, name) == 0) ++count;
    }
    return count;
}

// A bare clear is a glClear with no draw call in between. Cleanup must not
// submit a swap: the XComponent is already hidden and the next Draw overwrites
// this back buffer before presenting.
size_t CountBareClears(const std::vector<glmock::Entry>& log, size_t begin, size_t end)
{
    size_t count = 0;
    bool sawClear = false;
    bool sawDraw = false;
    for (size_t index = begin; index < end && index < log.size(); ++index) {
        const char* name = log[index].name;
        if (std::strcmp(name, "glClear") == 0) {
            sawClear = true;
        } else if (std::strcmp(name, "glDrawArrays") == 0 || std::strcmp(name, "glDrawElements") == 0) {
            sawDraw = true;
        } else if (std::strcmp(name, "eglSwapBuffers") == 0) {
            if (sawClear && !sawDraw) ++count;
            sawClear = false;
            sawDraw = false;
        }
    }
    return count;
}

bool PollUntil(const std::function<bool()>& predicate, int timeoutMs)
{
    const auto deadline = std::chrono::steady_clock::now() + std::chrono::milliseconds(timeoutMs);
    while (std::chrono::steady_clock::now() < deadline) {
        if (predicate()) return true;
        std::this_thread::sleep_for(std::chrono::milliseconds(2));
    }
    return predicate();
}

struct Fixture {
    EventSink sink;
    BookTurnHost host;
    long long vsyncTimeNs = 1'000'000'000LL;

    Fixture()
    {
        bookturntest::ResetVsync();
        host.SetEventCallback([this](HostEvent event, uint64_t generation, int32_t detail, uint64_t surfaceEpoch) {
            sink.Push(event, generation, detail, surfaceEpoch);
        });
    }

    bool AttachWithTextures()
    {
        host.AttachSurface(reinterpret_cast<void*>(0x10), 390, 780);
        EventRecord record {};
        if (!sink.WaitFor(HostEvent::SURFACE_READY, kAnyGeneration, record, 5000)) return false;
        QueuePageTextures("page-previous", "page-current", "page-next");
        // The worker may emit TEXTURE_READY after the first upload of the
        // batch; gate on the full slot mask, not on a single event.
        if (!sink.WaitFor(HostEvent::TEXTURE_READY, kAnyGeneration, record, 5000)) return false;
        return PollUntil([this]() { return (host.ReadyMask() & 7U) == 7U; }, 5000);
    }

    void QueuePageTextures(const char* previous, const char* current, const char* next)
    {
        { auto payload = MakePayload(TextureSlot::PREVIOUS, previous); payload.surfaceEpoch = host.SurfaceEpoch(); host.QueueTexture(std::move(payload)); }
        { auto payload = MakePayload(TextureSlot::CURRENT, current); payload.surfaceEpoch = host.SurfaceEpoch(); host.QueueTexture(std::move(payload)); }
        { auto payload = MakePayload(TextureSlot::NEXT, next); payload.surfaceEpoch = host.SurfaceEpoch(); host.QueueTexture(std::move(payload)); }
    }

    void UpdateInput(uint64_t generation, Direction direction, float pointerX)
    {
        BookTurnSample sample;
        sample.generation = generation;
        sample.direction = direction;
        sample.width = 390.0F;
        sample.height = 780.0F;
        sample.startX = direction == Direction::NEXT ? 390.0F : 0.0F;
        sample.startY = 390.0F;
        sample.pointerX = pointerX;
        sample.pointerY = 390.0F;
        sample.eventTimeNs = vsyncTimeNs;
        (void)host.UpdateInput(sample);
    }

    // Chase toward the far edge, then settle; pumps until the terminal event.
    // Real gaps between pumps let the render thread actually consume the
    // vsync ticks: a settle arriving before any chase frame would hit the
    // defensive rollback path (no active gesture) instead of committing.
    bool RunTurnTo(HostEvent terminal, uint64_t generation, Direction direction, EventRecord& out)
    {
        UpdateInput(generation, direction, direction == Direction::NEXT ? 20.0F : 370.0F);
        for (int frame = 0; frame < 40; ++frame) {
            PumpFrame();
            std::this_thread::sleep_for(std::chrono::milliseconds(2));
        }
        (void)host.Settle(generation, terminal == HostEvent::VISUAL_COMMIT_ENDPOINT);
        for (int frame = 0; frame < 200; ++frame) {
            PumpFrame();
            if (sink.WaitFor(terminal, generation, out, 10)) return true;
        }
        return false;
    }

    void PumpFrame()
    {
        bookturntest::PumpVsync(vsyncTimeNs);
        vsyncTimeNs += kVsyncIntervalNs;
    }

    static TexturePayload MakePayload(TextureSlot slot, const char* identity)
    {
        TexturePayload payload;
        payload.surfaceEpoch = 1;
        payload.slot = slot;
        payload.width = 8;
        payload.height = 8;
        payload.rowStride = 8 * 3;
        payload.sourceFormat = TextureSourceFormat::RGB_888;
        payload.identity = identity;
        payload.pixels.assign(static_cast<size_t>(8) * 8 * 3, 200);
        return payload;
    }
};

void AppendMarker(std::vector<const char*>& sequence, const char* marker)
{
    sequence.push_back(marker);
}

size_t MarkerIndex(const std::vector<const char*>& sequence, const char* marker)
{
    for (size_t index = 0; index < sequence.size(); ++index) {
        if (std::strcmp(sequence[index], marker) == 0) return index;
    }
    return sequence.size();
}

// The commit-order contract for one completed turn: nothing clears between
// the visual endpoint and the release, the release clears its back buffer
// without submitting a swap, and the retained generation returns to zero.
void AssertBarrierSequence(Fixture& fixture, uint64_t generation, EventRecord& endpoint,
    EventRecord& slotsCommitted, EventRecord& released, std::vector<const char*>& sequence)
{
    Check("endpoint retains terminal frame",
        PollUntil([&fixture, generation]() {
            return fixture.host.RetainedTerminalGeneration() == generation;
        }, 2000));
    AppendMarker(sequence, "VISUAL_ENDPOINT");

    AppendMarker(sequence, "ARKUI_PROMOTE");
    Check("commitSlots queued", fixture.host.CommitSlots(generation, Direction::NEXT));
    Check("slots committed", fixture.sink.WaitFor(HostEvent::SLOTS_COMMITTED, generation, slotsCommitted, 5000));
    const std::vector<glmock::Entry> logAtCommit = glmock::Log();
    Check("no clear between endpoint and slot commit",
        CountInRange(logAtCommit, "eglSwapBuffers", endpoint.glLogSize, slotsCommitted.glLogSize) == 0);
    Check("retention survives slot commit", fixture.host.RetainedTerminalGeneration() == generation);

    AppendMarker(sequence, "ARKUI_PRESENTED");
    Check("release accepted", fixture.host.ReleaseTerminalFrame(generation));
    Check("hidden clear queued", fixture.host.ClearSurface(generation));
    Check("terminal released", fixture.sink.WaitFor(HostEvent::TERMINAL_RELEASED, generation, released, 5000));
    const std::vector<glmock::Entry> logAtRelease = glmock::Log();
    Check("release submits no swap",
        CountInRange(logAtRelease, "eglSwapBuffers", slotsCommitted.glLogSize, released.glLogSize) == 0);
    Check("release window is a bare clear",
        CountInRange(logAtRelease, "glDrawArrays", slotsCommitted.glLogSize, released.glLogSize) == 0 &&
        CountInRange(logAtRelease, "glDrawElements", slotsCommitted.glLogSize, released.glLogSize) == 0 &&
        CountInRange(logAtRelease, "glClear", slotsCommitted.glLogSize, released.glLogSize) >= 1);
    Check("retention closed after release",
        PollUntil([&fixture]() { return fixture.host.RetainedTerminalGeneration() == 0; }, 2000));
    AppendMarker(sequence, "NATIVE_CLEAR");

    Check("endpoint before promote",
        MarkerIndex(sequence, "VISUAL_ENDPOINT") < MarkerIndex(sequence, "ARKUI_PROMOTE"));
    Check("promote before presented",
        MarkerIndex(sequence, "ARKUI_PROMOTE") < MarkerIndex(sequence, "ARKUI_PRESENTED"));
    Check("presented before native clear",
        MarkerIndex(sequence, "ARKUI_PRESENTED") < MarkerIndex(sequence, "NATIVE_CLEAR"));
}

void ScenarioSuccessfulNextTurn()
{
    std::printf("scenario: successful next turn\n");
    Fixture fixture;
    Check("attach with textures", fixture.AttachWithTextures());
    glmock::Reset();

    EventRecord endpoint {};
    EventRecord slotsCommitted {};
    EventRecord released {};
    std::vector<const char*> sequence;
    Check("turn reaches visual endpoint",
        fixture.RunTurnTo(HostEvent::VISUAL_COMMIT_ENDPOINT, 1, Direction::NEXT, endpoint));
    Check("endpoint generation matches", endpoint.generation == 1);
    AssertBarrierSequence(fixture, 1, endpoint, slotsCommitted, released, sequence);
}

void ScenarioPreviousTurn()
{
    std::printf("scenario: previous turn (reverse direction)\n");
    Fixture fixture;
    Check("attach with textures", fixture.AttachWithTextures());
    glmock::Reset();

    EventRecord endpoint {};
    EventRecord slotsCommitted {};
    EventRecord released {};
    std::vector<const char*> sequence;
    Check("previous turn reaches visual endpoint",
        fixture.RunTurnTo(HostEvent::VISUAL_COMMIT_ENDPOINT, 2, Direction::PREVIOUS, endpoint));
    Check("endpoint generation matches", endpoint.generation == 2);
    // The barrier is direction-symmetric; commit/release use PREVIOUS here.
    Check("endpoint retains terminal frame",
        PollUntil([&fixture]() { return fixture.host.RetainedTerminalGeneration() == 2; }, 2000));
    AppendMarker(sequence, "VISUAL_ENDPOINT");
    AppendMarker(sequence, "ARKUI_PROMOTE");
    Check("commitSlots queued", fixture.host.CommitSlots(2, Direction::PREVIOUS));
    Check("slots committed", fixture.sink.WaitFor(HostEvent::SLOTS_COMMITTED, 2, slotsCommitted, 5000));
    Check("no clear between endpoint and slot commit",
        CountInRange(glmock::Log(), "eglSwapBuffers", endpoint.glLogSize, slotsCommitted.glLogSize) == 0);
    AppendMarker(sequence, "ARKUI_PRESENTED");
    Check("release accepted", fixture.host.ReleaseTerminalFrame(2));
    Check("hidden clear queued", fixture.host.ClearSurface(2));
    Check("terminal released", fixture.sink.WaitFor(HostEvent::TERMINAL_RELEASED, 2, released, 5000));
    Check("release submits no swap",
        CountInRange(glmock::Log(), "eglSwapBuffers", slotsCommitted.glLogSize, released.glLogSize) == 0);
    AppendMarker(sequence, "NATIVE_CLEAR");
    Check("previous turn sequence ordered",
        MarkerIndex(sequence, "VISUAL_ENDPOINT") < MarkerIndex(sequence, "ARKUI_PROMOTE") &&
        MarkerIndex(sequence, "ARKUI_PROMOTE") < MarkerIndex(sequence, "ARKUI_PRESENTED") &&
        MarkerIndex(sequence, "ARKUI_PRESENTED") < MarkerIndex(sequence, "NATIVE_CLEAR"));
}

void ScenarioStaleConfirmations()
{
    std::printf("scenario: stale confirmations rejected\n");
    Fixture fixture;
    Check("attach with textures", fixture.AttachWithTextures());
    glmock::Reset();

    EventRecord endpoint {};
    Check("turn reaches visual endpoint",
        fixture.RunTurnTo(HostEvent::VISUAL_COMMIT_ENDPOINT, 3, Direction::NEXT, endpoint));
    EventRecord slotsCommitted {};
    Check("commitSlots queued", fixture.host.CommitSlots(3, Direction::NEXT));
    Check("slots committed", fixture.sink.WaitFor(HostEvent::SLOTS_COMMITTED, 3, slotsCommitted, 5000));

    Check("stale retain rejected", !fixture.host.RetainTerminalFrame(99));
    Check("zero generation rejected", !fixture.host.ReleaseTerminalFrame(0));
    Check("stale release rejected before any turn", !fixture.host.ReleaseTerminalFrame(99));
    Check("idempotent retain accepted", fixture.host.RetainTerminalFrame(3));
    Check("retention unchanged", fixture.host.RetainedTerminalGeneration() == 3);

    EventRecord released {};
    Check("release accepted", fixture.host.ReleaseTerminalFrame(3));
    Check("hidden clear queued", fixture.host.ClearSurface(3));
    Check("terminal released", fixture.sink.WaitFor(HostEvent::TERMINAL_RELEASED, 3, released, 5000));
    Check("release submits no swap",
        CountInRange(glmock::Log(), "eglSwapBuffers", slotsCommitted.glLogSize, released.glLogSize) == 0);
    Check("retention closed", fixture.host.RetainedTerminalGeneration() == 0);
}

void ScenarioRollback()
{
    std::printf("scenario: rollback clears after ArkUI restoration\n");
    Fixture fixture;
    Check("attach with textures", fixture.AttachWithTextures());
    glmock::Reset();

    EventRecord rollback {};
    Check("turn reaches rollback complete",
        fixture.RunTurnTo(HostEvent::ROLLBACK_COMPLETE, 4, Direction::NEXT, rollback));
    // ArkUI restores its page tree before hiding the XComponent and closing
    // the native barrier, exactly like a successful commit.
    Check("rollback retains terminal frame", fixture.host.RetainedTerminalGeneration() == 4);
    EventRecord strayEndpoint {};
    Check("no endpoint emitted",
        !fixture.sink.WaitFor(HostEvent::VISUAL_COMMIT_ENDPOINT, 4, strayEndpoint, 50));
    Check("rollback release accepted", fixture.host.ReleaseTerminalFrame(4));
    Check("rollback hidden clear queued", fixture.host.ClearSurface(4));
    EventRecord released {};
    Check("rollback terminal released", fixture.sink.WaitFor(HostEvent::TERMINAL_RELEASED, 4, released, 5000));
    Check("rollback cleared the surface",
        CountInRange(glmock::Log(), "eglSwapBuffers", rollback.glLogSize, released.glLogSize) == 0);
}

void ScenarioRapidConsecutiveTurns()
{
    std::printf("scenario: rapid consecutive turns, late stale release\n");
    Fixture fixture;
    Check("attach with textures", fixture.AttachWithTextures());
    glmock::Reset();

    // Turn A commits but ArkUI never confirms the presentation.
    EventRecord endpointA {};
    Check("turn A endpoint", fixture.RunTurnTo(HostEvent::VISUAL_COMMIT_ENDPOINT, 5, Direction::NEXT, endpointA));
    Check("commitSlots A", fixture.host.CommitSlots(5, Direction::NEXT));
    EventRecord slotsA {};
    Check("slots committed A", fixture.sink.WaitFor(HostEvent::SLOTS_COMMITTED, 5, slotsA, 5000));
    Check("turn A retained", fixture.host.RetainedTerminalGeneration() == 5);

    // A new transaction cannot steal a retained frame or replace its textures.
    Check("new programmatic request held by barrier", !fixture.host.StartProgrammatic(6, Direction::NEXT));
    Check("texture replacement held by barrier", !fixture.host.QueueTexture(Fixture::MakePayload(TextureSlot::CURRENT, "premature")));
    Check("release A", fixture.host.ReleaseTerminalFrame(5));
    Check("clear A", fixture.host.ClearSurface(5));
    EventRecord releasedA {};
    Check("A barrier closed", fixture.sink.WaitFor(HostEvent::TERMINAL_RELEASED, 5, releasedA, 5000));
    fixture.QueuePageTextures("page-previous-b", "page-current-b", "page-next-b");
    EventRecord textureReady {};
    Check("textures refreshed", fixture.sink.WaitFor(HostEvent::TEXTURE_READY, kAnyGeneration, textureReady, 5000) &&
        PollUntil([&fixture]() { return (fixture.host.ReadyMask() & 7U) == 7U; }, 5000));
    EventRecord endpointB {};
    Check("turn B endpoint", fixture.RunTurnTo(HostEvent::VISUAL_COMMIT_ENDPOINT, 6, Direction::NEXT, endpointB));
    Check("turn B retained", fixture.host.RetainedTerminalGeneration() == 6);
    Check("no bare clear during takeover",
        CountBareClears(glmock::Log(), slotsA.glLogSize, endpointB.glLogSize) == 0);

    // The late turn-A confirmation must never clear turn B's frame.
    Check("late stale release rejected", !fixture.host.ReleaseTerminalFrame(5));
    Check("turn B still retained", fixture.host.RetainedTerminalGeneration() == 6);
    EventRecord slotsB {};
    EventRecord releasedB {};
    Check("commitSlots B", fixture.host.CommitSlots(6, Direction::NEXT));
    Check("slots committed B", fixture.sink.WaitFor(HostEvent::SLOTS_COMMITTED, 6, slotsB, 5000));
    Check("release B accepted", fixture.host.ReleaseTerminalFrame(6));
    Check("hidden clear B queued", fixture.host.ClearSurface(6));
    Check("terminal released B", fixture.sink.WaitFor(HostEvent::TERMINAL_RELEASED, 6, releasedB, 5000));
    Check("turn B clear is the only swap",
        CountInRange(glmock::Log(), "eglSwapBuffers", slotsB.glLogSize, releasedB.glLogSize) == 0);
}

void ScenarioCrossChapterRefreshDuringRetention()
{
    std::printf("scenario: cross-chapter texture refresh during retention\n");
    Fixture fixture;
    Check("attach with textures", fixture.AttachWithTextures());
    glmock::Reset();

    EventRecord endpoint {};
    Check("turn endpoint", fixture.RunTurnTo(HostEvent::VISUAL_COMMIT_ENDPOINT, 7, Direction::NEXT, endpoint));
    Check("commitSlots", fixture.host.CommitSlots(7, Direction::NEXT));
    EventRecord slotsCommitted {};
    Check("slots committed", fixture.sink.WaitFor(HostEvent::SLOTS_COMMITTED, 7, slotsCommitted, 5000));

    Check("chapter texture held until presentation closes",
        !fixture.host.QueueTexture(Fixture::MakePayload(TextureSlot::CURRENT, "chapter-2-current")));
    Check("retention survives rejected refresh", fixture.host.RetainedTerminalGeneration() == 7);
    EventRecord released {};
    Check("release accepted", fixture.host.ReleaseTerminalFrame(7));
    Check("hidden clear queued", fixture.host.ClearSurface(7));
    Check("terminal released", fixture.sink.WaitFor(HostEvent::TERMINAL_RELEASED, 7, released, 5000));
    fixture.QueuePageTextures("chapter-2-previous", "chapter-2-current", "chapter-2-next");
    EventRecord textureReady {};
    Check("chapter textures uploaded after barrier",
        fixture.sink.WaitFor(HostEvent::TEXTURE_READY, kAnyGeneration, textureReady, 5000) &&
        PollUntil([&fixture]() { return (fixture.host.ReadyMask() & 7U) == 7U; }, 5000));
    Check("refresh never submits transparent frame",
        CountBareClears(glmock::Log(), slotsCommitted.glLogSize, textureReady.glLogSize) == 0);

}

void ScenarioSlowProgressStorage()
{
    std::printf("scenario: slow progress storage holds the terminal frame\n");
    Fixture fixture;
    Check("attach with textures", fixture.AttachWithTextures());
    glmock::Reset();

    EventRecord endpoint {};
    Check("turn endpoint", fixture.RunTurnTo(HostEvent::VISUAL_COMMIT_ENDPOINT, 8, Direction::NEXT, endpoint));
    Check("retained at endpoint", fixture.host.RetainedTerminalGeneration() == 8);

    // Simulate a slow Core progress write: a long dwell with no confirm.
    for (int frame = 0; frame < 12; ++frame) {
        fixture.PumpFrame();
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    Check("no clear during slow storage dwell",
        CountInRange(glmock::Log(), "eglSwapBuffers", endpoint.glLogSize, glmock::Log().size()) == 0);
    Check("retention survives the dwell", fixture.host.RetainedTerminalGeneration() == 8);

    EventRecord slotsCommitted {};
    EventRecord released {};
    Check("commitSlots after storage", fixture.host.CommitSlots(8, Direction::NEXT));
    Check("slots committed", fixture.sink.WaitFor(HostEvent::SLOTS_COMMITTED, 8, slotsCommitted, 5000));
    Check("release accepted after storage", fixture.host.ReleaseTerminalFrame(8));
    Check("hidden clear queued after storage", fixture.host.ClearSurface(8));
    Check("terminal released after storage",
        fixture.sink.WaitFor(HostEvent::TERMINAL_RELEASED, 8, released, 5000));
    Check("clear only after the confirmation",
        CountInRange(glmock::Log(), "eglSwapBuffers", endpoint.glLogSize, slotsCommitted.glLogSize) == 0 &&
        CountInRange(glmock::Log(), "eglSwapBuffers", slotsCommitted.glLogSize, released.glLogSize) == 0);
}

void ScenarioPresentationTimeout()
{
    std::printf("scenario: arkui presentation timeout keeps the terminal frame\n");
    bookturntest::ResetLogCounts();
    Fixture fixture;
    Check("attach with textures", fixture.AttachWithTextures());
    glmock::Reset();

    EventRecord endpoint {};
    Check("turn endpoint", fixture.RunTurnTo(HostEvent::VISUAL_COMMIT_ENDPOINT, 9, Direction::NEXT, endpoint));
    Check("commitSlots", fixture.host.CommitSlots(9, Direction::NEXT));
    EventRecord slotsCommitted {};
    Check("slots committed", fixture.sink.WaitFor(HostEvent::SLOTS_COMMITTED, 9, slotsCommitted, 5000));

    // BOOKTURN_RETAIN_TIMEOUT_MS=80 (set in main): the next render-thread
    // activity past the deadline must log the diagnostic and KEEP the frame.
    std::this_thread::sleep_for(std::chrono::milliseconds(150));
    Check("timeout retain probe", fixture.host.RetainTerminalFrame(9));
    Check("timeout diagnostic recorded", PollUntil([]() { return bookturntest::WarnCount() > 0; }, 1000));
    Check("safe degrade: frame still retained", fixture.host.RetainedTerminalGeneration() == 9);
    Check("timeout never clears",
        CountInRange(glmock::Log(), "eglSwapBuffers", slotsCommitted.glLogSize, glmock::Log().size()) == 0);

    // The late confirmation still closes the barrier cleanly.
    EventRecord released {};
    Check("late release accepted", fixture.host.ReleaseTerminalFrame(9));
    Check("hidden clear queued after timeout", fixture.host.ClearSurface(9));
    Check("terminal released", fixture.sink.WaitFor(HostEvent::TERMINAL_RELEASED, 9, released, 5000));
    Check("retention closed after timeout", fixture.host.RetainedTerminalGeneration() == 0);
}

void ScenarioPageExitAndReattach()
{
    std::printf("scenario: page exit (detach) and re-attach\n");
    Fixture fixture;
    Check("attach with textures", fixture.AttachWithTextures());
    glmock::Reset();

    EventRecord endpoint {};
    Check("turn endpoint", fixture.RunTurnTo(HostEvent::VISUAL_COMMIT_ENDPOINT, 10, Direction::NEXT, endpoint));
    Check("commitSlots", fixture.host.CommitSlots(10, Direction::NEXT));
    EventRecord slotsCommitted {};
    Check("slots committed", fixture.sink.WaitFor(HostEvent::SLOTS_COMMITTED, 10, slotsCommitted, 5000));
    Check("retained before exit", fixture.host.RetainedTerminalGeneration() == 10);

    // Page exit while retained: the surface is torn down; the hold resets.
    fixture.host.DetachSurface();
    EventRecord surfaceLost {};
    Check("surface lost", fixture.sink.WaitFor(HostEvent::SURFACE_LOST, kAnyGeneration, surfaceLost, 5000));
    Check("retention reset on detach", fixture.host.RetainedTerminalGeneration() == 0);

    // Re-attach runs a full turn through the same barrier.
    Check("reattach with textures", fixture.AttachWithTextures());
    glmock::Reset();
    EventRecord endpointB {};
    Check("turn endpoint after reattach",
        fixture.RunTurnTo(HostEvent::VISUAL_COMMIT_ENDPOINT, 11, Direction::NEXT, endpointB));
    EventRecord slotsCommittedB {};
    EventRecord releasedB {};
    Check("commitSlots after reattach", fixture.host.CommitSlots(11, Direction::NEXT));
    Check("slots committed after reattach",
        fixture.sink.WaitFor(HostEvent::SLOTS_COMMITTED, 11, slotsCommittedB, 5000));
    Check("release accepted after reattach", fixture.host.ReleaseTerminalFrame(11));
    Check("hidden clear queued after reattach", fixture.host.ClearSurface(11));
    Check("terminal released after reattach",
        fixture.sink.WaitFor(HostEvent::TERMINAL_RELEASED, 11, releasedB, 5000));
    Check("clear after reattach cycle",
        CountInRange(glmock::Log(), "eglSwapBuffers", slotsCommittedB.glLogSize, releasedB.glLogSize) == 0);
}

void ScenarioDetachDropsStaleMailbox()
{
    std::printf("scenario: detach drops stale surface mailbox work\n");
    Fixture fixture;

    // Queue a create, resize and texture payloads, then tear the surface down
    // before the worker is guaranteed to consume them.  The exact scheduling
    // is intentionally nondeterministic; the invariant is that no READY (or
    // renderable state) may appear after SURFACE_LOST for this lifecycle.
    fixture.host.AttachSurface(reinterpret_cast<void*>(0x10), 390, 780);
    fixture.host.ResizeSurface(320, 640);
    fixture.host.QueueTexture(Fixture::MakePayload(TextureSlot::CURRENT, "stale-current"));
    fixture.host.QueueTexture(Fixture::MakePayload(TextureSlot::NEXT, "stale-next"));
    fixture.host.DetachSurface();

    EventRecord surfaceLost {};
    Check("stale mailbox detach completes",
        fixture.sink.WaitFor(HostEvent::SURFACE_LOST, kAnyGeneration, surfaceLost, 5000));
    Check("stale mailbox leaves host not ready",
        PollUntil([&fixture]() { return !fixture.host.IsReady() && fixture.host.ReadyMask() == 0; }, 1000));
    EventRecord staleReady {};
    Check("stale attach does not resurrect surface",
        !fixture.sink.WaitFor(HostEvent::SURFACE_READY, kAnyGeneration, staleReady, 150));

    // A later create callback is a new request and must still be accepted.
    Check("fresh attach after stale boundary", fixture.AttachWithTextures());
}

void ScenarioWindowReflow()
{
    std::printf("scenario: window reflow during retention\n");
    Fixture fixture;
    Check("attach with textures", fixture.AttachWithTextures());
    glmock::Reset();

    EventRecord endpoint {};
    Check("turn endpoint", fixture.RunTurnTo(HostEvent::VISUAL_COMMIT_ENDPOINT, 12, Direction::NEXT, endpoint));
    Check("commitSlots", fixture.host.CommitSlots(12, Direction::NEXT));
    EventRecord slotsCommitted {};
    Check("slots committed", fixture.sink.WaitFor(HostEvent::SLOTS_COMMITTED, 12, slotsCommitted, 5000));

    // Window reflow while retained: resize must not clear or drop the hold.
    // (Resize emits no event; give the worker a moment, then assert.)
    fixture.host.ResizeSurface(300, 600);
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    Check("retention survives reflow", fixture.host.RetainedTerminalGeneration() == 12);
    Check("reflow never clears",
        CountInRange(glmock::Log(), "eglSwapBuffers", slotsCommitted.glLogSize, glmock::Log().size()) == 0);

    EventRecord released {};
    Check("release accepted", fixture.host.ReleaseTerminalFrame(12));
    Check("hidden clear queued", fixture.host.ClearSurface(12));
    Check("terminal released", fixture.sink.WaitFor(HostEvent::TERMINAL_RELEASED, 12, released, 5000));
    Check("clear after reflow",
        CountInRange(glmock::Log(), "eglSwapBuffers", slotsCommitted.glLogSize, released.glLogSize) == 0);
}

}  // namespace

void ScenarioAtomicEndAndQuietHold()
{
    Fixture fixture;
    Check("atomic attach", fixture.AttachWithTextures());
    BookTurnSample sample;
    sample.generation = 81; sample.direction = Direction::NEXT;
    sample.width = 390; sample.height = 780;
    sample.startX = 200; sample.startY = 390;
    sample.pointerX = 180; sample.pointerY = 390; sample.eventTimeNs = 1'000'000'000;
    Check("atomic first sample admitted", fixture.host.UpdateInput(sample));
    EventRecord frame {};
    for (int i = 0; i < 20; ++i) { fixture.PumpFrame(); if (fixture.sink.WaitFor(HostEvent::FRAME_PRESENTED, 81, frame, 10)) break; }
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
    const size_t beforeHold = glmock::Log().size();
    for (int i = 0; i < 30; ++i) { fixture.PumpFrame(); std::this_thread::sleep_for(std::chrono::milliseconds(1)); }
    Check("quiet hold does not render repeated frames", CountInRange(glmock::Log(), "eglSwapBuffers", beforeHold, glmock::Log().size()) == 0);
    sample.pointerX = -180; sample.eventTimeNs += 100'000'000;
    Check("atomic UP and commit accepted", fixture.host.EndGesture(sample, true));
    sample.pointerX = 190;
    Check("late MOVE rejected", !fixture.host.UpdateInput(sample));
    Check("duplicate UP rejected", !fixture.host.EndGesture(sample, true));
    Check("stale settle rejected", !fixture.host.Settle(80, false));
    EventRecord endpoint {};
    bool reached = false;
    for (int i = 0; i < 40; ++i) { fixture.PumpFrame(); if (fixture.sink.WaitFor(HostEvent::VISUAL_COMMIT_ENDPOINT, 81, endpoint, 10)) { reached = true; break; } }
    Check("atomic final sample reaches endpoint", reached);
    Check("source and destination preserved until commit", (fixture.host.ReadyMask() & 7U) == 7U);
}

void ScenarioRegrabSubmittedPose()
{
    Fixture fixture;
    Check("regrab attach", fixture.AttachWithTextures());
    BookTurnSample sample;
    sample.generation = 90; sample.direction = Direction::NEXT;
    sample.width = 390; sample.height = 780; sample.startX = 390; sample.startY = 100;
    sample.pointerX = 280; sample.pointerY = 360; sample.eventTimeNs = 1'000'000'000;
    Check("regrab initial input", fixture.host.UpdateInput(sample));
    EventRecord record {};
    for (int i = 0; i < 30; ++i) { fixture.PumpFrame(); if (fixture.sink.WaitFor(HostEvent::FRAME_PRESENTED, 90, record, 10)) break; }
    Check("regrab release", fixture.host.EndGesture(sample, true));
    for (int i = 0; i < 2; ++i) { fixture.PumpFrame(); std::this_thread::sleep_for(std::chrono::milliseconds(5)); }
    BookTurnSample grabbed = sample;
    grabbed.generation = 91; grabbed.startX = 100; grabbed.pointerX = 100;
    grabbed.startY = 650; grabbed.pointerY = 650;
    const auto before = fixture.host.Regrab(grabbed, 90);
    Check("regrab accepts before durable commit", before.has_value());
    Check("old MOVE cannot overwrite new pointer", !fixture.host.UpdateInput(sample));
    for (int i = 0; i < 30; ++i) { fixture.PumpFrame(); if (fixture.sink.WaitFor(HostEvent::FRAME_PRESENTED, 91, record, 10)) break; }
    // No VSync between end and the second grab: it reads the exact stationary
    // first re-grab frame, not an advanced rollback frame.
    Check("regrab cancel queues", fixture.host.EndGesture(grabbed, false));
    grabbed.generation = 92;
    const auto after = fixture.host.Regrab(grabbed, 91);
    Check("second grab reads the new frame", after.has_value());
    if (before.has_value() && after.has_value()) {
        Check("regrab preserves edge x", std::abs(before->edgeX - after->edgeX) < .001F);
        Check("regrab preserves edge y at another finger height", std::abs(before->edgeY - after->edgeY) < .001F);
        Check("regrab preserves visible tilt without second soft limit", std::abs(before->theta - after->theta) < .001F);
    }
}

void ScenarioSurfaceEpochRejectsOldCopy()
{
    Fixture fixture;
    Check("epoch attach", fixture.AttachWithTextures());
    auto oldCopy = Fixture::MakePayload(TextureSlot::CURRENT, "old-copy");
    oldCopy.surfaceEpoch = fixture.host.SurfaceEpoch();
    fixture.host.DetachSurface();
    Check("epoch replacement", fixture.AttachWithTextures());
    Check("old copied PixelMap is rejected after replacement", !fixture.host.QueueTexture(std::move(oldCopy)));
    Check("replacement readiness unchanged", (fixture.host.ReadyMask() & 7U) == 7U);
}


void ScenarioFailedReplacementInvalidatesOldPixels()
{
    Fixture fixture;
    Check("failed replacement attach", fixture.AttachWithTextures());
    auto payload = Fixture::MakePayload(TextureSlot::CURRENT, "bad-replacement");
    payload.surfaceEpoch = fixture.host.SurfaceEpoch();
    payload.pixels.resize(1); // Nonempty mailbox payload, invalid actual RGB extent.
    Check("bad replacement reaches render validation", fixture.host.QueueTexture(std::move(payload)));
    EventRecord failed {};
    Check("replacement failure reported", fixture.sink.WaitFor(HostEvent::RENDER_FAILURE, kAnyGeneration, failed, 5000));
    Check("failed replacement never re-admits old current", !fixture.host.CanStart(Direction::NEXT) &&
        !fixture.host.CanStart(Direction::PREVIOUS));
}

void ScenarioReplacementReadinessDuringUpload()
{
    Fixture fixture;
    Check("replacement race attach", fixture.AttachWithTextures());
    std::mutex gate;
    std::condition_variable condition;
    int entered = 0;
    int permitted = 0;
    glmock::SetTextureUploadHook([&]() {
        std::unique_lock<std::mutex> lock(gate);
        const int upload = ++entered;
        condition.notify_all();
        condition.wait(lock, [&]() { return permitted >= upload; });
    });
    auto queue = [&](TextureSlot slot, const char* identity) {
        auto payload = Fixture::MakePayload(slot, identity);
        payload.surfaceEpoch = fixture.host.SurfaceEpoch();
        return fixture.host.QueueTexture(std::move(payload));
    };
    auto waitUpload = [&](int value) {
        std::unique_lock<std::mutex> lock(gate);
        return condition.wait_for(lock, std::chrono::seconds(5), [&]() { return entered >= value; });
    };
    auto release = [&](int value) {
        std::lock_guard<std::mutex> lock(gate);
        permitted = value;
        condition.notify_all();
    };
    Check("previous replacement queued", queue(TextureSlot::PREVIOUS, "previous-new"));
    Check("previous upload entered", waitUpload(1));
    Check("current replacement queued during GL", queue(TextureSlot::CURRENT, "current-new"));
    Check("next replacement queued during GL", queue(TextureSlot::NEXT, "next-new"));
    release(1);
    Check("current upload entered", waitUpload(2));
    Check("other upload cannot resurrect pending current/next", (fixture.host.ReadyMask() & 6U) == 0);
    Check("old next pixels cannot admit a turn", !fixture.host.CanStart(Direction::NEXT));
    Check("newer current replacement queued during its upload", queue(TextureSlot::CURRENT, "current-newer"));
    release(2);
    Check("newest current upload entered", waitUpload(3));
    Check("same-slot upload cannot resurrect its superseded pixels", (fixture.host.ReadyMask() & 2U) == 0);
    release(3);
    Check("next upload entered", waitUpload(4));
    Check("pending next stays unavailable", !fixture.host.CanStart(Direction::NEXT));
    release(100);
    Check("all newest uploads finally ready", PollUntil([&]() { return (fixture.host.ReadyMask() & 7U) == 7U; }, 5000));
    glmock::SetTextureUploadHook({});
}


void ScenarioRapidProgrammaticCueRetainsBarrier()
{
    for (const auto direction : {Direction::NEXT, Direction::PREVIOUS}) {
        Fixture fixture;
        Check("rapid programmatic attach", fixture.AttachWithTextures());
        Check("rapid programmatic admitted", fixture.host.StartProgrammatic(100, direction, true));
        EventRecord endpoint {};
        bool reached = false;
        for (int frame = 0; frame < 6 && !reached; ++frame) {
            fixture.PumpFrame();
            reached = fixture.sink.WaitFor(HostEvent::VISUAL_COMMIT_ENDPOINT, 100, endpoint, 20);
        }
        Check("rapid cue completes within bounded display ticks", reached);
        Check("rapid endpoint still retained", fixture.host.RetainedTerminalGeneration() == 100);
        Check("rapid successor cannot bypass retained barrier", !fixture.host.StartProgrammatic(101, direction, true));
        EventRecord slots {}, released {};
        Check("rapid slots commit admitted", fixture.host.CommitSlots(100, direction));
        Check("rapid slots committed", fixture.sink.WaitFor(HostEvent::SLOTS_COMMITTED, 100, slots, 5000));
        Check("rapid release admitted", fixture.host.ReleaseTerminalFrame(100));
        Check("rapid clear admitted", fixture.host.ClearSurface(100));
        Check("rapid release receipt", fixture.sink.WaitFor(HostEvent::TERMINAL_RELEASED, 100, released, 5000));
        Check("rapid hidden clear submits no transparent swap",
            CountInRange(glmock::Log(), "eglSwapBuffers", slots.glLogSize, released.glLogSize) == 0);
    }
}

void ScenarioHighlightDeduplication()
{
    Fixture fixture;
    Check("highlight attach", fixture.AttachWithTextures());
    auto park = [&](uint64_t generation) {
        fixture.UpdateInput(generation, Direction::NEXT, 280);
        for (int frame = 0; frame < 25; ++frame) {
            fixture.PumpFrame(); std::this_thread::sleep_for(std::chrono::milliseconds(2));
        }
    };
    auto pump = [&]() {
        for (int frame = 0; frame < 15; ++frame) {
            fixture.PumpFrame(); std::this_thread::sleep_for(std::chrono::milliseconds(2));
        }
    };
    auto marks = [](bool empty) {
        DynamicHighlights value;
        value.identity = "page-current";
        if (!empty) { value.rects.push_back({.1F, .1F, .3F, .2F}); value.colors.push_back({.2F, .3F, .4F, -.2F}); }
        return value;
    };
    park(120);
    size_t begin = glmock::Log().size();
    Check("first marks accepted", fixture.host.SetDynamicHighlights(marks(false)));
    pump();
    Check("changed marks render while finger is stationary", CountInRange(glmock::Log(), "eglSwapBuffers", begin, glmock::Log().size()) > 0);
    begin = glmock::Log().size();
    for (int i = 0; i < 24; ++i) {
        Check("duplicate marks accepted", fixture.host.SetDynamicHighlights(marks(false)));
        fixture.PumpFrame(); std::this_thread::sleep_for(std::chrono::milliseconds(2));
    }
    pump();
    Check("duplicate marks do not wake drawing", CountInRange(glmock::Log(), "eglSwapBuffers", begin, glmock::Log().size()) == 0);
    begin = glmock::Log().size();
    Check("empty transition accepted", fixture.host.SetDynamicHighlights(marks(true))); pump();
    Check("empty transition clears marks", CountInRange(glmock::Log(), "eglSwapBuffers", begin, glmock::Log().size()) > 0);
    begin = glmock::Log().size();
    Check("repeated empty accepted", fixture.host.SetDynamicHighlights(marks(true))); pump();
    Check("repeated empty does not redraw", CountInRange(glmock::Log(), "eglSwapBuffers", begin, glmock::Log().size()) == 0);
    fixture.host.DetachSurface();
    Check("highlight reattach", fixture.AttachWithTextures());
    park(121); begin = glmock::Log().size();
    Check("same payload admitted on new surface", fixture.host.SetDynamicHighlights(marks(true))); pump();
    Check("new surface invalidates highlight dedupe", CountInRange(glmock::Log(), "eglSwapBuffers", begin, glmock::Log().size()) > 0);
}

void ScenarioReplacementHighlightMailbox()
{
    Fixture fixture;
    Check("replacement highlight attach", fixture.AttachWithTextures());
    std::mutex gate;
    std::condition_variable condition;
    bool entered = false;
    bool released = false;
    glmock::SetTextureUploadHook([&]() {
        std::unique_lock<std::mutex> lock(gate);
        entered = true;
        condition.notify_all();
        condition.wait(lock, [&]() { return released; });
    });
    auto texture = Fixture::MakePayload(TextureSlot::CURRENT, "blocked-old");
    texture.surfaceEpoch = fixture.host.SurfaceEpoch();
    Check("replacement highlight blocked upload", fixture.host.QueueTexture(std::move(texture)));
    {
        std::unique_lock<std::mutex> lock(gate);
        Check("replacement highlight upload entered", condition.wait_for(lock, std::chrono::seconds(5), [&]() { return entered; }));
    }
    const uint64_t oldEpoch = fixture.host.SurfaceEpoch();
    std::thread detach([&]() { fixture.host.DetachSurface(); });
    Check("replacement highlight detach queued", PollUntil([&]() { return fixture.host.SurfaceEpoch() != oldEpoch; }, 5000));
    fixture.host.AttachSurface(reinterpret_cast<void*>(0x20), 390, 780);
    const uint64_t replacementEpoch = fixture.host.SurfaceEpoch();
    auto marks = []() {
        DynamicHighlights value;
        value.identity = "page-current";
        value.rects.push_back({.1F, .1F, .3F, .2F});
        value.colors.push_back({.2F, .3F, .4F, -.2F});
        return value;
    };
    Check("replacement highlight mailbox accepted before teardown", fixture.host.SetDynamicHighlights(marks()));
    {
        std::lock_guard<std::mutex> lock(gate);
        released = true;
        condition.notify_all();
    }
    detach.join();
    glmock::SetTextureUploadHook({});
    EventRecord ready {};
    Check("replacement highlight old lost event carries original epoch", fixture.sink.WaitFor(HostEvent::SURFACE_LOST, kAnyGeneration, ready, 5000) &&
        ready.surfaceEpoch == oldEpoch + 1 && ready.surfaceEpoch != replacementEpoch);
    Check("replacement highlight new surface ready", fixture.sink.WaitFor(HostEvent::SURFACE_READY, kAnyGeneration, ready, 5000));
    Check("replacement ready event carries new epoch", ready.surfaceEpoch == replacementEpoch);
    fixture.QueuePageTextures("page-previous", "page-current", "page-next");
    Check("replacement highlight textures ready", PollUntil([&]() { return (fixture.host.ReadyMask() & 7U) == 7U; }, 5000));
    fixture.UpdateInput(122, Direction::NEXT, 280);
    for (int i = 0; i < 25; ++i) { fixture.PumpFrame(); std::this_thread::sleep_for(std::chrono::milliseconds(2)); }
    const size_t begin = glmock::Log().size();
    Check("replacement highlight same data resubmitted", fixture.host.SetDynamicHighlights(marks()));
    for (int i = 0; i < 15; ++i) { fixture.PumpFrame(); std::this_thread::sleep_for(std::chrono::milliseconds(2)); }
    Check("replacement highlight dropped mailbox cannot poison dedupe",
        CountInRange(glmock::Log(), "eglSwapBuffers", begin, glmock::Log().size()) > 0);
}

int main()
{
    // Shrink the retain-timeout watchdog for the whole process; every scenario
    // keeps the same retain semantics, only the diagnostic cadence changes.
    (void)setenv("BOOKTURN_RETAIN_TIMEOUT_MS", "80", 1);
    ScenarioHighlightDeduplication();
    ScenarioReplacementHighlightMailbox();
    ScenarioRapidProgrammaticCueRetainsBarrier();
    ScenarioReplacementReadinessDuringUpload();
    ScenarioFailedReplacementInvalidatesOldPixels();
    ScenarioSurfaceEpochRejectsOldCopy();
    ScenarioAtomicEndAndQuietHold();
    ScenarioRegrabSubmittedPose();

    ScenarioSuccessfulNextTurn();
    ScenarioPreviousTurn();
    ScenarioStaleConfirmations();
    ScenarioRollback();
    ScenarioRapidConsecutiveTurns();
    ScenarioCrossChapterRefreshDuringRetention();
    ScenarioSlowProgressStorage();
    ScenarioPresentationTimeout();
    ScenarioPageExitAndReattach();
    ScenarioDetachDropsStaleMailbox();
    ScenarioWindowReflow();

    std::printf("%d checks, %d failures\n", g_checks, g_failures);
    return g_failures == 0 ? 0 : 1;
}
