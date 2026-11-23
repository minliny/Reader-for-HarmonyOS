import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { selectContractCases, recordContractCasePass } from './lib/contract-case-selection.mjs';

const selected = selectContractCases({
  'number-boundaries': 'Actual GetGeneration, raw gesture callbacks, programmatic/timeline admission and diagnostic Percentile with bounded NAPI ports. Safe integers, nonfinite/fraction/range negatives and unchanged gesture fields.',
  'ohos-compile': 'Exact two production C++ translation units under actual OHOS clang target/sysroot and -O2 -Wall -Wextra -Werror. Old unchecked casts are an expected compiler failure. No HAP or device.',
});
const root = resolve(new URL('../', import.meta.url).pathname);
const artifact = resolve(root, '.reader-artifacts/framework-confluence-20261112/native-numeric');
const napiPath = 'entry/src/main/cpp/bookturn/bookturn_napi.cpp';
const hostPath = 'entry/src/main/cpp/bookturn/bookturn_host.cpp';
const napi = readFileSync(resolve(root, napiPath), 'utf8');
const host = readFileSync(resolve(root, hostPath), 'utf8');
function declaration(source, name) {
  const match = new RegExp('(?:bool|float|Direction|napi_value)\\s+' + name + '\\(').exec(source);
  assert.ok(match, name);
  const start = source.indexOf('{', match.index);
  let depth = 1, end = start + 1;
  while (depth && end < source.length) { if (source[end] === '{') depth++; if (source[end] === '}') depth--; end++; }
  assert.equal(depth, 0);
  return source.slice(match.index, end);
}
function run(command, args, { expected = 0, log, timeout = 30000 } = {}) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout });
  if (log) writeFileSync(resolve(artifact, log), JSON.stringify({ command, args, status: result.status, error: result.error?.message }) + '\n' + result.stdout + result.stderr);
  assert.equal(result.status, expected, result.stderr + (result.error?.message ?? ''));
  return result;
}

for (const id of selected) {
  mkdirSync(artifact, { recursive: true });
  if (id === 'number-boundaries') {
    const names = ['GetDouble', 'GetInt32', 'GetGeneration', 'DecodeDirection', 'UpdateInput', 'EndGesture', 'StartProgrammatic', 'StartAutomaticTimeline'];
    const body = names.map(name => declaration(napi, name)).join('\n');
    for (const name of ['Regrab', 'Settle', 'CommitSlots', 'RetainTerminalFrame', 'ReleaseTerminalFrame', 'ClearSurface'])
      assert.match(declaration(napi, name), /GetGeneration\(env, arguments\[/, name + ' keeps typed safe generation admission');
    assert.match(declaration(napi, 'Regrab'), /GetGeneration\(env, arguments\[11\], previousGeneration\)/);
    const source = `
#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstdint>
#include <limits>
#include <memory>
#include <string>
#include <vector>
struct Value { enum Kind { NUMBER, STRING, BOOLEAN } kind; double number; std::string text; bool boolean; };
struct Env { std::vector<Value*> arguments; int int64Reads = 0; };
using napi_env = Env*; using napi_value = Value*; using napi_callback_info = void*;
enum napi_status { napi_ok, napi_number_expected };
int napi_get_value_double(napi_env, napi_value v, double* result) { if (v->kind != Value::NUMBER) return napi_number_expected; *result=v->number; return napi_ok; }
int napi_get_value_int64(napi_env env, napi_value v, int64_t* result) { env->int64Reads++; *result=std::llround(v->number); return napi_ok; }
int napi_get_value_int32(napi_env, napi_value v, int32_t* result) { if (v->kind != Value::NUMBER) return napi_number_expected; *result=static_cast<int32_t>(std::llround(v->number)); return napi_ok; }
void napi_get_cb_info(napi_env env, napi_callback_info, size_t* count, napi_value* args, void*, void*) { std::copy_n(env->arguments.begin(), std::min(*count,env->arguments.size()),args); *count=env->arguments.size(); }
bool GetString(napi_env, napi_value v, std::string& out) { if(v->kind!=Value::STRING)return false;out=v->text;return true; }
bool GetBool(napi_env, napi_value v, bool& out) { if(v->kind!=Value::BOOLEAN)return false;out=v->boolean;return true; }
Value result {Value::BOOLEAN,0,"",false};
napi_value Boolean(napi_env, bool value) { result.boolean=value;return &result; }
enum class Direction { NEXT, PREVIOUS };
enum class ProgrammaticProfile { NORMAL, AUTOMATIC, RETAINED };
struct BookTurnSample { uint64_t generation=0; Direction direction=Direction::NEXT; bool verticalPrevious=false; float width=0,height=0,startX=0,startY=0,pointerX=0,pointerY=0;int64_t eventTimeNs=0; };
struct BookTurnHost { uint64_t generation=0; int32_t token=0;Direction direction=Direction::NEXT;ProgrammaticProfile profile=ProgrammaticProfile::NORMAL;BookTurnSample sample;bool commit=false;
 bool UpdateInput(const BookTurnSample& value) { sample=value;return true; }
 bool EndGesture(const BookTurnSample& value,bool accepted) { sample=value;commit=accepted;return true; }
 bool StartProgrammatic(uint64_t value,Direction dir,ProgrammaticProfile selected) { generation=value;direction=dir;profile=selected;return true; }
 bool StartAutomaticTimeline(uint64_t value,int32_t selected) { generation=value;token=selected;return true; }
};
auto currentHost=std::make_shared<BookTurnHost>();
std::shared_ptr<BookTurnHost> HostForId(const std::string& id) { return id=="fixture"?currentHost:nullptr; }
${body}
constexpr size_t kFrameDiagCapacity=512;
${declaration(host, 'Percentile')}
int main() {
 Env env; uint64_t generation=999;
 for(double number: {1.0,42.0,4294967296.0,9007199254740991.0}) {
  Value value {Value::NUMBER,number,"",false}; int reads=env.int64Reads;assert(GetGeneration(&env,&value,generation));assert(env.int64Reads==reads+1);assert(generation==static_cast<uint64_t>(std::llround(number)));
 }
 for(double number: {0.0,-0.0,-1.0,0.5,1.5,9007199254740992.0,18446744073709551616.0,std::numeric_limits<double>::quiet_NaN(),std::numeric_limits<double>::infinity(),-std::numeric_limits<double>::infinity()}) {
  Value value {Value::NUMBER,number,"",false};int reads=env.int64Reads;generation=999;assert(!GetGeneration(&env,&value,generation));assert(generation==999);assert(env.int64Reads==reads);
 }
 Value text {Value::STRING,0,"fixture",false};assert(!GetGeneration(&env,&text,generation));
 Value gen {Value::NUMBER,9007199254740991.0,"",false},direction {Value::NUMBER,-1,"",false},profile {Value::NUMBER,0,"",false},vertical {Value::BOOLEAN,0,"",true};
 for(double selected: {0.0,1.0,2.0}) { profile.number=selected;env.arguments={&text,&gen,&direction,&profile};assert(StartProgrammatic(&env,nullptr)->boolean);assert(currentHost->generation==9007199254740991ULL);assert(currentHost->direction==Direction::NEXT);assert(static_cast<int32_t>(currentHost->profile)==selected); }
 env.arguments={&text,&gen,&direction};assert(StartProgrammatic(&env,nullptr)->boolean);assert(currentHost->profile==ProgrammaticProfile::NORMAL);
 for(double invalid: {-1.0,0.5,3.0,std::numeric_limits<double>::quiet_NaN(),std::numeric_limits<double>::infinity()}) { profile.number=invalid;env.arguments={&text,&gen,&direction,&profile};assert(!StartProgrammatic(&env,nullptr)->boolean); }
 for(double invalid: {0.0,-0.5,1.5,2.0,std::numeric_limits<double>::quiet_NaN()}) { direction.number=invalid;env.arguments={&text,&gen,&direction};assert(!StartProgrammatic(&env,nullptr)->boolean); }
 Value token {Value::NUMBER,2147483647.0,"",false};env.arguments={&text,&gen,&token};assert(StartAutomaticTimeline(&env,nullptr)->boolean);assert(currentHost->token==INT32_MAX);
 for(double invalid: {0.0,-1.0,0.5,2147483648.0,std::numeric_limits<double>::quiet_NaN(),std::numeric_limits<double>::infinity()}) { token.number=invalid;assert(!StartAutomaticTimeline(&env,nullptr)->boolean); }
 direction.number=1;std::vector<Value> fields;for(double value: {320.0,844.0,12.25,40.5,99.75,150.125,1234.5})fields.push_back({Value::NUMBER,value,"",false});
 env.arguments={&text,&gen,&direction,&vertical};for(auto& field:fields)env.arguments.push_back(&field);
 assert(UpdateInput(&env,nullptr)->boolean);const auto& sample=currentHost->sample;
 assert(sample.generation==9007199254740991ULL&&sample.direction==Direction::PREVIOUS&&sample.verticalPrevious);
 assert(sample.width==320&&sample.height==844&&sample.startX==12.25F&&sample.startY==40.5F&&sample.pointerX==99.75F&&sample.pointerY==150.125F&&sample.eventTimeNs==1234500000LL);
 Value commit {Value::BOOLEAN,0,"",true};env.arguments.push_back(&commit);assert(EndGesture(&env,nullptr)->boolean);assert(currentHost->commit);
 for(double invalid: {0.0,1.5,9007199254740992.0,std::numeric_limits<double>::quiet_NaN()}) { gen.number=invalid;assert(!EndGesture(&env,nullptr)->boolean);env.arguments.pop_back();assert(!UpdateInput(&env,nullptr)->boolean);env.arguments.push_back(&commit); }
 std::vector<float> empty;assert(Percentile(empty,0.5F)==0);
 for(size_t size=1;size<=kFrameDiagCapacity;size++)for(float fraction: {0.5F,0.95F,1.0F}) {
  std::vector<float> values;for(size_t index=size;index>0;index--)values.push_back(static_cast<float>(index));
  const auto oldIndex=std::min(size-1,static_cast<size_t>(fraction*static_cast<float>(size-1)+0.5F));
  assert(Percentile(values,fraction)==static_cast<float>(oldIndex+1));
 }
}
`;
    const path = resolve(artifact, 'number-boundaries.cpp'), binary = resolve(artifact, 'number-boundaries');
    writeFileSync(path, source);
    run('/usr/bin/clang++', ['-std=c++17', '-O2', '-Wall', '-Wextra', '-Werror', path, '-o', binary], { log: 'number-compile.log' });
    run(binary, [], { log: 'number-run.log', timeout: 5000 });
    console.log(JSON.stringify({ safeGenerationBoundary: 9007199254740991, badNumbersRejectBeforeInt64: true,
      rawGestureFieldsUnchanged: true, profileAndTokenBounds: true, percentileSamples: 512 * 3,
      boundary: 'Actual C++ declarations with bounded NAPI ports; actual two-TU OHOS syntax compile is a separate case.' }));
  }
  if (id === 'ohos-compile') {
    const sdk = '/Applications/DevEco-Studio.app/Contents/sdk/default';
    const clang = sdk + '/hms/native/BiSheng/bin/clang++';
    const flags = ['--target=x86_64-linux-ohos', '--gcc-toolchain=' + sdk + '/hms/native/BiSheng',
      '--sysroot=' + sdk + '/openharmony/native/sysroot', '-I' + sdk + '/hms/native/sysroot/usr/include',
      '-I' + resolve(root, 'entry/src/main/cpp/bookturn'), '-std=c++17', '-D__MUSL__', '-O2',
      '-Wall', '-Wextra', '-Werror', '-Wno-error=unused-command-line-argument', '-fPIC', '-fsyntax-only'];
    const before = resolve(artifact, 'unchecked-casts-before.cpp');
    writeFileSync(before, '#include <cstdint>\n#include <cstddef>\nuint64_t generation(double value){return static_cast<uint64_t>(value);}\nsize_t percentile(float value){return static_cast<size_t>(value);}\n');
    const negative = run(clang, [...flags, before], { expected: 1, log: 'unchecked-casts-before.log' });
    assert.match(negative.stderr, /Wfloat-to-int-overflow/);
    for (const [index, path] of [napiPath, hostPath].entries())
      run(clang, [...flags, resolve(root, path)], { log: 'ohos-tu-' + index + '.log' });
    const inputs = [napiPath, hostPath, 'tools/test-bookturn-numeric-boundaries.mjs'].map(path => ({ path,
      sha256: createHash('sha256').update(readFileSync(resolve(root, path))).digest('hex') }));
    writeFileSync(resolve(artifact, 'verification.json'), JSON.stringify({ entry: 'tools/test-bookturn-numeric-boundaries.mjs',
      cases: selected, compiler: clang, flags, inputs, result: 'PASS', oldUncheckedCasts: 'EXPECTED_FAIL',
      boundary: 'C++ numeric boundary probe and exact OHOS two-translation-unit syntax compile. HAP/ArkTS/link/runtime/device remain separate.' }, null, 2) + '\n');
    console.log(JSON.stringify({ translationUnits: 2, warningPolicy: '-Wall -Wextra -Werror', uncheckedCasts: 'EXPECTED_FAIL', result: 'PASS' }));
  }
  recordContractCasePass(id);
}
