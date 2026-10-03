# One cold debug main-load fault

Source: clean Host `4bfec1eb5c6c51f3ad0b5ddb80e79b010a5b6feb`, branch
`codex/p8-startup-load-fault-20261003`. This slice only changes EntryAbility and
its existing cold-start diagnostic allowlist. StartupContentOwner, recovery UI,
restore/settings/data owners and actual WindowStage APIs remain the same.

## Why a target probe is still necessary

The existing owner supports main-load failure, independent recovery content and
retry. Code-side tests prove these guards, but they cannot establish whether the
actual HarmonyOS WindowStage can render that fallback after a real main-load
failure. There was no bounded production launch path to trigger exactly that
platform condition. A local fake callback is insufficient as target evidence.

## Exact admission and effect

Cold Want parameter: `readerStartupMainLoadFailure`, primitive boolean `true`.
It is accepted only when generated `DEBUG === true` and `BUILD_MODE_NAME === 'debug'`.
String `"true"`, numbers, truthy objects/boxed booleans, release/preview/custom
modes and absent values do not enable it. Concurrent motion-verification or
renderer-pilot requests conflict and return the normal Index. Prior four-argument
allowlist behavior is preserved.

After the original window, recovery/settings and shelf-font admission settles,
the first real `windowStage.loadContent` request is for
`pages/__ReaderStartupMainLoadFailure`. This page is deliberately absent from
both production source and main_pages.json. Production neither synthesizes an
error nor invokes `done` itself: the real OS callback (or synchronous platform
throw) goes through the original StartupContentOwner recovery driver.

The diagnostic destination is consumed immediately before dispatch. The next
main-content request, including explicit recovery retry or a recreated stage,
is for `pages/Index`. A retired stage's pending barrier cannot dispatch; a fault
already dispatched is not rearmed. A hot Want stays in the existing system-file
queue and cannot reconfigure/reload the destination. No storage reset, new task,
new font barrier, global owner or recovery algorithm is introduced.

The existing debug StartupTrace records `startup.main-load-fault-request` as an
application-code request marker. Its ordinary load-content callback status is
separate; neither trace event proves a rendered/native frame.

## Root's minimal target evidence recipe

Use one provenance-matched debug HAP and the existing target lease. Cold-launch
with only the exact boolean fault parameter. Preserve application data. Capture
launch parameters/build identity plus the request marker, actual OS load callback
failure, actual existing recovery content, one real recovery retry and subsequent
Index load callback success. Verify ordinary launch and hot Want do not inject.
If the OS gives no failure callback or cannot host recovery, record platform
unavailable/pending honestly; do not synthesize success or infer it from absence
of crashes. Actual native dispatch/recovery, device frame, visual and user
acceptance remain separate exits.

## Local evidence

`test-reader-startup-main-load-fault.mjs` runs the unmodified Ability methods,
real launch decision and actual StartupContentOwner. Controlled IO boundaries
cover original restore→configuration→reading-settings ordering, outstanding
shelf-font admission, main failure→recovery callback→explicit retry Index, no
restore replay, duplicate retry, cold/hot parameters, stage destroy/recreate,
late main/recovery callbacks and synchronous dispatch throw. Removing only the
real one-shot consumption statement demonstrably re-faults on retry. These are
controlled native callback boundaries, not OS callback evidence.

PASS regressions: control-verification launch, startup content recovery, trace,
actual startup reading-settings gateway and selected native font admission.
No HAP/VM/device was used. Code/local evidence PASS; actual OS callback and
fallback hosting OPEN. Root owns target verification.

## Rollback and future probes

Revert the two-file adapter and its tests/registration to remove this diagnostic
without changing recovery or data behavior. Do not add the absent route to the
page registry: that invalidates the probe.

Barrier-timeout and native-owner retirement are deliberately not injected here.
Their next proposals must identify the real withheld task/lifecycle event, retain
its admission/cleanup and define independent target evidence; they cannot reuse
this main-load failure as proof of those platform capabilities.
