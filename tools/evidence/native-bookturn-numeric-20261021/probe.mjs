// Issue-local numeric boundary checks only. No book-turn state-machine suite,
// HAP build, runtime/device IO or private signing material is loaded.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyBuildLease } from '../../../../Reader-Core/scripts/lib/build-resource-lock.mjs';
import { resolveHarmonyTool } from '../../../scripts/lib/harmony-toolchain.mjs';

verifyBuildLease();
const evidence = dirname(fileURLToPath(import.meta.url));
const root = resolve(evidence, '../../..');
const hostPath = 'entry/src/main/cpp/bookturn/bookturn_host.cpp';
const napiPath = 'entry/src/main/cpp/bookturn/bookturn_napi.cpp';
const host = readFileSync(resolve(root, hostPath), 'utf8');
const napi = readFileSync(resolve(root, napiPath), 'utf8');
const formerHost = execFileSync('git', ['show', 'HEAD:' + hostPath], { cwd: root, encoding: 'utf8' });
const sha = value => createHash('sha256').update(value).digest('hex');
function method(source, name) {
  const start = source.search(new RegExp('(?:bool|float|napi_value) ' + name + '\\('));
  assert.ok(start >= 0, 'actual production method exists: ' + name);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let position = open; position < source.length; position++) {
    if (source[position] === '{') depth++;
    if (source[position] === '}' && --depth === 0) return source.slice(start, position + 1);
  }
  throw new Error('unterminated production method: ' + name);
}
const capacity = host.match(/constexpr size_t kFrameDiagCapacity = \d+;/)?.[0];
assert.ok(capacity, 'actual production diagnostic capacity');
const harness = String.raw`
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <cstdlib>
#include <iostream>
#include <limits>
#include <memory>
#include <optional>
#include <string>
#include <vector>

// NAPI typed readers are explicit effect ports, not a native runtime claim.
enum class ValueType { Number, String, Boolean };
struct MockValue {
    ValueType type = ValueType::Number;
    double number = 0;
    std::string text;
    bool boolean = false;
    bool typedReadable = true;
};
using napi_env = void*;
using napi_value = MockValue*;
struct MockCallback { std::vector<napi_value> arguments; };
using napi_callback_info = MockCallback*;
enum napi_status { napi_ok, napi_invalid_arg };
int typed64Reads = 0;
int typed32Reads = 0;
bool forceNegative64 = false;
MockValue Number(double number) { MockValue value; value.number = number; return value; }
MockValue Text(const char* text) { MockValue value; value.type = ValueType::String; value.text = text; return value; }
napi_status napi_get_value_double(napi_env, napi_value value, double* output)
{
    if (value == nullptr || value->type != ValueType::Number) return napi_invalid_arg;
    *output = value->number; return napi_ok;
}
napi_status napi_get_value_int64(napi_env, napi_value value, int64_t* output)
{
    typed64Reads++;
    if (!value->typedReadable) return napi_invalid_arg;
    *output = forceNegative64 ? -1 : static_cast<int64_t>(value->number);
    return napi_ok;
}
napi_status napi_get_value_int32(napi_env, napi_value value, int32_t* output)
{
    typed32Reads++;
    if (!value->typedReadable) return napi_invalid_arg;
    *output = static_cast<int32_t>(value->number); return napi_ok;
}
napi_status napi_get_value_string_utf8(napi_env, napi_value value, char* buffer, size_t capacity, size_t* length)
{
    if (value == nullptr || value->type != ValueType::String) return napi_invalid_arg;
    *length = value->text.size();
    if (buffer != nullptr && capacity > 0) {
        const size_t copied = std::min(capacity - 1, value->text.size());
        std::memcpy(buffer, value->text.data(), copied); buffer[copied] = 0;
    }
    return napi_ok;
}
napi_status napi_get_boolean(napi_env, bool value, napi_value* output)
{
    static MockValue truth, falsity;
    truth.type = falsity.type = ValueType::Boolean;
    truth.boolean = true; falsity.boolean = false;
    *output = value ? &truth : &falsity; return napi_ok;
}
napi_status napi_get_cb_info(napi_env, napi_callback_info info, size_t* count, napi_value* arguments, void*, void*)
{
    const size_t copied = std::min(*count, info->arguments.size());
    for (size_t index = 0; index < copied; ++index) arguments[index] = info->arguments[index];
    *count = info->arguments.size(); return napi_ok;
}
enum class Direction { NEXT, PREVIOUS };
enum class ProgrammaticProfile { FIRST, SECOND, THIRD };
struct BookTurnHost {
    int programCalls = 0, automaticCalls = 0;
    uint64_t generation = 0;
    Direction direction = Direction::NEXT;
    ProgrammaticProfile profile = ProgrammaticProfile::FIRST;
    int32_t token = 0;
    bool StartProgrammatic(uint64_t selected, Direction decoded, ProgrammaticProfile chosen)
    {
        programCalls++; generation = selected; direction = decoded; profile = chosen; return true;
    }
    bool StartAutomaticTimeline(uint64_t selected, int32_t selectedToken)
    {
        automaticCalls++; generation = selected; token = selectedToken; return true;
    }
};
const auto effectHost = std::make_shared<BookTurnHost>();
std::shared_ptr<BookTurnHost> HostForId(const std::string& id) { return id == "id" ? effectHost : nullptr; }
` + ['GetString', 'GetDouble', 'GetInt32', 'GetSafeGeneration', 'GetBoundedInt32', 'Boolean',
  'DecodeDirection'].map(name => name === 'DecodeDirection' ?
    napi.slice(napi.indexOf('Direction DecodeDirection('), napi.indexOf('\nbool ReadPixelMap(')).trim() : method(napi, name)).join('\n\n') + '\n' +
  ['StartProgrammatic', 'StartAutomaticTimeline'].map(name => method(napi, name)).join('\n\n') + '\n' + capacity + '\n' +
  method(host, 'Percentile') + '\n' + method(formerHost, 'Percentile').replace('Percentile(', 'FormerPercentile(') + String.raw`

void Expect(bool condition, const char* label)
{
    if (!condition) { std::cerr << "FAIL " << label << std::endl; std::exit(1); }
}
bool Program(double generation, double direction, std::optional<double> profile = std::nullopt)
{
    auto id = Text("id"), gen = Number(generation), dir = Number(direction), prof = Number(profile.value_or(0));
    MockCallback callback { { &id, &gen, &dir } };
    if (profile.has_value()) callback.arguments.push_back(&prof);
    return StartProgrammatic(nullptr, &callback)->boolean;
}
bool Automatic(double generation, double token)
{
    auto id = Text("id"), gen = Number(generation), selectedToken = Number(token);
    MockCallback callback { { &id, &gen, &selectedToken } };
    return StartAutomaticTimeline(nullptr, &callback)->boolean;
}
int main()
{
    for (double input : { 0.0, -0.0, 1.0, 2.0, 2147483647.0, 4294967296.0, 9007199254740991.0 }) {
        auto value = Number(input); uint64_t result = 19;
        const int before = typed64Reads;
        Expect(GetSafeGeneration(nullptr, &value, result), "valid safe generation");
        Expect(result == static_cast<uint64_t>(input) && typed64Reads == before + 1, "exact typed generation");
    }
    std::cout << "PASS valid safe generation exactness and zero sentinel\n";
    const std::vector<double> invalid = { -1.0, -0.5, 0.5, 1.25, 9007199254740992.0,
        18446744073709551616.0, std::numeric_limits<double>::max(),
        std::numeric_limits<double>::quiet_NaN(), std::numeric_limits<double>::infinity(),
        -std::numeric_limits<double>::infinity() };
    for (double input : invalid) {
        auto value = Number(input); uint64_t result = 19;
        const int before = typed64Reads;
        Expect(!GetSafeGeneration(nullptr, &value, result), "invalid generation rejected");
        Expect(result == 19 && typed64Reads == before, "invalid generation cannot reach integer reader");
    }
    auto nonNumber = Text("3"); uint64_t unchanged = 19;
    Expect(!GetSafeGeneration(nullptr, &nonNumber, unchanged) && unchanged == 19, "nonnumeric generation rejected");
    std::cout << "PASS invalid generation rejected before typed conversion\n";
    auto unreadable = Number(7); unreadable.typedReadable = false;
    Expect(!GetSafeGeneration(nullptr, &unreadable, unchanged) && unchanged == 19, "typed failure preserves output");
    auto negativePort = Number(7); forceNegative64 = true;
    Expect(!GetSafeGeneration(nullptr, &negativePort, unchanged) && unchanged == 19, "invalid typed result rejected");
    forceNegative64 = false;
    std::cout << "PASS typed reader failure and negative typed result rejected\n";

    for (double generation : { 1.0, 2.0, 9007199254740991.0 }) {
        for (double direction : { -1.0, 1.0 }) {
            Expect(Program(generation, direction), "default program profile");
            Expect(static_cast<int32_t>(effectHost->profile) == 0, "default profile unchanged");
            for (int32_t profile : { 0, 1, 2 }) {
                Expect(Program(generation, direction, profile), "valid program domain");
                Expect(effectHost->generation == static_cast<uint64_t>(generation), "program generation exact");
                Expect(effectHost->direction == (direction < 0 ? Direction::NEXT : Direction::PREVIOUS), "direction unchanged");
                Expect(static_cast<int32_t>(effectHost->profile) == profile, "program profile unchanged");
            }
        }
        for (double token : { 1.0, 2147483647.0 }) {
            Expect(Automatic(generation, token), "valid automatic domain");
            Expect(effectHost->generation == static_cast<uint64_t>(generation) &&
                effectHost->token == static_cast<int32_t>(token), "automatic values unchanged");
        }
    }
    std::cout << "PASS actual programmatic and automatic callbacks retain valid domains\n";
    int programBefore = effectHost->programCalls, automaticBefore = effectHost->automaticCalls;
    for (double generation : invalid) {
        Expect(!Program(generation, -1) && !Automatic(generation, 1), "invalid callback generation");
    }
    Expect(!Program(0, -1) && !Automatic(0, 1), "positive generation required by these callbacks");
    for (double direction : { -2.0, -0.5, 0.0, 0.5, 2.0, 4294967295.0,
        std::numeric_limits<double>::quiet_NaN(), std::numeric_limits<double>::infinity() })
        Expect(!Program(1, direction), "invalid direction cannot wrap or truncate");
    for (double profile : { -1.0, 0.5, 1.5, 3.0, 4294967296.0,
        std::numeric_limits<double>::quiet_NaN(), std::numeric_limits<double>::infinity() })
        Expect(!Program(1, -1, profile), "invalid profile cannot wrap or truncate");
    for (double token : { -1.0, 0.0, 0.5, 1.5, 2147483648.0, 4294967297.0,
        std::numeric_limits<double>::quiet_NaN(), std::numeric_limits<double>::infinity() })
        Expect(!Automatic(1, token), "invalid automatic token cannot wrap or truncate");
    Expect(effectHost->programCalls == programBefore && effectHost->automaticCalls == automaticBefore,
        "rejected callback cannot reach host business effects");
    std::cout << "PASS actual callbacks retain invalid-domain refusal and no host effects\n";

    size_t comparisons = 0;
    for (size_t count = 1; count <= kFrameDiagCapacity; ++count) {
        std::vector<float> initial;
        for (size_t index = 0; index < count; ++index) initial.push_back(static_cast<float>(count - index));
        std::vector<float> fractions { 0.0F, 0.5F, 0.95F, 1.0F };
        if (count > 1) {
            const float half = 0.5F / static_cast<float>(count - 1);
            fractions.push_back(half);
            fractions.push_back(std::nextafter(half, 0.0F));
            fractions.push_back(std::nextafter(half, 1.0F));
        }
        for (float fraction : fractions) {
            auto current = initial, former = initial;
            Expect(Percentile(current, fraction) == FormerPercentile(former, fraction), "bounded percentile differential");
            comparisons++;
        }
    }
    std::cout << "PASS original percentile rounding differential " << comparisons << " cases\n";
    for (float fraction : { -1.0F, -0.1F, 1.1F, std::numeric_limits<float>::quiet_NaN(),
        std::numeric_limits<float>::infinity(), -std::numeric_limits<float>::infinity() }) {
        std::vector<float> values { 3, 2, 1 }, original = values;
        Expect(Percentile(values, fraction) == 0 && values == original, "invalid percentile fraction fails closed");
    }
    std::vector<float> empty, oversized(kFrameDiagCapacity + 1, 7);
    Expect(Percentile(empty, 0.5F) == 0 && Percentile(oversized, 0.5F) == 0,
        "bounded diagnostic population");
    std::cout << "PASS invalid diagnostic inputs rejected without selection\n";
}
`;

const temp = mkdtempSync(join(tmpdir(), 'reader-bookturn-numeric-'));
const report = { status: 'RUNNING', production: { [hostPath]: sha(host), [napiPath]: sha(napi) },
  formerHostSha256: sha(formerHost), checks: [],
  boundary: 'production numeric helper/callback execution with explicit NAPI/host ports; real BiSheng syntax compilation only, no native runtime/state-machine/HAP/device acceptance' };
function run(name, command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', cwd: root, maxBuffer: 8 * 1024 * 1024 });
  const output = (result.stdout ?? '') + (result.stderr ?? '');
  writeFileSync(join(evidence, name + '.log'), output);
  report.checks.push({ name, command, args, exitCode: result.status, signal: result.signal,
    log: name + '.log', logSha256: sha(output) });
  assert.equal(result.error, undefined, name + ': tool execution');
  assert.equal(result.status, 0, name + ': ' + output);
  return output;
}
try {
  const harnessPath = join(temp, 'numeric.cpp'), binary = join(temp, 'numeric');
  writeFileSync(harnessPath, harness);
  run('host-compile', process.env.CXX || '/usr/bin/clang++', ['-std=c++17', '-O1', '-Wall', '-Wextra', '-Werror', harnessPath, '-o', binary]);
  report.numericReceipts = run('numeric-boundaries', binary, []).trim().split('\n');
  const sdk = resolveHarmonyTool('sdkHome', { cwd: root });
  const native = resolve(sdk, 'native'), bisheng = resolve(sdk, '../hms/native/BiSheng');
  const compiler = join(bisheng, 'bin/clang++');
  for (const path of [compiler, join(native, 'sysroot'), resolve(bisheng, '../sysroot/usr/include')]) assert.ok(existsSync(path), 'actual selected SDK input: ' + path);
  const common = ['--target=aarch64-linux-ohos', '--gcc-toolchain=' + bisheng, '--sysroot=' + join(native, 'sysroot'),
    '-I' + resolve(bisheng, '../sysroot/usr/include'), '-I' + resolve(root, 'entry/src/main/cpp/bookturn'),
    '-std=c++17', '-D__MUSL__', '-fPIC', '-O2', '-Wall', '-Wextra', '-Werror',
    '-Wno-error=unused-command-line-argument', '-fsyntax-only'];
  run('bisheng-host-syntax', compiler, [...common, resolve(root, hostPath)]);
  run('bisheng-napi-syntax', compiler, [...common, resolve(root, napiPath)]);
  for (const [path, fingerprint] of Object.entries(report.production)) assert.equal(sha(readFileSync(resolve(root, path))), fingerprint, 'source unchanged during local checks: ' + path);
  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL'; report.failure = error.message; throw error;
} finally {
  writeFileSync(join(evidence, 'results.json'), JSON.stringify(report, null, 2) + '\n');
  rmSync(temp, { recursive: true, force: true });
}
console.log(JSON.stringify({ status: report.status, production: report.production,
  checks: report.checks.map(({ name, exitCode }) => ({ name, exitCode })), numericReceipts: report.numericReceipts }));
