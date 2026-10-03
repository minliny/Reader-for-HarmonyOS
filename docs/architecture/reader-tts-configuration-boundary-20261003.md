# Reader TTS configuration boundary

Source baseline: Host `cf56c662f5788b837ec3466dcefacdf34f663818`.
This is a P3 responsibility slice, not closure of the complete reading-runtime package.
The current UI geometry and persistent component tree are retained.

## Located failures and resulting ownership

`LocalReadingExperience` previously issued configuration writes, metadata reads,
credential cleanup and engine activation after multiple awaits without a single
lifecycle/book/coordinator/operation admission contract. A confirmed HTTP save
could then reject because list refresh or activation failed. Those configuration
failures also overwrote the formal playback state's error message.

`ReaderTtsConfigurationHost` now owns the serial durable mutation lane, explicit
HTTP write receipt, engine/rate configuration receipt, metadata refresh facts,
capability/activation facts and conservative credential eligibility. The mounted
reader supplies lifecycle, book and coordinator identity and projects admitted
values. Existing Core gateways, AssetStore credential owner, coordinator transport
tail and native speech implementations retain their responsibilities.

Gateway `onDispatch` is optional and runs after existing payload validation,
immediately before the runtime request. Local validation rejection is
`undispatched`; a lost transport reply remains `unknown`. Only an undispatched
new alias can be removed immediately. Confirmed replacement/deletion cleanup
requires a successful authoritative list and no remaining credential reference;
an invalid profile cannot prove that a reference is absent.

Retirement/supersession blocks further write stages, cleanup, metadata dispatch,
activation and UI publication. An already-dispatched write still settles or
issues its safe read-back; its receipt and credential must not be represented as
cancelled. Reopening a failed configuration layer retries only the metadata read.

The new coordinator `probeConfigurationAvailability(admission)` uses the existing
transport tail and probe implementation. It reports configuration probe failures
to the configuration owner, without publishing probing/unavailable/error over
formal book playback. Initial and playback availability probes retain their
existing behavior.

## Verification and remaining boundaries

`test-reader-tts-configuration-host.mjs` executes the production Host, real Core
gateways, SDK-parsed reader methods and real coordinator. Deferred replies cover
retired owners, newer intents, missing replies, read failures, secret allocation,
parameter rejection, confirmed write plus refresh failure, independent activation
failure, read-only recovery and omission negative controls.

Existing HTTP/TTS gateway, coordinator, state-machine, launch-intent, exit-progress,
Quick preparation, configuration interaction, lifecycle, product-surface and
operation-fact contracts are retained. Local test fixtures are not full ArkTS/HAP,
platform audio, device, visual or user-acceptance evidence.

A lost write ACK remains unknown even when a read finds matching data. An inline
save retry reconciles without re-putting or allocating another secret, and keeps
the draft/uncertainty visible. The mounted owner conservatively blocks repeated
unknown configuration writes; later lifecycle initialization reads the persisted
state. A protocol receipt/idempotency key would be needed to prove that original
transaction's ACK retrospectively. No new Core protocol is claimed here.

Rollback unit: the configuration Host and its LRE delegation, optional gateway
dispatch callbacks, configuration-only coordinator entry and associated tests.
Reverting this unit does not move/reset user data or change native transport,
credentials, paragraph layout, pagination or component-tree ownership.
