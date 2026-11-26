import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, renameSync, rmSync, truncateSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { crc32, deflateRawSync } from 'node:zlib';
import { withHapZip } from './hap-zip-reader.mjs';

const U32 = 0xffffffff;
const U16 = 0xffff;

function zip64Extra(values) {
  const extra = Buffer.alloc(4 + values.length * 8);
  extra.writeUInt16LE(1);
  extra.writeUInt16LE(values.length * 8, 2);
  values.forEach((value, index) => extra.writeBigUInt64LE(BigInt(value), 4 + index * 8));
  return extra;
}

function archive(items, { zip64 = false, gap = Buffer.alloc(0), comment = Buffer.alloc(0) } = {}) {
  const locals = [];
  const centrals = [];
  const layout = [];
  let position = 0;
  for (const item of items) {
    const name = Buffer.from(item.name);
    const content = Buffer.from(item.content ?? 'first entry');
    const flags = item.flags ?? (0x800 | (item.descriptor ? 8 : 0));
    const method = item.method ?? 0;
    const stored = method === 8 ? deflateRawSync(content) : content;
    const packed = item.trailing ? Buffer.concat([stored, Buffer.from(item.trailing)]) : stored;
    const checksum = crc32(content);
    const localExtra = zip64 ? zip64Extra([content.length, packed.length]) : item.padding ?? Buffer.alloc(0);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(zip64 ? 45 : 20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(item.descriptor ? 0 : checksum, 14);
    local.writeUInt32LE(zip64 ? U32 : item.descriptor ? 0 : packed.length, 18);
    local.writeUInt32LE(zip64 ? U32 : item.descriptor ? 0 : content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(localExtra.length, 28);
    const descriptor = Buffer.alloc(item.descriptor ? (zip64 ? 24 : 16) : 0);
    if (item.descriptor) {
      descriptor.writeUInt32LE(0x08074b50);
      descriptor.writeUInt32LE(checksum, 4);
      if (zip64) {
        descriptor.writeBigUInt64LE(BigInt(packed.length), 8);
        descriptor.writeBigUInt64LE(BigInt(content.length), 16);
      } else {
        descriptor.writeUInt32LE(packed.length, 8);
        descriptor.writeUInt32LE(content.length, 12);
      }
    }
    const extra = zip64 ? zip64Extra([content.length, packed.length, position]) : localExtra;
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(zip64 ? 45 : 20, 4);
    central.writeUInt16LE(zip64 ? 45 : 20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(zip64 ? U32 : packed.length, 20);
    central.writeUInt32LE(zip64 ? U32 : content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(extra.length, 30);
    central.writeUInt32LE(zip64 ? U32 : position, 42);
    const data = position + local.length + name.length + localExtra.length;
    layout.push({ local: position, data, descriptor: data + packed.length, central: 0 });
    locals.push(Buffer.concat([local, name, localExtra, packed, descriptor]));
    centrals.push(Buffer.concat([central, name, extra]));
    position += locals[locals.length - 1].length;
  }
  const centralStart = position + gap.length;
  let centralEnd = centralStart;
  centrals.forEach((central, index) => {
    layout[index].central = centralEnd;
    centralEnd += central.length;
  });
  const records = [];
  let locatorOffset;
  if (zip64) {
    const end64 = Buffer.alloc(56);
    end64.writeUInt32LE(0x06064b50);
    end64.writeBigUInt64LE(44n, 4);
    end64.writeUInt16LE(45, 12);
    end64.writeUInt16LE(45, 14);
    end64.writeBigUInt64LE(BigInt(items.length), 24);
    end64.writeBigUInt64LE(BigInt(items.length), 32);
    end64.writeBigUInt64LE(BigInt(centralEnd - centralStart), 40);
    end64.writeBigUInt64LE(BigInt(centralStart), 48);
    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50);
    locator.writeBigUInt64LE(BigInt(centralEnd), 8);
    locator.writeUInt32LE(1, 16);
    locatorOffset = centralEnd + end64.length;
    records.push(end64, locator);
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(zip64 ? U16 : items.length, 8);
  end.writeUInt16LE(zip64 ? U16 : items.length, 10);
  end.writeUInt32LE(zip64 ? U32 : centralEnd - centralStart, 12);
  end.writeUInt32LE(zip64 ? U32 : centralStart, 16);
  end.writeUInt16LE(comment.length, 20);
  return {
    data: Buffer.concat([...locals, gap, ...centrals, ...records, end, comment]),
    layout, centralEnd, locatorOffset, end: centralEnd + (zip64 ? 76 : 0),
  };
}

function withFixture(bytes, operation) {
  const root = mkdtempSync(join(tmpdir(), 'reader-hap-zip-fixture-'));
  try {
    const path = join(root, 'fixture.hap');
    writeFileSync(path, bytes);
    return operation(path);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function inspect(bytes, operation = zip => zip.names) {
  return withFixture(bytes, path => withHapZip(path, operation));
}

test('admits empty directory entries encoded with either supported compression method', () => {
  const { data } = archive([
    { name: 'assets/', content: '' }, { name: 'resources/', content: '', method: 8 },
    { name: 'resources/example.json', content: '{}' },
  ]);
  inspect(data, zip => {
    assert.deepEqual(zip.names, ['assets/', 'resources/', 'resources/example.json']);
    assert.equal(zip.read('resources/example.json').toString(), '{}');
  });
  assert.throws(() => inspect(archive([{ name: 'resources/', content: 'invalid', method: 8 }]).data),
    /directory entry has data/);
});

const basic = () => archive([{ name: 'module.json' }, { name: 'resources/rawfile/sample' }]);

test('reads exact stored and deflated names with signing gap and zero-alignment padding', () => {
  const fixture = archive([
    { name: 'module.json', padding: Buffer.alloc(4095) },
    { name: 'resources/rawfile/[literal]-书源.json', method: 8, descriptor: true },
  ], { gap: Buffer.from('opaque signing block'), comment: Buffer.from('ZIP comment') });
  inspect(fixture.data, zip => {
    assert.deepEqual(zip.names, ['module.json', 'resources/rawfile/[literal]-书源.json']);
    assert.equal(zip.read('module.json').toString(), 'first entry');
    assert.equal(zip.read('resources/rawfile/[literal]-书源.json').toString(), 'first entry');
    assert.throws(() => zip.read('resources/rawfile/*'), /required entry is missing/);
  });
});

test('rejects duplicate, aliased, malformed UTF-8 and unsafe names', () => {
  for (const names of [['module.json', 'module.json'], ['module', 'module/']]) {
    const fixture = archive(names.map(name => ({ name, content: '' })));
    assert.throws(() => inspect(fixture.data), /duplicate entry name/);
  }
  for (const name of ['/absolute', '../relative', 'a/../z', 'a//z', 'C:/root', 'dir\\child', 'line\nname']) {
    assert.throws(() => inspect(archive([{ name }]).data), /unsafe entry name/, name);
  }
  assert.throws(() => inspect(archive([{ name: Buffer.from([0xc3, 0x28]) }]).data), /invalid UTF-8/);
});

test('rejects central corruption, missing ZIP64 locator and inconsistent local offsets', () => {
  const invalid = basic();
  invalid.data.writeUInt32LE(0, invalid.end + 16);
  assert.throws(() => inspect(invalid.data), /invalid central directory bounds/);
  const truncated = basic();
  assert.throws(() => inspect(truncated.data.subarray(0, -1)), /missing end of central directory/);
  const overlapping = basic();
  overlapping.data.writeUInt32LE(0, overlapping.layout[1].central + 42);
  assert.throws(() => inspect(overlapping.data), /local header exceeds entry bounds/);
  const split = basic();
  split.data.writeUInt16LE(1, split.end + 4);
  assert.throws(() => inspect(split.data), /split archives/);
  const zip64 = archive([{ name: 'module.json' }], { zip64: true });
  zip64.data.writeUInt32LE(0, zip64.locatorOffset);
  assert.throws(() => inspect(zip64.data), /missing ZIP64 locator/);
});

test('reads ZIP64 records and rejects corrupt counts and integer offsets', () => {
  const fixture = archive([{ name: 'module.json', method: 8, descriptor: true }], { zip64: true });
  assert.equal(inspect(fixture.data, zip => zip.read('module.json').toString()), 'first entry');
  fixture.data.writeBigUInt64LE(2n, fixture.centralEnd + 24);
  assert.throws(() => inspect(fixture.data), /directory values disagree/);
  fixture.data.writeBigUInt64LE(2n ** 63n, fixture.locatorOffset + 8);
  assert.throws(() => inspect(fixture.data), /integer exceeds the safe range/);
});

test('rejects encryption, unsupported methods, oversized entries and local header mismatch', () => {
  assert.throws(() => inspect(archive([{ name: 'module.json', flags: 1 }]).data), /unsupported entry flags/);
  assert.throws(() => inspect(archive([{ name: 'module.json', method: 12 }]).data), /unsupported compression method/);
  const oversized = archive([{ name: 'module.json', method: 8 }]);
  oversized.data.writeUInt32LE(0x20000000, oversized.layout[0].central + 24);
  assert.throws(() => inspect(oversized.data), /exceeds size limits/);
  const mismatched = basic();
  mismatched.data[mismatched.layout[0].local + 30] = 0x41;
  assert.throws(() => inspect(mismatched.data), /local entry name disagrees/);
});

test('rejects descriptor mismatch, trailing deflate input and payload corruption', () => {
  const descriptor = archive([{ name: 'module.json', descriptor: true }]);
  descriptor.data.writeUInt32LE(123, descriptor.layout[0].descriptor + 8);
  assert.throws(() => inspect(descriptor.data), /data descriptor disagrees/);
  const trailing = archive([{ name: 'module.json', method: 8, trailing: 'junk' }]);
  assert.throws(() => inspect(trailing.data, zip => zip.read('module.json')), /unexpected trailing compressed data/);
  const changed = basic();
  changed.data[changed.layout[0].data] ^= 1;
  assert.throws(() => inspect(changed.data, zip => zip.read('module.json')), /entry size or CRC mismatch/);
  assert.throws(() => inspect(basic().data, zip => zip.read('module.json', 5)), /entry exceeds requested size limit/);
});

test('records a multichunk whole-file digest and guards identity after the descriptor is closed', () => {
  const fixture = archive([{ name: 'module.json' }], { gap: Buffer.alloc(2 * 1024 ** 2 + 37, 23) });
  const sha256 = createHash('sha256').update(fixture.data).digest('hex');
  withFixture(fixture.data, path => {
    const zip = withHapZip(path, opened => {
      assert.deepEqual(opened.fileRecord('public.hap'), { path: 'public.hap', bytes: fixture.data.length, sha256 });
      assert.deepEqual(opened.fileRecord(), { path: 'fixture.hap', bytes: fixture.data.length, sha256 });
      return opened;
    });
    assert.doesNotThrow(zip.assertUnchanged);
    assert.throws(() => zip.fileRecord(), /archive reader has already closed/);
    writeFileSync(path + '.replacement', fixture.data);
    renameSync(path + '.replacement', path);
    assert.throws(zip.assertUnchanged, /archive file identity changed/);
  });
});

test('rejects same-inode content changes and path replacement during the archive callback', () => {
  const fixture = basic();
  withFixture(fixture.data, path => {
    assert.throws(() => withHapZip(path, zip => {
      zip.fileRecord();
      const changed = Buffer.from(fixture.data);
      changed[fixture.layout[0].data] ^= 1;
      writeFileSync(path, changed);
    }), /archive file identity changed/);
  });
  withFixture(fixture.data, path => {
    assert.throws(() => withHapZip(path, zip => {
      zip.read('module.json');
      writeFileSync(path + '.replacement', fixture.data);
      renameSync(path + '.replacement', path);
    }), /archive file identity changed/);
  });
});

test('revalidates unchanged bytes after timestamp drift during and after the archive callback', () => {
  const fixture = basic();
  const sha256 = createHash('sha256').update(fixture.data).digest('hex');
  withFixture(fixture.data, path => {
    const assertUnchanged = withHapZip(path, zip => {
      assert.equal(zip.fileRecord().sha256, sha256);
      utimesSync(path, 1000, 1000);
      assert.doesNotThrow(zip.assertUnchanged);
      assert.equal(zip.fileRecord().sha256, sha256);
      return zip.assertUnchanged;
    });
    utimesSync(path, 2000, 2000);
    assert.doesNotThrow(assertUnchanged);
    assert.doesNotThrow(assertUnchanged);
  });
});

test('timestamp drift stays invalid until a full archive digest has been captured', () => {
  withFixture(basic().data, path => {
    assert.throws(() => withHapZip(path, zip => {
      utimesSync(path, 1000, 1000);
      zip.fileRecord();
    }), /archive file identity changed/);
  });
});

test('a retained archive digest rejects a late same-size content change', () => {
  const fixture = basic();
  withFixture(fixture.data, path => {
    const assertUnchanged = withHapZip(path, zip => {
      zip.fileRecord();
      return zip.assertUnchanged;
    });
    const changed = Buffer.from(fixture.data);
    changed[fixture.layout[0].data] ^= 1;
    writeFileSync(path, changed);
    utimesSync(path, 1000, 1000);
    assert.throws(assertUnchanged, /archive file identity changed/);
  });
});

test('rejects oversized or too-small archives before entry access', () => {
  withFixture(basic().data, path => {
    truncateSync(path, 8192 * 1024 ** 2 + 1);
    assert.throws(() => withHapZip(path, () => assert.fail('oversized archive entered callback')), /archive size is out of bounds/);
  });
  assert.throws(() => inspect(Buffer.alloc(21)), /archive size is out of bounds/);
});
