// Browser DESIGN reference generator, never a native-app acceptance runner.
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(process.env.READER_PLAYWRIGHT_MODULE||'/Users/minliny/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const delivery=JSON.parse(await readFile(path.join(here,'delivery.json'),'utf8'));
const output=path.join(here,'references');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1280},deviceScaleFactor:1});
const errors=[],records=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`file://${here}/index.html`,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
const previewOptions={'viewport-size':'phone','preview-theme':'day','font-scale':'1','keyboard-height':'0'};
let lastScreen='bookshelf',lastVariant='cover';
async function select(s,v,theme,profile,scale='1',keyboard='0'){
  for(const[id,value]of Object.entries({'viewport-size':profile,'preview-theme':theme,'font-scale':scale,'keyboard-height':keyboard}))if(previewOptions[id]!==value){await page.locator('#'+id).selectOption(value);previewOptions[id]=value;}
  if(lastScreen!==s.id){await page.locator(`[data-screen="${s.id}"]`).click();lastScreen=s.id;lastVariant=await page.locator('#viewport').getAttribute('data-active-variant');}
  if(lastVariant!==v.id){await page.locator(`[data-variant="${v.id}"]`).click();lastVariant=v.id;}
  await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>[...document.querySelectorAll('#viewport img')].every(n=>n.complete));
  const missing=await page.locator('#viewport img').evaluateAll(nodes=>nodes.filter(n=>!n.naturalWidth).map(n=>n.getAttribute('src')));if(missing.length)errors.push({screen:s.id,variant:v.id,missing});
  const suffix=scale!=='1'||keyboard!=='0'?`--text${scale}--ime${keyboard}`:'';const name=`${s.id}--${v.id}--${theme}--${profile}${suffix}.png`;
  const buffer=await page.locator('#viewport').screenshot({path:path.join(output,name)});
  const measurements=await page.locator('#viewport').evaluate(root=>{const origin=root.getBoundingClientRect();return [...root.querySelectorAll('.app-topbar,.main-tabs,.lib-continue,.lib-cover-slot,.lib-search-bar,.lib-detail-header,.reading-topbar,.reading-dock,.app-dialog,.reading-tts-manager,.source-import-dialog,.source-bottom-actions,.source-login-header')].map(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return{selector:n.className,x:r.x-origin.x,y:r.y-origin.y,width:r.width,height:r.height,radius:s.borderRadius,font:s.font,fontFamily:s.fontFamily};});});
  const textFixture=await page.locator('#viewport').innerText();
  records.push({screen:s.id,variant:v.id,theme,profile,textPressure:Number(scale),keyboardHeight:Number(keyboard),file:name,sha256:createHash('sha256').update(buffer).digest('hex'),textFixture,measurements});
}
try{
  for(const s of delivery.screens){for(const v of s.variants)for(const theme of ['day','night'])await select(s,v,theme,'phone');}
  console.log(JSON.stringify({phase:'all-states',images:records.length,errors:errors.length}));
  for(const s of delivery.screens)for(const profile of delivery.profiles.filter(p=>p.id!=='phone').map(p=>p.id))await select(s,s.variants[0],'day',profile);
  console.log(JSON.stringify({phase:'responsive',images:records.length,errors:errors.length}));
  const editable=[['search','idle'],['sources','default'],['json-import','default'],['source-tools','editor'],['source-tools','debug'],['reader-search','full'],['reader-replace','editor'],['reader-tts-manager','new'],['directory','local-rules-editor']];
  for(const [id,variant]of editable){const s=delivery.screens.find(s=>s.id===id);if(!s)throw new Error(`Unknown editable screen ${id}`);const v=s.variants.find(v=>v.id===variant);if(!v)throw new Error(`Unknown editable variant ${id}:${variant}`);await select(s,v,'day','ios','1','300');await select(s,v,'day','android','2','300');}
  for(const id of ['bookshelf','settings','general','detail','reader-controls','reader-directory','reader-tts','reader-settings']){const s=delivery.screens.find(s=>s.id===id);if(s)await select(s,s.variants[0],'day','small','2');}
  await page.locator('#keyboard-height').selectOption('0');await page.locator('#font-scale').selectOption('1');
  await page.locator('[data-screen="source-switch"]').click();await page.locator('[data-variant="switching"]').click();await page.keyboard.press('Escape');if(!await page.locator('[data-panel="source-switch"]').count())errors.push('source-switch busy dismiss');
  await page.locator('[data-screen="reader-tts-manager"]').click();await page.locator('[data-variant="busy"]').click();await page.keyboard.press('Escape');if(!await page.locator('[data-panel="reader-tts-manager"]').count())errors.push('TTS busy dismiss');
  await page.locator('#keyboard-height').selectOption('300');await page.keyboard.press('Escape');if(await page.locator('#keyboard-height').inputValue()!=='0'||!await page.locator('[data-panel="reader-tts-manager"]').count())errors.push('keyboard back priority');
  await page.locator('#viewport-size').selectOption('phone');await page.locator('[data-screen="reader-directory"]').click();await page.locator('[data-variant="full"]').click();await page.keyboard.press('Escape');if(!await page.locator('[data-panel="reader-directory"] .quick').count())errors.push('Full to Quick back');await page.keyboard.press('Escape');if(!await page.locator('[data-panel="reader-controls"]').count())errors.push('Quick to home back');await page.keyboard.press('Escape');if(await page.locator('[data-panel="reader-controls"]').count())errors.push('home to hidden back');
  await page.locator('[data-screen="group-select"]').click();await page.locator('[data-variant="busy"]').click();await page.keyboard.press('Escape');if(!await page.locator('[data-panel="group-select"]').count())errors.push('group busy dismiss');
  for(const tab of ['current','shared','type','motion','assets','acceptance']){await page.locator(`[data-spec-tab="${tab}"]`).click();if(!await page.locator('#spec-content').innerText())errors.push(`empty spec ${tab}`);}
  await page.locator('[data-spec-tab="motion"]').click();await page.locator('#reduce-motion').check();await page.locator('[data-motion="full"]').click();if(!/p=1\.000/.test(await page.locator('#motion-sampler output').innerText()))errors.push('reduced motion endpoint');await page.locator('[data-motion="quick"]').click();if(!/p=0\.000/.test(await page.locator('#motion-sampler output').innerText()))errors.push('reverse motion endpoint');
  await page.locator('[data-screen="reader-tts-manager"]').click();await page.locator('[data-variant="new"]').click();
  await page.locator('#measure-mode').check();await page.locator('#viewport .reading-tts-manager>header').click();if(!/边界/.test(await page.locator('#measurement-note').innerText()))errors.push('measurement tool');await page.locator('#measure-mode').uncheck();
  await page.locator('#viewport-size').selectOption('phone');await page.locator('[data-screen="general"]').click();await page.locator('[data-variant="default"]').click();const settingsWidth=await page.locator('.settings-general .app-card').first().evaluate(n=>n.getBoundingClientRect().width);if(Math.abs(settingsWidth-352)>.1)errors.push({settingsWidth,expected:352});
  await page.locator('#viewport-size').selectOption('small');await page.locator('#font-scale').selectOption('2');const textFit=await page.locator('.settings-theme button').evaluateAll(nodes=>nodes.every(n=>{const range=document.createRange();range.selectNodeContents(n);return range.getBoundingClientRect().width<=n.getBoundingClientRect().width-8;}));if(!textFit)errors.push('large text theme label fit');
  const themeLabelFits=await page.locator('.category-row:has(.settings-theme) .row-label').evaluate(n=>{const r=document.createRange();r.selectNodeContents(n);return r.getBoundingClientRect().width<=n.getBoundingClientRect().width;});if(!themeLabelFits)errors.push('large text App theme row label fit');
  const manifest={schemaVersion:1,evidence:'browser-design-reference',sourceTreeSha256:delivery.sourceTreeSha256,designSourceSha256:delivery.designSourceSha256,generatedAt:new Date().toISOString(),renderer:'Playwright Chromium',browserVersion:browser.version(),deviceScaleFactor:1,components:delivery.screens.length,variants:delivery.screens.reduce((a,s)=>a+s.variants.length,0),referenceImages:records.length,profiles:delivery.profiles,fontProbes:delivery.fontProbes,checks:['all-variants-day-night','all-default-window-profiles','keyboard-and-text-pressure','busy-dismiss-guards','keyboard-first-back','Full-Quick-home-hidden-back','spec-tabs','reduced-motion-and-reverse-endpoints','measurement-tool'],errors,nativeVerification:{ios:false,android:false,harmony:false},records};
  await writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({referenceImages:records.length,errors,sourceTreeSha256:delivery.sourceTreeSha256}));if(errors.length)process.exitCode=1;
}catch(error){await writeFile(path.join(output,'failed-run.json'),JSON.stringify({evidence:'browser-design-check-failure',sourceTreeSha256:delivery.sourceTreeSha256,designSourceSha256:delivery.designSourceSha256,recordedImages:records.length,message:String(error),errors},null,2)+'\n');throw error;}finally{await browser.close();}
