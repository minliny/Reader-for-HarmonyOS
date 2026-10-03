import {foundationControls} from './lib/reader-foundation-control-probe.mjs';
import {createReaderBuilderProbe} from './lib/reader-control-builder-probe.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadReaderTypographyRoles, readerTypographyRoles } from './lib/reader-typography-probe.mjs';

const source = readFileSync(new URL('../entry/src/main/ets/features/source/SourceToolsPage.ets', import.meta.url), 'utf8');
const baseline = JSON.parse(readFileSync(new URL('./fixtures/design/source-tools-typography-baseline.json', import.meta.url)));
const properties = {
  fontFamily: 'fontFamily', fontWeight: 'fontWeight', fontSize: 'fontSizeFp',
  lineHeight: 'lineHeightFp', letterSpacing: 'letterSpacingFp',
};
assert.equal(baseline.nodes.length, 25, 'baseline covers the full source-tools text family');
assert.equal(new Set(baseline.nodes.map(node => node.role)).size, 14, 'distinct authored tuples have bounded roles');

const expectedBindings = new Map();
const moved = new Map([['smallButton', {component:'ReaderButton',args:['原小操作',true,()=>{}]}],['actionButton',{component:'ReaderButton',args:['原操作',true,true,()=>{}]}],['fullWidthActionButton',{component:'ReaderButton',args:['原全宽操作',true,()=>{}]}],['debugCard',{component:'ReaderFormField',args:[]}],['editorCard',{component:'ReaderFormField',args:[]}]]);
const isMoved=node=>moved.has(node.method)&&(node.method!=='debugCard'||node.type==='TextInput')&&(node.method!=='editorCard'||node.type==='TextArea');
let movedCount=0;
for (const node of baseline.nodes) {
  const style = readerTypographyRoles[node.role];
  assert.ok(style, `${node.role}: real role export is loadable`);
  for (const [nativeProperty, property] of Object.entries(properties)) {
    assert.equal(style[property], node.tuple[nativeProperty], `${node.method}/${node.index}: ${property} preserves value or AUTO`);
    if (!isMoved(node) && Object.hasOwn(node.tuple, nativeProperty)) {
      const key = `${node.role}.${property}`;
      expectedBindings.set(key, (expectedBindings.get(key) ?? 0) + 1);
    }
  }
  assert.equal(style.scalePolicy, 'system');
  assert.equal(style.source, 'appBaseline');
}
for (const [binding, expected] of expectedBindings) {
  assert.equal(source.split(binding).length - 1, expected, `${binding}: all authored consumers are migrated`);
}
for(const original of baseline.nodes.filter(isMoved)){
  const entry=moved.get(original.method),shared=foundationControls();
  const {owner}=createReaderBuilderProbe(source,[original.method,'heading','debugLogRow','actionButton','canWriteSources'],
    {...shared.dependencies,LazyForEach:{create(){},pop(){}}},shared.hooks);
  Object.assign(owner,{appThemeScheme:'day',snapshot:{debugSourceId:'',checkMode:'search',checkDepth:2,debugKey:'原草稿',debugLogs:[],editorSourceId:'source',editorText:'{}'},
    debugLogDataSource:{},onDebugKeyChanged(){},onCheckSelectionChanged(){}});
  owner[original.method](...entry.args);
  const child=[...owner.children.values()].find(c=>c.constructor===shared.dependencies[entry.component]&&(original.type!=='TextArea'||c.specId==='source-code'));
  assert.ok(child,original.method+': actual former carrier constructs public producer');
  const carriers=shared.nodes(child).filter(n=>n.type===original.type);assert.equal(carriers.length,1,original.method+': '+JSON.stringify(shared.nodes(child).map(n=>n.type)));
  const actual=Object.fromEntries(Object.keys(properties).filter(p=>Object.hasOwn(carriers[0],p)).map(p=>[p,carriers[0][p]]));
  assert.deepEqual(actual,original.tuple,original.method+': original tuple and AUTO are retained by real SDK/native shared control');
  movedCount++;
}
assert.equal(movedCount,5,'all five former private controls have exact real shared SDK carriers');
assert.equal((source.match(/\.fontSize\(/g) ?? []).length,20);
assert.equal((source.match(/\.fontSize\(TYPE_SOURCE_TOOLS_[A-Z_]+\.fontSizeFp\)/g) ?? []).length,20,
  '20 current direct + five real public carriers preserve all 25 original nodes');
assert.doesNotMatch(source, /\.fontFamily\(['"]|\.fontSize\(\d|\.lineHeight\(\d|\.fontWeight\(FontWeight/,
  'the whole page must not retain a private physical tuple');

// The shared probe automatically discovers future roles instead of requiring
// each existing test to add another hard-coded dependency object.
const typographySource = readFileSync(new URL('../entry/src/main/ets/features/common/ReaderTypography.ets', import.meta.url), 'utf8');
const extended = loadReaderTypographyRoles(`${typographySource}\nexport const TYPE_PROBE_NEW_ROLE = TYPE_SOURCE_TOOLS_NOTE;\n`);
assert.deepEqual(extended.TYPE_PROBE_NEW_ROLE, extended.TYPE_SOURCE_TOOLS_NOTE);

console.log('PASS source-tools complete text family: 25 nodes / 14 real roles, explicit tuples and AUTO preserved');
