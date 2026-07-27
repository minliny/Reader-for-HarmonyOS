// Encrypts plaintext signing passwords using the same AES-128-GCM algorithm
// as DevEco Studio's hvigor-ohos-plugin DecipherUtil.
//
// Usage:
//   HARMONY_KEY_PASSWORD=... HARMONY_STORE_PASSWORD=... \
//     node scripts/encrypt-signing-pwds.mjs
// Updates build-profile.json5 with hex-encoded encrypted password strings.
//
// Requires signing/material/ directory (fd/, ac/, ce/ subdirs) next to the keystore.
// If missing, copies from ~/.ohos/config/material/.

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const SIGN_DIR = path.join(REPO, 'signing');
const MATERIAL_DIR = path.join(SIGN_DIR, 'material');

// Hardcoded component from DecipherUtil (must match exactly)
const COMPONENT = new Int8Array([49, 243, 9, 115, 214, 175, 91, 184, 211, 190, 177, 88, 101, 131, 192, 119]);

function readMaterialFile(dirPath) {
  const entries = fs.readdirSync(dirPath).filter(f => f !== '.DS_Store');
  if (entries.length !== 1) {
    throw new Error(`Expected exactly 1 file in ${dirPath}, found ${entries.length}`);
  }
  const entry = entries[0];
  const fullPath = path.join(dirPath, entry);
  const stat = fs.statSync(fullPath);
  if (stat.isDirectory()) {
    // One level deeper (fd/0/<file>)
    return readMaterialFile(fullPath);
  }
  return new Int8Array(fs.readFileSync(fullPath));
}

function readMaterialDirs(dirPath) {
  const entries = fs.readdirSync(dirPath).filter(f => f !== '.DS_Store');
  if (entries.length !== 3) {
    throw new Error(`Expected exactly 3 entries in ${dirPath}, found ${entries.length}`);
  }
  return entries.map(e => {
    const fullPath = path.join(dirPath, e);
    return readMaterialFile(fullPath);
  });
}

function xor(a, b) {
  const result = new Int8Array(a.byteLength);
  for (let i = 0; i < a.byteLength; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}

function xorComponents(arrays) {
  arrays.forEach(arr => {
    if (arr.length !== 16) {
      throw new Error(`Component must be 16 bytes, got ${arr.length}`);
    }
  });
  let result = xor(arrays[0], arrays[1]);
  for (let i = 2; i < arrays.length; i++) {
    result = xor(result, arrays[i]);
  }
  return Buffer.from(result);
}

function decrypt(key, data) {
  // DecipherUtil.decrypt format: [4-byte e][IV][ciphertext][16-byte authTag]
  // where e = ciphertext.length + 16 (authTag length)
  // and ivLength = data.length - 4 - e
  const e = (data[0] & 0xFF) << 24 | (data[1] & 0xFF) << 16 | (data[2] & 0xFF) << 8 | (data[3] & 0xFF);
  const i = data.length - 4 - e; // ivLength
  // Convert Int8Array slices to Buffer — createDecipheriv rejects Int8Array IV
  // in some Node versions despite being an ArrayBufferView.
  const dataBuf = Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  const iv = dataBuf.subarray(4, 4 + i);
  const ciphertext = dataBuf.subarray(4 + i, data.length - 16);
  const authTag = dataBuf.subarray(data.length - 16);
  const keyBuf = Buffer.from(key.buffer, key.byteOffset, key.byteLength);

  const decipher = crypto.createDecipheriv('aes-128-gcm', keyBuf, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted;
}

function encrypt(key, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-128-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: [4-byte big-endian e] + [IV] + [ciphertext] + [authTag]
  // e = ciphertext_length + 16 (authTag length)
  const e = ciphertext.length + 16;
  const eBuffer = Buffer.alloc(4);
  eBuffer.writeInt32BE(e, 0);

  const result = Buffer.concat([eBuffer, iv, ciphertext, authTag]);
  return result.toString('hex');
}

function deriveAesKey(materialDir) {
  const fdPath = path.join(materialDir, 'fd');
  const acPath = path.join(materialDir, 'ac');
  const cePath = path.join(materialDir, 'ce');

  // Read 3 key files from fd/
  const fdArrays = readMaterialDirs(fdPath);

  // Read salt from ac/
  const salt = readMaterialFile(acPath);

  // Read encrypted work material from ce/
  const encryptedWorkMaterial = readMaterialFile(cePath);

  // XOR: fd1 XOR fd2 XOR fd3 XOR component
  const allArrays = [...fdArrays, COMPONENT];
  const xored = xorComponents(allArrays);

  // PBKDF2 to derive root key
  const rootKey = crypto.pbkdf2Sync(xored.toString(), salt, 10000, 16, 'sha256');

  // Decrypt work material to get AES key
  const aesKey = decrypt(rootKey, encryptedWorkMaterial);

  return aesKey;
}

function copyMaterialFromOhos() {
  const ohosMaterial = path.join(process.env.HOME, '.ohos', 'config', 'material');
  if (!fs.existsSync(ohosMaterial)) {
    throw new Error(`No material directory found at ${ohosMaterial}. Run DevEco Studio signing config first.`);
  }
  if (!fs.existsSync(MATERIAL_DIR)) {
    fs.mkdirSync(MATERIAL_DIR, { recursive: true });
  }
  // Copy recursively
  fs.cpSync(ohosMaterial, MATERIAL_DIR, { recursive: true });
  console.log(`✓ Copied material from ${ohosMaterial} to ${MATERIAL_DIR}`);
}

// Main
const keyPwd = process.env.HARMONY_KEY_PASSWORD;
const storePwd = process.env.HARMONY_STORE_PASSWORD;
if (!keyPwd || !storePwd) {
  throw new Error('HARMONY_KEY_PASSWORD and HARMONY_STORE_PASSWORD are required');
}
for (const [name, value] of [['HARMONY_KEY_PASSWORD', keyPwd], ['HARMONY_STORE_PASSWORD', storePwd]]) {
  if (value.length < 32 || value.length % 2 === 0) {
    throw new Error(`${name} must contain at least 32 characters and have odd length`);
  }
}

console.log(`✓ Loaded signing passwords from environment (lengths ${keyPwd.length}/${storePwd.length})`);

// Ensure material directory exists
if (!fs.existsSync(MATERIAL_DIR)) {
  console.log('Material directory not found, copying from ~/.ohos/config/material...');
  copyMaterialFromOhos();
}

// Derive AES key
const aesKey = deriveAesKey(MATERIAL_DIR);
console.log(`✓ Derived AES key (${aesKey.length} bytes)`);

// Verify by decrypting the default password from plugin (best-effort; plugin
// material layout may differ, so failures here do not block encryption).
const pluginDefaultEncrypted = '/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor-ohos-plugin/res/material/zb/de';
if (fs.existsSync(pluginDefaultEncrypted)) {
  try {
    const pluginMaterialDir = '/Applications/DevEco-Studio.app/Contents/tools/hvigor/hvigor-ohos-plugin/res/material';
    const pluginKey = deriveAesKey(pluginMaterialDir);
    const encryptedDefault = new Int8Array(fs.readFileSync(pluginDefaultEncrypted));
    const decryptedDefault = decrypt(pluginKey, encryptedDefault);
    console.log(`✓ Verification: decrypted plugin default password (${decryptedDefault.length} bytes)`);
  } catch (verifyErr) {
    console.log(`⚠ Verification skipped (plugin material layout differs): ${verifyErr.message}`);
  }
}

// Encrypt passwords
const encryptedKeyPwd = encrypt(aesKey, keyPwd);
const encryptedStorePwd = encrypt(aesKey, storePwd);

console.log('');
console.log('=== Encrypted passwords for build-profile.json5 ===');
console.log(`keyPassword encrypted (${encryptedKeyPwd.length} chars)`);
console.log(`storePassword encrypted (${encryptedStorePwd.length} chars)`);

// Update build-profile.json5
const buildProfilePath = path.join(REPO, 'build-profile.json5');
let content = fs.readFileSync(buildProfilePath, 'utf-8');

// Replace keyPassword
content = content.replace(
  /"keyPassword":\s*"[^"]*"/,
  `"keyPassword": "${encryptedKeyPwd}"`
);
// Replace storePassword
content = content.replace(
  /"storePassword":\s*"[^"]*"/,
  `"storePassword": "${encryptedStorePwd}"`
);

fs.writeFileSync(buildProfilePath, content);
console.log(`\n✓ Updated ${buildProfilePath} with encrypted passwords`);
