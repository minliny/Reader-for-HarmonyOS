#!/usr/bin/env python3
import hashlib
import json
import sys
from pathlib import Path


REQUIRED_HOME_TOKENS = [
    "书架",
    "藏书",
    "在读",
    "未读",
    "阅读器",
    "ReaderShell PASS fixture",
    "章节",
    "正文",
    "TOC",
]
REQUIRED_RUNTIME_TOKENS = [
    "nativeHTTP",
    "LocalHTTP",
    "LocalFeed",
    "DataStore",
    "LocalBook",
    "SourceMgmt PASS fixture",
    "启用 2/3",
    "规则 search+detail+toc+content",
    "DEBUG fixture",
    "redacted:true",
    "Headless",
    "PASS fixture",
    "Download",
    "PASS 2/2",
    "TTS",
    "PASS q:3",
    "WebDAV",
    "PASS sync",
    "FileToken",
    "PASS opaque",
    "DBMig",
    "PASS v75:32",
    "PASS 2xx",
    "PASS rss:1",
    "PASS v75:3",
    "PASS epub:1",
    "ArkWeb",
    "Cookie",
    "Session",
    "JS",
    "Secure",
    "Corpus",
    "raw:false",
]
REJECTED_RUNTIME_TOKENS = ["FAIL", "RUNNING"]
FALSE_FLAGS = [
    "rawURLExported",
    "rawCookieValueExported",
    "rawCredentialValueExported",
    "rawSessionTokenExported",
    "rawResponseBodyExported",
    "readerCoreRootArtifactsMutated",
]
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


def fail(message: str) -> None:
    raise AssertionError(message)


def read_text(path: Path) -> str:
    if not path.is_file():
        fail(f"missing file: {path}")
    return path.read_text(encoding="utf-8")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def require_tokens(text: str, tokens: list[str], label: str) -> None:
    missing = [token for token in tokens if token not in text]
    if missing:
        fail(f"{label} missing tokens: {', '.join(missing)}")


def reject_tokens(text: str, tokens: list[str], label: str) -> None:
    found = [token for token in tokens if token in text]
    if found:
        fail(f"{label} rejected tokens present: {', '.join(found)}")


def artifact_path(summary: dict, key: str) -> Path:
    value = summary.get("artifacts", {}).get(key)
    if not isinstance(value, str) or len(value) == 0:
        fail(f"missing artifact path: {key}")
    return Path(value)


def validate(summary_path: Path) -> None:
    summary = json.loads(read_text(summary_path))

    if summary.get("schemaVersion") != "device-runtime-smoke.v1":
        fail("unexpected schemaVersion")
    if summary.get("status") != "PASS":
        fail(f"status is not PASS: {summary.get('status')}")
    if summary.get("failure") not in ("", None):
        fail("failure field is not empty")

    gate = summary.get("ciGate", {})
    if gate.get("name") != "harmonyos_device_runtime_ci":
        fail("unexpected ciGate.name")
    if gate.get("eligible") is not True:
        fail("ciGate.eligible must be true")
    if gate.get("result") != "PASS":
        fail("ciGate.result is not PASS")

    if summary.get("deviceExecutorUsed") is not True:
        fail("deviceExecutorUsed must be true")
    if summary.get("externalNetworkUsed") is not True:
        fail("externalNetworkUsed must be true")
    runtime_network = summary.get("runtimeNetwork")
    if not isinstance(runtime_network, dict):
        fail("runtimeNetwork must be present")
    if set(runtime_network.keys()) != RUNTIME_NETWORK_KEYS:
        fail("runtimeNetwork keys drifted")
    if not isinstance(runtime_network.get("proxyEnabled"), bool):
        fail("runtimeNetwork.proxyEnabled must be boolean")
    if not isinstance(runtime_network.get("proxyPort"), int):
        fail("runtimeNetwork.proxyPort must be integer")
    if not isinstance(runtime_network.get("proxyEndpointRewrittenForEmulator"), bool):
        fail("runtimeNetwork.proxyEndpointRewrittenForEmulator must be boolean")
    if not isinstance(runtime_network.get("proxyLocalPortReachable"), bool):
        fail("runtimeNetwork.proxyLocalPortReachable must be boolean")
    if not isinstance(runtime_network.get("proxyAppLevelApplied"), bool):
        fail("runtimeNetwork.proxyAppLevelApplied must be boolean")
    if not isinstance(runtime_network.get("proxyAppLevelStatus"), str):
        fail("runtimeNetwork.proxyAppLevelStatus must be string")
    if not isinstance(runtime_network.get("proxyListenScope"), str):
        fail("runtimeNetwork.proxyListenScope must be string")
    if runtime_network.get("proxyEnabled") is True:
        if runtime_network.get("proxyPort", 0) <= 0:
            fail("runtimeNetwork proxyPort must be positive when proxy is enabled")
        if runtime_network.get("proxyHostHash") in ("", "none", None):
            fail("runtimeNetwork proxyHostHash must be redacted when proxy is enabled")
        if runtime_network.get("proxyOriginalHostHash") in ("", "none", None):
            fail("runtimeNetwork proxyOriginalHostHash must be redacted when proxy is enabled")
        if runtime_network.get("proxyAppLevelStatus") in ("", "not_observed", None):
            fail("runtimeNetwork proxyAppLevelStatus must be observed when proxy is enabled")
    for flag in FALSE_FLAGS:
        if summary.get(flag) is not False:
            fail(f"{flag} must be false")
    host_probe = summary.get("hostNetworkProbe")
    if not isinstance(host_probe, dict):
        fail("hostNetworkProbe must be present")
    if set(host_probe.keys()) != HOST_NETWORK_PROBE_KEYS:
        fail("hostNetworkProbe keys drifted")
    if not isinstance(host_probe.get("executed"), bool):
        fail("hostNetworkProbe.executed must be boolean")
    for key in ["directHttpsClass", "proxyHttpsClass", "proxyHttpClass"]:
        if not isinstance(host_probe.get(key), str) or host_probe.get(key) == "":
            fail(f"hostNetworkProbe.{key} must be non-empty string")

    local_probe = summary.get("deviceLocalHTTPProbe")
    if not isinstance(local_probe, dict):
        fail("deviceLocalHTTPProbe must be present")
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

    feed_probe = summary.get("deviceLocalFeedProbe")
    if not isinstance(feed_probe, dict):
        fail("deviceLocalFeedProbe must be present")
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

    data_store_probe = summary.get("deviceDataStoreProbe")
    if not isinstance(data_store_probe, dict):
        fail("deviceDataStoreProbe must be present")
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

    local_book_probe = summary.get("deviceLocalBookProbe")
    if not isinstance(local_book_probe, dict):
        fail("deviceLocalBookProbe must be present")
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

    reader_ui_smoke = summary.get("deviceReaderUISmoke")
    if not isinstance(reader_ui_smoke, dict):
        fail("deviceReaderUISmoke must be present")
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

    source_mgmt_smoke = summary.get("deviceSourceManagementSmoke")
    if not isinstance(source_mgmt_smoke, dict):
        fail("deviceSourceManagementSmoke must be present")
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

    headless_demo = summary.get("deviceHeadlessServiceDemo")
    if not isinstance(headless_demo, dict):
        fail("deviceHeadlessServiceDemo must be present")
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
    if headless_demo.get("schemaVersion") != 75:
        fail("deviceHeadlessServiceDemo.schemaVersion must be 75")
    if headless_demo.get("migrationStepCount") != 32:
        fail("deviceHeadlessServiceDemo.migrationStepCount must be 32")
    if headless_demo.get("redacted") is not True:
        fail("deviceHeadlessServiceDemo.redacted must be true")
    if headless_demo.get("passedInRuntimePanel") is not True:
        fail("deviceHeadlessServiceDemo.passedInRuntimePanel must be true")

    if summary.get("requiredRuntimeTokens") != REQUIRED_RUNTIME_TOKENS:
        fail("requiredRuntimeTokens drifted")

    home_layout = artifact_path(summary, "homeLayout")
    runtime_layout = artifact_path(summary, "runtimeLayout")
    screenshot = artifact_path(summary, "runtimeScreenshot")
    log_file = artifact_path(summary, "log")
    junit = artifact_path(summary, "junit")

    home_text = read_text(home_layout)
    runtime_text = read_text(runtime_layout)
    require_tokens(home_text, REQUIRED_HOME_TOKENS, "homeLayout")
    if f"TOC {reader_ui_smoke.get('tocCount')}" not in home_text:
        fail("deviceReaderUISmoke.tocCount must match homeLayout TOC text")
    require_tokens(runtime_text, REQUIRED_RUNTIME_TOKENS, "runtimeLayout")
    if "SourceMgmt PASS fixture" not in runtime_text or "启用 2/3" not in runtime_text:
        fail("runtimeLayout must prove fixture-bound source management smoke")
    for token in ["Headless", "PASS fixture", "Download", "PASS 2/2", "TTS", "PASS q:3", "WebDAV", "PASS sync", "FileToken", "PASS opaque", "DBMig", "PASS v75:32"]:
        if token not in runtime_text:
            fail(f"runtimeLayout must prove headless service demo token: {token}")
    if "LocalFeed" not in runtime_text or "PASS rss:1" not in runtime_text:
        fail("runtimeLayout must prove device-local RSS feed parse separately")
    if "DataStore" not in runtime_text or "PASS v75:3" not in runtime_text:
        fail("runtimeLayout must prove device datastore smoke separately")
    if "LocalBook" not in runtime_text or "PASS epub:1" not in runtime_text:
        fail("runtimeLayout must prove device local-book import smoke separately")
    reject_tokens(runtime_text, REJECTED_RUNTIME_TOKENS, "runtimeLayout")

    for path in [screenshot, log_file, junit]:
        if not path.is_file():
            fail(f"missing artifact file: {path}")

    checksums = summary.get("checksums", {})
    if checksums.get("homeLayoutSha256") != sha256(home_layout):
        fail("homeLayout checksum mismatch")
    if checksums.get("runtimeLayoutSha256") != sha256(runtime_layout):
        fail("runtimeLayout checksum mismatch")
    if checksums.get("runtimeScreenshotSha256") != sha256(screenshot):
        fail("runtimeScreenshot checksum mismatch")


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: validate_device_runtime_smoke_artifact.py <summary.json>", file=sys.stderr)
        sys.exit(2)
    validate(Path(sys.argv[1]).resolve())
    print("device-runtime-smoke-artifact-ok")


if __name__ == "__main__":
    main()
