# `entry/src/main/ets/ui/platform`

This directory holds **ArkUI- and UIContext-coupled platform adapters** for HarmonyOS:

- [`ArkWebExecutionHost.ets`](./ArkWebExecutionHost.ets): Native `Web` controller bridge executing headless page/rule evaluations inside an ArkUI host surface.
- [`ReaderFontLoadHost.ts`](./ReaderFontLoadHost.ts): Font registration helper coupled to `@ohos.arkui.UIContext` font APIs.
- [`ReaderNativeAlertButtonCopy.ts`](./ReaderNativeAlertButtonCopy.ts): Display copy normalization for native system alert dialogs.
- [`ReaderNativeAlertOwner.ets`](./ReaderNativeAlertOwner.ets): ArkUI-lifecycle alert ownership coordinator.
- [`ReaderNativeAlertWindow.ts`](./ReaderNativeAlertWindow.ts): `UIContext` prompt/alert dialog presentation adapter.

## Architectural Boundary vs. `entry/src/main/ets/platform/`

- **`ui/platform/`**: Thin HarmonyOS platform adapters that require ArkUI state, `UIContext`, `WebviewController`, or UI window/dialog presentation.
- **`platform/`**: Headless OS and system service gateways (`file.fs`, HTTP/network routing, TTS engine/audio session, device storage probes, WebDAV credential store) that carry zero ArkUI component dependencies and run independent of mounted UI trees.
