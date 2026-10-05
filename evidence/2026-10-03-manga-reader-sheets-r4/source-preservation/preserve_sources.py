#!/usr/bin/env python3
"""Preserve frozen Reader source and its exact Native SDK without private material.

Reads only the specified delivery tree and approved design source. Writes only to
this evidence directory (or an explicit --output). No Git/source/build mutation.
"""
import argparse
import datetime
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import tarfile

DELIVERY = Path('/private/tmp/reader-manga-sheet-ui-delivery-20261003-1913')
DESIGN = Path('/Users/minliny/Documents/Reader/evidence/2026-10-02-manga-ui-demo')
LFS_BIN = '/Applications/GitHub Desktop.app/Contents/Resources/app/git/libexec/git-core'
CORE_FINGERPRINT = '9e97919470b42d81d87082c2c257984778da5e5e5e55798273b3242c99608c4b'
SO_SHA = '1fabbfa63b996e39da9a3ec01f6b396cf841f0d0b4016303daac56a974c17996'
REPOS = ('Reader-Core-Native', 'Reader-UI', 'Reader-for-HarmonyOS')
ENV = dict(os.environ, PATH=LFS_BIN + ':' + os.environ['PATH'])
CACHE_PARTS = {'.git', 'node_modules', 'target', '.reader-local', '.reader-artifacts',
               '.hvigor', '.ohpm', 'oh_modules', '__pycache__', '.pytest_cache',
               '.cache', '.DS_Store'}
PRIVATE_SUFFIXES = {'.p12', '.pfx', '.jks', '.keystore', '.cer', '.crt', '.cert',
                    '.pem', '.p7b', '.p7c', '.provisionprofile', '.mobileprovision'}
LOG_SUFFIXES = {'.log', '.jsonl', '.ftrace', '.trace', '.heapsnapshot', '.hprof'}
SOURCE_SUFFIXES = {'.mjs', '.js', '.cjs', '.ts', '.tsx', '.ets', '.css', '.py',
                   '.sh', '.rs', '.h', '.c', '.cpp', '.diff', '.patch', '.md'}
EVIDENCE_TEST_INPUTS = {
    'evidence/2026-09-11-appearance-make-v9/make-v9-reference.json',
    'evidence/2026-09-13-current-gap-register/capsule-figma-live.json',
    'evidence/2026-09-13-current-gap-register/theme-consumer-bindings.json',
    'reports/tooling/corpus-batch-live-full-1945-v5-2026-07-09.json',
    'reports/tooling/capability-catalog.json',
    'evidence/2026-09-14-physical-review/ShelfBookPresentation.ts.before',
    'evidence/2026-09-14-physical-review/BookshelfBookActionSheet.ets.before',
    'evidence/2026-09-14-physical-review/LocalBookDetail.ets.before',
    'evidence/2026-09-14-physical-review/SourceManagementPage.ets.before',
    'evidence/2026-09-14-physical-review/ShelfBookListDetails.ets.before',
    'evidence/2026-09-14-physical-review/BookshelfPage.ets.before',
}
ROOT_DOCUMENTS = ('AGENTS.md', 'ARCHITECTURE.md', 'HAP_BUILD_SYSTEM.md', 'README.md')
DESIGN_TOP = {'src', 'public', 'tests', 'scripts', 'worker', 'index.html',
              'package.json', 'package-lock.json', 'tsconfig.json',
              'vite.config.ts', 'playwright.config.ts', 'mobile-runtime.lock.json',
              'AGENTS.md', 'DESIGN_PLAN.md'}


def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args], env=ENV)


def sha_file(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def json_write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def candidates(repo):
    raw = git(repo, 'ls-files', '--cached', '--others', '--exclude-standard', '-z')
    return sorted(set(x.decode('utf-8') for x in raw.split(b'\0') if x))


def basic_exclusion(rel):
    p = PurePosixPath(rel)
    if p.is_absolute() or '..' in p.parts:
        raise RuntimeError('Unsafe source path: ' + rel)
    if any(part in CACHE_PARTS for part in p.parts):
        return 'git-or-dependency-or-build-cache'
    if p.suffix.lower() in PRIVATE_SUFFIXES:
        return 'certificate-or-key-or-profile-material'
    if any(part.lower() in {'signing', 'harmony-signing', 'keystores'} for part in p.parts):
        return 'private-signing-directory'
    if p.name == '.env' or (p.name.startswith('.env.') and not
                           any(token in p.name for token in ('example', 'sample', 'template'))):
        return 'private-environment-config'
    if p.name.lower() in {'local.properties', 'key.properties', 'secrets.json'}:
        return 'private-local-config'
    if p.suffix.lower() in LOG_SUFFIXES:
        return 'runtime-log-or-trace'
    return None


def evidence_projects(paths):
    # Retain full controlled source projects and their assets, not only text.
    return [str(PurePosixPath(p).parent) + '/' for p in paths
            if p.startswith('evidence/') and p.endswith('/package.json')]


def repo_exclusion(rel, projects):
    reason = basic_exclusion(rel)
    if reason:
        return reason
    p = PurePosixPath(rel)
    # Exact root outputs only: a third_party source directory named build is safe.
    if p.parts[0] in {'build', 'dist', 'coverage', 'test-results', 'playwright-report'}:
        return 'root-build-or-test-output'
    if p.parts[0] in {'evidence', 'reports'}:
        if rel in EVIDENCE_TEST_INPUTS:
            return None
        if any(rel.startswith(project) for project in projects):
            if any(part in {'dist', 'build', 'coverage', 'test-results', 'playwright-report'}
                   for part in p.parts):
                return 'design-project-build-or-test-output'
            return None
        # Retain controlled design records and source probes. Historical VM
        # pixels, traces, huge result JSON and prior generated bundles are not
        # source. They remain in the original evidence tree, outside this bundle.
        if p.suffix.lower() in SOURCE_SUFFIXES:
            return None
        return 'historical-evidence-or-report-output'
    return None


def source_record(source, archive_path):
    info = source.lstat()
    if not stat.S_ISREG(info.st_mode):
        raise RuntimeError('Selected input is not a regular file: ' + archive_path)
    # Check every ancestor, not only the final path, before reading source bytes.
    if any(parent.is_symlink() for parent in source.parents):
        raise RuntimeError('Symlink parent in selected source: ' + archive_path)
    return dict(path=archive_path, type='file', mode=info.st_mode & 0o777,
                bytes=info.st_size, sha256=sha_file(source))


def audit_content(source, rel):
    # Actual PEM material is forbidden even under an unsuspecting suffix.
    # Do not expose matching content. Test/source string literals are not keys.
    with source.open('rb') as f:
        first = f.read(1024 * 1024)
    if first.startswith(b'version https://git-lfs.github.com/spec/v1\n'):
        raise RuntimeError('LFS pointer instead of actual bytes: ' + rel)
    material = re.compile(rb'(?m)^-----BEGIN (?:(?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY|CERTIFICATE)-----')
    # Stream the whole input, retaining overlap for a header at a chunk boundary.
    with source.open('rb') as f:
        overlap = b''
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            probe = overlap + chunk
            if material.search(probe):
                raise RuntimeError('Private-key/certificate payload detected: ' + rel)
            overlap = probe[-128:]
    if source.name == 'build-profile.json5':
        # Public templates are permitted only without any private signing fields.
        if re.search(rb'(?:signingConfigs|storePassword|keyPassword|keystore)', first):
            raise RuntimeError('Signing-bearing build-profile forbidden: ' + rel)
    return {'path': rel, 'privatePayload': False, 'actualLfsBytes': True}


def parse_dirty(repo):
    raw = git(repo, 'status', '--porcelain=v1', '-z', '--untracked-files=all')
    entries = raw.split(b'\0')
    result = []
    i = 0
    while i < len(entries):
        if entries[i]:
            line = entries[i].decode('utf-8')
            row = dict(status=line[:2], path=line[3:])
            if 'R' in line[:2] or 'C' in line[:2]:
                i += 1
                row['originalPath'] = entries[i].decode('utf-8')
            result.append(row)
        i += 1
    return result


def archive(output, name, selected):
    records = [source_record(source, rel) for source, rel in selected]
    if len({r['path'] for r in records}) != len(records):
        raise RuntimeError('Duplicate archive paths')
    destination = output / (name + '.tar.gz')
    with destination.open('wb') as raw:
        with gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0, compresslevel=6) as gz:
            with tarfile.open(fileobj=gz, mode='w|', format=tarfile.PAX_FORMAT) as tar:
                for (source, rel), record in zip(selected, records):
                    if source_record(source, rel) != record:
                        raise RuntimeError('Source changed before archive: ' + rel)
                    info = tarfile.TarInfo(rel)
                    info.size = record['bytes']
                    info.mode = record['mode']
                    info.mtime = 0
                    info.uid = info.gid = 0
                    info.uname = info.gname = ''
                    with source.open('rb') as f:
                        tar.addfile(info, f)
    # Full decompression and digest comparison: no trusting tar headers/size.
    seen = set()
    expected = {r['path']: r for r in records}
    verified_bytes = 0
    with tarfile.open(destination, mode='r:gz') as tar:
        for member in tar:
            if member.name in seen or member.name not in expected or not member.isfile():
                raise RuntimeError('Unexpected or duplicate archive member: ' + member.name)
            p = PurePosixPath(member.name)
            if p.is_absolute() or '..' in p.parts:
                raise RuntimeError('Unsafe archive member: ' + member.name)
            seen.add(member.name)
            h = hashlib.sha256()
            size = 0
            with tar.extractfile(member) as f:
                for chunk in iter(lambda: f.read(1024 * 1024), b''):
                    h.update(chunk)
                    size += len(chunk)
            record = expected[member.name]
            if size != record['bytes'] or h.hexdigest() != record['sha256'] or member.mode != record['mode']:
                raise RuntimeError('Archive byte/mode mismatch: ' + member.name)
            verified_bytes += size
    if seen != set(expected):
        raise RuntimeError('Missing archive members')
    for (source, rel), record in zip(selected, records):
        if source_record(source, rel) != record:
            raise RuntimeError('Source changed after archive: ' + rel)
    content_digest = hashlib.sha256()
    for record in records:
        content_digest.update((json.dumps(record, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
    result = dict(schemaVersion=1, name=name, sourceFileCount=len(records),
                  sourceBytes=sum(r['bytes'] for r in records),
                  inventoryFingerprint=content_digest.hexdigest(),
                  archive=dict(path=destination.name, bytes=destination.stat().st_size,
                               sha256=sha_file(destination)), files=records,
                  verification=dict(fullArchiveRead=True, everyFileSha256=True,
                                    everyFileMode=True, exactMemberSet=True,
                                    sourceUnchangedDuringArchive=True,
                                    files=len(seen), bytes=verified_bytes))
    json_write(output / (name + '-inventory.json'), result)
    return result


def capture_core(output, label):
    snapshot = output / ('core-build-snapshot-' + label + '.json')
    subprocess.run(['node', 'scripts/build-input-snapshot.mjs', 'capture', str(snapshot)],
                   cwd=DELIVERY / 'Reader-Core-Native', env=ENV, check=True,
                   stdout=subprocess.DEVNULL)
    data = json.loads(snapshot.read_text())
    if data['fingerprint'] != CORE_FINGERPRINT:
        raise RuntimeError('Canonical Core fingerprint differs: ' + data['fingerprint'])
    return data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent)
    parser.add_argument('--preflight-only', action='store_true')
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    if not (Path(LFS_BIN) / 'git-lfs').is_file():
        raise RuntimeError('Required real Git LFS unavailable')
    subprocess.run(['git-lfs', 'version'], env=ENV, check=True, stdout=subprocess.DEVNULL)
    core_before = capture_core(output, 'before')
    states, excluded, audit = [], [], []
    source_selected = []
    for name in REPOS:
        repo = DELIVERY / name
        paths = candidates(repo)
        projects = evidence_projects(paths)
        missing = []
        kept = []
        for rel in paths:
            reason = repo_exclusion(rel, projects)
            if reason:
                excluded.append(dict(repo=name, path=rel, reason=reason))
                continue
            source = repo / rel
            if not source.exists():
                missing.append(rel)
                continue
            audit.append(audit_content(source, name + '/' + rel))
            kept.append(rel)
            source_selected.append((source, name + '/' + rel))
        states.append(dict(repo=name, source=str(repo),
                           head=git(repo, 'rev-parse', 'HEAD').decode().strip(),
                           dirty=parse_dirty(repo), gitEnumeratedFileCount=len(paths),
                           preservedFileCount=len(kept), trackedMissing=missing,
                           ignoredPrivateSigningDirectoryDetected=(repo / '.reader-local/signing').is_dir(),
                           retainedEvidenceSourceProjects=projects))
    for rel in ROOT_DOCUMENTS:
        source = DELIVERY / rel
        audit.append(audit_content(source, 'workspace/' + rel))
        source_selected.append((source, 'workspace/' + rel))
    for prefix in ('scripts', '.agents'):
        for source in sorted((DELIVERY / prefix).rglob('*')):
            if not source.is_file():
                continue
            rel = source.relative_to(DELIVERY).as_posix()
            reason = basic_exclusion(rel)
            if reason:
                excluded.append(dict(repo='workspace', path=rel, reason=reason))
                continue
            audit.append(audit_content(source, 'workspace/' + rel))
            source_selected.append((source, 'workspace/' + rel))
    selected_paths = {rel for _, rel in source_selected}
    for record in core_before['files']:
        if 'Reader-Core-Native/' + record['path'] not in selected_paths:
            raise RuntimeError('Canonical Core build input excluded: ' + record['path'])
    design_selected = []
    for directory, subdirs, files in os.walk(DESIGN, followlinks=False):
        current = Path(directory)
        for dirname in list(subdirs):
            rel = (current / dirname).relative_to(DESIGN).as_posix()
            reason = basic_exclusion(rel)
            if PurePosixPath(rel).parts[0] not in DESIGN_TOP:
                reason = reason or 'demo-runtime-or-editor-output'
            if reason:
                subdirs.remove(dirname)
                excluded.append(dict(repo='approved-design', path=rel + '/', reason=reason))
        for filename in sorted(files):
            source = current / filename
            rel = source.relative_to(DESIGN).as_posix()
            reason = basic_exclusion(rel)
            if PurePosixPath(rel).parts[0] not in DESIGN_TOP:
                reason = reason or 'demo-runtime-or-editor-output'
            if reason:
                excluded.append(dict(repo='approved-design', path=rel, reason=reason))
                continue
            audit.append(audit_content(source, 'approved-design/' + rel))
            design_selected.append((source, 'approved-design/' + rel))
    native_root = DELIVERY / 'Reader-Core-Native/target/harmony-napi/arm64-v8a'
    manifest = native_root / 'harmony-package-manifest.sha256'
    native_selected = []
    package_expected = {}
    for line in manifest.read_text().splitlines():
        digest, size, rel = line.split(None, 2)
        rel = rel.strip().lstrip('*')
        source = native_root / 'package' / rel
        if source.stat().st_size != int(size) or sha_file(source) != digest:
            raise RuntimeError('Native SDK package differs from bound manifest: ' + rel)
        package_expected[rel] = digest
        audit.append(audit_content(source, 'native-sdk/package/' + rel))
        native_selected.append((source, 'native-sdk/package/' + rel))
    package_files = {p.relative_to(native_root / 'package').as_posix()
                     for p in (native_root / 'package').rglob('*') if p.is_file()}
    if package_files != set(package_expected):
        raise RuntimeError('Native SDK has extra or missing package files')
    for rel in ('harmony-package-manifest.sha256', 'core-input-snapshot.json',
                'core-build-identity.json', 'harmony-napi-build-evidence.txt'):
        source = native_root / rel
        audit.append(audit_content(source, 'native-sdk/' + rel))
        native_selected.append((source, 'native-sdk/' + rel))
    native_snapshot = json.loads((native_root / 'core-input-snapshot.json').read_text())
    if native_snapshot['fingerprint'] != CORE_FINGERPRINT:
        raise RuntimeError('Native SDK belongs to another Core input snapshot')
    host_so = DELIVERY / 'Reader-for-HarmonyOS/entry/libs/arm64-v8a/libreader_core_napi.so'
    if sha_file(host_so) != SO_SHA or package_expected.get('libs/arm64-v8a/libreader_core_napi.so') != SO_SHA:
        raise RuntimeError('Host/SDK Native SO does not match the expected artifact')
    preflight = dict(schemaVersion=1, generatedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                     deliverySource=str(DELIVERY), approvedDesignSource=str(DESIGN),
                     gitLfsExecutable=str(Path(LFS_BIN) / 'git-lfs'),
                     privateMaterialPolicy='No keys, certificates, profiles, private config, dependency/build caches or live run/staging artifacts.',
                     sourceEnumeration='git ls-files --cached --others --exclude-standard -z, plus controlled Root docs/scripts/.agents; design allowlist.',
                     coreBuildInputFingerprint=CORE_FINGERPRINT, nativeSoSha256=SO_SHA,
                     repoStates=states, audit=audit, exclusions=excluded,
                     nativePackageManifestChecked=True,
                     canonicalCoreBuildInputsAllIncluded=True,
                     missingExternalOptionalToolInputs=[dict(
                         tool='Reader-for-HarmonyOS/tools/refresh-source-supply-manifest.mjs',
                         path='workspace/evidence/2026-08-31-five-line/supply-admission-results.json',
                         reason='Not present in the independent delivery Root; retained as an explicit external refresh-tool dependency, not invented or copied from mutable shared source.')],
                     sourceCandidateFileCount=len(source_selected),
                     designCandidateFileCount=len(design_selected),
                     nativeCandidateFileCount=len(native_selected))
    json_write(output / 'preflight.json', preflight)
    print(json.dumps(dict(preflight='PASS', sourceFiles=len(source_selected),
                          designFiles=len(design_selected), nativeFiles=len(native_selected),
                          excludedFiles=len(excluded), coreFingerprint=CORE_FINGERPRINT)))
    if args.preflight_only:
        return
    archives = []
    for name, inputs in (('reader-source', source_selected), ('approved-design-source', design_selected),
                         ('native-sdk', native_selected)):
        result = archive(output, name, sorted(inputs, key=lambda item: item[1]))
        archives.append({k: result[k] for k in ('name', 'sourceFileCount', 'sourceBytes',
                                               'inventoryFingerprint', 'archive', 'verification')})
        print(json.dumps({k: result[k] for k in ('name', 'sourceFileCount', 'sourceBytes', 'archive')}))
    core_after = capture_core(output, 'after')
    if core_before != core_after:
        raise RuntimeError('Core source changed during preservation')
    all_inputs = dict((rel, source) for source, rel in source_selected + design_selected + native_selected)
    for artifact in archives:
        inventory = json.loads((output / (artifact['name'] + '-inventory.json')).read_text())
        for record in inventory['files']:
            if source_record(all_inputs[record['path']], record['path']) != record:
                raise RuntimeError('Source changed before final verification: ' + record['path'])
    summary = dict(schemaVersion=1, status='PASS', archives=archives,
                   coreBuildInputFingerprint=CORE_FINGERPRINT,
                   nativeSoSha256=SO_SHA, sourceMutation=False,
                   privateSigningMaterialIncluded=False,
                   originalCanonicalHapRun='Preserved separately by the parent; this bundle claims source/SDK preservation only.',
                   scriptSha256=sha_file(Path(__file__)))
    json_write(output / 'verification.json', summary)
    print(json.dumps(dict(result='PASS', archiveCount=len(archives),
                          files=sum(a['sourceFileCount'] for a in archives),
                          sourceBytes=sum(a['sourceBytes'] for a in archives))))


if __name__ == '__main__':
    main()
