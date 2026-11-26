import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { TextDecoder } from 'node:util';
import { crc32, inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50;
const ZIP64_EOCD = 0x06064b50;
const ZIP64_LOCATOR = 0x07064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const DESCRIPTOR = 0x08074b50;
const UTF8 = 0x800;
const HAS_DESCRIPTOR = 0x08;
const MAX16 = 0xffff;
const MAX32 = 0xffffffff;
const MIB = 1024 ** 2;
const MAX_ARCHIVE_BYTES = 8192 * MIB;
const MAX_CENTRAL_BYTES = 32 * MIB;
const MAX_ENTRY_BYTES = 256 * MIB;
const MAX_ENTRY_COUNT = 16_384;
const MAX_TOTAL_BYTES = 4096 * MIB;
const SHA_CHUNK_BYTES = MIB;
const decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

function requireZip(condition, message) {
  if (!condition) throw new Error('Invalid HAP ZIP: ' + message);
}

function uint64(bytes, offset) {
  const value = bytes.readBigUInt64LE(offset);
  requireZip(value <= BigInt(Number.MAX_SAFE_INTEGER), 'integer exceeds the safe range');
  return Number(value);
}

function bounded(offset, size, limit) {
  return offset >= 0 && offset <= limit && size >= 0 && size <= limit - offset;
}

function readInto(fd, bytes, offset, size) {
  let bytesRead = 0;
  while (bytesRead < size) {
    const count = readSync(fd, bytes, bytesRead, size - bytesRead, offset + bytesRead);
    requireZip(count > 0, 'archive truncated while reading');
    bytesRead += count;
  }
}

function reader(fd, fileSize) {
  return (offset, size) => {
    requireZip(bounded(offset, size, fileSize), 'read exceeds archive bounds');
    const bytes = Buffer.allocUnsafe(size);
    readInto(fd, bytes, offset, size);
    return bytes;
  };
}

function archiveSha256(fd, fileSize) {
  const hash = createHash('sha256');
  const chunk = Buffer.allocUnsafe(Math.min(fileSize, SHA_CHUNK_BYTES));
  for (let offset = 0; offset < fileSize; offset += chunk.length) {
    const size = Math.min(chunk.length, fileSize - offset);
    readInto(fd, chunk, offset, size);
    hash.update(chunk.subarray(0, size));
  }
  return hash.digest('hex');
}

function assertSameArchiveFile(expected, actual) {
  requireZip(actual?.isFile() && actual.dev === expected.dev && actual.ino === expected.ino &&
    actual.size === expected.size && actual.mode === expected.mode, 'archive file identity changed');
}

function sameArchiveTimestamps(before, after) {
  return before.mtimeNs === after.mtimeNs && before.ctimeNs === after.ctimeNs;
}

function centralDirectory(read, fileSize) {
  const tailSize = Math.min(fileSize, 22 + MAX16);
  const tailOffset = fileSize - tailSize;
  const tail = read(tailOffset, tailSize);
  let end;
  for (let offset = tail.length - 22; offset >= 0; offset--) {
    if (tail.readUInt32LE(offset) !== EOCD || offset + 22 + tail.readUInt16LE(offset + 20) !== tailSize) continue;
    requireZip(end === undefined, 'ambiguous end of central directory');
    end = offset;
  }
  requireZip(end !== undefined, 'missing end of central directory');
  const endOffset = tailOffset + end;
  requireZip(tail.readUInt16LE(end + 4) === 0 && tail.readUInt16LE(end + 6) === 0, 'split archives are unsupported');
  const entriesOnDisk = tail.readUInt16LE(end + 8);
  let count = tail.readUInt16LE(end + 10);
  let size = tail.readUInt32LE(end + 12);
  let start = tail.readUInt32LE(end + 16);
  let directoryEnd = endOffset;
  const locatorOffset = endOffset - 20;
  const locator = locatorOffset >= 0 ? read(locatorOffset, 20) : null;
  if (locator?.readUInt32LE(0) === ZIP64_LOCATOR) {
    requireZip(locator.readUInt32LE(4) === 0 && locator.readUInt32LE(16) === 1, 'split ZIP64 archives are unsupported');
    const zip64Offset = uint64(locator, 8);
    requireZip(bounded(zip64Offset, 56, locatorOffset), 'invalid ZIP64 end record offset');
    const zip64 = read(zip64Offset, 56);
    requireZip(zip64.readUInt32LE(0) === ZIP64_EOCD && uint64(zip64, 4) === locatorOffset - zip64Offset - 12,
      'invalid ZIP64 end record');
    requireZip(zip64.readUInt32LE(16) === 0 && zip64.readUInt32LE(20) === 0, 'split ZIP64 archives are unsupported');
    const wideCount = uint64(zip64, 32);
    const wideSize = uint64(zip64, 40);
    const wideStart = uint64(zip64, 48);
    requireZip(uint64(zip64, 24) === wideCount && (entriesOnDisk === MAX16 || entriesOnDisk === wideCount) &&
      (count === MAX16 || count === wideCount) && (size === MAX32 || size === wideSize) &&
      (start === MAX32 || start === wideStart), 'ZIP32 and ZIP64 directory values disagree');
    [count, size, start, directoryEnd] = [wideCount, wideSize, wideStart, zip64Offset];
  } else {
    requireZip(entriesOnDisk === count && count !== MAX16 && size !== MAX32 && start !== MAX32, 'missing ZIP64 locator or split directory');
  }
  requireZip(count <= MAX_ENTRY_COUNT && size <= MAX_CENTRAL_BYTES && size >= count * 46, 'central directory exceeds entry or size limits');
  requireZip(bounded(start, size, directoryEnd) && start + size === directoryEnd, 'invalid central directory bounds');
  return { start, count, bytes: read(start, size) };
}

// ZIP64 fields occur in fixed order, with only the placeholder fields present.
function wideFields(extra, fields) {
  let zip64;
  for (let cursor = 0; cursor < extra.length;) {
    // Huawei tools use raw zero padding to align stored HAP entries.
    if (extra[cursor] === 0 && extra.subarray(cursor).every(byte => byte === 0)) break;
    requireZip(bounded(cursor, 4, extra.length), 'truncated extra field');
    const type = extra.readUInt16LE(cursor);
    const size = extra.readUInt16LE(cursor + 2);
    cursor += 4;
    requireZip(bounded(cursor, size, extra.length), 'extra field exceeds header');
    if (type === 1) {
      requireZip(zip64 === undefined, 'duplicate ZIP64 extra field');
      zip64 = extra.subarray(cursor, cursor + size);
    }
    cursor += size;
  }
  const requiredSize = fields.reduce((size, field) => size + (field.required ? field.width : 0), 0);
  requireZip((zip64?.length ?? 0) === requiredSize && !(zip64 && !requiredSize), 'invalid ZIP64 extra field');
  let offset = 0;
  return fields.map(field => {
    if (!field.required) return field.value;
    const value = field.width === 8 ? uint64(zip64, offset) : zip64.readUInt32LE(offset);
    offset += field.width;
    return value;
  });
}

const wide32 = value => ({ value, required: value === MAX32, width: 8 });
const wide16 = value => ({ value, required: value === MAX16, width: 4 });

function entryName(bytes, flags) {
  requireZip(bytes.length > 0 && ((flags & UTF8) !== 0 || bytes.every(byte => byte < 0x80)), 'entry name must use ASCII or UTF-8');
  let name;
  try { name = decoder.decode(bytes); }
  catch { requireZip(false, 'invalid UTF-8 entry name'); }
  const path = name.endsWith('/') ? name.slice(0, -1) : name;
  requireZip(!/[\\:\p{Cc}]/u.test(name) && !path.split('/').some(part => part === '' || part === '.' || part === '..'),
    'unsafe entry name');
  return name;
}

function readDescriptor(read, start, limit, entry, wide) {
  const length = wide ? 20 : 12;
  const available = Math.min(length + 4, limit - start);
  requireZip(available >= length, 'truncated data descriptor');
  const bytes = read(start, available);
  const matches = [0, 4].filter(offset => {
    if (!bounded(offset, length, bytes.length) || (offset === 4 && bytes.readUInt32LE(0) !== DESCRIPTOR)) return false;
    if (bytes.readUInt32LE(offset) !== entry.crc) return false;
    const packed = wide ? bytes.readBigUInt64LE(offset + 4) : BigInt(bytes.readUInt32LE(offset + 4));
    const size = wide ? bytes.readBigUInt64LE(offset + 12) : BigInt(bytes.readUInt32LE(offset + 8));
    return packed === BigInt(entry.packed) && size === BigInt(entry.size);
  });
  requireZip(matches.length === 1, 'data descriptor disagrees with central directory');
  return start + matches[0] + length;
}

function checkLocal(read, limit, entry, centralName, zip64Sizes) {
  const offset = entry.local;
  requireZip(bounded(offset, 30, limit), 'local header exceeds entry bounds');
  const record = read(offset, 30);
  requireZip(record.readUInt32LE(0) === LOCAL && record.readUInt16LE(6) === entry.flags &&
    record.readUInt16LE(8) === entry.method, 'local header disagrees with central directory');
  const nameBytes = record.readUInt16LE(26);
  const extraBytes = record.readUInt16LE(28);
  const headerBytes = nameBytes + extraBytes;
  requireZip(bounded(offset + 30, headerBytes, limit), 'local name/extra exceed entry bounds');
  const variable = read(offset + 30, headerBytes);
  requireZip(variable.subarray(0, nameBytes).equals(centralName), 'local entry name disagrees with central directory');
  const encodedSize = record.readUInt32LE(22);
  const encodedPacked = record.readUInt32LE(18);
  const [size, packed] = wideFields(variable.subarray(nameBytes), [wide32(encodedSize), wide32(encodedPacked)]);
  const crc = record.readUInt32LE(14);
  const hasDescriptor = (entry.flags & HAS_DESCRIPTOR) !== 0;
  const matches = (actual, expected) => actual === expected || (hasDescriptor && actual === 0);
  requireZip(matches(size, entry.size) && matches(packed, entry.packed) && matches(crc, entry.crc),
    'local sizes or CRC disagree with central directory');
  entry.data = offset + 30 + headerBytes;
  requireZip(bounded(entry.data, entry.packed, limit), 'entry payload overlaps another entry or the central directory');
  if (hasDescriptor) readDescriptor(read, entry.data + entry.packed, limit, entry,
    zip64Sizes || encodedSize === MAX32 || encodedPacked === MAX32);
}

function parseEntries(read, directory) {
  const { bytes, count, start } = directory;
  const entries = new Map();
  const localRecords = [];
  let cursor = 0;
  let total = 0;
  for (let index = 0; index < count; index++) {
    requireZip(bounded(cursor, 46, bytes.length) && bytes.readUInt32LE(cursor) === CENTRAL, 'invalid central directory entry');
    const flags = bytes.readUInt16LE(cursor + 8);
    const method = bytes.readUInt16LE(cursor + 10);
    requireZip(method === 0 || method === 8, 'unsupported compression method');
    requireZip((flags & ~(UTF8 | HAS_DESCRIPTOR | (method === 8 ? 0x06 : 0))) === 0, 'unsupported entry flags');
    const crc = bytes.readUInt32LE(cursor + 16);
    const encodedPacked = bytes.readUInt32LE(cursor + 20);
    const encodedSize = bytes.readUInt32LE(cursor + 24);
    const nameBytes = bytes.readUInt16LE(cursor + 28);
    const extraBytes = bytes.readUInt16LE(cursor + 30);
    const commentBytes = bytes.readUInt16LE(cursor + 32);
    const disk = bytes.readUInt16LE(cursor + 34);
    const encodedLocal = bytes.readUInt32LE(cursor + 42);
    const nameOffset = cursor + 46;
    const extraOffset = nameOffset + nameBytes;
    const next = extraOffset + extraBytes + commentBytes;
    requireZip(next <= bytes.length, 'central directory entry is truncated');
    const unixMode = bytes.readUInt32LE(cursor + 38) >>> 16;
    requireZip(bytes[cursor + 5] !== 3 || [0, 0o040000, 0o100000].includes(unixMode & 0o170000),
      'non-regular archive entry');
    const rawName = bytes.subarray(nameOffset, extraOffset);
    const name = entryName(rawName, flags);
    const [size, packed, local, diskNumber] = wideFields(bytes.subarray(extraOffset, extraOffset + extraBytes),
      [wide32(encodedSize), wide32(encodedPacked), wide32(encodedLocal), wide16(disk)]);
    requireZip(diskNumber === 0 && (method !== 0 || size === packed), 'invalid disk or stored entry size');
    requireZip(size <= MAX_ENTRY_BYTES && packed <= MAX_ENTRY_BYTES && total + size <= MAX_TOTAL_BYTES,
      'entry or archive exceeds size limits');
    requireZip(!name.endsWith('/') || size === 0, 'directory entry has data');
    requireZip(!entries.has(name) && !entries.has(name.endsWith('/') ? name.slice(0, -1) : name + '/'), 'duplicate entry name');
    const entry = { flags, method, crc, size, packed, local };
    entries.set(name, entry);
    localRecords.push({ entry, rawName, zip64Sizes: encodedSize === MAX32 || encodedPacked === MAX32 });
    cursor = next;
    total += size;
  }
  requireZip(cursor === bytes.length, 'unexpected bytes in central directory');
  localRecords.sort((left, right) => left.entry.local - right.entry.local);
  for (let index = 0; index < localRecords.length; index++) {
    const { entry, rawName, zip64Sizes } = localRecords[index];
    checkLocal(read, localRecords[index + 1]?.entry.local ?? start, entry, rawName, zip64Sizes);
  }
  return entries;
}

/** Open one read-only archive for a synchronous action. Only assertUnchanged remains usable afterward. */
export function withHapZip(path, action) {
  const absolute = resolve(path);
  const pathStat = () => lstatSync(absolute, { bigint: true, throwIfNoEntry: false });
  let captured = pathStat();
  requireZip(captured?.isFile(), 'archive must be a regular file');
  requireZip(captured.size >= 22n && captured.size <= BigInt(MAX_ARCHIVE_BYTES), 'archive size is out of bounds');
  const openFlags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0);
  const fd = openSync(absolute, openFlags);
  let open = true;
  let sha256;
  try {
    const bytes = Number(captured.size);
    const descriptorStamp = archiveFd => {
      const opened = fstatSync(archiveFd, { bigint: true });
      const current = pathStat();
      assertSameArchiveFile(captured, opened);
      assertSameArchiveFile(captured, current);
      requireZip(sameArchiveTimestamps(opened, current), 'archive file identity changed');
      return opened;
    };
    const stableDigest = (archiveFd, before) => {
      requireZip(sameArchiveTimestamps(before, descriptorStamp(archiveFd)), 'archive file identity changed');
      const digest = archiveSha256(archiveFd, bytes);
      requireZip(sameArchiveTimestamps(before, descriptorStamp(archiveFd)), 'archive file identity changed');
      return digest;
    };
    const assertUnchanged = () => {
      const current = open ? descriptorStamp(fd) : pathStat();
      if (!open) assertSameArchiveFile(captured, current);
      if (sameArchiveTimestamps(captured, current)) return current;
      requireZip(sha256 !== undefined, 'archive file identity changed');
      // A changed timestamp can only refresh the stamp after hashing the same
      // inode under a stable descriptor and confirming all the original bytes.
      const archiveFd = open ? fd : openSync(absolute, openFlags);
      try {
        requireZip(stableDigest(archiveFd, current) === sha256, 'archive file identity changed');
        captured = current;
        return current;
      } finally { if (!open) closeSync(archiveFd); }
    };
    assertUnchanged();
    const read = reader(fd, bytes);
    const entries = parseEntries(read, centralDirectory(read, bytes));
    const result = action({
      names: Object.freeze([...entries.keys()]),
      assertUnchanged,
      fileRecord(recordedPath = basename(absolute)) {
        requireZip(open, 'archive reader has already closed');
        const before = assertUnchanged();
        sha256 ??= stableDigest(fd, before);
        return { path: recordedPath, bytes, sha256 };
      },
      read(name, maxBytes = MAX_ENTRY_BYTES) {
        requireZip(open, 'archive reader has already closed');
        const before = assertUnchanged();
        const entry = entries.get(name);
        requireZip(entry && !name.endsWith('/'), 'required entry is missing');
        requireZip(Number.isSafeInteger(maxBytes) && maxBytes >= 0 && entry.size <= maxBytes,
          'entry exceeds requested size limit');
        const packed = read(entry.data, entry.packed);
        let bytes = packed;
        if (entry.method === 8) {
          try {
            const result = inflateRawSync(packed, { maxOutputLength: Math.max(1, entry.size), info: true });
            requireZip(result.engine.bytesWritten === packed.length, 'unexpected trailing compressed data');
            bytes = result.buffer;
          } catch (error) {
            if (error instanceof Error && error.message.startsWith('Invalid HAP ZIP:')) throw error;
            requireZip(false, 'invalid or oversized DEFLATE payload');
          }
        }
        requireZip(bytes.length === entry.size && crc32(bytes) === entry.crc, 'entry size or CRC mismatch');
        requireZip(sameArchiveTimestamps(before, descriptorStamp(fd)), 'archive file identity changed');
        return bytes;
      },
    });
    assertUnchanged();
    return result;
  } finally {
    open = false;
    closeSync(fd);
  }
}
