// Pure inference: no source reads, clocks, randomness or evidence fabrication.
// Layer facts, navigation facts and acceptance results are separate inputs.
const matches = (input, when) => Object.entries(when).every(([key, value]) => input[key] === value);
export function prototypeForBrief(brief, model) {
  const base = model.prototypes.find(p => matches(brief, p.when));
  if (!base) return null;
  const variant = (base.compositionVariants ?? []).find(v => matches(brief, v.when));
  return variant ? { ...base, headerRole: variant.headerRole, regions: variant.regions } : base;
}
export function deriveStructure(brief, model, routeContract = null) {
  const required = ['purpose', 'role', 'content', 'queryPriority', 'queryComplexity', 'queryFrequency', 'collectionLength',
    'navigationPersistence', 'contentImmersive', 'titleCanExit', 'alternateNavigation', 'primaryActionScope', 'selectionMode'];
  for (const key of required) if (brief[key] === undefined || brief[key] === 'UNRESOLVED') throw Error(`BRIEF: missing/unresolved ${key}`);
  if (Object.hasOwn(brief, 'queryHeightClass')) throw Error('BRIEF: queryHeightClass is derived from measured queryViewport, not author input');
  let decisionInput = brief;
  if (brief.queryViewport !== undefined) {
    const budget = brief.queryViewport;
    const names = ['availableHeight', 'fixedChromeHeight', 'minimumContentHeight'];
    if (brief.queryPriority !== 'primary' || !budget || Array.isArray(budget) ||
        Object.keys(budget).length !== names.length || Object.keys(budget).some(key => !names.includes(key)) ||
        names.some(key => typeof budget[key] !== 'number' || !Number.isFinite(budget[key])) ||
        budget.availableHeight <= 0 || budget.fixedChromeHeight < 0 || budget.minimumContentHeight <= 0) {
      throw Error('BRIEF: primary queryViewport requires finite measured available/fixed/minimum heights');
    }
    // This is the unbounded requirement of the candidate fixed layout, not
    // the zero inset after fallback. Using post-fallback geometry would flip
    // the decision back and forth on each layout pass.
    decisionInput = { ...brief, queryHeightClass:
      budget.fixedChromeHeight + budget.minimumContentHeight > budget.availableHeight ? 'constrained' : 'sufficient' };
  }
  if (brief.purpose === 'read' && (brief.role !== 'reader' || brief.content !== 'canvas' || brief.navigationPersistence === 'required')) throw Error('BRIEF: reader requires canvas/reader role without standard persistent navigation');
  if (brief.purpose === 'select' && (brief.content !== 'collection' || brief.selectionMode === 'none')) throw Error('BRIEF: selection requires selectable collection');
  if (brief.purpose === 'search' && (brief.content !== 'collection' || brief.queryPriority !== 'primary')) throw Error('BRIEF: compound search requires primary query and result collection');
  if (brief.purpose === 'inspect' && brief.content !== 'document') throw Error('BRIEF: detail requires document content');
  if (brief.role === 'reader' && brief.purpose !== 'read') throw Error('BRIEF: reader role requires reading purpose');
  if (brief.purpose === 'select' && brief.primaryActionScope !== 'global' &&
      !(brief.selectionMode === 'single' && brief.primaryActionScope === 'perItem')) {
    throw Error('BRIEF: selection requires direct single-row commit or a global commit action');
  }
  const prototype = prototypeForBrief(brief, model);
  if (!prototype) throw Error('PROTOTYPE: no supported prototype; do not infer from appearance');
  const output = { modelVersion: model.modelVersion, prototype: prototype.id };
  for (const [key, decision] of Object.entries(model.decisions)) {
    const found = decision.rules.find(rule => matches(decisionInput, rule.when));
    const value = found ? found.result : decision.default;
    if (value === null || value === undefined || value === 'UNRESOLVED') throw Error(`DECISION: unresolved ${key}`);
    output[key] = value;
  }
  if (!prototype.headerPresentations.includes(output.header)) throw Error(`GRAMMAR: ${prototype.id} disallows header ${output.header}; resolve Brief`);
  if (!prototype.queryPlacements.includes(output.query)) throw Error(`GRAMMAR: ${prototype.id} disallows query ${output.query}; resolve Brief`);
  output.headerRole = prototype.headerRole;
  if (routeContract) output.routeContractRef = routeContract.routeId;
  return output;
}
