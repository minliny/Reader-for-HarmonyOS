#!/usr/bin/env python3
import json
import sys
from pathlib import Path


SCHEMA_VERSION = "harmonyos-core-legado-gap-matrix.v1"
MATRIX_PATH = Path("docs/PLANNING/HARMONYOS_CORE_LEGADO_CAPABILITY_GAP_MATRIX.json")
REQUIRED_ROW_IDS = {
    "source_rules_static_parsing",
    "js_webview_cookie_session",
    "core_release_gate",
    "harmonyos_runtime_ci",
    "local_books",
    "rss_explore",
    "data_layer",
    "ui_host_services",
    "webdav_backup_tts_download",
}
RUNTIME_NETWORK_KEYS = {
    "proxyMode",
    "proxyEnabled",
    "proxySource",
    "proxyHostHash",
    "proxyOriginalHostHash",
    "proxyPort",
    "proxyEndpointRewrittenForEmulator",
    "proxyListenScope",
    "proxyLocalPortReachable",
    "proxyAppLevelApplied",
    "proxyAppLevelStatus",
}
HOST_NETWORK_PROBE_KEYS = {
    "executed",
    "directHttpsClass",
    "proxyHttpsClass",
    "proxyHttpClass",
}
DEVICE_LOCAL_HTTP_PROBE_KEYS = {
    "configured",
    "serverStarted",
    "serverReachable",
    "deviceHostHash",
    "port",
}
DEVICE_LOCAL_FEED_PROBE_KEYS = {
    "configured",
    "fixtureServed",
    "serverReachable",
    "deviceHostHash",
    "port",
}
DEVICE_DATA_STORE_PROBE_KEYS = {
    "configured",
    "schemaVersion",
    "migrationStepCount",
    "recordCount",
    "passedInRuntimePanel",
}
DEVICE_LOCAL_BOOK_PROBE_KEYS = {
    "configured",
    "format",
    "tocCount",
    "bookshelfCount",
    "permissionHandoff",
    "passedInRuntimePanel",
}
DEVICE_READER_UI_SMOKE_KEYS = {
    "configured",
    "mode",
    "tocCount",
    "passedInHomeLayout",
}
DEVICE_SOURCE_MANAGEMENT_SMOKE_KEYS = {
    "configured",
    "mode",
    "sourceCount",
    "enabledCount",
    "debugPassed",
    "redacted",
    "passedInSettingsLayout",
}
DEVICE_HEADLESS_SERVICE_DEMO_KEYS = {
    "configured",
    "mode",
    "downloadPassed",
    "downloadCompletedCount",
    "downloadScheduledCount",
    "ttsPassed",
    "ttsQueuedSegments",
    "webdavPassed",
    "fileTokenPassed",
    "databaseMigrationPassed",
    "schemaVersion",
    "migrationStepCount",
    "redacted",
    "passedInRuntimePanel",
}
FALSE_FLAGS = [
    "rawURLExported",
    "rawCookieValueExported",
    "rawCredentialValueExported",
    "rawSessionTokenExported",
    "rawResponseBodyExported",
    "readerCoreRootArtifactsMutated",
]
PASS_OVERCLAIM_STATUSES = {
    "MEASURED_PASS",
    "CURRENT_PASS",
    "DEVICE_RUNTIME_VERIFIED",
    "RUNTIME_PARITY_VERIFIED",
}


def fail(message: str) -> None:
    raise AssertionError(message)


def read_json(path: Path) -> dict:
    if not path.is_file():
        fail(f"missing file: {path}")
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        fail(f"{path} must contain a JSON object")
    return data


def require_bool(value: object, expected: bool, label: str) -> None:
    if value is not expected:
        fail(f"{label} must be {expected}")


def validate_clean_room(matrix: dict) -> None:
    clean_room = matrix.get("cleanRoom")
    if not isinstance(clean_room, dict):
        fail("cleanRoom must be present")
    require_bool(clean_room.get("maintained"), True, "cleanRoom.maintained")
    require_bool(clean_room.get("externalGPLCodeCopied"), False, "cleanRoom.externalGPLCodeCopied")
    require_bool(
        clean_room.get("legadoSourceCopiedTranslatedOrAdapted"),
        False,
        "cleanRoom.legadoSourceCopiedTranslatedOrAdapted",
    )
    require_bool(
        clean_room.get("compatLevelDefinitionsChanged"),
        False,
        "cleanRoom.compatLevelDefinitionsChanged",
    )


def read_text(path: Path) -> str:
    if not path.is_file():
        fail(f"missing file: {path}")
    return path.read_text(encoding="utf-8")


def validate_runtime_artifact(repo_root: Path, matrix: dict) -> tuple[dict, str]:
    ci = matrix.get("latestDeviceRuntimeCI")
    if not isinstance(ci, dict):
        fail("latestDeviceRuntimeCI must be present")
    artifact_value = ci.get("artifact")
    if not isinstance(artifact_value, str) or not artifact_value.endswith(".json"):
        fail("latestDeviceRuntimeCI.artifact must be a JSON path")
    fail_validator = ci.get("failClosedValidator")
    if fail_validator != "scripts/validate_device_runtime_smoke_fail_artifact.py":
        fail("latestDeviceRuntimeCI.failClosedValidator drifted")
    if not (repo_root / fail_validator).is_file():
        fail("latestDeviceRuntimeCI.failClosedValidator missing")
    if ci.get("failClosedValidationCommand") != "npm run ci:device-runtime:validate-fail":
        fail("latestDeviceRuntimeCI.failClosedValidationCommand drifted")
    artifact = repo_root / artifact_value
    summary = read_json(artifact)
    if summary.get("schemaVersion") != "device-runtime-smoke.v1":
        fail("latest runtime artifact schema drifted")

    actual_passed = (
        summary.get("status") == "PASS"
        and summary.get("ciGate", {}).get("result") == "PASS"
        and summary.get("failure") in ("", None)
    )
    if ci.get("passed") is not actual_passed:
        fail("latestDeviceRuntimeCI.passed does not match artifact status")
    if actual_passed:
        fail("validator expected the current snapshot to preserve fail-closed gap status")
    current_failure = str(ci.get("currentFailure", ""))
    if "external nativeHTTP" not in current_failure:
        fail("latestDeviceRuntimeCI.currentFailure must distinguish external nativeHTTP")
    if "LocalHTTP" not in current_failure or "PASS 2xx" not in current_failure:
        fail("latestDeviceRuntimeCI.currentFailure must preserve LocalHTTP PASS 2xx context")

    runtime_network = summary.get("runtimeNetwork")
    if not isinstance(runtime_network, dict):
        fail("latest runtime artifact must include runtimeNetwork")
    missing_keys = RUNTIME_NETWORK_KEYS.difference(runtime_network.keys())
    if missing_keys:
        fail(f"runtimeNetwork missing keys: {', '.join(sorted(missing_keys))}")
    if not isinstance(runtime_network.get("proxyEndpointRewrittenForEmulator"), bool):
        fail("runtimeNetwork.proxyEndpointRewrittenForEmulator must be boolean")
    if not isinstance(runtime_network.get("proxyLocalPortReachable"), bool):
        fail("runtimeNetwork.proxyLocalPortReachable must be boolean")
    if not isinstance(runtime_network.get("proxyAppLevelApplied"), bool):
        fail("runtimeNetwork.proxyAppLevelApplied must be boolean")
    if not isinstance(runtime_network.get("proxyAppLevelStatus"), str):
        fail("runtimeNetwork.proxyAppLevelStatus must be string")

    for flag in FALSE_FLAGS:
        if summary.get(flag) is not False:
            fail(f"{flag} must be false in latest runtime artifact")

    home_layout_value = summary.get("artifacts", {}).get("homeLayout")
    if not isinstance(home_layout_value, str):
        fail("latest runtime artifact must include artifacts.homeLayout")
    home_layout_text = read_text(Path(home_layout_value))
    for token in ["阅读器", "ReaderShell PASS fixture", "章节", "正文", "TOC"]:
        if token not in home_layout_text:
            fail(f"latest home layout must preserve reader UI smoke token: {token}")
    runtime_layout_value = summary.get("artifacts", {}).get("runtimeLayout")
    if not isinstance(runtime_layout_value, str):
        fail("latest runtime artifact must include artifacts.runtimeLayout")
    runtime_layout_text = read_text(Path(runtime_layout_value))
    if "app:on" in current_failure:
        if "app:on" not in runtime_layout_text:
            fail("latestDeviceRuntimeCI.currentFailure claims app:on but runtime layout does not")
        if runtime_network.get("proxyAppLevelApplied") is not True or runtime_network.get("proxyAppLevelStatus") != "on":
            fail("latestDeviceRuntimeCI.currentFailure claims app:on but summary runtimeNetwork does not")
    host_probe = summary.get("hostNetworkProbe")
    if not isinstance(host_probe, dict):
        fail("latest runtime artifact must include hostNetworkProbe")
    if set(host_probe.keys()) != HOST_NETWORK_PROBE_KEYS:
        fail("hostNetworkProbe keys drifted")
    if host_probe.get("executed") is not True:
        fail("hostNetworkProbe.executed must be true")
    for key in ["directHttpsClass", "proxyHttpsClass", "proxyHttpClass"]:
        if not isinstance(host_probe.get(key), str) or host_probe.get(key) in ("", "not_run", "not_configured"):
            fail(f"hostNetworkProbe.{key} must be observed")
    matrix_host_probe = ci.get("hostNetworkProbe")
    if not isinstance(matrix_host_probe, dict) or matrix_host_probe != host_probe:
        fail("latestDeviceRuntimeCI.hostNetworkProbe must mirror the latest artifact")
    local_probe = summary.get("deviceLocalHTTPProbe")
    if not isinstance(local_probe, dict):
        fail("latest runtime artifact must include deviceLocalHTTPProbe")
    if set(local_probe.keys()) != DEVICE_LOCAL_HTTP_PROBE_KEYS:
        fail("deviceLocalHTTPProbe keys drifted")
    if local_probe.get("configured") is not True:
        fail("deviceLocalHTTPProbe.configured must be true")
    if local_probe.get("serverStarted") is not True:
        fail("deviceLocalHTTPProbe.serverStarted must be true")
    if local_probe.get("serverReachable") is not True:
        fail("deviceLocalHTTPProbe.serverReachable must be true")
    if local_probe.get("deviceHostHash") in ("", "none", None):
        fail("deviceLocalHTTPProbe.deviceHostHash must be redacted")
    if not isinstance(local_probe.get("port"), int) or local_probe.get("port", 0) <= 0:
        fail("deviceLocalHTTPProbe.port must be positive")
    matrix_local_probe = ci.get("deviceLocalHTTPProbe")
    if not isinstance(matrix_local_probe, dict):
        fail("latestDeviceRuntimeCI.deviceLocalHTTPProbe must be present")
    for key in ["configured", "serverStarted", "serverReachable"]:
        if matrix_local_probe.get(key) is not True:
            fail(f"latestDeviceRuntimeCI.deviceLocalHTTPProbe.{key} must be true")
    if matrix_local_probe.get("passedInRuntimePanel") is not True:
        fail("latestDeviceRuntimeCI.deviceLocalHTTPProbe.passedInRuntimePanel must be true")
    feed_probe = summary.get("deviceLocalFeedProbe")
    if not isinstance(feed_probe, dict):
        fail("latest runtime artifact must include deviceLocalFeedProbe")
    if set(feed_probe.keys()) != DEVICE_LOCAL_FEED_PROBE_KEYS:
        fail("deviceLocalFeedProbe keys drifted")
    if feed_probe.get("configured") is not True:
        fail("deviceLocalFeedProbe.configured must be true")
    if feed_probe.get("fixtureServed") is not True:
        fail("deviceLocalFeedProbe.fixtureServed must be true")
    if feed_probe.get("serverReachable") is not True:
        fail("deviceLocalFeedProbe.serverReachable must be true")
    if feed_probe.get("deviceHostHash") in ("", "none", None):
        fail("deviceLocalFeedProbe.deviceHostHash must be redacted")
    if not isinstance(feed_probe.get("port"), int) or feed_probe.get("port", 0) <= 0:
        fail("deviceLocalFeedProbe.port must be positive")
    matrix_feed_probe = ci.get("deviceLocalFeedProbe")
    if not isinstance(matrix_feed_probe, dict):
        fail("latestDeviceRuntimeCI.deviceLocalFeedProbe must be present")
    for key in ["configured", "fixtureServed", "serverReachable"]:
        if matrix_feed_probe.get(key) is not True:
            fail(f"latestDeviceRuntimeCI.deviceLocalFeedProbe.{key} must be true")
    if matrix_feed_probe.get("passedInRuntimePanel") is not True:
        fail("latestDeviceRuntimeCI.deviceLocalFeedProbe.passedInRuntimePanel must be true")
    data_store_probe = summary.get("deviceDataStoreProbe")
    if not isinstance(data_store_probe, dict):
        fail("latest runtime artifact must include deviceDataStoreProbe")
    if set(data_store_probe.keys()) != DEVICE_DATA_STORE_PROBE_KEYS:
        fail("deviceDataStoreProbe keys drifted")
    if data_store_probe.get("configured") is not True:
        fail("deviceDataStoreProbe.configured must be true")
    if data_store_probe.get("schemaVersion") != 75:
        fail("deviceDataStoreProbe.schemaVersion must be 75")
    if data_store_probe.get("migrationStepCount") != 32:
        fail("deviceDataStoreProbe.migrationStepCount must be 32")
    if data_store_probe.get("recordCount") != 3:
        fail("deviceDataStoreProbe.recordCount must be 3")
    if data_store_probe.get("passedInRuntimePanel") is not True:
        fail("deviceDataStoreProbe.passedInRuntimePanel must be true")
    matrix_data_store_probe = ci.get("deviceDataStoreProbe")
    if not isinstance(matrix_data_store_probe, dict):
        fail("latestDeviceRuntimeCI.deviceDataStoreProbe must be present")
    if matrix_data_store_probe != data_store_probe:
        fail("latestDeviceRuntimeCI.deviceDataStoreProbe must mirror the latest artifact")
    local_book_probe = summary.get("deviceLocalBookProbe")
    if not isinstance(local_book_probe, dict):
        fail("latest runtime artifact must include deviceLocalBookProbe")
    if set(local_book_probe.keys()) != DEVICE_LOCAL_BOOK_PROBE_KEYS:
        fail("deviceLocalBookProbe keys drifted")
    if local_book_probe.get("configured") is not True:
        fail("deviceLocalBookProbe.configured must be true")
    if local_book_probe.get("format") != "epub":
        fail("deviceLocalBookProbe.format must be epub")
    if local_book_probe.get("tocCount") != 1:
        fail("deviceLocalBookProbe.tocCount must be 1")
    if local_book_probe.get("bookshelfCount") != 1:
        fail("deviceLocalBookProbe.bookshelfCount must be 1")
    if local_book_probe.get("permissionHandoff") is not True:
        fail("deviceLocalBookProbe.permissionHandoff must be true")
    if local_book_probe.get("passedInRuntimePanel") is not True:
        fail("deviceLocalBookProbe.passedInRuntimePanel must be true")
    matrix_local_book_probe = ci.get("deviceLocalBookProbe")
    if not isinstance(matrix_local_book_probe, dict):
        fail("latestDeviceRuntimeCI.deviceLocalBookProbe must be present")
    if matrix_local_book_probe != local_book_probe:
        fail("latestDeviceRuntimeCI.deviceLocalBookProbe must mirror the latest artifact")
    reader_ui_smoke = summary.get("deviceReaderUISmoke")
    if not isinstance(reader_ui_smoke, dict):
        fail("latest runtime artifact must include deviceReaderUISmoke")
    if set(reader_ui_smoke.keys()) != DEVICE_READER_UI_SMOKE_KEYS:
        fail("deviceReaderUISmoke keys drifted")
    if reader_ui_smoke.get("configured") is not True:
        fail("deviceReaderUISmoke.configured must be true")
    if reader_ui_smoke.get("mode") != "fixture":
        fail("deviceReaderUISmoke.mode must be fixture")
    if not isinstance(reader_ui_smoke.get("tocCount"), int) or reader_ui_smoke.get("tocCount", 0) <= 0:
        fail("deviceReaderUISmoke.tocCount must be positive")
    if reader_ui_smoke.get("passedInHomeLayout") is not True:
        fail("deviceReaderUISmoke.passedInHomeLayout must be true")
    if f"TOC {reader_ui_smoke.get('tocCount')}" not in home_layout_text:
        fail("deviceReaderUISmoke.tocCount must match latest home layout")
    matrix_reader_ui_smoke = ci.get("deviceReaderUISmoke")
    if not isinstance(matrix_reader_ui_smoke, dict):
        fail("latestDeviceRuntimeCI.deviceReaderUISmoke must be present")
    if matrix_reader_ui_smoke != reader_ui_smoke:
        fail("latestDeviceRuntimeCI.deviceReaderUISmoke must mirror the latest artifact")
    source_mgmt_smoke = summary.get("deviceSourceManagementSmoke")
    if not isinstance(source_mgmt_smoke, dict):
        fail("latest runtime artifact must include deviceSourceManagementSmoke")
    if set(source_mgmt_smoke.keys()) != DEVICE_SOURCE_MANAGEMENT_SMOKE_KEYS:
        fail("deviceSourceManagementSmoke keys drifted")
    if source_mgmt_smoke.get("configured") is not True:
        fail("deviceSourceManagementSmoke.configured must be true")
    if source_mgmt_smoke.get("mode") != "fixture":
        fail("deviceSourceManagementSmoke.mode must be fixture")
    if source_mgmt_smoke.get("sourceCount") != 3:
        fail("deviceSourceManagementSmoke.sourceCount must be 3")
    if source_mgmt_smoke.get("enabledCount") != 2:
        fail("deviceSourceManagementSmoke.enabledCount must be 2")
    if source_mgmt_smoke.get("debugPassed") is not True:
        fail("deviceSourceManagementSmoke.debugPassed must be true")
    if source_mgmt_smoke.get("redacted") is not True:
        fail("deviceSourceManagementSmoke.redacted must be true")
    if source_mgmt_smoke.get("passedInSettingsLayout") is not True:
        fail("deviceSourceManagementSmoke.passedInSettingsLayout must be true")
    for token in ["SourceMgmt PASS fixture", "启用 2/3", "规则 search+detail+toc+content", "DEBUG fixture", "redacted:true"]:
        if token not in runtime_layout_text:
            fail(f"latest runtime layout must preserve source management smoke token: {token}")
    matrix_source_mgmt_smoke = ci.get("deviceSourceManagementSmoke")
    if not isinstance(matrix_source_mgmt_smoke, dict):
        fail("latestDeviceRuntimeCI.deviceSourceManagementSmoke must be present")
    if matrix_source_mgmt_smoke != source_mgmt_smoke:
        fail("latestDeviceRuntimeCI.deviceSourceManagementSmoke must mirror the latest artifact")
    headless_demo = summary.get("deviceHeadlessServiceDemo")
    if not isinstance(headless_demo, dict):
        fail("latest runtime artifact must include deviceHeadlessServiceDemo")
    if set(headless_demo.keys()) != DEVICE_HEADLESS_SERVICE_DEMO_KEYS:
        fail("deviceHeadlessServiceDemo keys drifted")
    if headless_demo.get("configured") is not True:
        fail("deviceHeadlessServiceDemo.configured must be true")
    if headless_demo.get("mode") != "fixture":
        fail("deviceHeadlessServiceDemo.mode must be fixture")
    if headless_demo.get("downloadPassed") is not True:
        fail("deviceHeadlessServiceDemo.downloadPassed must be true")
    if headless_demo.get("downloadCompletedCount") != 2 or headless_demo.get("downloadScheduledCount") != 2:
        fail("deviceHeadlessServiceDemo download counts must be 2/2")
    if headless_demo.get("ttsPassed") is not True or headless_demo.get("ttsQueuedSegments") != 3:
        fail("deviceHeadlessServiceDemo TTS queue must pass with 3 segments")
    if headless_demo.get("webdavPassed") is not True:
        fail("deviceHeadlessServiceDemo.webdavPassed must be true")
    if headless_demo.get("fileTokenPassed") is not True:
        fail("deviceHeadlessServiceDemo.fileTokenPassed must be true")
    if headless_demo.get("databaseMigrationPassed") is not True:
        fail("deviceHeadlessServiceDemo.databaseMigrationPassed must be true")
    if headless_demo.get("schemaVersion") != 75 or headless_demo.get("migrationStepCount") != 32:
        fail("deviceHeadlessServiceDemo must preserve v75:32 migration evidence")
    if headless_demo.get("redacted") is not True:
        fail("deviceHeadlessServiceDemo.redacted must be true")
    if headless_demo.get("passedInRuntimePanel") is not True:
        fail("deviceHeadlessServiceDemo.passedInRuntimePanel must be true")
    for token in ["Headless", "PASS fixture", "Download", "PASS 2/2", "TTS", "PASS q:3", "WebDAV", "PASS sync", "FileToken", "PASS opaque", "DBMig", "PASS v75:32"]:
        if token not in runtime_layout_text:
            fail(f"latest runtime layout must preserve headless service demo token: {token}")
    matrix_headless_demo = ci.get("deviceHeadlessServiceDemo")
    if not isinstance(matrix_headless_demo, dict):
        fail("latestDeviceRuntimeCI.deviceHeadlessServiceDemo must be present")
    if matrix_headless_demo != headless_demo:
        fail("latestDeviceRuntimeCI.deviceHeadlessServiceDemo must mirror the latest artifact")
    return summary, runtime_layout_text


def validate_non_ui_boundary(matrix: dict) -> None:
    boundary = matrix.get("nonUIBoundary")
    if not isinstance(boundary, dict):
        fail("nonUIBoundary must be present")
    require_bool(boundary.get("localCodeOwnedMeasuredComplete"), True, "nonUIBoundary.localCodeOwnedMeasuredComplete")
    require_bool(boundary.get("uiAndPageBehaviorExcluded"), True, "nonUIBoundary.uiAndPageBehaviorExcluded")
    require_bool(boundary.get("deviceExecutorClaimedByNonUIBundle"), False, "nonUIBoundary.deviceExecutorClaimedByNonUIBundle")
    require_bool(boundary.get("externalNetworkClaimedByNonUIBundle"), False, "nonUIBoundary.externalNetworkClaimedByNonUIBundle")
    exclusions = matrix.get("scopeExclusions")
    if not isinstance(exclusions, list) or not any("UI/page behavior parity" in str(item) for item in exclusions):
        fail("scopeExclusions must explicitly exclude UI/page behavior parity")


def validate_documentation_drift_guards(repo_root: Path, matrix: dict) -> None:
    guards = matrix.get("documentationDriftGuards")
    if not isinstance(guards, list) or len(guards) == 0:
        fail("documentationDriftGuards must be present")
    for guard in guards:
        if not isinstance(guard, dict):
            fail("documentationDriftGuards entries must be objects")
        guard_id = str(guard.get("id", "unknown"))
        path_value = guard.get("path")
        if not isinstance(path_value, str) or not path_value.startswith("docs/"):
            fail(f"{guard_id} path must be a docs path")
        text = read_text(repo_root / path_value)
        required_tokens = guard.get("requiredTokens")
        rejected_tokens = guard.get("rejectedTokens")
        if not isinstance(required_tokens, list) or len(required_tokens) == 0:
            fail(f"{guard_id} requiredTokens must be non-empty")
        if not isinstance(rejected_tokens, list):
            fail(f"{guard_id} rejectedTokens must be a list")
        for token in required_tokens:
            if not isinstance(token, str) or token not in text:
                fail(f"{guard_id} missing required token: {token}")
        for token in rejected_tokens:
            if isinstance(token, str) and token in text:
                fail(f"{guard_id} rejected token present: {token}")


def validate_rows(repo_root: Path, matrix: dict, runtime_summary: dict, runtime_layout_text: str) -> None:
    rows = matrix.get("rows")
    if not isinstance(rows, list):
        fail("rows must be a list")
    ids = [row.get("id") for row in rows if isinstance(row, dict)]
    if len(ids) != len(set(ids)):
        fail("row ids must be unique")
    missing = REQUIRED_ROW_IDS.difference(ids)
    extra = set(ids).difference(REQUIRED_ROW_IDS)
    if missing:
        fail(f"missing rows: {', '.join(sorted(missing))}")
    if extra:
        fail(f"unexpected rows: {', '.join(sorted(extra))}")

    rows_by_id = {row["id"]: row for row in rows}
    for row_id, row in rows_by_id.items():
        for key in ["status", "owner", "currentEvidence", "legadoGap", "evidence", "nextProofRequired"]:
            if key not in row:
                fail(f"{row_id} missing {key}")
        if not isinstance(row["evidence"], list) or len(row["evidence"]) == 0:
            fail(f"{row_id}.evidence must be a non-empty list")
        for evidence in row["evidence"]:
            if isinstance(evidence, str) and evidence.startswith(("docs/", "scripts/", "artifacts/")):
                if not (repo_root / evidence).exists():
                    fail(f"{row_id} missing local evidence: {evidence}")

    hos_runtime = rows_by_id["harmonyos_runtime_ci"]
    if hos_runtime.get("status") != "CURRENT_CI_EXTERNAL_NATIVE_HTTP_CORPUS_FAIL":
        fail("harmonyos_runtime_ci status must distinguish external nativeHTTP failure")
    if hos_runtime.get("status") in PASS_OVERCLAIM_STATUSES:
        fail("harmonyos_runtime_ci cannot claim pass while latest artifact fails")
    runtime_text = " ".join(
        str(hos_runtime.get(key, "")) for key in ["status", "currentEvidence", "legadoGap", "nextProofRequired"]
    )
    if "external nativeHTTP" not in runtime_text or "corpus" not in runtime_text.lower():
        fail("harmonyos_runtime_ci must name the current external nativeHTTP/corpus gap")
    if "LocalHTTP" not in runtime_text or "PASS" not in runtime_text:
        fail("harmonyos_runtime_ci must preserve the LocalHTTP PASS split")
    if runtime_summary.get("status") != "FAIL":
        fail("latest runtime artifact no longer matches the recorded nativeHTTP fail-closed gap")
    if "nativeHTTP" not in runtime_layout_text or "FAIL" not in runtime_layout_text or "Corpus" not in runtime_layout_text:
        fail("latest runtime layout no longer records the nativeHTTP/corpus fail-closed gap")
    if "LocalHTTP" not in runtime_layout_text or "PASS 2xx" not in runtime_layout_text:
        fail("latest runtime layout must keep device-local nativeHTTP 2xx evidence separate")
    if "LocalFeed" not in runtime_layout_text or "PASS rss:1" not in runtime_layout_text:
        fail("latest runtime layout must keep device-local RSS feed parse evidence separate")
    if "DataStore" not in runtime_layout_text or "PASS v75:3" not in runtime_layout_text:
        fail("latest runtime layout must keep device datastore evidence separate")
    if "LocalBook" not in runtime_layout_text or "PASS epub:1" not in runtime_layout_text:
        fail("latest runtime layout must keep device local-book evidence separate")

    js_row = rows_by_id["js_webview_cookie_session"]
    if js_row.get("status") != "PARTIAL_DEVICE_VERIFIED_CURRENT_EXTERNAL_NATIVE_HTTP_CORPUS_FAIL":
        fail("js_webview_cookie_session status must distinguish external nativeHTTP failure")
    js_text = " ".join(str(js_row.get(key, "")) for key in ["status", "currentEvidence", "legadoGap"])
    if "external nativeHTTP" not in js_text or "Corpus" not in js_text:
        fail("js_webview_cookie_session must preserve the latest external nativeHTTP/Corpus failure context")
    if "LocalHTTP" not in js_text:
        fail("js_webview_cookie_session must preserve LocalHTTP device evidence context")
    if "login UX" not in js_text:
        fail("js_webview_cookie_session must keep login UX as a remaining product gap")

    ui_row = rows_by_id["ui_host_services"]
    if ui_row.get("status") in PASS_OVERCLAIM_STATUSES:
        fail("ui_host_services cannot claim Legado UI parity")
    if ui_row.get("status") != "READER_PREVIEW_SOURCE_MGMT_SMOKE_MAJOR_PRODUCT_GAP":
        fail("ui_host_services status must reflect reader preview/source management smoke and remaining major product gap")
    ui_text = " ".join(str(ui_row.get(key, "")) for key in ["currentEvidence", "legadoGap", "nextProofRequired"])
    if "ReaderShell PASS fixture" not in ui_text or "deviceReaderUISmoke" not in ui_text:
        fail("ui_host_services must preserve reader UI smoke evidence")
    if "SourceMgmt PASS fixture" not in ui_text or "deviceSourceManagementSmoke" not in ui_text:
        fail("ui_host_services must preserve source management smoke evidence")
    for token in ["live source debugger", "RSS", "download UI", "TTS playback UI", "WebDAV UI"]:
        if token not in ui_text:
            fail(f"ui_host_services must keep remaining product gap: {token}")

    data_row = rows_by_id["data_layer"]
    if data_row.get("status") != "DEVICE_DATASTORE_HEADLESS_DBMIG_SMOKE_PRODUCTION_DB_GAP":
        fail("data_layer status must reflect device datastore/headless DB migration smoke and production DB gap")
    data_text = " ".join(str(data_row.get(key, "")) for key in ["currentEvidence", "legadoGap", "nextProofRequired"])
    if "DataStore" not in data_text or "PASS v75:3" not in data_text or "deviceDataStoreProbe" not in data_text:
        fail("data_layer must preserve device datastore smoke evidence")
    if "DBMig" not in data_text or "PASS v75:32" not in data_text or "deviceHeadlessServiceDemo" not in data_text:
        fail("data_layer must preserve headless DB migration demo evidence")
    if "production persistence" not in data_row.get("legadoGap", ""):
        fail("data_layer must keep production persistence as a remaining host-app gap")
    if "Room" not in data_text or "migration" not in data_text:
        fail("data_layer must keep Room/migration production gap visible")

    local_books_row = rows_by_id["local_books"]
    if local_books_row.get("status") != "DEVICE_LOCAL_BOOK_FILETOKEN_SMOKE_READER_UI_GAP":
        fail("local_books status must reflect device local-book/file-token smoke and reader/file-picker UX gap")
    local_books_text = " ".join(str(local_books_row.get(key, "")) for key in ["currentEvidence", "legadoGap", "nextProofRequired"])
    if "LocalBook" not in local_books_text or "PASS epub:1" not in local_books_text or "deviceLocalBookProbe" not in local_books_text:
        fail("local_books must preserve device local-book smoke evidence")
    if "FileToken" not in local_books_text or "PASS opaque" not in local_books_text or "deviceHeadlessServiceDemo" not in local_books_text:
        fail("local_books must preserve headless file-token smoke evidence")
    for token in ["file-picker", "reader", "real-file corpus"]:
        if token not in local_books_text:
            fail(f"local_books must keep remaining product gap: {token}")

    rss_row = rows_by_id["rss_explore"]
    if rss_row.get("status") != "DEVICE_LOCAL_FEED_SMOKE_EXTERNAL_LIVE_GAP":
        fail("rss_explore status must reflect device-local feed smoke and external live gap")
    rss_text = " ".join(str(rss_row.get(key, "")) for key in ["currentEvidence", "legadoGap", "nextProofRequired"])
    if "LocalFeed" not in rss_text or "PASS rss:1" not in rss_text:
        fail("rss_explore must preserve LocalFeed PASS rss:1 evidence")
    for token in ["live feed", "subscription", "background"]:
        if token not in rss_text:
            fail(f"rss_explore must keep remaining product gap: {token}")

    webdav_row = rows_by_id["webdav_backup_tts_download"]
    if webdav_row.get("status") != "DEVICE_HEADLESS_SERVICE_DEMO_PRODUCTION_GAP":
        fail("webdav_backup_tts_download status must reflect device headless demo and production gap")
    webdav_text = " ".join(str(webdav_row.get(key, "")) for key in ["currentEvidence", "legadoGap", "nextProofRequired"])
    for token in ["deviceHeadlessServiceDemo", "Download PASS 2/2", "TTS PASS q:3", "WebDAV PASS sync", "FileToken PASS opaque", "DBMig PASS v75:32"]:
        if token not in webdav_text:
            fail(f"webdav_backup_tts_download must preserve headless demo evidence: {token}")
    for token in ["production WebDAV", "background download", "native/HTTP TTS playback", "media-session"]:
        if token not in webdav_text:
            fail(f"webdav_backup_tts_download must keep remaining production gap: {token}")


def validate(repo_root: Path) -> None:
    matrix = read_json(repo_root / MATRIX_PATH)
    if matrix.get("schemaVersion") != SCHEMA_VERSION:
        fail("unexpected schemaVersion")
    if matrix.get("updatedAt") != "2026-06-23":
        fail("updatedAt drifted")
    validate_clean_room(matrix)
    runtime_summary, runtime_layout_text = validate_runtime_artifact(repo_root, matrix)
    validate_non_ui_boundary(matrix)
    validate_documentation_drift_guards(repo_root, matrix)
    validate_rows(repo_root, matrix, runtime_summary, runtime_layout_text)


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    try:
        validate(repo_root)
    except AssertionError as error:
        print(f"harmonyos-core-legado-gap-matrix-failed: {error}", file=sys.stderr)
        sys.exit(1)
    print("harmonyos-core-legado-gap-matrix-ok")


if __name__ == "__main__":
    main()
