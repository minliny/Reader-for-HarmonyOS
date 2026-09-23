import text from '@ohos.graphics.text';

// ArkUI Text and graphics.text share the native global FontCollection. A
// registerFont call is only a submission, so it cannot authorize text layout.
// Keep the checked load receipt for each immutable bundled/content-hashed face.
const fontLoads: Map<string, Promise<void>> = new Map();
const readyFontFamilies: Set<string> = new Set();
let collection: text.FontCollection | undefined;

/** Synchronous observation of the checked native receipt, never a load. */
export function readerFontLoadReady(family: string): boolean {
  return readyFontFamilies.has(family);
}

export function loadReaderFontChecked(family: string, source: Resource | string): Promise<void> {
  const existing = fontLoads.get(family);
  if (existing !== undefined) return existing;
  let operation: Promise<void>;
  try {
    if (collection === undefined) collection = text.FontCollection.getGlobalInstance();
    operation = collection.loadFontWithCheck(family, source);
  } catch (error) {
    return Promise.reject(error);
  }
  const receipt = operation.then((): void => {
    readyFontFamilies.add(family);
  }).catch((error: Error): void => {
    readyFontFamilies.delete(family);
    fontLoads.delete(family);
    throw error;
  });
  fontLoads.set(family, receipt);
  return receipt;
}
