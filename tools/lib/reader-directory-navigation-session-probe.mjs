import { registerHooks } from 'node:module';

const sessionUrl = new URL('../../entry/src/main/ets/features/reading/presentation/ReaderDirectoryNavigationSession.ts', import.meta.url).href;
// Resolve only this production module's ArkTS bindings; unrelated imports keep
// their own resolution contract after the real session exports have loaded.
const resolution = registerHooks({ resolve(specifier, context, next) {
  if (context.parentURL === sessionUrl &&
      ['../application/ReaderDirectoryNavigation', './ReaderDirectorySessionState'].includes(specifier)) {
    return next(`${specifier}.ts`, context);
  }
  return next(specifier, context);
} });
let implementation;
try { implementation = await import(sessionUrl); }
finally { resolution.deregister(); }

export const {
  readerDirectoryCollapsedIds, readerDirectoryAdmitRevision, readerDirectoryToggleCollapsed,
  readerDirectoryClearSessionState, openReaderDirectoryNavigation,
} = implementation;
