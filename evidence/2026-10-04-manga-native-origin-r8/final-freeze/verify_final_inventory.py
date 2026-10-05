#!/usr/bin/env python3
"""Read-only verification of R8 bounded final evidence inventory and external refs."""
from pathlib import Path
import hashlib,json,stat
ROOT=Path(__file__).resolve().parents[1]
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as s:
  for c in iter(lambda:s.read(1048576),b''):h.update(c)
 return h.hexdigest()
def exact(p,r):
 assert p.is_file() and p.stat().st_size==r['bytes'] and stat.S_IMODE(p.stat().st_mode)==r['mode'] and sha(p)==r['sha256'],str(p)
def main():
 inventory_path=ROOT/'final-freeze/INVENTORY.json';result_path=ROOT/'final-freeze/RESULT.json'
 result=json.loads(result_path.read_bytes());inv=json.loads(inventory_path.read_bytes())
 assert sha(inventory_path)==result['inventorySha256']
 assert inv['status']==result['status']=='PARTIAL' and inv['acceptanceStatus']==result['acceptanceStatus']=='OPEN' and inv['runtimeExitCode']==result['runtimeExitCode']==2
 for r in inv['files']:exact(ROOT/r['path'],r)
 for r in inv['externalRefs']:exact(Path(r['path']),r)
 excluded=set(inv['selfExcludedPaths']);actual={p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*') if p.is_file() and p.relative_to(ROOT).as_posix() not in excluded}
 assert actual=={r['path'] for r in inv['files']}
 assert sum(r['bytes'] for r in inv['files'])==inv['evidenceBytes']
 print(json.dumps({'status':'EVIDENCE_READBACK_PASS','productStatus':'PARTIAL','acceptanceStatus':'OPEN','runtimeExitCode':2,'records':len(inv['files']),'externalRefs':len(inv['externalRefs']),'everyRecordedByteModeAndHashMatched':True,'inventorySha256':sha(inventory_path),'resultSha256':sha(result_path),'deviceOrBuildOperation':False}))
if __name__=='__main__':main()
