const { mkdtempSync, readFileSync, rmSync, statSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

// Only the current account, LocalSystem and local administrators may have
// access. Deny entries do not grant access; unknown allow/object ACEs fail shut.
function privateWindowsAcl(sddl, userSid) {
  if (!/^S-1-\d+(?:-\d+)+$/.test(userSid)) return false;
  // icacls /save writes the filename before the DACL. A file on drive D:
  // must not be mistaken for the ACL declaration.
  const declaration = sddl.split(/\r?\n/).map(line => line.trim())
    .find(line => /^D:(?:P|AI|AR)*(?:\(|$)/.test(line));
  const acl = declaration?.slice(2);
  if (!acl) return false;
  const entries = [...acl.matchAll(/\(([^()]*)\)/g)];
  if (!entries.length || !entries.some(entry => entry[1].split(';')[0] === 'A')) return false;
  const allowed = new Set(['SY', 'BA', 'S-1-5-18', 'S-1-5-32-544', userSid]);
  return entries.every(entry => {
    const fields = entry[1].split(';');
    return fields[0] === 'D' || (fields.length === 6 && fields[0] === 'A' && allowed.has(fields[5]));
  });
}

function assertPrivateFilePermissions(path) {
  const stat = statSync(path);
  if (!stat.isFile()) throw new Error(`Private input is not a regular file: ${path}`);
  if (process.platform !== 'win32') {
    if ((stat.mode & 0o077) !== 0) throw new Error(`Private input permissions must exclude group/other access: ${path}`);
    return;
  }
  const systemRoot = process.env.SystemRoot || process.env.WINDIR;
  if (!systemRoot) throw new Error('Windows private-file ACL verification requires SystemRoot.');
  const identity = spawnSync(join(systemRoot, 'System32/whoami.exe'), ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true });
  const userSid = identity.status === 0 ? identity.stdout.trim().match(/"(S-1-\d+(?:-\d+)+)"$/)?.[1] : undefined;
  const temporary = mkdtempSync(join(tmpdir(), 'reader-private-acl-'));
  try {
    const output = join(temporary, 'acl.txt');
    const result = spawnSync(join(systemRoot, 'System32/icacls.exe'), [path, '/save', output, '/q'], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0 || !userSid) throw new Error('Windows private-file ACL verification is unavailable.');
    const bytes = readFileSync(output);
    const acl = bytes.includes(0) ? bytes.toString('utf16le') : bytes.toString('utf8');
    if (!privateWindowsAcl(acl, userSid)) {
      throw new Error(`Private input ACL must allow only the current user, SYSTEM and Administrators: ${path}`);
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}

module.exports = { assertPrivateFilePermissions, privateWindowsAcl };
