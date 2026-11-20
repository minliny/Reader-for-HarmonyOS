import { registerHooks } from 'node:module';

/** Node fixtures load the shipping ArkTS modules, whose relative TypeScript
 * imports omit extensions. Keep Node's own resolution first; this adapter only
 * supplies the missing .ts extension. The selected fixture owns deregistration.
 * Importing this module never loads the SDK or installs a process-global hook.
 */
export function registerReaderTypeScriptImports() {
  return registerHooks({
    resolve(specifier, context, next) {
      try {
        return next(specifier, context);
      } catch (error) {
        if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') &&
          !/\.[a-z]+$/i.test(specifier)) return next(specifier + '.ts', context);
        throw error;
      }
    }
  });
}
