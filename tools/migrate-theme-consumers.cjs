// One-time reviewed migration utility; palette values remain in Reader-UI/theme/registry.json.
const fs=require('fs'),path=require('path');
const sdk=process.env.READER_ETS_LOADER_ROOT||'/Applications/DevEco-Studio.app/Contents/sdk/default/openharmony/ets/build-tools/ets-loader';
const ts=require(sdk+'/node_modules/typescript'),options=require(sdk+'/lib/ets_checker.js').compilerOptions;
const root=path.resolve(__dirname,'../entry/src/main/ets'), registryPath=path.resolve(__dirname,'../../Reader-UI/theme/registry.json');
const registry=JSON.parse(fs.readFileSync(registryPath,'utf8'));
const skipFiles=new Set(['ReadingSurface.ets','ReaderPageChrome.ets','ReaderBookTurnSurface.ets','ReaderPageInteractionLayer.ets','ReaderControlMotionVerification.ets','ReaderRendererPilot.ets']);
const ownedFiles=new Set(['LocalReadingExperience.ets','ReaderControlPanel.ets','ReaderControlMotionStage.ets','ReaderControlAutoPageContent.ets','ReaderControlTtsContent.ets','ReaderSessionCapsule.ets','ReaderSessionLaunchStage.ets']);
const mapping={
'2D4A3E':'D2BD96','1F3528':'7A684F','254A3D':'D2BD96','243D30':'D2BD96','2B6F62':'D2BD96','2F6373':'D2BD96','244F5C':'7A684F',
'1F1B17':'EADFCE','1A1612':'EADFCE','332C25':'EADFCE','41484C':'EADFCE','2C2520':'EADFCE','3F372F':'EADFCE',
'5B5046':'BAAD9C','756F69':'BAAD9C','757575':'BAAD9C','817A72':'BAAD9C','8A7D6F':'BAAD9C','8A7B6B':'BAAD9C','9C9488':'BAAD9C','9A948E':'BAAD9C','A19A91':'BAAD9C','A9A39A':'BAAD9C','604C3B':'BAAD9C','5C554D':'BAAD9C','5C564E':'BAAD9C','6F655D':'BAAD9C','564D44':'BAAD9C','807366':'BAAD9C',
'9B8466':'E2D1B9','B4A697':'E2D1B9','C1C7CD':'E2D1B9','E8E2D9':'E2D1B9','E8E2DA':'E2D1B9','E3DED6':'E2D1B9',
'AAA39A':'5C6065','B3ACA4':'5C6065','C6BFB2':'5C6065','C9C5BE':'5C6065',
'FFF8EF':'2C2824','FFFCF8':'2A2622','FFFDF9':'2A2622','FAF7F2':'2C2824','F5F0E8':'24211E','F6ECDD':'24211E','F9F0E6':'24211E','F8F4EC':'24211E','F5ECE6':'2C2824','E4E0D8':'2C2824','FFF9F2':'2C2824',
'A8543A':'DC9E53','5A4A2A':'DC9E53','8C521D':'DC9E53','9A6A1F':'DC9E53',
'28704E':'54B080','2A7A5A':'86B49B','E8F4ED':'263C30','FDECEA':'472B28','D8E8E2':'334338',
'436F88':'8B775D','315F78':'7A684F','6A4F7A':'B69BCD','7A5A38':'BD9B6E'
};
function argb(v){let h=v.slice(1).toUpperCase();return h.length===6?'FF'+h:h;}
function rgba(v){const h=argb(v);return {r:parseInt(h.slice(2,4),16),g:parseInt(h.slice(4,6),16),b:parseInt(h.slice(6,8),16),a:parseInt(h.slice(0,2),16)/255};}
function propOf(n){let cur=n;while(cur.parent){const p=cur.parent;if(ts.isCallExpression(p)&&p.arguments.some(a=>a.pos<=n.pos&&a.end>=n.end)){if(ts.isPropertyAccessExpression(p.expression))return p.expression.name.text;}if(ts.isPropertyAssignment(p)&&p.name.getText()==='color')return 'color';if(ts.isPropertyDeclaration(p))return 'default';if(ts.isMethodDeclaration(p))break;cur=p;}return '';}
function put(role,day,night,source){if(!registry.appRoles[role])registry.appRoles[role]={day:rgba(day),night:rgba(night),provenance:source};return role;}
function roleForLiteral(n,struct,member,file){
 const d=argb(n.text),rgb=d.slice(2),attribute=propOf(n);let night=mapping[rgb]||rgb;
 const effect=member.toLowerCase().includes('shadow')||attribute==='color'&&['000000','1F1B17','463423','5C4732','594632','2E261F','4B3A26','2F2314','332C25'].includes(rgb);
 if(effect)night=rgb;
 if(rgb==='FFFFFF')night=(attribute==='backgroundColor'&&/Toggle|Switch|Replace/.test(struct))?'EADFCE':attribute==='fontColor'?'FFFFFF':attribute==='backgroundColor'?'2C2824':rgb;
 if(rgb==='FFFAF4')night=['fontColor','fillColor','selectedColor'].includes(attribute)?(/Reader/.test(struct)?'1C1A18':'FFFAF4'):attribute==='default'?'2A2622':'2C2824';
 if(rgb==='2D4A3E'&&attribute==='backgroundColor')night='7A684F';
 if(rgb==='B4A697'&&['fontColor','fillColor','placeholderColor'].includes(attribute))night='BAAD9C';
 if(rgb==='C1C7CD'&&struct==='ReaderToggle')night='5C6065';
 if(rgb==='1F1B17'&&/mask|scrim/i.test(member))night=rgb;
 let role=`app.${struct}.${member}.${attribute||'paint'}.${d}`;
 const nightArgb='#'+d.slice(0,2)+night;
 return put(role,n.text,nightArgb,`Current ${file}:${member}; approved READER_REPAIR_SPEC §2 consumer mapping; ${effect?'preserved effect':'Night role adaptation'}`);
}
let count=0;const bindingRows=[];
function scan(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,ent.name);if(ent.isDirectory())scan(file);else if(file.endsWith('.ets')&&!skipFiles.has(ent.name)&&(!ownedFiles.has(ent.name)||process.argv.includes('--include-shared'))){
 let source=fs.readFileSync(file,'utf8');const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.ETS,options);if(tree.parseDiagnostics.length)throw Error('ETS_PARSE '+file);
 const edits=[],structs=new Map(),defaults=new Map();
 const relative=path.relative(root,file);
 function visit(n,struct,member){
  if(ts.SyntaxKind[n.kind]==='StructDeclaration'){struct=n;structs.set(n,{used:false,scheme:'appThemeScheme'});const declared=n.members.find(m=>m.getText(tree).includes("@StorageLink('readerAppScheme')"));if(declared)structs.get(n).scheme=declared.name.text;}
  if(struct&&n.parent===struct&&n.name)member=n.name.getText(tree);
  const meta=structs.get(struct);const inSwatch=/themeColor|themeSwatch/.test(member||'');
  if(struct&&!inSwatch){
   let role;
   if(ts.isIdentifier(n)&&registry.appRoles[n.text]&&!ts.isPropertyAccessExpression(n.parent)&&!(ts.isPropertyDeclaration(n.parent)&&n.parent.name===n)){
    role=n.text;
    const attribute=propOf(n);
    if(role==='TOK_ON_PRIMARY'&&(/features\/reading\//.test(relative)))role='app.control.onPrimary';
    if(role==='TOK_GREEN'&&attribute==='backgroundColor')role='app.action.fill';
    if(role==='TOK_TTS_PAPER'&&attribute==='fontColor')role='app.tts.onPrimary';
    if(role==='TOK_TTS_PAPER'&&['blockColor','selectedColor'].includes(attribute))role='app.tts.thumb';
   }else if(ts.isIdentifier(n)&&n.text==='TOK_READ_BODY_INK')role='app.control.itemInk';
   else if(ts.isStringLiteral(n)&&/^#[0-9A-Fa-f]{6,8}$/.test(n.text))role=roleForLiteral(n,struct.name.text,member,relative);
   if(role){
    if(ts.isPropertyDeclaration(n.parent)&&n.parent.initializer===n&&n.parent.getText(tree).includes('@Prop')){
      defaults.set(struct.name.text+'.'+n.parent.name.text,{role,scheme:meta.scheme});edits.push({start:n.getStart(tree),end:n.end,text:"''"});
    }else edits.push({start:n.getStart(tree),end:n.end,text:`readerAppColor('${role}', this.${meta.scheme})`});
    meta.used=true;bindingRows.push({file:relative,component:struct.name.text,member,role,line:tree.getLineAndCharacterOfPosition(n.getStart()).line+1});
   }
  }
  ts.forEachChild(n,c=>visit(c,struct,member));
 }
 visit(tree);
 function wrapProps(n,struct){if(ts.SyntaxKind[n.kind]==='StructDeclaration')struct=n;if(struct&&ts.isPropertyAccessExpression(n)&&n.expression.kind===ts.SyntaxKind.ThisKeyword){const d=defaults.get(struct.name.text+'.'+n.name.text);if(d){const original=n.getText(tree);edits.push({start:n.getStart(tree),end:n.end,text:`(${original} === '' ? readerAppColor('${d.role}', this.${d.scheme}) : ${original})`});}}ts.forEachChild(n,c=>wrapProps(c,struct));}
 wrapProps(tree);
 for(const [struct,meta] of structs)if(meta.used&&!struct.members.some(m=>m.name?.text===meta.scheme))edits.push({start:struct.members.pos,end:struct.members.pos,text:`\n  @StorageLink('readerAppScheme') private ${meta.scheme}: string = 'day';\n`});
 if(edits.length){for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);if(!source.includes('import { readerAppColor')){let importPath=path.relative(path.dirname(file),path.join(root,'features/common/ReaderThemeRegistry')).replaceAll('\\','/');if(!importPath.startsWith('.'))importPath='./'+importPath;source=`import { readerAppColor } from '${importPath}';\n`+source;}fs.writeFileSync(file,source);count++;}
}}}
scan(root);fs.writeFileSync(registryPath,JSON.stringify(registry,null,2)+'\n');
const output=path.resolve(__dirname,'../evidence/2026-09-13-current-gap-register/theme-consumer-bindings.json');
let previous=[];if(fs.existsSync(output))previous=JSON.parse(fs.readFileSync(output,'utf8'));
fs.writeFileSync(output,JSON.stringify([...previous,...bindingRows],null,2)+'\n');console.log('Migrated components files:',count,'bindings:',bindingRows.length);
