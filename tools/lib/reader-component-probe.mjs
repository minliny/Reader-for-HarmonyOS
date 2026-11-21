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
        const url = new URL(entry.name, dir);
        if (!featureIndex.has(name)) featureIndex.set(name, url);
        const source = readFileSync(url, 'utf8');
        for (const match of source.matchAll(/\b(?:export\s+)?struct\s+([A-Za-z][A-Za-z0-9_]*)/g))
          if (!featureIndex.has(match[1])) featureIndex.set(match[1], url);
      }
    }
  };
  visit(root);
}
function missingComponents(error) {
  const names = new Set();
  for (const diagnostic of error?.actual ?? []) {
    const match = /'([A-Za-z][A-Za-z0-9_]*)\s*\(/.exec(diagnostic?.message ?? '');
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
  const activeComponents = hooks.activeComponents ?? new Set();
  const options = { ...hooks, childSources, activeComponents, createGlobals: hooks.createGlobals ?? readerProbeGlobals };
  let deps = dependencies;
  if (featureIndex.size === 0) indexFeatureSources();
  // Proactively mount parameterized children. Zero-argument components are
  // resolved lazily on the SDK diagnostic so page-level probes stay bounded.
  for (const match of source.matchAll(/\b([A-Z][A-Za-z0-9_]*)\s*\(\s*\{/g)) {
    const name = match[1];
    if (deps[name] !== undefined || !featureIndex.has(name) || activeComponents.has(name)) continue;
    const child = readFileSync(featureIndex.get(name), 'utf8');
    activeComponents.add(name);
    try {
      deps = { ...deps, [name]: createReaderComponentProbe(child, builderComponentMembers(child, name), deps,
        { ...hooks, componentName: name, activeComponents }).Component };
      if (childSources[name] === undefined) childSources[name] = child;
    } catch (_error) {
      try {
        const standIn = childStandIn(name, child);
        deps = { ...deps, [name]: createReaderComponentProbe(standIn, ['build'], deps,
          { ...hooks, componentName: name, activeComponents }).Component };
        childSources[name] = standIn;
      } catch (_stubError) { /* keep unresolved */ }
    } finally {
      activeComponents.delete(name);
    }
  }
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return createEtsBuilderProbe(source, names, deps, options);
    } catch (error) {
      const all = missingComponents(error);
      const pending = all.filter(name => deps[name] === undefined);
      if (process.env.PROBE_DEBUG && all.length > 0) console.error('AUTO-PENDING', pending, 'of', all,
        all.map(name => `${name}:${typeof deps[name]}`));
      // A dependency may already hold the component value without the SDK
      // knowing its prop metadata; register a minimal shape so the mount site
      // is accepted, then retry.
      const unregistered = all.filter(name => typeof deps[name] === 'function' && childSources[name] === undefined);
      if (pending.length === 0 && unregistered.length > 0) {
        for (const name of unregistered) childSources[name] = `@Component\nexport struct ${name} {\n  build() { Column() {} }\n}`;
        continue;
      }
      if (pending.length === 0) throw error;
      if (featureIndex.size === 0) indexFeatureSources();
      let added = false;
      for (const name of pending) {
        const path = featureIndex.get(name);
        if (path === undefined || activeComponents.has(name)) continue;
        const child = readFileSync(path, 'utf8');
        let mounted;
        activeComponents.add(name);
        try {
          mounted = createReaderComponentProbe(child, builderComponentMembers(child, name), deps,
            { ...hooks, componentName: name, activeComponents }).Component;
          if (childSources[name] === undefined) childSources[name] = child;
        } catch (_childError) {
          try {
            const standIn = childStandIn(name, child);
            mounted = createReaderComponentProbe(standIn, ['build'], deps,
              { ...hooks, componentName: name, activeComponents }).Component;
            childSources[name] = standIn;
          } catch (_stubError) { activeComponents.delete(name); continue; }
        } finally {
          activeComponents.delete(name);
        }
        deps = { ...deps, [name]: mounted };
        added = true;
      }
      if (!added) throw error;
    }
  }
  return createEtsBuilderProbe(source, names, deps, options);
}
