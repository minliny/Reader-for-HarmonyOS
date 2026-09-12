import subprocess,json,datetime
from pathlib import Path
out=Path('/Users/minliny/Documents/Reader/Reader-for-HarmonyOS/evidence/2026-09-10-page-turn-vm-followup/repair-validation-03670f1f')
nonce='7639eccd-429f-4b7d-bcfd-c02c16f6fa99'
def run(script,mode,count,label):
 subprocess.run(['python3','/tmp/'+script,str(out),nonce,mode,str(count),label],check=True)
run('reader_vm_memory.py','仿真',1,'memory-before-stress')
for suffix,mode in [('slide','滑动'),('cover','覆盖'),('simulation','仿真'),('none','无动画')]:
 run('reader_vm_sweep.py',mode,100,'sweep-'+suffix)
 run('reader_vm_memory.py',mode,1,'memory-after-'+suffix)
(out/'stress-batch-result.json').write_text(json.dumps({'status':'PASS','turns':800,'directionsEachPerMode':100,'modes':4,'scope':'10-page chapter sweeps with per-page ordinal and text hash; not rapid, not 100 distinct successive pages','finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2))
