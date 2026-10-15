// Offline geometry and actual bundled-font regression. This does not render a browser.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {screens as library, libraryBooks, applyLibrarySample} from '../ui-library.mjs';
import {screens as settings, applySettingsSample} from '../ui-settings.mjs';
import {screens as reading} from '../ui-reading.mjs';
import {bookForSample} from '../demo-state.mjs';
import {profiles} from '../delivery-config.mjs';
import {topbar} from '../shared.mjs';
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=Object.fromEntries(await Promise.all(['reading.css','delivery.css','library.css','settings.css','app.css'].map(async name=>[name,await fs.readFile(path.join(here,name),'utf8')])));
// Only inspect these explicit scalar rules; this is not a CSS cascade emulator.
function rule(file,selector){
  const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const matches=[...files[file].matchAll(new RegExp('(?:^|})\\s*'+escape(selector)+'\\{([^}]*)\\}','g'))];
  assert(matches.length,`Missing rule ${selector}`);
  return Object.assign({},...matches.map(m=>Object.fromEntries(m[1].split(';').filter(Boolean).map(d=>{const i=d.indexOf(':');return[d.slice(0,i).trim(),d.slice(i+1).trim()];}))));
}
const quick=rule('reading.css','.reading-quick-back'),search=rule('reading.css','.reading-search-back'),replace=rule('reading.css','.reading-replace-back');
assert.equal(quick['white-space'],'nowrap');assert.equal(quick.flex,'none');assert.equal(quick.padding,'0');
assert.equal(rule('reading.css','.reading-quick-back>span')['white-space'],'nowrap');
assert(files['reading.css'].includes('.reading-quick-back>img,.reading-quick-back>span{flex:none}'));
assert.equal(search['padding-left'],'8px');assert.equal(replace.gap,'5px');assert.equal(replace['justify-content'],'center');assert.equal(replace.padding,'0');
assert.equal(quick.color,'var(--TOK_READ_PRIMARY)');assert.equal(quick.background,'var(--TOK_SURFACE_PANEL_SOFT)');
assert(files['app.css'].includes(':where(.viewport) button{color:inherit}'));assert(!files['app.css'].includes('.viewport button{color:inherit}'));
assert.equal(topbar('书源检测、调试与编辑').includes('top-actions'),false);
assert.equal(topbar('书源', '<button>检测</button>').includes('top-actions'),true);
const python='/Users/minliny/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const font=path.resolve(here,'../../../entry/src/main/resources/rawfile/NotoSansSC-VF.otf');
const measured=JSON.parse(execFileSync(python,['-c',`from PIL import ImageFont\nimport json,sys\nprint(json.dumps({str(size):ImageFont.truetype(sys.argv[1],size).getlength('返回') for size in [10,13,20]}))`,font],{encoding:'utf8'}));
assert.equal(measured['10'],20);assert(18+11+4+measured['10']>51,'Original cramped row must be reproduced');
const layoutModels=[];
for(const profile of profiles)for(const [scale,extra]of [[1,0],[1.3,6],[2,20]]){
  const safe=Math.max(profile.insets[1],profile.insets[3]);
  const width=profile.width>=600?Math.min(720,profile.width-Math.max(26,safe)-Math.max(14,safe)):Math.min(364,profile.width-2*Math.max(13,safe));
  const contentWidth=width-78,backWidth=51+extra,textWidth=measured[String(Math.round(10*scale))];
  assert(8+11+4+textWidth<=backWidth,`Search back overflow: ${profile.id}/${scale}`);
  assert(11+5+textWidth<=backWidth,`Replace back overflow: ${profile.id}/${scale}`);
  const fieldLeft=66.102+extra,fieldWidth=contentWidth-119-extra;
  assert(fieldWidth>0);assert(fieldLeft>=10.1+backWidth+5);
  assert(Math.abs(contentWidth-11.898-36-(fieldLeft+fieldWidth)-5)<.001);
  assert(66.55+extra>=10.1+backWidth+5);
  layoutModels.push({profile:profile.id,scale,backWidth,textWidth,fieldWidth});
}
const groups=new Map();let states=0,returnedButtons=0;
for(const screen of [...library,...settings,...reading])for(const variant of screen.variants){
  states++;const choices={};if(library.includes(screen))applyLibrarySample(screen.id,variant.id,choices);if(settings.includes(screen))applySettingsSample(screen.id,variant.id,choices);
  const book=bookForSample(libraryBooks,variant.id);
  for(const profile of profiles){
    const html=screen.render({variant:variant.id,choices,book,size:profile.width>=600?'wide':'phone',viewportWidth:profile.width,viewportHeight:profile.height,tablet:profile.deviceType==='tablet',theme:'day'});
    for(const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){
      const attributes=m[1],label=attributes.match(/aria-label="([^"]*)"/)?.[1]||m[2].replace(/<[^>]*>/g,'').trim(),action=attributes.match(/data-action="([^"]*)"/)?.[1]||'';
      if(!/返回|收起|退出|关闭|取消/.test(label)&&action!=='back'&&action!=='close')continue;
      assert(label,`Unnamed return/close ${screen.id}/${variant.id}`);
      const cls=attributes.match(/class="([^"]*)"/)?.[1]||'',key=cls+' / '+label;
      const row=groups.get(key)||{class:cls,label,modules:new Set(),states:new Set(),count:0};row.modules.add(screen.id);row.states.add(screen.id+'/'+variant.id);row.count++;groups.set(key,row);returnedButtons++;
    }
  }
}
for(const id of ['reader-search','reader-replace']){
  const html=reading.find(s=>s.id===id).render({variant:'quick',choices:{},book:libraryBooks[0],theme:'day',size:'phone',viewportWidth:390,viewportHeight:844});
  assert(/reading-quick-back[^>]+>[\s\S]*?width="11"[\s\S]*?<span>返回<\/span>/.test(html));
  assert(!/reading-action[^>]+aria-label="返回阅读控制首页"/.test(html));
}
const editor=reading.find(s=>s.id==='reader-replace').render({variant:'editor',choices:{},book:libraryBooks[0],size:'phone',theme:'day'});
assert(editor.includes('reading-replace-editor-back'));
const result={status:'PASS',scope:'Explicit native geometry + actual font advances + all-state return/close inventory; not browser layout/visual acceptance',stateCount:states,renderCount:states*profiles.length,returnOrCloseControls:returnedButtons,fontMetrics:measured,models:layoutModels,groups:[...groups.values()].map(r=>({...r,modules:[...r.modules],states:[...r.states]})),browser:false,nativeVisual:false};
console.log(JSON.stringify(result));
