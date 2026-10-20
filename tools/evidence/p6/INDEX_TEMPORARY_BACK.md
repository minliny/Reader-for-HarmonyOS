# Index temporary surface Back consumer closure — 2026-10-03

Dependencies: actual Runtime retirement commit `d8e551fe`, leaf bridge `e3e1504e` (local equivalent `63d3b649`). Changes are confined to isolated Host worktree; no deployment input changed.

## Real consumers and ownership

Index receives the actual SDK emitted regular callbacks from SettingsPage, SourceManagementPage and BookshelfShell. A finite page lease stores scope, navigation, captured mounted Runtime, instance identity and the leaf handler. It is cleared by navigation/Index teardown, or by the matching leaf retirement. Older unregister callbacks cannot withdraw a new lease. Runtime static storage is authoritative; constructing a required live owner continues to use the hard-failing getter.

Back priority is existing deletion confirmation, JSON import, source switch, local import, default shelf group editor, then the live page-local temporary layer, then the original route/reader exit. Busy group save consumes Back without dismissing its in-flight editor. A close-handler exception consumes the current Back without claiming the native surface closed or navigating underneath it. The failure remains observable in existing logging; it does not fabricate task cancellation or storage ACK.

## Retained bookshelf

BookshelfShell is retained when hidden first-page preparation changes Index navigation. Real `@Prop @Watch navigationGeneration` renews only the local Back registration and retires the previous menu opening. A small keyed More trigger gets fresh V1 constructor callbacks; its original dimensions and current menu structure are unchanged. The shell/content actors stay mounted, preserving the page/scroll tree. Each registration carries its generation. Index compares the supplied generation, current route, captured Runtime and matching instance identity. Old physical trigger/handler/unregister cannot act on a newer opening.

Settings and Source route construction captures immutable navigation/Runtime arguments. Their own unique selection/opening IDs and mounted guards remain in the leaf. Source keeps its existing collapse animation and continues consuming Back until its genuine completion callback closes the panel.

## Code/SDK evidence

New `test-temporary-back-index-sdk.mjs`: unmodified Index Builders → real SDK emitted leaf constructors/Props/Watch → production handlers; three consumers, layer priority/fallback, close/reappear, navigation/route, Runtime unset/replacement, unmounted, old unregister, failed close, Source collapse and persistent bookshelf generation update. The original leaf SDK test still verifies real responsive shared choice actors, menu actions, late collapse ACKs and guard-removal negative controls.

Existing bookshelf shell readiness/empty/loading/failure/day/night/tablet tests and geometry, real receipt recovery consumers, Settings selection, private Typography and test tiers pass. Legacy Back fixtures now include the real new method dependencies and explicit absent-import seam; original source-switch/reading/directory/General route assertions remain. No native layout/focus/OS scheduling, HAP, device, visual or user acceptance is established by these local tests.
