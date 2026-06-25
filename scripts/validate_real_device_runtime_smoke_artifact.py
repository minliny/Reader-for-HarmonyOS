#!/usr/bin/env python3
import importlib.util
import json
import sys
from pathlib import Path


def fail(message: str) -> None:
    raise AssertionError(message)


def load_base_validator():
    module_path = Path(__file__).with_name("validate_device_runtime_smoke_artifact.py")
    spec = importlib.util.spec_from_file_location("device_runtime_validator", module_path)
    if spec is None or spec.loader is None:
        fail(f"unable to load validator: {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_summary(path: Path) -> dict:
    if not path.is_file():
        fail(f"missing summary: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def validate(summary_path: Path) -> None:
    base_validator = load_base_validator()
    base_validator.validate(summary_path)
    summary = read_summary(summary_path)

    target = summary.get("target")
    if not isinstance(target, str) or target == "":
        fail("target must be non-empty string")
    if target.startswith("127.") or target.startswith("localhost"):
        fail(f"real-device evidence cannot use loopback target: {target}")
    if summary.get("tier") != "device":
        fail(f"real-device evidence requires tier=device, got {summary.get('tier')}")

    required_tokens = summary.get("requiredRuntimeTokens")
    if not isinstance(required_tokens, list):
        fail("requiredRuntimeTokens must be a list")
    for token in ["HostBus", "PASS op:"]:
        if token not in required_tokens:
            fail(f"requiredRuntimeTokens missing {token}")


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: validate_real_device_runtime_smoke_artifact.py <summary.json>", file=sys.stderr)
        sys.exit(2)
    validate(Path(sys.argv[1]).resolve())
    print("real-device-runtime-smoke-artifact-ok")


if __name__ == "__main__":
    main()
