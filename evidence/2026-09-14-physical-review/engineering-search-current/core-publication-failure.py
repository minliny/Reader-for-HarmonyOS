import json, pathlib, subprocess, sqlite3, tempfile
root=pathlib.Path('/Users/minliny/Documents/Reader/Reader-Core-Native')
d=pathlib.Path(tempfile.mkdtemp(prefix='reader-core-publication-',dir='/tmp/reader-engineering-audit'))
exe=str(root/'target/debug/reader-cli')
cfg=json.dumps({'dataDirectory':str(d)})
def call(cmd):
 p=subprocess.run([exe,'--config-json',cfg,'--stdin'],input=json.dumps(cmd),text=True,capture_output=True,timeout=20)
 return {'exit':p.returncode,'stdout':p.stdout.strip(),'stderr':p.stderr.strip()}
init=call({'protocolVersion':1,'requestId':1,'method':'runtime.ping','params':{}})
assert init['exit']==0,init
con=sqlite3.connect(d/'reader-core.sqlite3')
source={'sourceId':'probe-source','name':'probe','baseUrl':'https://example.test','rules':{'search':[{'kind':'jsonPath','path':'$.books[*]'}]}}
con.execute('INSERT INTO sources(source_id,source_json) VALUES (?,?)',('probe-source',json.dumps(source)))
con.execute("CREATE TRIGGER injected_candidate_failure BEFORE INSERT ON search_books WHEN NEW.book_url='/b2' BEGIN SELECT RAISE(ABORT,'injected candidate write failure'); END")
con.commit()
books=[{'bookId':'/b1','title':'First','author':'A'},{'bookId':'/b2','title':'Second','author':'A'},{'bookId':'/b3','title':'Third','author':'A'}]
result=call({'protocolVersion':1,'requestId':2,'method':'book.search','params':{'sourceId':'probe-source','searchResponse':json.dumps({'books':books})}})
report={'kind':'current Core CLI; isolated SQLite; injected second-candidate write failure; no network','coreCommit':'316ed8362d4d820756f22f22bee35fd4d5f932a9','dataDirectory':str(d),'result':result,'sourceBooks':con.execute('SELECT source_id,book_id FROM source_books ORDER BY book_id').fetchall(),'searchBooks':con.execute('SELECT origin,book_url FROM search_books ORDER BY book_url').fetchall()}
con.close()
pathlib.Path('/tmp/reader-engineering-audit/core-publication-failure.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
