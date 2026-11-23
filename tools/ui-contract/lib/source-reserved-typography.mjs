export const sourceReservedTypographyCase = 'source-management.supplemental-reserved-typography-366-font-130';
export const sourceReservedTypographyFixture = 'public-source-reserved-typography-366-font-130';
export const sourceReservedTypographyFixtureV2 = 'public-source-reserved-typography-366-font-130-v2';
export const sourceReservedTypographyNarrowCase = 'source-management.supplemental-reserved-typography-320-font-130';
export const sourceReservedTypographyNarrowFixture = 'public-source-reserved-typography-320-font-130-v1';
export const reservedStatusReveal = 'reveal-unchecked';
export const reservedStatusReady = 'unchecked-control-ready';
export const sourceReservedTypographyInput = 'reserved-source-host';
export const publicReservedSourceHost = 'source-01.reader-phase1.invalid';
export const reservedSourceSample = 'reserved-row';
export const reservedSourceToggle = 'reader-source-public-toggle-fixture';
const nativeToggleKey = /^reader-toggle:source-back:[1-9]\d*:https:\/\/source-01\.reader-phase1\.invalid\/:(?:0|[1-9]\d*)$/u;

export function matchesReservedSourceNativeToggle(value) {
  return typeof value === 'string' && nativeToggleKey.test(value);
}

export function sourceReservedTypographySample(fixture, step) {
  return (fixture?.id === sourceReservedTypographyFixture || usesReservedNativeToggle(fixture?.id)) &&
    step?.id === reservedSourceSample;
}

export function isReservedTypographyCase(id) {
  return id === sourceReservedTypographyCase || id === sourceReservedTypographyNarrowCase;
}

export function usesReservedNativeToggle(fixtureId) {
  return fixtureId === sourceReservedTypographyFixtureV2 || fixtureId === sourceReservedTypographyNarrowFixture;
}

export function applyReservedTypographyNarrowWindow(contract) {
  contract.id = sourceReservedTypographyNarrowCase;
  contract.version = 1;
  contract.fixture.id = sourceReservedTypographyNarrowFixture;
  contract.fixture.description = 'Measure the normal populated public directory at effective system font 1.30 in an actual 320vp window. Reveal the unchecked status control inside its native scroll lane, then use it and the normal query to measure the same preserved disabled row without mutating the catalog.';
  const statusAnchor = 'reader-source-status-unchecked';
  const initial = contract.steps.find(step => step.id === 'source-ready');
  initial.anchors = initial.anchors.filter(anchor => anchor !== statusAnchor);
  const statusIndex = contract.steps.findIndex(step => step.id === 'select-unchecked');
  contract.steps[statusIndex].from = reservedStatusReady;
  contract.steps.splice(statusIndex, 0, {
    id:reservedStatusReveal,kind:'action',op:'swipe',from:initial.id,target:'reader-source-status-filter',
    path:{from:[.9,.5],to:[.12,.5],speed:450},
  },{
    id:reservedStatusReady,kind:'locate',anchors:['reader-source-status-filter',statusAnchor],
    keyboard:false,afterAction:reservedStatusReveal,quietMs:500,
  });
  for (const {expected} of contract.assertions) {
    if (expected.minWidthVp === undefined) continue;
    expected.minWidthVp = 319.6;
    expected.maxWidthVp = 320.4;
  }
  return contract;
}
