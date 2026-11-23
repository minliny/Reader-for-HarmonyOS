import assert from 'node:assert/strict';
import { createReaderBuilderProbe, readerBuilderCompilationCacheStats } from './lib/reader-control-builder-probe.mjs';
import { createArkUIPropertyRuntimeProbe } from './lib/arkui-property-runtime-probe.mjs';
import { actualReaderPageShell } from './lib/reader-page-shell-runtime-probe.mjs';

// Retained generic assertions from the withdrawn message framework test.
const policyA=actualReaderPageShell(),policyB=actualReaderPageShell();
assert.notEqual(policyA,policyB,'SDK module emit reuse preserves fresh production module exports');
assert.notEqual(policyA.readerPageInitialHeaderHeight,policyB.readerPageInitialHeaderHeight,'page policy functions bind independent actual module graphs');
const childSource="@Component export struct SdkCacheChild { @Prop message: string = ''; build() { Text(this.message); } }";
const parentSource="@Component struct SdkCacheParent { @State message: string = ''; onPress: () => void = () => {}; build() { Column() { Text('实际标题'); SdkCacheChild({ message: this.message }); Button('操作').onClick(() => this.onPress()); } } }";
function fixture(source=parentSource) {
  const properties=createArkUIPropertyRuntimeProbe();
  const hooks={...properties.hooks,childSources:{SdkCacheChild:childSource},mountChildren:true,lifecycleChildren:true};
  const Child=createReaderBuilderProbe(childSource,['message','build'],properties.sdk,hooks).Component;
  const owner=createReaderBuilderProbe(source,['message','onPress','build'],{...properties.sdk,SdkCacheChild:Child},hooks).owner;
  const walk=value=>[value,...[...(value.children?.values()??[])].flatMap(walk)];
  return {owner,walk,nodes:()=>walk(owner).flatMap(value=>[...value.nodes.values()])};
}
const beforeCache=readerBuilderCompilationCacheStats(),a=fixture(),b=fixture();
let left=0,right=0;a.owner.message='独立甲';b.owner.message='独立乙';
a.owner.onPress=()=>left++;b.owner.onPress=()=>right++;a.owner.initialRender();b.owner.initialRender();
assert.ok(readerBuilderCompilationCacheStats().hits>beforeCache.hits,'exact official SDK output is reused');
assert.notEqual(a.owner,b.owner);assert.notEqual(a.owner.__message,b.owner.__message,'state property owners remain independent');
assert.notEqual([...a.owner.children.values()][0],[...b.owner.children.values()][0],'cached lowering never shares nested components');
assert.ok(a.nodes().some(node=>node.create==='独立甲'));assert.ok(b.nodes().some(node=>node.create==='独立乙'));
a.nodes().find(node=>node.type==='Button').onClick();assert.deepEqual([left,right],[1,0],'cached callback closes over its own owner');
b.nodes().find(node=>node.type==='Button').onClick();assert.deepEqual([left,right],[1,1]);
const beforeChanged=readerBuilderCompilationCacheStats().compiles;
const changed=fixture(parentSource.replace('实际标题','不同源码标题'));changed.owner.initialRender();
assert.ok(readerBuilderCompilationCacheStats().compiles>beforeChanged,'source edits invalidate emitted-code reuse');
assert.ok(changed.nodes().some(node=>node.create==='不同源码标题'));
console.log('PASS generic installed-SDK lowering/page-policy cache: fresh module graphs, component/property/callback owners and exact-source invalidation; native layout remains separate.');
