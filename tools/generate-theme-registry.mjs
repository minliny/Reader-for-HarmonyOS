import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..');
const source=path.join(root,'Reader-UI/theme/registry.json');
const raw=fs.readFileSync(source,'utf8');
const registry=JSON.parse(raw);
if(registry.schemaVersion!==1) throw Error('THEME_SCHEMA_UNSUPPORTED');
const schemes=['day','night'];
function argb(c){
  if(!c || ![c.r,c.g,c.b].every(v=>Number.isInteger(v)&&v>=0&&v<=255)||!Number.isFinite(c.a)||c.a<0||c.a>1) throw Error('THEME_RGBA_INVALID');
  const bytes=[Math.round(c.a*255),c.r,c.g,c.b];
  return '#'+bytes.map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
}
const appRoles=Object.keys(registry.appRoles).sort();
if(!appRoles.length) throw Error('APP_PALETTE_EMPTY');
for(const role of appRoles)for(const scheme of schemes) argb(registry.appRoles[role][scheme]);
const ids=Object.keys(registry.reader).sort((a,b)=>registry.reader[a].order-registry.reader[b].order);
const readerKeys=['paperStart','paperEnd','ink','chromeMeta','statusBackground','statusForeground','swatch','selection','paperBack','turnShadow'];
for(const id of ids){const v=registry.reader[id];if(!schemes.includes(v.scheme)||!v.provenance)throw Error('READER_THEME_INVALID '+id); for(const role of readerKeys)argb(v.roles[role]);}
if(!ids.includes('day')||!ids.includes('night'))throw Error('DEFAULT_THEME_MISSING');
const header=`// Generated from Reader-UI/theme/registry.json. Do not edit.\n// SHA256 ${crypto.createHash('sha256').update(raw).digest('hex')}\n`;
let code=header+`export type ReaderThemeScheme = 'day' | 'night';\nexport type ReaderAppThemeMode = ReaderThemeScheme | 'system';\nexport type ReaderThemeId = ${ids.map(JSON.stringify).join(' | ')};\nexport type ReaderAppColorRole = ${appRoles.map(JSON.stringify).join(' | ')};\n\n`;
code+=`const DAY: Record<ReaderAppColorRole, string> = ${JSON.stringify(Object.fromEntries(appRoles.map(k=>[k,argb(registry.appRoles[k].day)])),null,2)};\n`;
code+=`const NIGHT: Record<ReaderAppColorRole, string> = ${JSON.stringify(Object.fromEntries(appRoles.map(k=>[k,argb(registry.appRoles[k].night)])),null,2)};\n`;
code+=`export function readerAppColor(role: ReaderAppColorRole, scheme: string): string {\n  return scheme === 'night' ? NIGHT[role] : DAY[role];\n}\n`;
code+=`export interface ReaderThemeDefinition {\n  id: ReaderThemeId; scheme: ReaderThemeScheme; order: number; displayName: string;\n  paperStart: string; paperEnd: string; ink: string; chromeMeta: string;\n  statusBackground: string; statusForeground: string; swatch: string; selection: string; paperBack: string; turnShadow: string;\n  paperTexture: boolean; sourcePaperLighting: boolean;\n}\n`;
code+=`export const READER_THEME_DEFINITIONS: ReaderThemeDefinition[] = ${JSON.stringify(ids.map(id=>{const d=registry.reader[id];return {id,scheme:d.scheme,order:d.order,displayName:d.displayName,...Object.fromEntries(readerKeys.map(k=>[k,argb(d.roles[k])])),...d.effects}}),null,2)};\n`;
code+=`export function findReaderTheme(id: string): ReaderThemeDefinition | undefined {\n  return READER_THEME_DEFINITIONS.find((theme: ReaderThemeDefinition): boolean => theme.id === id);\n}\nexport function readerThemeDefinition(id: string): ReaderThemeDefinition {\n  return findReaderTheme(id) ?? READER_THEME_DEFINITIONS[0];\n}\n`;
const outputs=[path.join(root,'Reader-for-HarmonyOS/entry/src/main/ets/features/common/ReaderThemeRegistry.ts'),path.join(root,'Reader-UI/theme/ReaderThemeRegistry.ts')];
for(const out of outputs){if(process.argv.includes('--check')){if(fs.readFileSync(out,'utf8')!==code)throw Error('THEME_ADAPTER_STALE '+out);}else fs.writeFileSync(out,code);}
console.log(`Theme registry: ${appRoles.length} complete App roles × 2; ${ids.length} Reader palettes; canonical hash verified.`);

const selectionSource=fs.readFileSync(path.join(root,'Reader-UI/theme/ReaderThemeSelection.ts'),'utf8');
const selectionOutput=path.join(root,'Reader-for-HarmonyOS/entry/src/main/ets/features/common/ReaderThemeSelection.ts');
const selectionCode='// Generated copy of Reader-UI/theme/ReaderThemeSelection.ts. Do not edit.\n'+selectionSource;
if(process.argv.includes('--check')){if(fs.readFileSync(selectionOutput,'utf8')!==selectionCode)throw Error('THEME_SELECTION_ADAPTER_STALE');}else fs.writeFileSync(selectionOutput,selectionCode);
