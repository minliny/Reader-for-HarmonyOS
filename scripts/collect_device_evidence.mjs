// collect_device_evidence.mjs — harvest per-capability device evidence from
// hdc hilog and produce a capability matrix.
//
// Problem: HostCapabilityManifest declares 41 capabilities with deviceVerified
// as a static field. Real device verification requires capturing hilog output
// after running the app + self-checks on a real device, then mapping log tags
// → capabilities to produce evidence-backed deviceVerified status.
//
// This script:
//   1. Optionally triggers a fresh app run + self-checks via hdc.
//   2. Captures hilog output filtered to self-check tags.
//   3. Parses each tag's log lines to extract success/failure signals.
//   4. Maps tags → capabilities and produces a JSON evidence matrix.
//   5. Prints a human-readable summary + writes evidence JSON.
//
// Prerequisites:
//   - hdc on PATH (DevEco Studio installed) OR HDC_PATH env var set.
//   - Device connected via USB/network with USB debugging enabled.
//   - HAP installed: hdc install -r entry-default-signed.hap
//
// Usage:
//   node scripts/collect_device_evidence.mjs                 # capture + report
//   node scripts/collect_device_evidence.mjs --trigger-only   # just trigger
//   node scripts/collect_device_evidence.mjs --report-only    # parse existing
//   node scripts/collect_device_evidence.mjs --output evidence.json
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

const DEVECO = '/Applications/DevEco-Studio.app/Contents';
function resolveHdc() {
  if (process.env.HDC_PATH) {
    return process.env.HDC_PATH;
  }
  const fromPath = spawnSync('sh', ['-c', 'command -v hdc'], { encoding: 'utf8' });
  if (fromPath.status === 0 && fromPath.stdout.trim().length > 0) {
    return fromPath.stdout.trim();
  }
  const candidates = [
    `${DEVECO}/sdk/default/openharmony/toolchains/hdc`,
    `${DEVECO}/sdk/default/hms/toolchains/hdc`,
    `${DEVECO}/tools/hdc`,
    `${DEVECO}/tool/hdc`,
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return 'hdc';
}
const HDC = resolveHdc();

// ── Self-check tags → capabilities mapping ──
// Each tag is emitted by a runXxxSelfCheck method in EntryAbility.ets.
// The tag's log lines prove specific capabilities were exercised on device.
const TAG_TO_CAPABILITIES = {
  'HostManifest': {
    description: 'Capability manifest broadcast at init + post-self-check evidence drive',
    capabilities: [],
    // Init broadcast: deviceVerified=0 (honest — nothing verified yet).
    // Post-self-check: deviceVerified>0 (evidence-driven).
    // Both lines prove the manifest is wired and broadcasting; this is meta
    // evidence and does not mark a HostCapability verified by itself.
    successPattern: /summary total=\d+.*deviceVerified=\d+/,
  },
  'CoreSelfCheck': {
    description: 'Core NAPI runtime ping/coreInfo/hostSmoke',
    capabilities: ['host.smoke.echo'],
    successPattern: /ping ok=true[\s\S]*coreInfo=[\s\S]*hostSmoke type=/,
  },
  'ReadingChain': {
    description: 'Minimal reading chain: http + cookie + file',
    capabilities: ['http.execute', 'cookie.set', 'cookie.get', 'file.write', 'file.read'],
    successPattern: /DONE transport\+cache verified/,
  },
  'RssChain': {
    description: 'RSS ingestion: http + item-count + file cache',
    capabilities: ['http.execute', 'file.write', 'file.read'],
    successPattern: /DONE transport\+cache verified/,
  },
  'LocalBook': {
    description: 'local_book TXT + EPUB: file + persistence + zlib',
    capabilities: ['file.write', 'file.read', 'persistence.put', 'persistence.get'],
    successPattern: /DONE txt\+epub local_book verified/,
  },
  'SyncWebDav': {
    description: 'sync/WebDAV: credential.get + http PUT/GET + file',
    capabilities: ['credential.get', 'http.execute', 'file.write'],
    successPattern: /DONE credential\+http\+file composed/,
  },
  'UiAdapter': {
    description: 'UI-only adapters: WebView + permission + notification',
    capabilities: ['webview.open', 'webview.close', 'permission.check', 'notification.show', 'notification.cancel'],
    successPattern: /DONE webview\+permission\+notification/,
  },
  'TtsSelfCheck': {
    description: 'TTS TextReader: start/pause/resume/stop/progress',
    capabilities: ['tts.system.start', 'tts.system.pause', 'tts.system.resume', 'tts.system.stop'],
    successPattern: /shutdown done/,
  },
};

const args = process.argv.slice(2);
const triggerOnly = args.includes('--trigger-only');
const reportOnly = args.includes('--report-only');
const outputIdx = args.indexOf('--output');
const outputPath = outputIdx >= 0 && args[outputIdx + 1]
  ? path.resolve(args[outputIdx + 1])
  : path.join(REPO, 'docs/PLANNING/device-evidence.json');
const reportLogPath = (() => {
  if (!reportOnly) {
    return null;
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--output') {
      i++;
      continue;
    }
    if (arg.startsWith('--')) {
      continue;
    }
    return path.resolve(arg);
  }
  return null;
})();

function run(cmd, opts = {}) {
  return spawnSync('sh', ['-c', cmd], { encoding: 'utf8', ...opts });
}

function checkHdc() {
  const r = run(`"${HDC}" list targets`);
  if (r.status !== 0) {
    console.error(`✗ hdc not available at ${HDC} (exit ${r.status})`);
    console.error('  Set HDC_PATH env var or install DevEco Studio.');
    return false;
  }
  const targets = r.stdout.trim().split('\n').filter(t => t && t !== '[Empty]');
  if (targets.length === 0) {
    console.error('✗ No device connected. Connect a device with USB debugging enabled.');
    return false;
  }
  console.log(`✓ Device connected: ${targets.join(', ')}`);
  return true;
}

function triggerSelfChecks() {
  console.log('→ Triggering fresh self-checks (force-stop + launch with selfCheck=true)...');
  const pkg = 'reader.minliny.testpackage';
  run(`"${HDC}" shell aa force-stop ${pkg}`);
  // Clear hilog buffer so we only capture fresh output.
  run(`"${HDC}" shell hilog -r`);
  // Launch the app with --ps selfCheck true so EntryAbility.onCreate runs all
  // Host self-checks. Regular launches (without this param) skip self-checks.
  const launch = run(`"${HDC}" shell aa start -a EntryAbility -b ${pkg} --ps selfCheck true`);
  if (launch.status !== 0) {
    console.error(`✗ Failed to launch app: ${launch.stderr || launch.stdout}`);
    return false;
  }
  console.log('✓ App launched with selfCheck=true. Waiting 25s for self-checks to complete...');
  // Self-checks are fire-and-forget in onCreate. The longest chain is TTS
  // (~6s) + network round-trips (WebDAV/HTTP). 25s is a safe upper bound.
  execSync('sleep 25');
  return true;
}

function captureHilog() {
  console.log('→ Capturing hilog output...');
  // Capture all hilog, then filter to our tags. We capture broadly because
  // hilog tag filtering on-device is unreliable across OS versions.
  const r = run(`"${HDC}" shell hilog -x 2>/dev/null`);
  if (r.status !== 0) {
    console.error(`✗ hilog capture failed: ${r.stderr || r.stdout}`);
    return '';
  }
  return r.stdout || '';
}

function parseEvidence(hilogText) {
  const evidence = {};
  for (const [tag, spec] of Object.entries(TAG_TO_CAPABILITIES)) {
    // Match lines containing the tag in the hilog output. hilog format:
    //   07-07 21:12:34.567 12345 67890 I [tag] message
    // Or simpler: just grep for [tag] in the line.
    const tagLines = hilogText.split('\n').filter(l => l.includes(`[${tag}]`));
    const fullText = tagLines.join('\n');
    const hasSuccess = spec.successPattern.test(fullText);
    const hasError = /\berror=/.test(fullText) && !hasSuccess;
    evidence[tag] = {
      description: spec.description,
      capabilities: spec.capabilities,
      logLineCount: tagLines.length,
      status: hasSuccess ? 'verified' : (hasError ? 'failed' : (tagLines.length > 0 ? 'partial' : 'missing')),
      sampleLines: tagLines.slice(-3), // last 3 lines as evidence sample
    };
  }
  return evidence;
}

function buildCapabilityMatrix(evidence) {
  // Aggregate per-capability status from all tags that cover it.
  const matrix = {};
  for (const [tag, ev] of Object.entries(evidence)) {
    for (const cap of ev.capabilities) {
      if (!matrix[cap]) {
        matrix[cap] = { tags: [], status: 'missing' };
      }
      matrix[cap].tags.push(tag);
      // 'verified' wins over 'partial' wins over 'failed' wins over 'missing'.
      const rank = { verified: 3, partial: 2, failed: 1, missing: 0 };
      if (rank[ev.status] > rank[matrix[cap].status]) {
        matrix[cap].status = ev.status;
      }
    }
  }
  return matrix;
}

function printSummary(evidence, matrix) {
  console.log('');
  console.log('═'.repeat(72));
  console.log('Device Evidence Summary');
  console.log('═'.repeat(72));
  console.log('');
  console.log('Per-tag evidence:');
  for (const [tag, ev] of Object.entries(evidence)) {
    const icon = ev.status === 'verified' ? '✓' : (ev.status === 'failed' ? '✗' : (ev.status === 'partial' ? '⚠' : '○'));
    console.log(`  ${icon} [${tag}] ${ev.status} (${ev.logLineCount} lines) — ${ev.description}`);
  }
  console.log('');
  console.log('Per-capability matrix:');
  const caps = Object.keys(matrix).sort();
  let verified = 0, partial = 0, failed = 0, missing = 0;
  for (const cap of caps) {
    const m = matrix[cap];
    const icon = m.status === 'verified' ? '✓' : (m.status === 'failed' ? '✗' : (m.status === 'partial' ? '⚠' : '○'));
    console.log(`  ${icon} ${cap.padEnd(30)} ${m.status.padEnd(10)} tags: ${m.tags.join(', ')}`);
    if (m.status === 'verified') verified++;
    else if (m.status === 'partial') partial++;
    else if (m.status === 'failed') failed++;
    else missing++;
  }
  console.log('');
  console.log(`Total: ${verified} verified / ${partial} partial / ${failed} failed / ${missing} missing out of ${caps.length}`);
  console.log('');
}

// ── Main ──

if (reportOnly) {
  // Parse an existing hilog capture file (useful for re-reporting).
  if (!reportLogPath || !fs.existsSync(reportLogPath)) {
    console.error('✗ --report-only requires a hilog file argument (existing file path).');
    console.error('  Usage: node scripts/collect_device_evidence.mjs --report-only <hilog.txt> [--output evidence.json]');
    process.exit(1);
  }
  const text = fs.readFileSync(reportLogPath, 'utf8');
  const evidence = parseEvidence(text);
  const matrix = buildCapabilityMatrix(evidence);
  printSummary(evidence, matrix);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ evidence, matrix, capturedAt: new Date().toISOString() }, null, 2));
  console.log(`Evidence written to ${outputPath}`);
  process.exit(0);
}

if (!checkHdc()) process.exit(1);

if (!triggerOnly) {
  if (!triggerSelfChecks()) process.exit(1);
  const hilogText = captureHilog();
  // Save raw hilog for archival / re-reporting.
  const rawLog = path.join(REPO, 'docs/PLANNING/device-hilog-raw.txt');
  fs.mkdirSync(path.dirname(rawLog), { recursive: true });
  fs.writeFileSync(rawLog, hilogText);
  console.log(`✓ Raw hilog saved to ${rawLog}`);
  const evidence = parseEvidence(hilogText);
  const matrix = buildCapabilityMatrix(evidence);
  printSummary(evidence, matrix);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({ evidence, matrix, capturedAt: new Date().toISOString() }, null, 2));
  console.log(`Evidence JSON written to ${outputPath}`);
} else {
  if (!triggerSelfChecks()) process.exit(1);
  console.log('✓ Self-checks triggered. Run without --trigger-only to capture + report.');
}
