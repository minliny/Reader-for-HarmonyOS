# System file open navigation consumer

Baseline: `706d8af4`, existing `ReaderSystemFileOpenHost` and its bounded queue.
The system Want/URI staging, Core import, retained asset and authoritative
bookshelf/progress are unchanged. The new finite navigation Host removes the
Index checking/checked/notice/exit/applying/subscription state. Index remains
responsible for its ArkUI lifecycle, foreground/route/book projection, actual
toast surface and the route/open intents supplied through a typed adapter.

The Host captures one exact Runtime. Its mount generation, queue result ID,
navigation generation and immutable source/book tuple fence asynchronous
source-switch lookup before asking the existing serialized reader to exit.
No matching book or queue ACK is interpreted as a durable write receipt. A
blocked switch retains the already imported local book/result. Cancelling a
progress-preserving exit consumes only that exact navigation intent, preserving
both the current reader and the imported book on its shelf.

The mounted page may disappear/rebuild without discarding the queue result.
A retired Runtime cannot subscribe to or consume a replacement queue. A query
can settle while backgrounded; navigation waits for foreground. Failed hidden
reads release their local checking lease for a later pure query. Notification
failure cannot change the import truth. A route callback failure retains the
result. An exit callback which throws may already have accepted work, so it is
not blindly requested a second time; ordinary cancel/exit still settle its ID.

`test-system-file-open-navigation-owner.mjs` drives the complete shipped class
and actual bounded queue, substituting only the OS/runtime identity and page
adapter: cold delivery, progress-preserving exit, cancel, pending transaction,
old Runtime/navigation/book/result/mount, background settlement, notification
and route exceptions, synchronous reentry, and a Runtime-guard negative
control. Existing URI/import/queue/manifest tests remain required.

This candidate still requires the Index writer to consume the owner and delete
the old fields/method body. Source/local tests are not ArkTS/HAP, actual Want
grant/reconstruction, device focus, visual or user acceptance. New fault copy
for a throwing route/exit adapter must be recorded for the postponed UI review;
normal UI geometry and normal workflow copy stay the current-app baseline.
