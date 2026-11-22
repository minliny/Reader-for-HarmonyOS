import { constants, lstatSync, openSync, closeSync, fstatSync, readFileSync, readdirSync, ftruncateSync, writeFileSync, writeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../../../../', import.meta.url));
const evidencePath = 'evidence/reader-ui-verification-plan-20261119/implementation';
const root = resolve(workspace, evidencePath);
const indexName = 'EVIDENCE-INDEX.json';
const lookupName = 'EVIDENCE-CURRENT-LOOKUP.json';
const reusePath = 'phase-1/acceptance-correction/phase-1-evidence-reuse-final.json';
const native = 'phase-1/current-native-20261120';
const skip = new Set(['.git', '.hg', '.svn', 'node_modules', 'oh_modules', 'target', 'build', 'dist',
  '.hvigor', 'Reader-Core', 'Reader-for-HarmonyOS', 'owner', 'raw', 'tools', 'scripts']);
const maxDepth = 12;
const maxMetadataBytes = 16 * 1024 * 1024;
const sha = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) ? value : null;
const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value) ? value : null;
const text = value => typeof value === 'string' && value.length ? value : null;
const sorted = values => [...values].sort();
const json = value => `${JSON.stringify(value, null, 2)}\n`;

function localStat(base, path, directory = false) {
  if (typeof path !== 'string' || /[\\\x00-\x1f]/.test(path)) return null;
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) return null;
  let full = base;
  try {
    for (const [i, part] of parts.entries()) {
      full = join(full, part);
      const stat = lstatSync(full);
      if (i < parts.length - 1 || directory) {
        if (!stat.isDirectory()) return null;
      } else {
        return stat.isFile() ? stat : null;
      }
    }
    return lstatSync(full);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return null;
    throw error;
  }
}

function readRecord(path, plain = false) {
  const stat = localStat(root, path);
  if (!stat) return { problem: '元数据缺失或不是范围内普通文件' };
  if (stat.size > maxMetadataBytes) return { problem: '元数据超出大小上限' };
  const fd = openSync(join(root, path), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const data = readFileSync(fd, 'utf8');
    try {
      const value = plain ? data.trim() : JSON.parse(data);
      if (!plain && (!value || typeof value !== 'object' || Array.isArray(value))) return { problem: 'JSON 不是记录对象' };
      return { value };
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return { problem: 'JSON 无法解析' };
    }
  } finally {
    closeSync(fd);
  }
}

function scannedKind(name, path) {
  if (name === 'receipt.json' || /^.+[-.]receipt\.json$/i.test(name)) return 'receipt';
  if (name === 'tool-identity.json') return 'replay-tool';
  if (name === 'manifest.json') return 'candidate-manifest';
  if (name === 'PROGRESS.md') return 'progress';
  if (name.endsWith('.tar.gz') || name.endsWith('.zip')) return 'archive-file';
  if (name === 'derivation.json') return 'derivation';
  if (name === 'OWNER-SOURCE-PROJECTION.json' || name.startsWith('PREFLIGHT-')) return 'metadata';
  if (/handoff/i.test(name) && /\.(json|md)$/.test(name)) return 'handoff';
  if (path === reusePath || /^PHASE-[01]-(?:COVERAGE|RESIDUAL-MATRIX).*\.json$/.test(name)) return 'existing-inventory';
  if (/\.png$/i.test(name)) return 'screenshot';
  if (/(?:^|[-_.])(?:layout(?:-?dump)?|dump-?layout)(?:[-_.]|$).*\.json$/i.test(name) || /^layout\.json$/i.test(name)) return 'layout-dump';
  return null;
}

function collect() {
  const records = new Map();
  const topLevelDirectories = [];
  const excluded = [];
  const referenceIssues = new Set();
  const reuse = readRecord(reusePath).value;
  const historical = new Map();
  if (reuse?.schema === 'reader-phase1-raw-evidence-reuse-v1') {
    for (const entry of Array.isArray(reuse.cases) ? reuse.cases : []) {
      if (entry?.status !== 'REASSESSED_HISTORICAL_CAPTURE' || !sha(entry.original?.root) || !text(entry.original?.receiptPath)) continue;
      const path = `phase-1/${entry.original.receiptPath}`;
      if (!historical.has(path)) historical.set(path, []);
      historical.get(path).push(entry);
    }
  }

  function add(path, kind, reason, extras = {}) {
    const bytes = kind === 'directory' ? null : localStat(root, path)?.size;
    if (bytes === undefined) return;
    records.set(path, { path, kind, caseId: null, candidate: null, toolVersion: null,
      status: 'unknown', reason, bytes, ...extras });
  }

  function walk(dir = '', depth = 0) {
    const entries = readdirSync(join(root, dir), { withFileTypes: true });
    if (dir && entries.some(entry => entry.name === '.git')) {
      excluded.push({ path: dir, reason: '嵌套 Git 工作树，不读取内容' });
      return;
    }
    for (const entry of entries) {
      const path = dir ? `${dir}/${entry.name}` : entry.name;
      if (!dir && [indexName, lookupName].includes(entry.name)) continue;
      if (entry.isSymbolicLink()) {
        excluded.push({ path, reason: '不跟随符号链接' });
      } else if (entry.isDirectory()) {
        if (!dir) {
          topLevelDirectories.push(path);
          add(path, 'directory', '一级目录导航；目录本身不能证明候选、工具或验收状态');
        }
        if (skip.has(entry.name) || depth >= maxDepth) {
          excluded.push({ path, reason: entry.name === 'raw' ? '原始载荷仅从回执/会话引用定位' :
            depth >= maxDepth ? '达到扫描深度上限' : '源码、依赖或构建树不展开' });
        } else walk(path, depth + 1);
      } else if (entry.isFile()) {
        const kind = scannedKind(entry.name, path);
        if (kind) add(path, kind, '存在于磁盘；尚无当前候选或可复用性授权');
      }
    }
  }
  walk();

  function assets(record, receipt) {
    const bundleDir = dirname(record.path);
    const refs = new Map();
    const save = (ref, kind, source) => {
      if (!text(ref?.path)) return;
      const path = bundleDir === '.' ? ref.path : `${bundleDir}/${ref.path}`;
      if (ref.path.split('/')[0] !== 'raw' || !localStat(root, path)) {
        referenceIssues.add(`${record.path}: ${kind} 引用缺失、越界或不是普通 raw 文件`);
        return;
      }
      const previous = refs.get(path);
      if (previous && (previous.kind !== kind || previous.recordedSha256 !== sha(ref.sha256))) {
        referenceIssues.add(`${record.path}: ${path} 的引用标识冲突`);
        return;
      }
      if (!previous) refs.set(path, { kind, recordedSha256: sha(ref.sha256), referenceSource: source });
    };

    if (receipt.session?.path === 'session/session.json') {
      const sessionPath = bundleDir === '.' ? receipt.session.path : `${bundleDir}/${receipt.session.path}`;
      const { value: session, problem } = readRecord(sessionPath);
      if (!session || session.runId !== receipt.runId) {
        referenceIssues.add(`${record.path}: 会话元数据不可用或 runId 不匹配${problem ? `（${problem}）` : ''}`);
      } else {
        const queue = [session.chain];
        while (queue.length) {
          const value = queue.pop();
          if (!value || typeof value !== 'object') continue;
          save(value.layout, 'layout-dump', sessionPath);
          save(value.screenshot, 'screenshot', sessionPath);
          for (const child of Object.values(value)) if (child && typeof child === 'object') queue.push(child);
        }
      }
    }
    for (const assertion of Array.isArray(receipt.assertions) ? receipt.assertions : []) {
      for (const ref of Array.isArray(assertion?.evidenceRefs) ? assertion.evidenceRefs : []) {
        if (typeof ref?.path === 'string' && ref.path.startsWith('raw/') && /\.png$/i.test(ref.path)) {
          save(ref, 'screenshot', record.path);
        }
      }
    }
    for (const [path, ref] of refs) {
      add(path, ref.kind, '原记录声明的载荷引用；仅探测文件存在和大小，未打开、验哈希或转移结论', {
        caseId: record.caseId, candidate: record.candidate, toolVersion: record.toolVersion,
        status: record.status, ...(record.statusSource ? { statusSource: record.statusSource } : {}),
        recordedSha256: ref.recordedSha256, referenceSource: ref.referenceSource,
        receiptPath: record.path,
      });
    }
  }

  for (const path of sorted(records.keys())) {
    const record = records.get(path);
    if (!['receipt', 'replay-tool', 'handoff', 'candidate-manifest', 'derivation'].includes(record.kind) || !path.endsWith('.json')) continue;
    const { value, problem } = readRecord(path);
    if (!value) {
      record.reason = problem;
      continue;
    }
    if (record.kind === 'receipt' && value.schema === 'reader-ui-receipt-v1') {
      const identity = value.candidate?.identity;
      record.caseId = text(value.caseId);
      record.candidate = sha(identity?.hapSha256) ?? sha(identity?.appContentHash);
      record.toolVersion = sha(value.tool?.sha256);
      record.candidateIdentity = { hapSha256: sha(identity?.hapSha256), appContentHash: sha(identity?.appContentHash),
        appBuildId: text(identity?.appBuildId), buildRunId: text(identity?.buildRunId),
        sourceFingerprint: sha(identity?.sourceFingerprint) };
      record.caseSha256 = sha(value.caseSha256);
      const sidecar = path.replace(/\.json$/, '.sha256');
      record.recordedReceiptRoot = sha(readRecord(sidecar, true).value);
      const matches = historical.get(path)?.some(entry => entry.caseId === record.caseId && entry.original.root === record.recordedReceiptRoot);
      const derivationPath = dirname(path) === '.' ? 'derivation.json' : `${dirname(path)}/derivation.json`;
      const derivation = readRecord(derivationPath).value;
      if (matches) {
        record.status = 'historical';
        record.reason = '既有复用清单的历史原包路径、caseId 与根摘要旁车记录相符；未重新验证';
        record.statusSource = reusePath;
      } else if (derivation?.mode === 'REUSED_CAPTURE' && sha(derivation.originalRootSha256) &&
        record.caseSha256 && derivation.caseSha256 === record.caseSha256) {
        record.status = 'historical';
        record.reason = '派生元数据声明复用了原采集；不等于当前候选原生执行或采集可复用';
        record.statusSource = derivationPath;
        record.recordedOriginalRoot = derivation.originalRootSha256;
      } else if (!record.caseId || !record.candidate || !record.toolVersion || !record.recordedReceiptRoot) {
        record.reason = '回执的用例、候选、工具或根摘要旁车标识不齐；未确认当前性或可复用性';
      } else {
        record.reason = '仅提取既有回执和根摘要旁车标识；未确认当前性或可复用性';
      }
      assets(record, value);
    } else if (record.kind === 'candidate-manifest' && value.name === 'reader-harmonyos-hap-run') {
      const signed = Array.isArray(value.artifacts) ? value.artifacts.filter(item => item?.kind === 'signed') : [];
      record.candidate = (signed.length === 1 ? sha(signed[0].sha256) : null) ??
        sha(value.expectedVersion?.appContentHash) ?? commit(value.source?.harmony?.commit);
      record.reason = record.candidate ? '从候选清单摘录标识；不代表已部署或已验收' : '候选清单未提供可识别的唯一标识';
    } else if (record.kind === 'replay-tool') {
      record.toolVersion = sha(value.sha256);
      record.reason = record.toolVersion ? '冻结工具的自报 SHA-256；未执行或复算工具' : '缺少有效的工具 SHA-256';
    } else if (record.kind === 'handoff') {
      record.toolVersion = sha(value.tool?.sha256);
      record.recordedDisposition = text(value.disposition) ?? text(value.observationStatus);
      record.reason = '交接记录仅供查找；交接状态不授予当前候选或验收结论';
    } else if (record.kind === 'derivation') {
      record.reason = '派生元数据仅供追溯；源采集与派生结论均未验证';
    } else {
      record.reason = '文件名匹配，但未识别当前索引支持的回执或候选清单格式';
    }
  }

  const rows = sorted(records.keys()).map(path => records.get(path));
  const tally = key => Object.fromEntries(sorted(new Set(rows.map(row => row[key])))
    .map(value => [value, rows.filter(row => row[key] === value).length]));
  return {
    schema: 'reader-ui-evidence-navigation-v1',
    root: '.',
    scope: { topLevelDirectories: sorted(topLevelDirectories), maxDepth, maxMetadataBytes,
      excluded: excluded.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) },
    semantics: {
      status: '只描述导航线索；仅有明确历史来源才标为 historical，不从名称、日期、PASS 或文件存在推断 current/reusable',
      unknown: '标识为 null 表示没有可用的记录；unknown 不等于未执行、失败或不适用',
      nonElevation: '不验证根摘要/哈希链或原始载荷；不执行回放、不重评行为、不恢复历史 PASS、不作验收或归档判定',
      logicalBytes: '索引文件的 stat 逻辑字节数，含各路径的副本；不是全树、独占磁盘占用或可回收量',
    },
    counts: { records: rows.length, byKind: tally('kind'),
      byStatus: { current: 0, reusable: 0, historical: 0, unknown: 0, ...tally('status') },
      indexedLogicalBytes: rows.reduce((sum, row) => sum + (row.bytes ?? 0), 0) },
    referenceIssues: sorted(referenceIssues),
    records: rows,
  };
}

function lookup(index) {
  const records = new Map(index.records.map(row => [row.path, row]));
  const links = [
    ['phase-1/PHASE-1-CURRENT-NATIVE-HANDOFF.json', '原生交接计划；先查执行缺口，不视为执行回执'],
    ['phase-1/PHASE-1-COVERAGE-HANDOFF.json', '既有阶段覆盖交接与范围'],
    [`${native}/runs`, '原生运行落盘入口；从索引按路径和 caseId 查回执'],
    [`${native}/current-candidate-1f57-20261120T055230Z/OWNER-SOURCE-PROJECTION.json`, '候选工具源码投影记录；不是部署或执行证明'],
    [`${native}/derived-current-reading-20261120T1335Z/receipt.json`, '阅读派生回执；核对其原始采集身份，不等同当前候选采集'],
    [reusePath, '既有历史复用清单；仅按原有 case 与范围查找'],
    ['PHASE-0-HANDOFF.json', 'Phase 0 交接与原回执线索'],
    ['phase-1/PROGRESS.md', 'Phase 1 历史原件（原位，按标题或 caseId 查询）'],
    ['PROGRESS.md', '实施历史原件（原位）'],
  ];
  return {
    schema: 'reader-ui-evidence-current-lookup-v1',
    boundary: index.semantics.nonElevation,
    index: indexName,
    purpose: '当前查找入口，而非当前候选、当前结果或可复用性的声明；不按文件名或修改时间选最新。',
    lookup: links.map(([path, purpose]) => {
      const row = records.get(path);
      return { path, purpose, onDisk: Boolean(row || localStat(root, path, true)),
        status: row?.status ?? 'unknown', ...(row?.recordedDisposition ? { recordedDisposition: row.recordedDisposition } : {}),
        ...(row?.caseId ? { caseId: row.caseId } : {}) };
    }),
    counts: index.counts,
    unknowns: ['未确认当前候选原生执行与验收覆盖', '没有从该索引授权证据复用',
      '未运行回放，回放的确定性和归档资格均未知', '没有测量全树磁盘占用或估算可回收量'],
    retention: ['原始回执及根摘要旁车永久保留；本索引不替代任何原件。',
      '失败、缺证或状态未知保留完整原始包及环境身份；不得从摘要恢复历史 PASS。',
      '通过样本可另做 claim、关键字段和工具 SHA 摘要；回放输出可另做同输入双次复算证明。',
      '回放确定性未另证或迁移未获确认前，不具备归档资格；PROGRESS 原位，使用此导航代替切分。'],
  };
}

function output(name, data, mode) {
  const path = join(root, name);
  const noFollow = constants.O_NOFOLLOW;
  const stat = localStat(root, name);
  if (stat && stat.nlink !== 1) throw new Error(`拒绝使用硬链接输出：${name}`);
  if (stat) {
    const fd = openSync(path, (mode === '--check' ? constants.O_RDONLY : constants.O_RDWR) | noFollow);
    try {
      const opened = fstatSync(fd);
      if (!opened.isFile() || opened.nlink !== 1 || opened.ino !== stat.ino || opened.dev !== stat.dev) {
        throw new Error(`拒绝使用不匹配的输出文件：${name}`);
      }
      if (readFileSync(fd, 'utf8') === data) return;
      if (mode === '--check') throw new Error(`生成结果与磁盘不一致：${name}`);
      const buffer = Buffer.from(data);
      for (let offset = 0; offset < buffer.length;) {
        offset += writeSync(fd, buffer, offset, buffer.length - offset, offset);
      }
      ftruncateSync(fd, buffer.length);
    } finally {
      closeSync(fd);
    }
  } else {
    if (mode === '--check') throw new Error(`缺少生成文件：${name}`);
    writeFileSync(path, data, { flag: constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow });
  }
}

const [rootFlag, suppliedRoot, mode, ...extra] = process.argv.slice(2);
if (rootFlag !== '--evidence-root' || !suppliedRoot || resolve(suppliedRoot) !== root ||
  !['--write', '--check'].includes(mode) || extra.length || !localStat(workspace, evidencePath, true)) {
  console.error(`用法：node tools/build-ui-evidence-index.mjs --evidence-root <${root}> --write|--check`);
  process.exitCode = 2;
} else {
  try {
    const index = collect();
    const results = [[indexName, json(index)], [lookupName, json(lookup(index))]];
    for (const [name, data] of results) output(name, data, mode);
    console.log(JSON.stringify({ mode, ...index.counts,
      referenceIssues: index.referenceIssues.length,
      outputBytes: Object.fromEntries(results.map(([name, data]) => [name, Buffer.byteLength(data)])) }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
