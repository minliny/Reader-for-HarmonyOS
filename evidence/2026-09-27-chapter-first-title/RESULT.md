# Chapter-first title publication

## Recorded before implementation

- User reports that the first render of every chapter in 晚唐 flashes and the whole body then moves downward on the installed Host `09ce7ea4` / Core `bf2aab24` candidate. The user subsequently confirmed **continuous page turning into the next chapter**, rather than selecting from the directory. Pixel displacement remains unmeasured.
- Code audit: `LocalReadingExperience.beginFirstPageCommit` attaches the synchronously measured `nativeTitle` to the first fragment before publishing the physical page. `ReaderPageTurnSurface` forwards fragments only through `fragmentsProvider`/`contentRevision`, avoiding deep copies.
- `ReadingSurface` renders the body through `renderFragments()`, but its title branch reads `pageFragments[0].nativeTitle`. On this real paged route that array remains the default empty array, so the measured title is ignored and a new ordinary Text is laid out instead. This is a confirmed inconsistent publication path; it is not yet proof that it uniquely causes the reported native flicker.
- Scope: correct only the two title reads in `ReadingSurface`, preserving the existing provider and legacy-array contracts. No timing delay, extra cache, safe-area/header change, content/progress change or Core change.

## Simulation and live-page mismatch

The root task's existing 17:26 consistent backup records `navigationMode=paged`, `pageTransition=simulation`, serif18, lineHeight1.96, paragraphSpacing16 and extendIntoCutout=false. This is historical preference evidence, not a fresh read of the user's current configuration.

`BookTurnTextureBuilder` passes both `pageFragments` and the current provider to `ReadingSurface`. Thus the old code already used the native title in a simulation destination texture, while the resident live `ReaderPageTurnSurface` used a fresh ordinary Text. This creates a concrete transition between different title layout paths at promotion. The correction makes title and body consume the same provider in both paths. Neither the precise downward displacement nor every cause of flashing is claimed established from this code evidence.

## Implementation and focused results

- Production change: only the two title reads in `ReadingSurface.ets` use the existing `renderFragments()` authority.
- `red.log`: the actual SDK slot → Surface chain receives the measured title via the live provider but emits only the body native recipe and a fallback title Text. The first two attempts lacked probe defaults for slotIdentity and Canvas; they are retained as `probe-fixture-failure*.log` and are not product failures.
- `green.log`: actual SDK Stage/slot/Surface and the unchanged offscreen Builder body prove the same measured title recipe survives prepared next-page residency, promotion into the same physical slot, and stable replay. The test invokes the production native resource/controller with instrumented, fractional measured heights and rejects remeasurement; declared content inset plus measured title height plus spacing stays equal across the prepared texture and live promotion. These are model/resource boundary observations, **not captured native frames**.
- The old-read negative control still reproduces a live fallback title while the same offscreen texture uses the measured native title. Legacy arrays without a provider, authoritative empty providers, stale copied arrays and non-first pages are covered.
- Existing native paragraph owner and view SDK regressions (`native-owner.log`, `native-view.log`), pagination integration (`pagination.log`) and simulation architecture (`book-turn.log`) all PASS. `git diff --check` PASS. No full Host gate was rerun here.
- A separate bounded-window start>0 prepared-title predicate issue was fixed by the parallel task in `54b15e0f`. It can cause an unwanted title to disappear; it is not presented as the cause of the reported downward movement. This task did not edit that production file.

Status: code and focused regression PASS. Full ArkTS/HAP and exact installed simulation cross-chapter pixels remain with the root task. No VM/HAP/user-data operations. No animation, page cache, rendering delay, safe-area or persisted layout policy changes.
