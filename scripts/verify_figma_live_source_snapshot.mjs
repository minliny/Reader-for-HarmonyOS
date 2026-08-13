#!/usr/bin/env node
// HarmonyOS host gate: verify the Figma live-source snapshot that Authoritative
// Reader-UI publishes, then delegate the broader Figma-first structural check to
// Reader-UI's own verifier.  This script intentionally holds NO independent
// visual authority — it only:
//   1. confirms the live-source snapshot artifact exists in Reader-UI,
//   2. checks the snapshot's self-consistency (expected/found node counts,
//      no detached substitutes, official revision cross-reference),
//   3. invokes Reader-UI/tools/design/verify-figma-first-reading-chain.mjs
//      --baseline to validate registry/evidence/reconciliation provenance.
//
// --baseline mode exits zero when structural provenance is sound even while
// delivery remains blocked by device/motion evidence.  This matches the
// HarmonyOS host's position: we consume the contract; we do not fabricate
// visual delivery evidence.  Do NOT add a --strict pass-through here without
// coordinating with Reader-UI — delivery blockers are physical and can only
// be unblocked by real device/motion evidence.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const harmonyRepo = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(harmonyRepo, '..');
const readerUiRepo = path.join(workspaceRoot, 'Reader-UI');

const snapshotPath = path.join(readerUiRepo, 'docs/design/FIGMA_LIVE_SOURCE_SNAPSHOT.json');
const evidencePath = path.join(readerUiRepo, 'docs/design/F0_FIGMA_CURRENT_REVISION_EVIDENCE.json');
const registryPath = path.join(readerUiRepo, 'docs/design/FIGMA_VISUAL_ADMISSION_REGISTRY.json');
const readerUiVerifierPath = path.join(readerUiRepo, 'tools/design/verify-figma-first-reading-chain.mjs');

const errors = [];

function readJson(target, label) {
  if (!fs.existsSync(target)) {
    errors.push(`missing ${label}: ${path.relative(readerUiRepo, target)}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (error) {
    errors.push(`invalid JSON for ${label}: ${error.message}`);
    return null;
  }
}

const snapshot = readJson(snapshotPath, 'Figma live-source snapshot');
const evidence = readJson(evidencePath, 'official current-revision evidence');
const registry = readJson(registryPath, 'visual-admission registry');

// 1. Snapshot self-consistency.
if (snapshot) {
  if (snapshot.kind !== 'FIGMA_PLUGIN_LIVE_SOURCE_SNAPSHOT') {
    errors.push(`snapshot kind mismatch: expected FIGMA_PLUGIN_LIVE_SOURCE_SNAPSHOT, got ${snapshot.kind}`);
  }
  if (snapshot.schemaVersion !== '1.0.0') {
    errors.push(`snapshot schemaVersion must be 1.0.0, got ${snapshot.schemaVersion}`);
  }
  const summary = snapshot.summary || {};
  if (summary.allExpectedNodesFound !== true) {
    errors.push('snapshot summary.allExpectedNodesFound must be true');
  }
  if (summary.detachedSubstitutesAccepted !== false) {
    errors.push('snapshot summary.detachedSubstitutesAccepted must be false');
  }
  if (typeof summary.expectedNodeCount !== 'number' || typeof summary.foundNodeCount !== 'number') {
    errors.push('snapshot summary.expectedNodeCount/foundNodeCount must be numbers');
  } else if (summary.expectedNodeCount !== summary.foundNodeCount) {
    errors.push(`snapshot node count mismatch: expected ${summary.expectedNodeCount}, found ${summary.foundNodeCount}`);
  } else if (!Array.isArray(snapshot.nodes) || snapshot.nodes.length !== summary.foundNodeCount) {
    errors.push(`snapshot.nodes length ${snapshot.nodes?.length} does not match summary.foundNodeCount ${summary.foundNodeCount}`);
  }
  if (snapshot.provenance?.source !== 'figma-plugin-api-through-codex') {
    errors.push(`snapshot provenance.source must be figma-plugin-api-through-codex, got ${snapshot.provenance?.source}`);
  }
  if (snapshot.provenance?.readOnly !== true) {
    errors.push('snapshot provenance.readOnly must be true');
  }
  if (snapshot.provenance?.nodeRevision !== null) {
    errors.push('snapshot provenance.nodeRevision must remain null; the Plugin API does not expose an official REST revision');
  }
}

// 2. Cross-reference snapshot -> official evidence -> registry authority.
if (snapshot && evidence) {
  const snapshotRevRef = snapshot.provenance?.officialFileRevisionEvidence;
  if (!snapshotRevRef) {
    errors.push('snapshot provenance.officialFileRevisionEvidence is missing');
  } else {
    if (snapshotRevRef.artifact !== 'F0_FIGMA_CURRENT_REVISION_EVIDENCE.json') {
      errors.push(`snapshot officialFileRevisionEvidence.artifact must be F0_FIGMA_CURRENT_REVISION_EVIDENCE.json, got ${snapshotRevRef.artifact}`);
    }
    if (snapshotRevRef.currentRevision !== evidence.currentRevision) {
      errors.push(`snapshot officialFileRevisionEvidence.currentRevision (${snapshotRevRef.currentRevision}) differs from evidence.currentRevision (${evidence.currentRevision})`);
    }
  }
  if (snapshot.fileKey !== evidence.fileKey) {
    errors.push(`snapshot fileKey (${snapshot.fileKey}) differs from evidence fileKey (${evidence.fileKey})`);
  }
}

if (snapshot && registry) {
  if (snapshot.fileKey !== registry.authority?.fileKey) {
    errors.push(`snapshot fileKey (${snapshot.fileKey}) differs from registry authority fileKey (${registry.authority?.fileKey})`);
  }
}

if (evidence && registry) {
  if (evidence.fileKey !== registry.authority?.fileKey) {
    errors.push(`evidence fileKey (${evidence.fileKey}) differs from registry authority fileKey (${registry.authority?.fileKey})`);
  }
  if (registry.authority?.fileKey && evidence.currentRevision) {
    for (const record of registry.records || []) {
      if (record.classification !== 'exact-figma-binding') continue;
      const rev = record.figma?.revision;
      if (rev && rev !== evidence.currentRevision) {
        errors.push(`registry record ${record.id} revision ${rev} differs from official evidence ${evidence.currentRevision}`);
      }
    }
  }
}

// 3. Delegate the broader Figma-first structural check to Reader-UI authority.
if (!fs.existsSync(readerUiVerifierPath)) {
  errors.push(`Reader-UI verifier missing: ${path.relative(readerUiRepo, readerUiVerifierPath)}`);
} else {
  const result = spawnSync(process.execPath, [readerUiVerifierPath, '--baseline'], {
    cwd: readerUiRepo,
    encoding: 'utf8',
  });
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.status !== 0) {
    errors.push(`Reader-UI verify-figma-first-reading-chain.mjs --baseline exited ${result.status}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`FIGMA_LIVE_SOURCE_SNAPSHOT ERROR: ${error}`);
  process.exitCode = 1;
} else {
  const nodeCount = snapshot?.summary?.foundNodeCount || 0;
  const revision = evidence?.currentRevision || 'unknown';
  console.log(`FIGMA_LIVE_SOURCE_SNAPSHOT: manifest-valid; nodes=${nodeCount} revision=${revision}`);
}
