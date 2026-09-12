// Input-chain motion math (contract V2 §5.3, §7.2, §11.3). ArkTS records the
// newest raw sample into the host mailbox; the free-edge state (x_follow
// chase) lives in native and advances on VSync frame callbacks. Kept as pure
// functions so the semantics are unit-testable without a host or GL.
#ifndef READER_BOOKTURN_MOTION_H
#define READER_BOOKTURN_MOTION_H

#include "bookturn_solver.h"

#include <cstdint>

namespace reader::bookturn {

// Input is sampled on the next VSync with no intentional delay or pursuit.
constexpr float kCompleteSeconds = 0.320F;
// Queued completed taps use a short cue; finger release still uses the
// independent 80..320 ms velocity-based settlement below.
constexpr float kRapidCompleteSeconds = 0.030F;
constexpr float kSettleMinSeconds = 0.080F;

// Raw gesture sample. No edge fields: the edge is native-owned state.
struct BookTurnSample {
    uint64_t generation = 0;
    Direction direction = Direction::NEXT;
    bool verticalPrevious = false;
    float width = 0.0F;
    float height = 0.0F;
    float startX = 0.0F;
    float startY = 0.0F;
    float pointerX = 0.0F;
    float pointerY = 0.0F;
    int64_t eventTimeNs = 0;
};

// Chase controller state, owned by the host render thread. Carries the chased
// edge across frames and derives finger velocity from consecutive samples.
struct BookTurnChaseState {
    float edgeX = 0.0F;
    float originEdgeX = 0.0F;
    float originEdgeY = 0.0F;
    float regrabTheta = 0.0F;
    bool regrabbed = false;
    float previousPointerX = 0.0F;
    float previousPointerY = 0.0F;
    int64_t previousSampleTimeNs = 0;
    float lastPointerX = 0.0F;
    float lastPointerY = 0.0F;
    int64_t lastSampleTimeNs = 0;
    float fingerVelocityX = 0.0F;
    float fingerVelocityY = 0.0F;
    bool seeded = false;
};

float SourceEdgeX(Direction direction, float width);

// Restart the chase for a new gesture generation: the edge rests at the
// source edge exactly as the V1 begin semantics did.
void ResetChase(BookTurnChaseState& state, const BookTurnSample& sample);

// Feed one mailbox sample: updates the finger velocity only. The edge itself
// never moves here — advancement happens per VSync frame in ChaseAdvance.
void RecordChaseSample(BookTurnChaseState& state, const BookTurnSample& sample);

// Consume the latest sample; a stationary pointer keeps an identical pose.
BookTurnSample PresentChaseSample(const BookTurnChaseState& state, const BookTurnSample& sample,
    int64_t frameTimeNs);

// Map displacement from the acquired origin symmetrically in both directions.
float ChaseTargetX(const BookTurnSample& sample);

// Set the edge directly at the frame boundary, without integrating a chase.
float ChaseAdvance(BookTurnChaseState& state, const BookTurnSample& sample, float frameSeconds);

// Progress-space distance between the chased edge and the current target
// (what M-CATCH-LOCK compares against). <= kCatchLockVp means caught up.
float ChaseGap(const BookTurnChaseState& state, const BookTurnSample& sample);

// Settlement schedule (contract §7.2). tau is the direction-independent
// geometric schedule parameter: rest tau is 0 for NEXT and 1 for PREVIOUS,
// complete tau the opposite. The frozen duration formula T-COMPLETE*(1-tau0)
// is written for the canonical NEXT rest orientation and is applied
// symmetrically as T-COMPLETE*remaining.
float SettleTargetTau(Direction direction, bool commit);
float SettleDurationSeconds(float tau0, Direction direction, bool commit,
    float velocityPagesPerSecond = 0.0F);
// tau(t): linear in tau for release settle / cancel (INV-3 exact time
// reversal); ease-out tail for the click/auto path.
float SettleTauAt(float tau0, float targetTau, float elapsedSeconds, float durationSeconds,
    bool easeOut);

// Release takeover keeps the exact gesture-end tilt on its first frame, then
// removes it over the same duration as the remaining tau settlement. A cubic
// smoothstep gives zero angular velocity at both boundaries, avoiding the old
// 80ms posture snap without changing the horizontal settlement schedule.
float SettleThetaAt(float theta0, float elapsedSeconds, float durationSeconds);

// §7.3 tau_swap decision (shared by the host and the 13.1 INV-2 gate scan):
// only a NEXT commit may swap early — the sheet passes through a thin spine
// strip inside the S5 window (tau >= kStageSpineEnd) once its coverage drops
// to kSwapCoverRatio. PREVIOUS commits keep the endpoint swap (the sheet
// covers the viewport until tau 0; at tau 1 it lies flat OFF-screen, which
// must never read as "thin strip") and rollbacks never swap.
bool SettlementSwapShouldFire(bool commit, Direction direction, float tau,
    const BookTurnPose& pose);

}  // namespace reader::bookturn

#endif  // READER_BOOKTURN_MOTION_H
