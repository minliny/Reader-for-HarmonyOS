/** Preserve every native button property without referencing the ArkUI-only
 * schema in TypeScript. The ETS owner supplies the guarded action. */
export function readerNativeAlertButtonCopy<T extends object>(button: T, action: () => void): T { return { ...button, action }; }
