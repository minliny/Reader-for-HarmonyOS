import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { registerHooks, syncBuiltinESMExports } from 'node:module';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const output = process.env.READER_LAYOUT_TRACE_OUTPUT ?? root + 'Reader-for-HarmonyOS/.reader-artifacts/framework-confluence-20261112/code-side-audit/repair-reading-layout/execution-inputs.json';
if (!output.startsWith(root) || !output.includes('/.reader-artifacts/'))
    throw new Error('Trace output must remain in this checkout private artifacts.');
const read = fs.readFileSync.bind(fs);
const files = new Map();
const sdkFiles = new Map();
const hash = value => createHash('sha256').update(value).digest('hex');
function capture(path, value, mechanism) {
    if (path instanceof URL)
        path = fileURLToPath(path);
    if (typeof path !== 'string')
        return;
    if (!path.startsWith('/'))
        path = process.cwd() + '/' + path;
    const local = path.startsWith(root) && !path.includes('/.reader-artifacts/') && !path.includes('/.git/');
    const sdk = !local && /\/(?:lib\/(?:process_component_class|process_ui_syntax|validate_ui_syntax|ets_checker)\.js|node_modules\/typescript\/(?:package\.json|lib\/typescript\.js))$/.test(path);
    if (!local && !sdk)
        return;
    const table = local ? files : sdkFiles;
    const digest = hash(value);
    const record = table.get(path) ?? { path: local ? path.slice(root.length) : path, sha256: digest, mechanisms: [], observedSha256: [] };
    if (!record.mechanisms.includes(mechanism))
        record.mechanisms.push(mechanism);
    if (!record.observedSha256.includes(digest))
        record.observedSha256.push(digest);
    table.set(path, record);
}
fs.readFileSync = function (path, ...args) {
    const value = read(path, ...args);
    capture(path, value, 'fs.readFileSync');
    return value;
};
syncBuiltinESMExports();
registerHooks({ load(url, context, next) {
        if (url.startsWith('file:')) {
            const path = fileURLToPath(url);
            if (path.startsWith(root) || /\/lib\/(?:process_component_class|process_ui_syntax|validate_ui_syntax|ets_checker)\.js$/.test(path)) {
                capture(path, read(path), 'node.load');
            }
        }
        return next(url, context);
    } });
capture(fileURLToPath(import.meta.url), read(fileURLToPath(import.meta.url)), 'trace-entry');
process.on('exit', code => {
    const unstable = [];
    for (const [path, record] of [...files, ...sdkFiles]) {
        const finalSha256 = hash(read(path));
        record.exitSha256 = finalSha256;
        if (record.observedSha256.length !== 1 || finalSha256 !== record.sha256)
            unstable.push(record.path);
    }
    const ordered = [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
    fs.writeFileSync(output, JSON.stringify({ kind: 'reader-layout-execution-inputs', recordedAt: new Date().toISOString(), node: process.version,
        command: process.argv.slice(1), testExitCode: code, traceIntegrity: unstable.length === 0 ? 'PASS' : 'FAIL',
        exitCode: unstable.length > 0 ? 1 : code, root, inputs: ordered, sdkInputs: [...sdkFiles.values()], unstable,
        sourceSetSha256: hash(ordered.map(record => record.path + '\0' + record.sha256).join('\n')) }, null, 2) + '\n');
    if (unstable.length > 0)
        process.exitCode = 1;
});
