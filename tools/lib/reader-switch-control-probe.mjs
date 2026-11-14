import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { readerAppColor } from '../../entry/src/main/ets/ui/foundation/ReaderThemeRegistry.ts';
import { readerTypographyRoles } from './reader-typography-probe.mjs';
import { productionReaderPressFeedback } from './reader-press-feedback-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './arkui-property-runtime-probe.mjs';
import { createReaderBuilderProbe } from './reader-control-builder-probe.mjs';
import { boundedMembers } from './bounded-surface-sdk-probe.mjs';
import { readerFoundationTokens } from './reader-tokens-probe.mjs';
import { installedEtsCompiler } from './ets-compiler-runtime.mjs';
const read=name=>readFileSync(new URL('../../entry/src/main/ets/ui/controls/'+name+'.ets',import.meta.url),'utf8');
export const toggleSource=read('ReaderToggle'),segmentSource=read('ReaderSegmentedControl');
const controlRecipe=source=>source.slice(source.indexOf('type Reader'),source.indexOf('/** Controlled'));
export const switchSpecSource=controlRecipe(toggleSource)+controlRecipe(segmentSource);
const formRowSource=read('ReaderFormRow');
export function switchSpecs(source=switchSpecSource){return new Function(stripTypeScriptTypes(source).replace(/^export /gm,'')+';return{resolveReaderToggleSpec,resolveReaderSegmentSpec,READER_APP_THEME_SEGMENT_WIDTH};')();}
export function switchControls({specs=switchSpecs(),toggleDefinition=toggleSource,segmentDefinition=segmentSource,properties=createArkUIPropertyRuntimeProbe(),ColorMetrics,accessibility={sendAccessibilityEvent:async()=>{}}}={}){
 const {root,require}=installedEtsCompiler();
 require(root+'/lib/validate_ui_syntax.js').builderParamObjectCollection.set('ReaderFormRow',new Set(['content']));
  // The official advanced V2 component crosses a finite constructor/event
  // port here. Its internal layout, focus and rendering stay native evidence.
  const syntax = require(root + '/lib/validate_ui_syntax.js');
  const nativeProps = ['items', 'selectedIndex', 'onItemClicked', 'itemSpace', 'itemMinHeight', 'itemPadding',
    'itemBorderRadius', 'itemFontColor', 'itemSelectedFontColor', 'buttonPadding', 'buttonMinHeight',
    'itemSelectedBackgroundColor', 'itemShadow', 'buttonBackgroundColor', 'buttonBorderRadius'];
  syntax.componentCollection.customComponents.add('CapsuleSegmentButtonV2');
  syntax.propCollection.set('CapsuleSegmentButtonV2', new Set(nativeProps));
  class CapsuleSegmentButtonV2Port {
    constructor(owner, params, _storage, id) { Object.assign(this, { owner, params, id }); }
    updateStateVars(params) { Object.assign(this.params, params); }
  }
  class SegmentButtonV2ItemsPort extends Array {
    static get [Symbol.species]() { return Array; }
    constructor(items) { super(...items); }
  }
  class TextModifierPort {
    constructor() {
      const target = { attributes: {} };
      const proxy = new Proxy(target, { get(value, key) {
        if (key in value) return value[key];
        return argument => { value.attributes[key] = argument; return proxy; };
      } });
      return proxy;
    }
  }
  const frameText = segmentDefinition.slice(segmentDefinition.indexOf('class ReaderSegmentPolicyFrame'),
    segmentDefinition.indexOf('type ReaderSegmentSpecId'));
  const Frame = new Function('FrameCallback', stripTypeScriptTypes(frameText) + ';return ReaderSegmentPolicyFrame;')(class {});
  const toggleFrameText = toggleDefinition.slice(toggleDefinition.indexOf('class ReaderToggleFocusFrame'),
    toggleDefinition.indexOf('type ReaderToggleSpecId'));
  const ToggleFocusFrame = new Function('FrameCallback', stripTypeScriptTypes(toggleFrameText) + ';return ReaderToggleFocusFrame;')(class {});
  const dependencies = { accessibility, ReaderToggleFocusFrame: ToggleFocusFrame, ...properties.sdk, ...specs, ...readerFoundationTokens, ...readerTypographyRoles, readerAppColor,
    ReaderPressFeedback: productionReaderPressFeedback({ ColorMetrics }),
    CapsuleSegmentButtonV2: CapsuleSegmentButtonV2Port, SegmentButtonV2Items: SegmentButtonV2ItemsPort,
    TextModifier: TextModifierPort, ReaderSegmentPolicyFrame: Frame,
    uiContext: { getFont: () => ({}), isAvailable: () => true, isFollowingSystemFontScale: () => true, getMaxFontScale: () => 3 },
    AccessibilityRoleType: { SWITCH: 'AccessibilityRoleType.SWITCH', RADIO: 'AccessibilityRoleType.RADIO' },
  };
 const hooks={...properties.hooks,childSources:{ReaderToggle:toggleDefinition,ReaderSegmentedControl:segmentDefinition,ReaderFormRow:formRowSource},mountChildren:true,lifecycleChildren:true,allowEmptyBranchAdmission:true};
 const toggle=createReaderBuilderProbe(toggleDefinition,boundedMembers(toggleDefinition),dependencies,hooks);
 const segment=createReaderBuilderProbe(segmentDefinition,boundedMembers(segmentDefinition),dependencies,hooks);
 const row=createReaderBuilderProbe(formRowSource,boundedMembers(formRowSource),dependencies,hooks);
 Object.assign(dependencies,{ReaderToggle:toggle.Component,ReaderSegmentedControl:segment.Component,ReaderFormRow:row.Component});
  const capsules = owner => [
    ...[...owner.children.values()].filter(child => child instanceof CapsuleSegmentButtonV2Port),
    ...[...owner.children.values()].flatMap(child => child.children ? capsules(child) : []),
  ];
  const choices = owner => {
    const capsule = capsules(owner).at(-1);
    if (capsule === undefined) return nodes(owner).filter(node => node.type === 'Button' && node.onClick);
    const params = capsule.params;
    const click = params.onItemClicked;
    return params.items.map((item, index) => ({
      evidence: 'official-V2 parameter/event port', onClick: () => click(index),
      accessibilitySelected: index === params.selectedIndex,
      constraintSize: { minHeight: params.itemMinHeight.value }, border: item.textModifier?.attributes.border,
    }));
  };
 const nodes=owner=>[...owner.nodes.values(),...[...owner.children.values()].flatMap(child=>child.nodes?nodes(child):[])];
 return {toggle,segment,row,dependencies,hooks,properties,nodes,choices,capsules,
  consumer(source,members,extra={},params={}){return createReaderBuilderProbe(source,members,{...dependencies,...extra},{...hooks,initialParams:params}).owner;},
  mount(probe,params){Object.assign(probe.owner,params);probe.owner.aboutToAppear();probe.owner.initialRender();return probe.owner;},
  update(owner,params){const current=Object.fromEntries(Object.keys(owner).filter(k=>k.startsWith('__')).map(k=>[k.slice(2),owner[k.slice(2)]]));owner.updateStateVars({...current,...params});properties.flush();},
 };
}
