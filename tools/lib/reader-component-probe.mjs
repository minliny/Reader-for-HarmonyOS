import { createEtsBuilderProbe } from './ets-builder-probe.mjs';
import { readerProbeGlobals } from './reader-probe-globals.mjs';

/** A component-family fixture supplies its actual children and properties.
 * No Reader page composition or missing-component factory runs here. */
export function createReaderComponentProbe(source, names, dependencies = {}, hooks = {}) {
  return createEtsBuilderProbe(source, names, dependencies,
    { ...hooks, createGlobals: hooks.createGlobals ?? readerProbeGlobals });
}
