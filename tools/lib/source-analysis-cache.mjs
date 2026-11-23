import { serialize } from 'node:v8';

/** Memoize only derived facts from the current exact source and SDK options.
 * Each file retains one revision; callers always receive independent values.
 * Failed parses/assertions are never cached. No mtime or test result is used.
 */
export function sourceAnalysisCache(options) {
  const entries = new Map();
  return (source, file, analyze) => {
    let context;
    try { context = serialize(options); }
    catch { return analyze(); } // Unsupported compiler state: keep the real path.
    const previous = entries.get(file);
    if (previous?.source === source && previous.context.equals(context)) {
      return structuredClone(previous.value);
    }
    const value = analyze();
    entries.delete(file);
    entries.set(file, { source, context, value: structuredClone(value) });
    if (entries.size > 32) entries.delete(entries.keys().next().value);
    return value;
  };
}
