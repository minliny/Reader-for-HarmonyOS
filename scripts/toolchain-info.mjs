#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHarmonyTool, ENVIRONMENT_CONTRACT } from './lib/harmony-toolchain.mjs';

const cwd = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tools = {};
for (const name of ['devecoHome', 'sdkHome', 'node', 'hvigorw', 'ohpm', 'hdc', 'etsLoader', 'hvigorPlugin', 'java', 'openssl', 'unzip', 'signTool', 'objcopy']) {
  try { tools[name] = resolveHarmonyTool(name, { cwd, required: false }) || null; }
  catch (error) { tools[name] = { error: error.message }; }
}
console.log(JSON.stringify({ schemaVersion: 1, contract: ENVIRONMENT_CONTRACT, platform: process.platform, node: process.execPath, tools }, null, 2));
