import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const registryPath=path.resolve(root,'../Reader-UI/theme/registry.json');
const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
const media=path.join(root,'entry/src/main/resources/base/media');
const map={ '2D4A3E':'D2BD96','1F3528':'D2BD96','2F6373':'D2BD96','1F1B17':'EADFCE','332C25':'EADFCE','756F69':'BAAD9C','3F372F':'EADFCE','5B5046':'BAAD9C','4D463F':'EADFCE','41484C':'EADFCE','857C70':'BAAD9C','F8F4EC':'24211E','E8E2D9':'51493F','C1C7CD':'5C6065','F0EBE1':'332D27','C4BDB0':'746B60','CCC5B8':'6B6258','D4CEC2':'5D554B','D8D1C4':'514A40','E0D9CC':'463E35','EAE4D8':'3E3730' };
function rgba(hex){return {r:parseInt(hex.slice(0,2),16),g:parseInt(hex.slice(2,4),16),b:parseInt(hex.slice(4,6),16),a:1};}
const names=new Set();
function collect(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,ent.name);if(ent.isDirectory())collect(f);else if(f.endsWith('.ets'))for(const m of fs.readFileSync(f,'utf8').matchAll(/'app\.media\.([^']+)'/g))if(!m[1].endsWith('_theme_night'))names.add(m[1]);}}
collect(path.join(root,'entry/src/main/ets'));
const manifest=[];
for(const name of names){const f=path.join(media,name+'.svg');if(!fs.existsSync(f))continue;const original=fs.readFileSync(f,'utf8');let changed=false;
 const night=original.replace(/#[0-9a-f]{6}\b/gi,color=>{const rgb=color.slice(1).toUpperCase();const role='app.icon.'+name+'.'+rgb;let target=map[rgb]||rgb;
  if(['FFFAF4','FFFCF8'].includes(rgb)&&name.startsWith('reader_'))target='1C1A18';
  if(!registry.appRoles[role])registry.appRoles[role]={day:rgba(rgb),night:rgba(target),provenance:`Existing monochrome/state SVG ${name}; same path and alpha, §2 App role mapping`};
  const c=registry.appRoles[role].night;const resolved='#'+[c.r,c.g,c.b].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
  if(resolved.toUpperCase()!==color.toUpperCase())changed=true;return resolved;
 });
 if(!changed)continue;
 const out=path.join(media,name+'_theme_night.svg');
 if(process.argv.includes('--check')){if(fs.readFileSync(out,'utf8')!==night)throw Error('THEME_ICON_STALE '+name);}else fs.writeFileSync(out,night);
 manifest.push(name);
}
if(!process.argv.includes('--check')){
 fs.writeFileSync(registryPath,JSON.stringify(registry,null,2)+'\n');
 fs.writeFileSync(path.join(root,'tools/theme-svg-variants.json'),JSON.stringify(manifest.sort(),null,2)+'\n');
 fs.writeFileSync(path.resolve(root,'evidence/2026-09-13-current-gap-register/theme-icon-bindings.json'),JSON.stringify(manifest.sort(),null,2)+'\n');
}
console.log('Theme SVG adapters:',manifest.length,'; geometry/path/opacity unchanged.');
