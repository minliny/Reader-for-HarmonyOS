import { readFileSync, readdirSync } from 'node:fs';
import { createEtsBuilderProbe, builderComponentMembers, builderChildProperties } from './ets-builder-probe.mjs';
import { readerProbeGlobals } from './reader-probe-globals.mjs';

const featureIndex = new Map();
function indexFeatureSources() {
  const root = new URL('../../entry/src/main/ets/features/', import.meta.url);
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(new URL(`${entry.name}/`, dir));
      else if (entry.name.endsWith('.ets')) {
        const name = entry.name.slice(0, -4);
        if (!featureIndex.has(name)) featureIndex.set(name, new URL(entry.name, dir));
      }
    }
  };
  visit(root);
}
function missingComponents(error) {
  const names = new Set();
  for (const diagnostic of error?.actual ?? []) {
    const match = /'([A-Za-z][A-Za-z0-9_]*)\s*\(\{/.exec(diagnostic?.message ?? '');
    if (match) names.add(match[1]);
  }
  return [...names];
}
function childStandIn(name, source) {
  const props = [...builderChildProperties(source, name)];
  const fields = props.map(prop => `  @Prop ${prop}: any = undefined;`).join('\n');
  return `@Component\nexport struct ${name} {\n${fields}\n  build() { Column() {} }\n}`;
}

/** A component-family fixture supplies its actual children and properties.
 * No Reader page composition or missing-component factory runs here. Children
 * the page actually mounts are resolved from their real source, and fall back
 * to a prop-compatible stand-in when their own ports are not available. */
export function createReaderComponentProbe(source, names, dependencies = {}, hooks = {}) {
  const childSources = { ...(hooks.childSources ?? {}) };
  const options = { ...hooks, childSources, createGlobals: hooks.createGlobals ?? readerProbeGlobals };
  let deps = dependencies;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return createEtsBuilderProbe(source, names, deps, options);
    } catch (error) {
      const all = missingComponents(error);
      const pending = all.filter(name => deps[name] === undefined);
      if (process.env.PROBE_DEBUG && all.length > 0) console.error('AUTO-PENDING', pending, 'of', all,
        all.map(name => `${name}:${typeof deps[name]}`));
      if (pending.length === 0) throw error;
      if (featureIndex.size === 0) indexFeatureSources();
      let added = false;
      for (const name of pending) {
        const path = featureIndex.get(name);
        if (path === undefined) continue;
        const child = readFileSync(path, 'utf8');
        let mounted;
        try {
          mounted = createReaderComponentProbe(child, builderComponentMembers(child, name), deps,
            { ...hooks, componentName: name }).Component;
          if (childSources[name] === undefined) childSources[name] = child;
        } catch (_childError) {
          try {
            const standIn = childStandIn(name, child);
            mounted = createReaderComponentProbe(standIn, ['build'], deps, { ...hooks, componentName: name }).Component;
            childSources[name] = standIn;
          } catch (_stubError) { continue; }
        }
        deps = { ...deps, [name]: mounted };
        added = true;
      }
      if (!added) throw error;
    }
  }
  return createEtsBuilderProbe(source, names, deps, options);
}
