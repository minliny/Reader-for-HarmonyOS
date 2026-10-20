import { readFileSync } from 'node:fs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { foundationControls } from './reader-foundation-control-probe.mjs';
import * as geometry from '../../entry/src/main/ets/features/reading/ReaderControlSearchGeometry.ts';
import * as motion from '../../entry/src/main/ets/features/reading/ReaderControlMotionPresentation.ts';

const actualSource = readFileSync(new URL('../../entry/src/main/ets/features/reading/ReaderControlSearchContent.ets', import.meta.url), 'utf8');

// Compile the shipping parent and shipping field/modifier. Only native
// focus/controller APIs remain platform seams; this does not implement focus,
// draft, geometry or keyboard policy on behalf of the consumer.
export function readerContentSearchFieldProbe(source = actualSource) {
  const controls = foundationControls();
  const probe = createReaderBuilderProbe(source, ['queryInputId', 'queryInputMounted', 'inputController',
    'query', 'appThemeScheme', 'onQueryChange', 'onTemporaryLayerChange',
    'focusQueryField', 'searchField', 'searchAction', 'frame', 'presentation', 'submit', 'canSearch'],
    { ...controls.dependencies, ...geometry, ...motion, readerContentSearchInputSequence: 0,
      TextInputController: class { stopCalls = 0; stopEditing() { this.stopCalls++; } } }, controls.hooks);
  return { ...probe, controls, nodes: owner => controls.orderedNodes(owner) };
}
