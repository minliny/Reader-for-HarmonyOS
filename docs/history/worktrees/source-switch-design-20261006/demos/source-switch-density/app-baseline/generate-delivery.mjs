import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as config from './delivery-config.mjs';
import {screens as library} from './ui-library.mjs';
import {screens as settings} from './ui-settings.mjs';
import {screens as reading} from './ui-reading.mjs';
import {specifications as libSpec} from './spec-library.mjs';
import {specifications as settingsSpec} from './spec-settings.mjs';
import {specifications as readingSpec,motionSpec} from './spec-reading.mjs';
import {fixtures} from './shared.mjs';
import {overview} from './logic-overview.mjs';
const clean=s=>String(s).replaceAll('|','\\|').replaceAll('\n','<br>');
const table=(headers,rows)=>`| ${headers.join(' | ')} |\n| ${headers.map(()=>'---').join(' | ')} |\n${rows.map(row=>`| ${row.map(clean).join(' | ')} |`).join('\n')}\n`;
const sourceLinks=(items,host)=>items.map(s=>`[${path.basename(s.path)}:${s.line}](${path.join(host,s.path)}:${s.line})`).join('、');
const diagramMarkdown=route=>`${route.summary}\n\n\`\`\`mermaid\n${route.diagram.trim()}\n\`\`\`\n\n`;
async function readRoutes(here,screens){
  const routes={};
  for(const name of ['library','settings','reading']){
    const part=JSON.parse(await readFile(path.join(here,`routes-${name}.json`),'utf8'));
    for(const [id,route]of Object.entries(part)){
      if(routes[id])throw new Error(`Duplicate route diagram: ${id}`);
      if(!route.summary||!/^flowchart (TD|LR)\n/.test(route.diagram))throw new Error(`Invalid route diagram: ${id}`);
      routes[id]=route;
    }
  }
  for(const s of screens)if(!routes[s.id])throw new Error(`Missing route diagram: ${s.id}`);
  for(const id of Object.keys(routes))if(!screens.some(s=>s.id===id))throw new Error(`Unreachable route diagram: ${id}`);
  return routes;
}
export const deliverySourcePaths=[...new Set([...Object.values({...libSpec,...settingsSpec,...readingSpec}).flatMap(s=>s.sources),...motionSpec.flatMap(s=>s.sources)].map(s=>s.path))];
export async function generateDelivery({here,host,snapshot,registry,fontFiles,licenseFiles,sha}){
  const all=[...library,...settings,...reading], specs={...libSpec,...settingsSpec,...readingSpec};
  if(new Set(all.map(s=>s.id)).size!==all.length)throw new Error('Duplicate screen id');
  for(const s of all){if(!specs[s.id])throw new Error(`Missing delivery spec: ${s.id}`);for(const k of ['layout','typography','behavior','adaptation','sources'])if(!specs[s.id][k]?.length)throw new Error(`Empty ${s.id}.${k}`);}
  for(const id of Object.keys(specs))if(!all.some(s=>s.id===id))throw new Error(`Unreachable spec: ${id}`);
  for(const p of [...all.flatMap(s=>s.source),...Object.values(specs).flatMap(s=>s.sources),...motionSpec.flatMap(s=>s.sources)]){const lines=(await readFile(path.join(host,p.path),'utf8')).split('\n');if(p.line<1||p.line>lines.length)throw new Error(`Invalid source ${p.path}:${p.line}`);}
  const typePath='entry/src/main/ets/features/common/ReaderTypography.ets';
  const text=await readFile(path.join(host,typePath),'utf8');
  // Compile the application's pure style declarations with the existing upstream
  // compiler. This preserves aliases, inline/inherited roles and signed spacing.
  let esbuild;try{esbuild=await import('esbuild');}catch{esbuild=await import(path.join(path.dirname(host),'evidence/opensource-completion/renderer-pilot/node_modules/esbuild/lib/main.js'));}
  const compiled=await esbuild.build({entryPoints:[path.join(host,typePath)],bundle:true,format:'esm',write:false,loader:{'.ets':'ts'},target:'es2020'});
  const nativeStyles=await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
  const roleLines=new Map([...text.matchAll(/export const (TYPE_\w+)/g)].map(m=>[m[1],text.slice(0,m.index).split('\n').length]));
  const typography=[...roleLines].map(([role,line])=>{
    const style=nativeStyles[role];if(!style)throw new Error(`Unresolved typography ${role}`);
    return {role,family:style.fontFamily??null,weight:style.fontWeight??null,fontSize:style.fontSizeFp??null,lineHeight:style.lineHeightFp??null,letterSpacing:style.letterSpacingFp??null,scalePolicy:style.scalePolicy??'inherited',origin:style.source??'owningText',kind:style instanceof nativeStyles.ReaderInheritedTextStyle?'inherited':style instanceof nativeStyles.ReaderInlineTextStyle?'inline':'explicit',path:typePath,line};
  });
  if(typography.length!==[...text.matchAll(/export const TYPE_/g)].length)throw new Error(`Typography extraction drift: ${typography.length}`);
  const fontLicense=name=>name.startsWith('Inter')?'Inter-OFL.txt':name.startsWith('Noto')?'Noto-OFL.txt':name.startsWith('LXGWWenKaiGB')?'LXGWWenKaiGBLite-OFL.txt':name.startsWith('LXGWWenKaiLite')?'LXGWWenKaiLite-OFL.txt':name.startsWith('Sarasa')?'SarasaGothic-OFL.txt':'ZhuqueFangsong-OFL.txt';
  const fonts=fontFiles.map(name=>({name,path:`entry/src/main/resources/rawfile/${name}`,sha256:snapshot.inputs[`entry/src/main/resources/rawfile/${name}`],license:fontLicense(name)}));
  for(const f of fonts)if(!licenseFiles.includes(f.license))throw new Error(`Missing font license ${f.name}`);
  const icons=[];for(const name of snapshot.media.filter(n=>n.endsWith('.svg'))){const p=`entry/src/main/resources/base/media/${name}`;const text=await readFile(path.join(host,p),'utf8');icons.push({name,path:p,sha256:snapshot.inputs[p],viewBox:text.match(/viewBox="([^"]+)"/)?.[1]??null});}
  const screens=all.map(s=>({id:s.id,label:s.label,kind:s.kind??'page',background:s.background??null,variants:s.variants,closeBlockedVariants:s.closeBlockedVariants??[],temporaryVariants:s.temporaryVariants??[],closeToVariant:typeof s.closeToVariant==='function'?Object.fromEntries((s.temporaryVariants??[]).map(v=>[v,s.closeToVariant(v)])):s.closeToVariant??{},quickVariantByFull:s.quickVariantByFull??{},backgroundByVariant:s.backgroundByVariant??{},dismissable:s.dismissable!==false,spec:specs[s.id]}));
  const designInputs={};for(const name of (await readdir(here)).filter(n=>/\.(mjs|css)$/.test(n)||/^routes-(library|settings|reading)\.json$/.test(n)||n==='index.html').sort())designInputs[name]=sha(await readFile(path.join(here,name)));
  let references;
  try {const manifest=JSON.parse(await readFile(path.join(here,'references/manifest.json'),'utf8'));references={status:manifest.sourceTreeSha256===snapshot.sourceTreeSha256&&manifest.designSourceSha256===sha(JSON.stringify(designInputs))?'CURRENT':'HISTORICAL_STALE',manifest:'references/manifest.json',sourceTreeSha256:manifest.sourceTreeSha256,designSourceSha256:manifest.designSourceSha256,generatedAt:manifest.generatedAt};}
  catch {references={status:'NOT_GENERATED',manifest:'references/manifest.json'};}
  const sharedMotion={id:'press-feedback',label:'公共按压反馈',origin:'源码事实',trigger:'按下 / 释放 / touch cancel',properties:'当前surface与TOK_ACCENT的12%alpha混合，圆角沿ReaderPressFeedback构造值。',duration:'事件即时；源码无过渡时长',curve:'无额外补间',interruption:'松开、取消或禁用恢复原表面；业务selected状态由owner保持。',reducedMotion:'保留颜色反馈，不增加空间运动。',sources:[{path:'entry/src/main/ets/features/common/ReaderPressFeedback.ets',line:31}]};
  const delivery={schemaVersion:1,origin:'source-derived-design-and-explicit-porting-decisions',sourceTreeSha256:snapshot.sourceTreeSha256,designSourceSha256:sha(JSON.stringify(designInputs)),designInputs,generatedAt:snapshot.generatedAt,...config,fixtures,screens,typography,motion:[sharedMotion,...motionSpec],theme:registry,assets:{fonts,icons,licenses:licenseFiles.map(name=>({name,path:`entry/src/main/resources/rawfile/${name}`,sha256:snapshot.inputs[`entry/src/main/resources/rawfile/${name}`]}))},verification:{browser:references.status,references,iosNative:false,androidNative:false,harmonyNative:false,backend:false}};
  await writeFile(path.join(here,'delivery.json'),JSON.stringify(delivery,null,2)+'\n');
  await generateLogic({here,host,delivery});
}
export async function generateLogic({here,host,delivery}){
  const {screens,typography,assets:{fonts}}=delivery;
  const currentIds=[...library,...settings,...reading].map(s=>s.id).sort();
  if(JSON.stringify(screens.map(s=>s.id).sort())!==JSON.stringify(currentIds))throw new Error('Delivery screen coverage drift; run build.mjs before regenerating logic');
  const routes=await readRoutes(here,screens);
  let md=`<!-- delivery:start -->\n\n## 跨平台交付范围与参数来源\n\n本节与 UI 稿底部的实现规格由同一份参数生成，登记 ${screens.length} 个界面/组件、${screens.reduce((a,s)=>a+s.variants.length,0)} 个状态样本；不新增产品页面。\n\n逐页规格分别标明源码事实、用户指定的样式调整和移植决定。“书籍操作”采用用户指定的旧漫画 demo 样式，原生应用尚未同步。iOS / Android 的安全区、字体缩放、触摸与系统界面映射为移植决定；这些设计参数可供原生实现，尚未取得两端原生截图及业务验收。\n\n### 单位、公共组件与平台映射\n\n${table(['公共布局（源码）','值'],config.sharedGeometry)}\n${table(['移植决定','规则'],config.platformRules)}\n\n平台依据：${config.platformSources.map(s=>`[${s.label}](${s.url})`).join('、')}。\n\n安全区/键盘预览使用下列测试输入，不绑定实际设备型号；上线读取 OS 实时值。\n\n${table(['样本','窗口','上 / 右 / 下 / 左'],config.profiles.map(p=>[p.label,`${p.width}×${p.height}`,p.insets.join(' / ')]))}\n\n### 排版、换行与资产\n\n${table(['规则','交付约束'],config.typographyRules)}\n\n字体角色直接从 ReaderTypography.ets 提取；null 行高代表 AUTO；null 字族、字重或字号保留原生继承，inline role由所属正文提供尺寸。下表之外的领域文字由逐页规格给定。\n\n${table(['角色','字族','字号 / 行高','字重','缩放owner'],typography.map(t=>[t.role,t.family??'继承',`${t.fontSize??'继承'} / ${t.lineHeight??'AUTO'}`,t.weight??'继承',t.scalePolicy]))}\n\n${table(['字体文件','SHA-256','许可'],fonts.map(f=>[f.name,f.sha256,f.license]))}\n\n原 SVG、完整主题RGBA、字体和许可文件路径以及文件指纹在 [delivery.json](delivery.json)；各端打包原文件与许可。UI 的“文字/换行”页提供中文、标点、数字、长书名、URL、扩展字样本。缺字回退、AUTO 行高及系统字族各端须记录实测结果。\n\n### 逐页尺寸、状态与适配\n\n`;
  md+=table(['路线索引','模块'],[['书架与搜索',library],['设置与书源',settings],['阅读与离线',reading]].map(([label,group])=>[label,group.map(s=>`[${s.label}](#route-${s.id})`).join(' · ')]))+'\n';
  for(const s of screens){md+=`<a id="route-${s.id}"></a>\n\n#### ${s.label}（${s.id}）\n\n**入口与动作路线**\n\n${diagramMarkdown(routes[s.id])}已有状态：${s.variants.map(v=>v.label).join('、')}。\n\n`;for(const[k,label]of [['layout','尺寸与约束'],['typography','排版'],['behavior','行为与状态'],['adaptation','移植适配']])md+=`**${label}**\n\n${s.spec[k].map(v=>`- ${v}`).join('\n')}\n\n`;md+=`来源：${sourceLinks(s.spec.sources,host)}。\n\n`;}
  md+='### 动效、手势与中断\n\n';
  for(const m of delivery.motion)md+=`#### ${m.label}\n\n${table(['参数','值'],[['来源',m.origin],['触发',m.trigger],['几何/属性',m.properties],['时长',m.duration],['曲线',m.curve],['中断',m.interruption],['减少动态效果',m.reducedMotion]])}\n来源：${sourceLinks(m.sources,host)}。\n\n`;
  md+=`### 参考图与原生验收\n\n[参考图清单](references/manifest.json)保留浏览器设计图、夹具、度量和指纹。当前图片状态为 **${delivery.verification.references?.status||'NOT_GENERATED'}**；仅当源码和设计指纹同时一致时才能用作本版参考。本次修复未重新生成浏览器图，历史图片不能代表修复后的视觉效果。它们也不是 Harmony / iOS / Android 运行截图，原生验证仍未完成。\n\n${table(['范围','门槛'],config.acceptance)}\n\n系统弹窗与键盘比较动作、文案和恢复逻辑，自绘界面比较几何/资产/主题/排版。减少动态效果只取消非必要空间运动，不能跳过业务回执。字体回退及原生文字引擎导致的差异必须记录并校准；不能用浏览器截图通过代替两端“原样还原”验收。\n\n重新生成参数/逻辑稿/浏览器bundle：在 Host 执行 \`node docs/ui-design/app-baseline/build.mjs\`；生成参考图执行 \`node docs/ui-design/app-baseline/render-references.mjs\`，复用本机已有 Playwright。生成器会拒绝缺页规格、无效源码引用及缺少或重复的模块路线图。只更新逻辑稿路线、保持已交付 UI 参数与 bundle 时，执行 \`node docs/ui-design/app-baseline/generate-delivery.mjs --logic-only\`。\n\n<!-- delivery:end -->`;
  const baseline=JSON.parse(await readFile(path.join(here,'baseline.json'),'utf8'));
  const provenance=`Host 基线为 \`${baseline.host.branch} / ${baseline.host.head}\`；${baseline.host.dirtySourceFiles.length ? '包含当前未提交的源码修改，具体文件见输入清单。' : '当前输入源码无未提交修改。'}`;
  const header=overview.replaceAll('__HOST_BASELINE__',provenance).replaceAll('__MODULE_COUNT__',String(screens.length));
  await writeFile(path.join(here,'LOGIC.md'),header+'\n\n'+md+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==3||process.argv[2]!=='--logic-only')throw new Error('Usage: node generate-delivery.mjs --logic-only');
  const here=path.dirname(fileURLToPath(import.meta.url)),host=path.resolve(here,'../../..');
  const delivery=JSON.parse(await readFile(path.join(here,'delivery.json'),'utf8'));
  await generateLogic({here,host,delivery});
  console.log(JSON.stringify({logicOnly:true,routeModules:delivery.screens.length}));
}
