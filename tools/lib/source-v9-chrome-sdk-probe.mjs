import { readFileSync } from 'node:fs';
import { boundedMembers } from './bounded-surface-sdk-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import * as fonts from '../../entry/src/main/ets/ui/foundation/ReaderFontFamilies.ts';

const source = readFileSync(new URL('../../entry/src/main/ets/features/source/ui/SourceV9Chrome.ets', import.meta.url), 'utf8');

export function sourceV9ChromeControls(dependencies, hooks, names = ['SourceV9TypeSeal', 'SourceV9CircleCheck', 'SourceV9DetectButton']) {
  const children = {};
  for (const componentName of names) {
    children[componentName] = createReaderBuilderProbe(source, boundedMembers(source, componentName),
      { ...dependencies, ...fonts }, { ...hooks, componentName }).Component;
  }
  return {
    dependencies: { ...dependencies, ...children },
    hooks: { ...hooks, childSources: { ...hooks.childSources, ...Object.fromEntries(names.map(name => [name, source])) } },
  };
}
