import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {installedEtsCompiler} from './lib/ets-compiler-runtime.mjs';
const root=path.resolve(import.meta.dirname,'..'),base=path.join(root,'entry/src/main/ets');
const {ts}=installedEtsCompiler(),modules=new Map(),inputs=new Map();
function add(relative) {
  let file=path.resolve(base,relative);
  if(!existsSync(file))file+=existsSync(file+'.ts')?'.ts':'.ets';
  const id=path.relative(base,file).replaceAll('\\','/');
  if(modules.has(id))return id;
  if(id==='app/ReaderWindowCoordinator.ts') {modules.set(id,'exports.ReaderWindowCoordinator={metrics:()=>metrics};');return id;}
  const source=readFileSync(file,'utf8');inputs.set(id,source);modules.set(id,'');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}}).outputText;
  const bundled=output.replace(/require\("([^"]+)"\)/g,(_all,dep)=>{
    if(!dep.startsWith('.'))throw Error('Unexpected platform import '+dep);
    return `require(${JSON.stringify(add(path.relative(base,path.resolve(path.dirname(file),dep))))})`;
  });
  modules.set(id,bundled);return id;
}
for(const file of ['features/shell/MainNavigationSpec.ts','features/common/ReaderFloatingBarMetrics.ts',
  'features/common/ReaderPageGeometry.ts','features/common/ReaderTypography.ets','features/common/ReaderTokens.ets',
  'features/bookshelf/BookshelfGridSpec.ets','features/common/ReaderThemeRegistry.ts'])add(file);
const settings=readFileSync(path.join(base,'features/settings/SettingsGateway.ts'),'utf8');
const defaults=settings.match(/const DEFAULT_SNAPSHOT[^=]*=\s*({[\s\S]*?});/)[1];
const defaultRail=/wideNavigationRail:\s*true/.test(defaults);inputs.set('SettingsGateway.default',defaults);
const hash=createHash('sha256').update(JSON.stringify([...inputs])).digest('hex');
const bundle='const moduleFactories={'+[...modules].map(([k,v])=>JSON.stringify(k)+':function(require,module,exports){\n'+v+'\n}').join(',\n')+'};';
const icons={};
for(const key of ['library','settings'])for(const state of ['active','outline']) {
  const filename=`bookshelf_${key}_${state}.svg`;
  icons[key+'_'+state]='data:image/svg+xml;base64,'+readFileSync(path.join(root,'entry/src/main/resources/base/media',filename)).toString('base64');
}
const template=readFileSync(path.join(root,'docs/ui-design/main-navigation/demo.template.html'),'utf8');
const result=template.replace('/* PRODUCTION_MODULES */',bundle).replace('/* SNAPSHOT */',`const snapshot=${JSON.stringify({hash,defaultRail,icons})};`);
const output=path.join(root,'docs/ui-design/main-navigation/reader-navigation-dual-mode.html');writeFileSync(output,result);
console.log(JSON.stringify({output,sourceSha256:hash,modules:modules.size,defaultRail}));
