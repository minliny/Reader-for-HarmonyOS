import json,copy
from pathlib import Path
from importlib.metadata import version
from jsonschema import Draft202012Validator
root=Path('/Users/minliny/Documents/Reader/Reader-Core-Native');fixtures=root/'protocol/fixtures/conformance/positions'
command=json.loads((root/'protocol/reader-command.schema.json').read_text());event=json.loads((root/'protocol/reader-event.schema.json').read_text())
Draft202012Validator.check_schema(command);Draft202012Validator.check_schema(event)
validations=[]
for path in sorted(fixtures.glob('*ph75*.json')):
 payload=json.loads(path.read_text());expected=not path.name.startswith('invalid-')
 if 'method' in payload: validator=Draft202012Validator(command); target=payload
 else:
  name=path.stem.removeprefix('valid-ph75-').removesuffix('-result')
  if name.startswith('chapter-'):definition='ChapterContentData'
  elif name=='search-content':definition='SearchContentData'
  else:
   head,tail=name.rsplit('-',1);definition={'progress':'ReadingProgress','bookmark':'Bookmark','highlight':'BookHighlight'}[head]+tail.title()+'Data'
  validator=Draft202012Validator({'$ref':'#/$defs/'+definition,'$defs':event['$defs']});target=payload['data']
 errors=list(validator.iter_errors(target));actual=not errors
 assert actual==expected,(path.name,[e.message for e in errors]);validations.append({'fixture':path.name,'expectedValid':expected,'valid':actual})
for change in ['unknown-status','negative-offset','missing-processing','too-many-anchors']:
 v=json.loads((fixtures/'valid-ph75-chapter-committed-result.json').read_text())['data']
 m=v['positionMigration']
 if change=='unknown-status':m['status']='guessed'
 if change=='negative-offset':m['anchors'][0]['offset']=-1
 if change=='missing-processing':del m['processingVersion']
 if change=='too-many-anchors':m['anchors']=[m['anchors'][0]]*129
 validator=Draft202012Validator({'$ref':'#/$defs/ChapterContentData','$defs':event['$defs']});assert list(validator.iter_errors(v));validations.append({'mutation':change,'valid':False})
print(json.dumps({'validator':'jsonschema '+version('jsonschema'),'draft':'2020-12','passed':len(validations),'validations':validations},indent=2))
