# HarmonyOS HOS-10 Validation / RC Hardening Plan

**Date**: 2026-05-16
**Bridge**: Core `3c72be8` / HarmonyOS `35ef516`
**Status**: PLANNING

## 1. Goal

Validate that HarmonyOS can **actually** call Reader-Core through the bridge server. Cross-validate ArkTS implementations against Core output. Prepare RC release readiness without claiming production status.

## 2. Phase Overview

| Stage | Goal | Tasks |
|-------|------|-------|
| **HOS-10A** | Bridge cross-validation | 6 tasks |
| **HOS-10B** | Simulator + network | 2 tasks |
| **HOS-10C** | Release readiness plan | 1 task |

## 3. HOS-10A — Bridge Cross-Validation (6 tasks)

### HOS-10A-001 Bridge Health Smoke from HarmonyOS
- BridgeHTTPClient.health() → /health endpoint
- Verify DTO decode (BridgeHealth interface)
- If localhost not reachable from simulator: record HOST_NETWORK_BLOCKED
- Document expected host config for dev

### HOS-10A-002 Bridge Host Configuration
- BridgeHTTPClient baseUrl should be configurable, NOT hardcoded
- Document: localhost (Mac), LAN IP (simulator), 10.0.2.2 (Android emulator analog?)
- Create dev host config in fixture/bridge settings
- No production URLs hardcoded

### HOS-10A-003 TXTParser Cross-Validation
- Same TXT input → ArkTS TXTParser + Core POST /parse/txt
- Compare: chapter count, titles, encoding, byteCount
- If mismatch: keep LOCAL_FALLBACK_EXPERIMENTAL
- If match: upgrade to VERIFIED_DEV
- Create cross-validation test fixture

### HOS-10A-004 Search Bridge Cross-Validation
- Same BookSource + SearchQuery → BridgeHTTPClient + FixtureReplayInterceptor
- Verify: DTO decode (SearchResultItem[]), error model, empty result
- No real book source websites
- If bridge unreachable → fixture fallback works

### HOS-10A-005 TOC/Content Bridge Cross-Validation
- Verify DTO decode (TOCItem[], ContentPage), cache strategy, error fallback
- No real book source websites

### HOS-10A-006 Capability Matrix Upgrade Gate
- Audit all BRIDGE_CONNECTED_DEV_ONLY capabilities
- Only cross-validated capabilities upgrade to VERIFIED_DEV
- PRODUCTION_READY requires: VERIFIED_DEV + simulator test + signing plan
- Document gate criteria

## 4. HOS-10B — Simulator + Network (2 tasks)

### HOS-10B-001 Simulator Deployment Smoke
- Build HAP
- Attempt deployment to HarmonyOS emulator
- Verify: app starts, shell renders, no crash
- If no emulator: record ENV_BLOCKED (no simulator)

### HOS-10B-002 Device/Network Documentation
- Document localhost vs emulator networking
- Mac host IP configuration for simulator
- No secrets saved

## 5. HOS-10C — Release Readiness (1 task)

### HOS-10C-001 Signing/Release Readiness Plan
- Production signing config plan
- Profile/permission checklist
- Release build configuration
- Plan only — do not fake release completion

## 6. Capability Status Rules

| Status | Meaning | Upgrade Criteria |
|--------|---------|-----------------|
| CONTRACT_ONLY | Interface defined, no impl | Adapter implementation |
| FIXTURE_ONLY | Hardcoded fixture data | Real service connection |
| LOCAL_FALLBACK_EXPERIMENTAL | ArkTS re-impl, not validated | Cross-validation pass |
| BRIDGE_CLIENT_ONLY | Client exists, no server | Bridge server built |
| BRIDGE_CONNECTED_DEV_ONLY | Bridge works, dev env only | Cross-validation + simulator |
| VERIFIED_DEV | Cross-validated, dev env | Simulator test + signing plan |
| PRODUCTION_READY_PENDING_RELEASE | Verified, awaiting release | Signing + store submission |

Forbidden to use without evidence:
- PRODUCTION_READY
- FULLY_SUPPORTED
- COMPLETE

## 7. Loop Rules (Validation Mode)

- ONLY HOS-10 tasks are eligible
- No feature development (HOS-0A through HOS-6B are CLOSED)
- No UI expansion (pages/ frozen)
- No real book source websites
- No production secrets
- Each tick: one HOS-10 READY task
- Status upgrades require evidence (cross-validation output, build log, etc.)
