import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const source = read('entry/src/main/cpp/bookturn/bookturn_napi.cpp');
const motion = read('entry/src/main/cpp/bookturn/bookturn_motion.h');
const session = read('entry/src/main/ets/features/reading/BookTurnPresentationSession.ets');
const declarations = read('entry/src/main/cpp/types/libreader_bookturn_napi/Index.d.ts');
function block(text, signature) {
  const start = text.indexOf(signature);
  assert.ok(start >= 0, signature);
  let end = text.indexOf('{', start) + 1, depth = 1;
  while (depth) { if (text[end] === '{') depth++; if (text[end] === '}') depth--; end++; }
  return text.slice(start, end);
}

// Execute the production NAPI entry points with only value transport/host mocked.
const cpp = `
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <memory>
#include <string>
#include <vector>
struct Value { enum Kind { NUMBER, STRING, BOOL } kind; double number; std::string text; };
using napi_env=void*; using napi_value=Value*;
struct Info { std::vector<napi_value> args; }; using napi_callback_info=Info*;
Value result{Value::BOOL,0,""};
void napi_get_cb_info(napi_env,napi_callback_info info,size_t* count,napi_value* args,void*,void*) {
  const size_t limit=*count; *count=info->args.size();
  for(size_t i=0;i<limit && i<info->args.size();++i) args[i]=info->args[i];
}
bool GetString(napi_env,napi_value v,std::string& out){if(!v || v->kind!=Value::STRING)return false;out=v->text;return true;}
bool GetDouble(napi_env,napi_value v,double& out){if(!v || v->kind!=Value::NUMBER)return false;out=v->number;return true;}
napi_value Boolean(napi_env,bool b){result.number=b;return &result;}
enum class Direction:int32_t{NEXT=-1,PREVIOUS=1};
Direction DecodeDirection(int32_t d){return static_cast<Direction>(d);}
${block(motion, 'enum class ProgrammaticProfile')};
struct BookTurnHost {
  int calls=0; uint64_t generation=0; ProgrammaticProfile profile=ProgrammaticProfile::MANUAL; int32_t token=0;
  bool StartProgrammatic(uint64_t g,Direction,ProgrammaticProfile p){calls++;generation=g;profile=p;return true;}
  bool StartAutomaticTimeline(uint64_t g,int32_t t){calls++;generation=g;token=t;return true;}
};
auto host=std::make_shared<BookTurnHost>();
std::shared_ptr<BookTurnHost> HostForId(const std::string& id){return id=="reader"?host:nullptr;}
${block(source, 'napi_value StartProgrammatic(')}
${block(source, 'napi_value StartAutomaticTimeline(')}
int checks=0,failures=0;
void Check(const char* label,bool ok){checks++;if(!ok){failures++;std::printf("FAIL %s\\n",label);}}
int main(){
  Value id{Value::STRING,0,"reader"},gen{Value::NUMBER,5,""},dir{Value::NUMBER,-1,""},profile{Value::NUMBER,0,""};
  Info info{{&id,&gen,&dir}};
  Check("omitted profile is manual",StartProgrammatic(nullptr,&info)->number==1 && host->profile==ProgrammaticProfile::MANUAL);
  info.args.push_back(&profile);
  for(int p=0;p<3;p++){profile.number=p;Check("valid numeric profile forwarded",StartProgrammatic(nullptr,&info)->number==1 && static_cast<int>(host->profile)==p);}
  for(double p : {-1.0,3.0,1.5,double(NAN),double(INFINITY)}){profile.number=p;const int before=host->calls;Check("invalid profile rejected",StartProgrammatic(nullptr,&info)->number==0 && host->calls==before);}
  profile.kind=Value::BOOL;profile.number=1;Check("legacy boolean cannot silently become a profile",StartProgrammatic(nullptr,&info)->number==0);
  profile.kind=Value::NUMBER;profile.number=2;
  for(double g : {0.0,-1.0,1.5,double(NAN),double(INFINITY),9007199254740992.0}){gen.number=g;Check("invalid programmatic generation rejected",StartProgrammatic(nullptr,&info)->number==0);}
  gen.number=5;
  for(double d : {0.0,2.0,-1.5,double(NAN)}){dir.number=d;Check("invalid direction rejected",StartProgrammatic(nullptr,&info)->number==0);}
  dir.number=1;Check("previous direction accepted",StartProgrammatic(nullptr,&info)->number==1);
  Value token{Value::NUMBER,123,""};info.args={&id,&gen,&token};
  Check("automatic token forwarded",StartAutomaticTimeline(nullptr,&info)->number==1 && host->token==123 && host->generation==5);
  token.number=INT32_MAX;Check("largest token losslessly forwarded",StartAutomaticTimeline(nullptr,&info)->number==1 && host->token==INT32_MAX);
  for(double t : {0.0,-1.0,1.5,double(NAN),double(INFINITY),2147483648.0}){token.number=t;const int before=host->calls;Check("invalid automatic token rejected",StartAutomaticTimeline(nullptr,&info)->number==0 && host->calls==before);}
  token.number=123;
  for(double g : {0.0,-1.0,1.5,double(NAN),double(INFINITY),9007199254740992.0}){gen.number=g;Check("invalid automatic generation rejected",StartAutomaticTimeline(nullptr,&info)->number==0);}
  std::printf("automatic bridge: %d checks, %d failures\\n",checks,failures);return failures?1:0;
}`;
const scratch = mkdtempSync(path.join(tmpdir(), 'reader-automatic-bridge-'));
try {
  writeFileSync(path.join(scratch, 'bridge.cpp'), cpp);
  const binary = path.join(scratch, 'bridge');
  const compiled = spawnSync('c++', ['-std=c++17', '-O2', '-Wall', '-Wextra', '-Werror', path.join(scratch, 'bridge.cpp'), '-o', binary], { encoding: 'utf8', timeout: 60000 });
  assert.equal(compiled.status, 0, compiled.stdout + compiled.stderr);
  const run = spawnSync(binary, [], { encoding: 'utf8', timeout: 10000 });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  process.stdout.write(run.stdout);
} finally { rmSync(scratch, { recursive: true, force: true }); }
for (const [name, value] of [['MANUAL', 0], ['RAPID', 1], ['AUTOMATIC', 2]]) {
  assert.match(session, new RegExp(`BOOK_TURN_PROFILE_${name} = ${value};`));
}
assert.match(block(session, '  startProgrammatic('), /nativeDirection\(direction\), profile\)/);
assert.match(block(session, '  startAutomaticTimeline('), /this\.componentId, generation, surfaceToken/);
assert.match(declarations, /startProgrammatic:.*profile\?: number/);
assert.match(declarations, /startAutomaticTimeline:.*surfaceToken: number/);
assert.match(source, /\{ "startAutomaticTimeline", nullptr, StartAutomaticTimeline,/);
console.log('automatic profile, token transport and bridge declarations: PASS');
