# R8 SDK immediate Host wakeup receipt

Only `bindings/harmony/sdk/reader_core.ts` and `reader_core.test.ts` changed. SDK vendor not manually edited. No Native/HAP or device work.

- Once-only Host completion signal replaces default settled-state 10 ms polling. Resolve, reject, synchronous throw, request cancel and runtime close wake waiting requests immediately.
- Deadlines retained with a single timer; legacy caller-supplied shouldCancel predicate retains its configured sampling, but completion never waits for that sample. Runtime Native reads remain zero-time non-blocking. Every 32 immediately drained pump events yields a zero-delay macrotask to avoid event-storm starvation.
- Listener/timer cleanup is per request; concurrent requests cannot wake/complete another identity. Close tolerates throwing abort hooks and releases all waiters. Canceled/expired/closed completions cannot reach Native. Equal-clock deadline race gives timeout priority.

Validation:
- 50 SDK tests, 284 assertions PASS (`bun test bindings/harmony/sdk/`): `/private/tmp/r8-sdk-final.log`.
- Strict TS check with unused checks PASS: `/private/tmp/r8-sdk-typecheck-final.log`.
- New immediate 10-hop production-path regression against original HEAD SDK is red: `/private/tmp/r8-sdk-baseline-red.log`.
- Deterministic tests cover immediate, delayed, rejection, synchronous throw, before/after registration cancellation, late resolve/reject, timeout races, concurrent dispatch, close, Native queue waits, 1000-event starvation and cleanup.
- Scheduling probe `/private/tmp/r8-sdk-latency.ts`, raw baseline `/private/tmp/r8-sdk-baseline-timing.jsonl`, new `/private/tmp/r8-sdk-current-timing.jsonl`.
  Immediate 10 Host hops: old Host-complete->Native aggregate 112.891 ms, new 0.364 ms; wall115.161->2.618 ms. Actual Host work0.001 ms both.
  Simulated delayed 5 hops: old Hostwork40.218 ms + extra12.341 ms; new Hostwork41.787 ms + extra0.071 ms.
  New deadline timers fired0 and residual0. All Native reads used0ms. This measures scheduling overhead only, not real network/device journey latency.
