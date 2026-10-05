import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const host=path.resolve(here,'../../..');
const workspace=path.dirname(host);
const sha=data=>createHash('sha256').update(data).digest('hex');
const git=(repo,...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
async function filesIn(dir){const result=[];for(const item of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isDirectory())result.push(...await filesIn(p));else if(item.isFile())result.push(p);}return result.sort();}
const src=await filesIn(path.join(host,'entry/src/main/ets'));
const inputs={};for(const p of src)inputs[path.relative(host,p)]=sha(await readFile(p));
const {generateDelivery,deliverySourcePaths}=await import('./generate-delivery.mjs');
for(const p of deliverySourcePaths)if(!inputs[p])inputs[p]=sha(await readFile(path.join(host,p)));
for(const p of await filesIn(path.join(host,'entry/src/main/resources/base/media')))inputs[path.relative(host,p)]=sha(await readFile(p));
const rawDir=path.join(host,'entry/src/main/resources/rawfile');
const fontFiles=(await readdir(rawDir)).filter(n=>/\.(otf|ttf)$/.test(n));
const licenseFiles=(await readdir(rawDir)).filter(n=>/OFL\.txt$|FONT-SOURCES\.txt$/.test(n));
for(const name of [...fontFiles,...licenseFiles]){const p=path.join(rawDir,name);inputs[path.relative(host,p)]=sha(await readFile(p));}
const theme=path.join(workspace,'Reader-UI/theme/registry.json');
inputs['../Reader-UI/theme/registry.json']=sha(await readFile(theme));
const status=git(host,'status','--porcelain').split('\n').filter(Boolean);
const media=await readdir(path.join(host,'entry/src/main/resources/base/media'));
const snapshot={schemaVersion:1,evidence:'current-workspace-source',generatedAt:new Date().toISOString(),host:{branch:git(host,'branch','--show-current'),head:git(host,'rev-parse','HEAD'),dirtySourceFiles:status.map(s=>s.slice(3)).filter(s=>s.startsWith('entry/'))},core:{head:git(path.join(workspace,'Reader-Core-Native'),'rev-parse','HEAD')},scope:'L0 reachable application surfaces only',sourceTreeSha256:sha(JSON.stringify(inputs)),inputs,media:media.sort(),verification:{nativeVisual:false,device:false,backendOperations:false}};
await writeFile(path.join(here,'baseline.json'),JSON.stringify(snapshot,null,2)+'\n');
const registry=JSON.parse(await readFile(theme,'utf8'));
const rgba=c=>`rgba(${c.r},${c.g},${c.b},${c.a})`;
const aliases={paper:'TOK_PAPER',card:'TOK_CARD_BG','card-hi':'TOK_CARD_BG_HI',ink:'TOK_INK',muted:'TOK_MUTED',primary:'TOK_PRIMARY_DARK',green:'TOK_GREEN','on-primary':'TOK_ON_PRIMARY','primary-soft':'TOK_PRIMARY_SOFT',border:'TOK_BORDER',line:'TOK_LINE',danger:'TOK_DANGER','row-divider':'TOK_ROW_DIVIDER','setting-icon-bg':'TOK_SETTING_ICON_BG'};
Object.assign(aliases,{meta:'TOK_META_BG',field:'TOK_FIELD_SURFACE',solid:'TOK_SURFACE_SOLID','panel-soft':'TOK_SURFACE_PANEL_SOFT','setting-action-bg':'TOK_SETTING_ACTION_BG','setting-action':'TOK_SETTING_ACTION_BG','source-search-border':'app.SourceManagementPage.SEARCH_FIELD_BORDER','source-chip-border':'app.SourceManagementPage.CHIP_BORDER','source-muted-bg':'app.SourceManagementPage.STATUS_MUTED_BG','source-muted-dot':'app.SourceManagementPage.STATUS_MUTED_DOT','source-good-dot':'app.SourceManagementPage.STATUS_GOOD_DOT','source-error-dot':'app.SourceManagementPage.STATUS_ERROR_DOT','toggle-off-track':'app.toggle.offTrack','toggle-knob':'app.ReaderToggle.build.backgroundColor.FFFFFFFF'});
let css='/* Generated directly from Reader-UI/theme/registry.json. */\n';
for(const scheme of ['day','night']){css+=`.viewport[data-theme="${scheme}"] {\n`;for(const [name,role]of Object.entries(aliases))css+=`  --${name}: ${rgba(registry.appRoles[role][scheme])};\n`;for(const [role,v]of Object.entries(registry.appRoles))if(v[scheme]){css+=`  --${role.replaceAll('.','-')}: ${rgba(v[scheme])};\n`;if(role.includes('.'))css+=`  --${role.replaceAll('.','_')}: ${rgba(v[scheme])};\n`;}for(const [role,v]of Object.entries(registry.reader[scheme].roles))css+=`  --reader-${role}: ${rgba(v)};\n`;css+='}\n';}
await writeFile(path.join(here,'tokens.css'),css);
await generateDelivery({here,host,snapshot,registry,fontFiles,licenseFiles,sha});
let esbuild;
try{esbuild=await import('esbuild');}catch{esbuild=await import(path.join(workspace,'evidence/opensource-completion/renderer-pilot/node_modules/esbuild/lib/main.js'));}
await esbuild.build({entryPoints:[path.join(here,'app.mjs')],bundle:true,format:'iife',target:'es2020',outfile:path.join(here,'app.bundle.js'),minify:true,legalComments:'none'});
console.log(JSON.stringify({sourceFiles:Object.keys(inputs).length,sourceTreeSha256:snapshot.sourceTreeSha256,bundler:`esbuild ${esbuild.version}`,bundleBytes:(await stat(path.join(here,'app.bundle.js'))).size}));
