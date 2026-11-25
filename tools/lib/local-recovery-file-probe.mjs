import assert from 'node:assert/strict';
import { createCipheriv, createDecipheriv, createHash, pbkdf2, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { access, lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { pureModuleProbe } from './ets-pure-module-probe.mjs';
import { ReaderDocumentPickerActivity } from '../../entry/src/main/ets/platform/ReaderDocumentPickerActivity.ts';

// The SDK emits the production module. Node filesystem and OpenSSL operations
// stand in for the platform ports. Deliberately allow short reads and writes.
export function localRecoveryFileProbe(freeBytes = 2 * 1024 ** 3) {
  const handles = new Map();
  const pathOf = path => path.startsWith('file://') ? fileURLToPath(path) : path;
  const io = {
    OpenMode: { READ_ONLY: 0, WRITE_ONLY: 1, CREATE: 2, TRUNC: 4, READ_WRITE: 8 },
    WhenceType: { SEEK_SET: 0, SEEK_END: 2 },
    async open(path, mode) {
      const handle = await open(pathOf(path), mode === io.OpenMode.READ_ONLY ? 'r' : mode === io.OpenMode.READ_WRITE ? 'r+' : 'w');
      handles.set(handle.fd, { handle, position: 0, size: (await handle.stat()).size });
      return handle;
    },
    async close(handle) { handles.delete(handle.fd); await handle.close(); },
    stat(input) { return typeof input === 'string' ? stat(pathOf(input)) : handles.get(input).handle.stat(); },
    lseek(fd, offset, whence) {
      const handle = handles.get(fd);
      handle.position = (whence === io.WhenceType.SEEK_END ? handle.size : 0) + offset;
      return handle.position;
    },
    async read(fd, buffer) {
      const file = handles.get(fd), bytes = new Uint8Array(buffer);
      const { bytesRead } = await file.handle.read(bytes, 0, Math.min(bytes.length, 131071), file.position);
      file.position += bytesRead;
      return bytesRead;
    },
    async write(fd, buffer) {
      const file = handles.get(fd), bytes = new Uint8Array(buffer);
      const { bytesWritten } = await file.handle.write(bytes, 0, Math.min(bytes.length, 131069), file.position);
      file.position += bytesWritten;
      return bytesWritten;
    },
    fsync: fd => handles.get(fd).handle.sync(),
    access: path => access(pathOf(path)).then(() => true, error => {
      if (error.code === 'ENOENT') return false;
      throw error;
    }),
    lstat: path => lstat(pathOf(path)),
    mkdir: (path, recursive) => mkdir(pathOf(path), { recursive }),
    listFile: path => readdir(pathOf(path)),
    rmdir: path => rm(pathOf(path), { recursive: true }),
    mkdtemp: path => mkdtemp(pathOf(path).replace(/XXXXXX$/, '')),
    moveFile: (from, to) => rename(pathOf(from), pathOf(to)),
    readText: path => readFile(pathOf(path), 'utf8'),
    unlink: path => unlink(pathOf(path)),
  };

  const derive = promisify(pbkdf2);
  const updateSizes = [];
  const blob = data => ({ data: new Uint8Array(data) });
  const crypto = {
    CryptoMode: { ENCRYPT_MODE: 0, DECRYPT_MODE: 1 },
    createMd(algorithm) {
      assert.equal(algorithm, 'SHA256');
      const hash = createHash('sha256');
      return { update: async ({ data }) => { hash.update(data); }, digest: async () => blob(hash.digest()) };
    },
    createKdf(algorithm) {
      assert.equal(algorithm, 'PBKDF2|SHA256');
      return { async generateSecret({ algName, password, salt, iterations, keySize }) {
        assert.equal(algName, 'PBKDF2');
        assert.equal(salt.length, 16);
        assert.equal(iterations, 600000);
        assert.equal(keySize, 32);
        return blob(await derive(password, salt, iterations, keySize, 'sha256'));
      } };
    },
    createSymKeyGenerator(algorithm) {
      assert.equal(algorithm, 'AES256');
      return { convertKey: async ({ data }) => Buffer.from(data) };
    },
    createRandom: () => ({ generateRandom: async length => blob(randomBytes(length)) }),
    createCipher(algorithm) {
      assert.equal(algorithm, 'AES256|GCM|NoPadding');
      let cipher, encrypt;
      return {
        async init(mode, key, { algName, iv, aad, authTag }) {
          assert.equal(algName, 'GcmParamsSpec');
          assert.equal(iv.data.length, 12);
          assert.equal(authTag.data.length, 16);
          encrypt = mode === crypto.CryptoMode.ENCRYPT_MODE;
          cipher = (encrypt ? createCipheriv : createDecipheriv)('aes-256-gcm', key, iv.data, { authTagLength: 16 });
          cipher.setAAD(aad.data);
          if (!encrypt) cipher.setAuthTag(authTag.data);
        },
        async update({ data }) { updateSizes.push(data.length); return blob(cipher.update(data)); },
        async doFinal(input) {
          assert.equal(input, null);
          const data = cipher.final();
          return blob(encrypt ? Buffer.concat([data, cipher.getAuthTag()]) : data);
        },
      };
    },
  };

  let pickerOperation;
  class DocumentViewPicker {
    constructor(context) { assert.ok(context); }
    select(options) { return pickerOperation('select', options); }
    save(options) { return pickerOperation('save', options); }
  }
  const picker = { DocumentViewPicker, DocumentSelectOptions: class {}, DocumentSaveOptions: class {} };
  const util = { generateRandomUUID: () => randomUUID(), TextEncoder: class { encodeInto(text) { return new TextEncoder().encode(text); } },
    TextDecoder: { create: (encoding, options) => ({ decodeToString: bytes => new TextDecoder(encoding, options).decode(bytes) }) } };
  const statvfs = { getFreeSize: async () => freeBytes };
  const production = new URL('../../entry/src/main/ets/platform/backup/LocalRecoveryFile.ts', import.meta.url);
  const support = pureModuleProbe(readFileSync(production, 'utf8'), 'LocalRecoveryFile.ts',
    { fileIo: io, picker, statvfs, crypto, util, ReaderDocumentPickerActivity }, [
      'LOCAL_RECOVERY_MAX_BYTES', 'sealRecoveryFile', 'openRecoveryFile', 'recoveryVisitFile',
      'recoveryReserve', 'selectRecoveryDocument', 'LocalRecoveryFileError', 'recoveryHashFile', 'recoveryCopyBytes',
      'recoveryDigest', 'recoveryOutput', 'recoveryRead', 'recoveryText', 'recoveryUtf8',
      'recoveryWithFile',
    ]);
  return { support, io, util, statvfs, crypto, handles, updateSizes, setPicker: action => { pickerOperation = action; } };
}
