export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND' &&
        (specifier.startsWith('./') || specifier.startsWith('../'))) {
      for (const ext of ['.ts', '.ets']) {
        try {
          return await next(specifier + ext, context);
        } catch {
          // try next extension
        }
      }
    }
    throw err;
  }
}
