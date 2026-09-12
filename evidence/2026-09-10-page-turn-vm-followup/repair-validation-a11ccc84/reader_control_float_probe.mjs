import { ReaderControlRuntime } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlRuntime.ts';
import { createReaderControlSessionState,openReaderControlSession,enterReaderControlModule,sampleReaderControlSession } from '/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/entry/src/main/ets/features/reading/ReaderControlSessionState.ts';
const cfg={axis:{quickGrabberScreenY:1628/3.5,fullGrabberScreenY:357/3.5,hiddenGrabberScreenY:1691/3.5},tapMaxDurationMs:500,directionSlopVp:8,settleDurationMs:320};
for(const steps of [12,30,36,60,90,120]){
 const r=new ReaderControlRuntime(cfg);r.start(enterReaderControlModule(openReaderControlSession(createReaderControlSessionState(),0),'settings',0));r.down(0,1628/3.5,0);let s;
 for(let i=1;i<=steps;i++)s=r.move(0,(1628-1017*i/steps)/3.5,600*i/steps);
 const p=sampleReaderControlSession(s.session).expansionProgress;console.log({steps,p,expected:1017/1271,last:r.lastPointerY(),expectedY:611/3.5});
}
