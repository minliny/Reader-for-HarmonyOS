import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
registerHooks({resolve(s,c,n){try{return n(s,c)}catch(e){if(s.startsWith('.')&&!s.endsWith('.ts'))return n(`${s}.ts`,c);throw e}}});
const {classifyChapterBody}=await import('/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/RemoteContentAdmission.ts');
for(const line of readFileSync(new URL('./core-probe/results.jsonl', import.meta.url),'utf8').trim().split('\n')){
 const row=JSON.parse(line);if(row.stage==='content')console.log(JSON.stringify({...row,hostVerdict:classifyChapterBody(row.output)}));
}
