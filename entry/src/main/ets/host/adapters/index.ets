// host/adapters — barrel export for Host capability adapters.
// Phase 4-7 implementation; consumed by HostDispatcher / CapabilityRouter.
export { HttpHostAdapter } from './HttpHostAdapter';
export { CoreHostAdapter } from './CoreHostAdapter';
export { CookieHostAdapter } from './CookieHostAdapter';
export { SourceSessionHostStore } from './SourceSessionHostStore';
export type { SourceLoginHeaderState } from './SourceSessionHostStore';
export { WebViewHostAdapter } from './WebViewHostAdapter';
export { FileHostAdapter } from './FileHostAdapter';
export { ClipboardHostAdapter } from './ClipboardHostAdapter';
export { TtsHostAdapter } from './TtsHostAdapter';
export { ScreenHostAdapter } from './ScreenHostAdapter';
export { NotificationHostAdapter } from './NotificationHostAdapter';
export { BackgroundHostAdapter } from './BackgroundHostAdapter';
export { ShareHostAdapter } from './ShareHostAdapter';
export { PermissionHostAdapter } from './PermissionHostAdapter';
export { CredentialHostAdapter } from './CredentialHostAdapter';
