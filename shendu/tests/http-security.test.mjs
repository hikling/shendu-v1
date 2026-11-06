import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import { runInNewContext } from 'node:vm';

const appDir = fileURLToPath(new URL('../', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'shendu-http-security-'));
const password = 'http-audit-' + randomBytes(16).toString('hex');
const servers = [];
let direct, proxied, ownerCookie, memberCookie, memberId;

async function start(name, trustProxy = '') {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const directory = join(root, name);
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: appDir,
    env: { ...process.env, SHENDU_PORT: String(port), SHENDU_DATA_DIR: directory,
      SHENDU_MASTER_KEY: '',
      SHENDU_MASTER_KEY_PATH: join(directory, 'backup-master.key'),
      SHENDU_TRUST_PROXY: trustProxy, SHENDU_SECURE_COOKIE: 'false' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  servers.push(child);
  let logs = ''; child.stdout.on('data', value => { logs += value; }); child.stderr.on('data', value => { logs += value; });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { if ((await fetch(base + '/healthz')).ok) return base; } catch {}
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail('isolated server failed to start: ' + logs);
}
async function api(path, { method = 'GET', body, cookie = ownerCookie, headers = {}, base = direct } = {}) {
  const response = await fetch(base + path, { method,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, value: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
before(async () => {
  direct = await start('direct'); proxied = await start('proxied', 'true');
  const owner = await api('/api/auth/register', { method: 'POST', cookie: '', body: { username: 'http_owner', password } });
  assert.equal(owner.status, 201); ownerCookie = owner.cookie;
  assert.equal((await api('/api/admin/users', { method: 'POST', body: { username: 'http_member', password } })).status, 201);
  const member = await api('/api/auth/login', { method: 'POST', cookie: '', body: { username: 'http_member', password } });
  assert.equal(member.status, 200); memberCookie = member.cookie; memberId = member.value.user.id;
});
after(async () => {
  await Promise.all(servers.map(async child => {
    if (child.exitCode === null) { const stopped = once(child, 'exit'); child.kill('SIGTERM'); await stopped; }
  }));
  rmSync(root, { recursive: true, force: true });
});

test('direct startup cannot bypass login throttling by rotating X-Forwarded-For', async () => {
  for (let index = 1; index <= 13; index++) {
    const response = await api('/api/auth/login', { method: 'POST', cookie: '',
      body: { username: 'nonexistent_direct', password }, headers: { 'X-Forwarded-For': `198.51.100.${index}` } });
    assert.equal(response.status, index <= 12 ? 401 : 429);
  }
});

test('explicit trusted-proxy mode retains separate client rate-limit buckets', async () => {
  for (let index = 1; index <= 13; index++) {
    const response = await api('/api/auth/login', { base: proxied, method: 'POST', cookie: '',
      body: { username: 'nonexistent_proxied', password }, headers: { 'X-Forwarded-For': `198.51.100.${index}` } });
    assert.equal(response.status, 401);
  }
});

test('member cannot use administrator backup or account-management routes', async () => {
  for (const [path, method] of [
    ['/api/admin/users', 'GET'], ['/api/admin/users', 'POST'], ['/api/admin/registration', 'PUT'],
    ['/api/admin/site-backup/export', 'POST'], ['/api/admin/site-backup/inspect', 'POST'], ['/api/admin/site-backup/restore', 'POST']
  ]) {
    assert.equal((await api(path, { method, cookie: memberCookie, ...(method === 'GET' ? {} : { body: {} }) })).status, 403, path);
  }
});

test('unsafe origins and JSON shapes are rejected without changing account settings', async () => {
  const original = await api('/api/me');
  assert.equal((await api('/api/settings', { method: 'PUT', body: { stage: { name: 'unwanted' } }, headers: { Origin: 'https://attacker.invalid' } })).status, 403);
  assert.equal((await api('/api/settings', { method: 'PUT', body: [], headers: {} })).status, 400);
  assert.equal((await api('/api/settings', { method: 'PUT', body: {}, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await api('/api/me')).value.stage.name, original.value.stage.name);
});

test('unused chunk-upload transport is removed while the current import interface remains available', async () => {
  for (const path of ['/api/backup/upload/start', '/api/backup/upload/unused/chunk', '/api/backup/upload/unused/preview', '/api/backup/upload/unused/apply']) {
    const response = await api(path, { method: 'POST', body: {} });
    assert.equal(response.status, 404); assert.equal(response.value.error, 'not_found');
  }
  assert.equal((await api('/api/data/inspect', { method: 'POST', body: { encryptedBackup: '{}', password } })).status, 400);
});

function externalApiHarness(run) {
  const source = readFileSync(join(appDir, 'server.mjs'), 'utf8');
  const rateCode = source.slice(source.indexOf('const rateMap ='), source.indexOf('function exportPayload('));
  const apiCode = source.slice(source.indexOf('async function api('), source.indexOf('const server = http.createServer'));
  const outcomes = [];
  const context = { net, TRUST_PROXY: false, requireUser: () => ({ id: 'account', role: 'member' }),
    db: { prepare: () => ({ get: () => ({ id: 'target', user_id: 'account' }) }) },
    runExternalBackup: run,
    saveBackupOutcome: (...args) => { outcomes.push(args); return true; },
    json: (_res, status, body) => ({ status, body }),
    error: (_res, status, message, code) => ({ status, body: { message, error: code } }) };
  const handler = runInNewContext(`${rateCode}\n${apiCode}\napi`, context);
  return { outcomes, request: () => handler({ method: 'POST', headers: {}, socket: { remoteAddress: '127.0.0.1' } }, {},
    { pathname: '/api/backup/targets/target/run' }) };
}

test('external backup API limits repeated work before generating additional backup buffers', async () => {
  let runs = 0;
  const harness = externalApiHarness(async () => { runs++; });
  for (let index = 1; index <= 13; index++) {
    const response = await harness.request();
    assert.equal(response.status, index <= 12 ? 200 : 429);
  }
  assert.equal(runs, 12); assert.equal(harness.outcomes.length, 12);
});

test('busy external backup rejection preserves the in-flight operation status', async () => {
  const harness = externalApiHarness(async () => { throw Object.assign(new Error('busy'), { status: 429, code: 'backup_busy' }); });
  const response = await harness.request();
  assert.equal(response.status, 429); assert.equal(response.body.error, 'backup_busy');
  assert.equal(harness.outcomes.length, 0);
});

test('revoking a session while an import body is uploading prevents restore', async () => {
  const body = JSON.stringify({ mode: 'replace', confirmation: 'RESTORE', encryptedBackup: '{}', password });
  let completed;
  const response = new Promise((resolve, reject) => {
    completed = http.request(direct + '/api/data/import', { method: 'POST', headers: {
      Cookie: memberCookie, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)
    } }, incoming => {
      let value = ''; incoming.on('data', chunk => { value += chunk; });
      incoming.on('end', () => resolve({ status: incoming.statusCode, value: JSON.parse(value) }));
      incoming.on('error', reject);
    });
    completed.on('error', reject);
    completed.flushHeaders(); completed.write(body.slice(0, 1));
  });
  // Let the server authenticate and suspend at its body read before disabling it.
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal((await api(`/api/admin/users/${memberId}`, { method: 'PATCH', body: { status: 'disabled' } })).status, 200);
  completed.end(body.slice(1));
  const rejected = await response;
  assert.equal(rejected.status, 401); assert.equal(rejected.value.error, 'unauthorized');
  assert.equal((await api('/api/me')).status, 200);
});
