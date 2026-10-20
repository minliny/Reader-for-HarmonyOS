import {selectContractCases,recordContractCasePass} from './lib/contract-case-selection.mjs';
const selected=selectContractCases({
 'icon-map':{description:'Actual current module icon map active/inactive/unknown across day/night',resources:[]},
 'outline-assets':{description:'Current SVG XML painted paths have outline-only semantic fill/stroke; no Figma visual parity claim',resources:[]}
});
async function runCase(selectedCase){
 const {default:assert}=await import('node:assert/strict');
 const assets=[['directory','reader_directory_list_active','rc_list','rc_list'],['tts','reader_tts_nav_active','rc_headphones','rc_headphones'],['appearance','reader_appearance_nav_active','rc_palette','rc_palette'],['settings','reader_settings_nav_active','rc_settings','rc_settings']];
 if(selectedCase==='icon-map'){
  const {selectedProductionMethods}=await import('./lib/selected-production-methods.mjs');
  const Control=selectedProductionMethods(new URL('../entry/src/main/ets/features/reading/ReaderControlPanel.ets',import.meta.url),'ReaderControlPanel',['moduleIcon']);
  const owner=new Control();
  for(const [module,active,fallback,nightInactive] of assets)for(const enabled of [true,false])for(const scheme of ['day','night']){
   owner.appScheme=scheme;owner.isActiveModule=()=>enabled;
   const expected=enabled?active+(scheme==='night'?'_theme_night':''):scheme==='night'?nightInactive+'_theme_night':fallback;
   assert.equal(owner.moduleIcon(fallback,module),expected);
  }
  for(const scheme of ['day','night']){owner.appScheme=scheme;assert.equal(owner.moduleIcon('custom-icon','unknown'),'custom-icon');}
  return;
 }
 const {fileURLToPath}=await import('node:url');const {spawnSync}=await import('node:child_process');
 const files=assets.flatMap(([,asset])=>['day','night'].map(scheme=>({scheme,path:fileURLToPath(new URL(`../entry/src/main/resources/base/media/${asset}${scheme==='night'?'_theme_night':''}.svg`,import.meta.url))})));
 const script=`import json,sys,xml.etree.ElementTree as ET
items=json.load(sys.stdin)
output=[]
for item in items:
 root=ET.parse(item['path']).getroot(); paths=[]
 def visit(node,fill='black',stroke='none'):
  tag=node.tag.split('}')[-1]
  if tag in ('defs','clipPath','mask'):return
  if tag=='style' or 'style' in node.attrib:raise ValueError('inline/CSS style needs explicit fixture review')
  fill=node.get('fill',fill);stroke=node.get('stroke',stroke)
  if tag=='path':paths.append({'fill':fill,'stroke':stroke})
  for child in node:visit(child,fill,stroke)
 visit(root)
 output.append({'scheme':item['scheme'],'paths':paths})
json.dump(output,sys.stdout)`;
 const result=spawnSync('python3',['-c',script],{input:JSON.stringify(files),encoding:'utf8',timeout:10000});assert.ifError(result.error);assert.equal(result.status,0,result.stderr);
 for(const item of JSON.parse(result.stdout)){assert.ok(item.paths.length>0);for(const path of item.paths){assert.equal(path.fill,'none');assert.equal(path.stroke,item.scheme==='day'?'#FFFAF4':'#1C1A18');}}
}
for(const id of selected){await runCase(id);recordContractCasePass(id);}
