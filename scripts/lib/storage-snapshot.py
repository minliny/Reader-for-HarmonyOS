"""Normalize only a verified, stopped-app local copy using SQLite Backup API."""
import hashlib
import json
import pathlib
import shutil
import sqlite3
import sys


def record(path):
    if path.is_symlink() or not path.is_file():
        raise RuntimeError("storage snapshot input must be a regular file")
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return {"name": path.name, "bytes": path.stat().st_size, "sha256": digest.hexdigest()}


def main():
    if len(sys.argv) != 3:
        raise RuntimeError("Usage: storage-snapshot.py <raw copy directory> <new analysis directory>")
    raw, work = map(pathlib.Path, sys.argv[1:])
    if raw.is_symlink() or not raw.is_dir() or work.exists():
        raise RuntimeError("snapshot requires an existing raw directory and a new analysis directory")
    before = sorted((record(path) for path in raw.iterdir()), key=lambda value: value["name"])
    work.mkdir(mode=0o700)
    # SHM is a transient coordination file. Preserve the original in raw/, but
    # reconstruct it beside the analysis copy. Never open the original device
    # DB or use immutable=1 to ignore a live/committed WAL.
    for name in ("reader-core.sqlite3", "reader-core.sqlite3-wal"):
        source = raw / name
        if source.exists():
            shutil.copyfile(source, work / name)
    admission = work / "admission"
    admission.mkdir(mode=0o700)
    logical = admission / "reader-core.sqlite3"
    if (raw / "storage-meta.json").exists():
        shutil.copyfile(raw / "storage-meta.json", admission / "storage-meta.json")
    source = sqlite3.connect((work / "reader-core.sqlite3").resolve().as_uri() + "?mode=rw", uri=True)
    try:
        source.execute("PRAGMA query_only=ON")
        destination = sqlite3.connect(logical)
        try:
            source.backup(destination)
            checked = destination.execute("PRAGMA quick_check").fetchall()
            if checked != [("ok",)]:
                raise RuntimeError("SQLite logical snapshot quick_check failed")
        finally:
            destination.close()
    finally:
        source.close()
    after = sorted((record(path) for path in raw.iterdir()), key=lambda value: value["name"])
    if before != after:
        raise RuntimeError("raw storage backup changed while constructing analysis copy")
    print(json.dumps({"format": "reader.storage-snapshot", "version": 1, "method": "sqlite-backup-api",
                      "rawFiles": before, "logical": record(logical), "quickCheck": "ok"}, separators=(",", ":")))


if __name__ == "__main__":
    main()
