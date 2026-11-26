// Node-only resolver for pure Reader TS modules that use ArkTS-style
// extensionless imports. It is used exclusively by explicit check scripts and
// never by the DevEco build.
export async function resolve(specifier, context, next) {
  if (specifier === '@reader/core-harmony') {
    // The app package re-exports wire helpers from this generated SDK. Use
    // the same implementation without instantiating the package's native binding.
    return next(new URL('../entry/vendor/core-harmony/sdk/reader_core.ts', import.meta.url).href, context);
  }
  if (specifier.startsWith('.') && !/\.[a-zA-Z0-9]+$/.test(specifier)) {
    for (const extension of ['.ts', '.ets']) {
      try {
        return await next(specifier + extension, context);
      } catch (_) {
        // Try the next extension before surfacing the original resolution error.
      }
    }
  }
  return next(specifier, context);
}
