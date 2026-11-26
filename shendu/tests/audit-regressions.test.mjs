import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { runInNewContext } from 'node:vm';
import { validateSnapshotDatabase } from '../scripts/backup-safety.mjs';
import { createFinanceLedger } from '../finance-ledger.mjs';
import { inspectReceiptImage } from '../public/receipt-client.js';

const appDir = fileURLToPath(new URL('../', import.meta.url));
const root = mkdtempSync(join(tmpdir(), 'shendu-audit-regressions-'));
const password = 'audit-regression-' + randomBytes(12).toString('hex');
const servers = [];
let baseUrl, ownerCookie, adminCookie, memberCookie, memberId, adminId;

async function startServer(name, envExtra = {}) {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const dir = join(root, name);
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: appDir,
    env: {
      ...process.env,
      SHENDU_PORT: String(port),
      SHENDU_DATA_DIR: dir,
      SHENDU_MASTER_KEY: '',
      SHENDU_MASTER_KEY_PATH: join(dir, 'backup-master.key'),
      SHENDU_TRUST_PROXY: 'true',
      SHENDU_SECURE_COOKIE: 'false',
      ...envExtra
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  servers.push(child);
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk; });
  child.stderr.on('data', chunk => { logs += chunk; });
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 150; attempt++) {
    try { if ((await fetch(url + '/healthz')).ok) return { url, dir }; } catch {}
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.fail('server failed to start: ' + logs);
}

async function api(path, { method = 'GET', body, cookie = ownerCookie, headers = {}, url = baseUrl } = {}) {
  const res = await fetch(url + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  let value;
  try { value = JSON.parse(text); } catch { value = text; }
  return { status: res.status, value, cookie: res.headers.get('set-cookie')?.split(';')[0] };
}

before(async () => {
  const started = await startServer('main');
  baseUrl = started.url;
  const reg = await api('/api/auth/register', { method: 'POST', cookie: '', body: { username: 'AuditOwner', password } });
  assert.equal(reg.status, 201);
  assert.equal(reg.value.user.status, 'active');
  assert.ok(reg.value.user.createdAt);
  ownerCookie = reg.cookie;
  assert.equal((await api('/api/admin/users', { method: 'POST', body: { username: 'audit_admin', password, role: 'admin' } })).status, 201);
  assert.equal((await api('/api/admin/users', { method: 'POST', body: { username: 'audit_member', password, role: 'member' } })).status, 201);
  const adminLogin = await api('/api/auth/login', { method: 'POST', cookie: '', body: { username: 'audit_admin', password } });
  adminCookie = adminLogin.cookie;
  adminId = adminLogin.value.user.id;
  const memberLogin = await api('/api/auth/login', { method: 'POST', cookie: '', body: { username: 'audit_member', password } });
  memberCookie = memberLogin.cookie;
  memberId = memberLogin.value.user.id;
});

after(async () => {
  await Promise.all(servers.map(async child => {
    if (child.exitCode === null) {
      const stopped = once(child, 'exit');
      child.kill('SIGTERM');
      await stopped;
    }
  }));
  rmSync(root, { recursive: true, force: true });
});

test('admin-cli rejects empty --password-file argument instead of encrypting with flag text', () => {
  const out = join(root, 'empty-pass-flag.shendu-db');
  const result = spawnSync(process.execPath, ['scripts/admin-cli.mjs', 'snapshot', out, '--password-file', ''], {
    cwd: appDir,
    env: { ...process.env, SHENDU_DATA_DIR: join(root, 'main') },
    encoding: 'utf8'
  });
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(out), false);
  assert.match(result.stdout + result.stderr, /admin-cli\.mjs snapshot/);
});

test('backup-safety rejects SQLite triggers/views and AAD-mismatched v2 credentials', () => {
  const key = randomBytes(32);
  const keyHex = key.toString('hex');
  const sealSecretV2 = (value, scope) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(`shendu:secret:v2:${scope}`));
    const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return JSON.stringify({ v: 2, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
  };

  const triggerDb = new DatabaseSync(':memory:');
  try {
    triggerDb.exec('CREATE TABLE t(x TEXT); CREATE TRIGGER evil AFTER INSERT ON t BEGIN SELECT 1; END;');
    assert.throws(() => validateSnapshotDatabase(triggerDb, keyHex), /触发器|视图/);
  } finally {
    triggerDb.close();
  }

  const swappedDb = new DatabaseSync(':memory:');
  try {
    swappedDb.exec(`
      CREATE TABLE schema_meta(key TEXT PRIMARY KEY, value TEXT);
      INSERT INTO schema_meta(key, value) VALUES('data_encryption', 'AES-256-GCM');
      CREATE TABLE records(id TEXT, user_id TEXT, title TEXT, data TEXT, verification TEXT);
      CREATE TABLE user_settings(user_id TEXT, key TEXT, value TEXT);
      CREATE TABLE backup_targets(id TEXT, user_id TEXT, encrypted_config TEXT);
    `);
    swappedDb.prepare('INSERT INTO backup_targets(id,user_id,encrypted_config) VALUES(?,?,?)')
      .run('target-b', 'user-b', sealSecretV2({ url: 'https://backup.example.test' }, 'backup-target:user-a:target-a'));
    assert.throws(() => validateSnapshotDatabase(swappedDb, keyHex), /不匹配|损坏/);
  } finally {
    swappedDb.close();
  }
});

test('SSRF validator blocks IPv6 bypass ranges, trailing-dot localhost, and virtual-hosted S3 IP literals', async () => {
  const blockedUrls = [
    'https://[::ffff:0:127.0.0.1]/dav',
    'https://[::127.0.0.1]/dav',
    'https://[2001::1]/dav',
    'https://[64:ff9b::127.0.0.1]/dav',
    'https://[2001:db8::1]/dav',
    'https://localhost./dav',
    'https://sub.localhost./dav'
  ];
  for (const url of blockedUrls) {
    const res = await api('/api/backup/targets', {
      method: 'POST',
      body: { name: 'ssrf-test', kind: 'webdav', schedule: 'manual', config: { url, username: 'u', password: 'p', directory: 'shendu' } }
    });
    assert.equal(res.status, 400, `expected 400 for ${url}, got ${res.status}`);
  }
  const virtualIp = await api('/api/backup/targets', {
    method: 'POST',
    body: {
      name: 's3-ip-vhost',
      kind: 's3',
      schedule: 'manual',
      config: { endpoint: 'https://93.184.216.34', region: 'auto', bucket: 'bucket', accessKey: 'ak', secretKey: 'sk', directory: 'shendu', pathStyle: false }
    }
  });
  assert.equal(virtualIp.status, 400);
});

test('per-user rate limit resists X-Forwarded-For IP rotation under TRUST_PROXY=true', async () => {
  const exportLimiter = async index => api('/api/admin/site-backup/inspect', {
    method: 'POST',
    headers: { 'X-Forwarded-For': `203.0.113.${index}` },
    body: { encryptedBackup: '{}', backupPassword: password }
  });
  let hit429 = false;
  for (let i = 1; i <= 12; i++) {
    const res = await exportLimiter(i);
    if (res.status === 429) { hit429 = true; break; }
  }
  assert.equal(hit429, true, 'authenticated user rate limit should trip despite rotating X-Forwarded-For');
});

test('Unicode username collisions, unauthorized admin role edits, non-string period, and non-decision verify fields are guarded', async () => {
  // Unicode/NFKC collision with AuditOwner
  const dup = await api('/api/admin/users', { method: 'POST', body: { username: 'auditowner', password } });
  assert.equal(dup.status, 409);

  // Non-superadmin admin attempting to edit role gets 403
  const roleEscalation = await api(`/api/admin/users/${memberId}`, { method: 'PATCH', cookie: adminCookie, body: { role: 'admin' } });
  assert.equal(roleEscalation.status, 403);

  // Non-string period rejected with 400
  const badPeriod = await api('/api/records', { method: 'PUT', cookie: memberCookie, body: { type: 'daily', period: ['2026-11-26'], data: {} } });
  assert.equal(badPeriod.status, 400);

  // Non-decision verification ignores injected outcome/process
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
  const me = await api('/api/me', { cookie: memberCookie });
  const metrics = (me.value.stage?.metrics || []).map(m => ({ id: m.id, name: m.name, target: m.target, status: '达标', note: '完成' }));
  assert.equal((await api('/api/finance/day', { method: 'POST', cookie: memberCookie, body: { date: today, state: 'zero' } })).status, 200);
  const saved = await api('/api/records', {
    method: 'PUT',
    cookie: memberCookie,
    body: { type: 'daily', period: today, data: { metrics, answers: { today: ['完成审计测试'] }, action: '核对接口', ifCondition: '异常', ifThen: '回滚', verifyDate: today } }
  });
  assert.equal(saved.status, 200);
  const completed = await api(`/api/records/${saved.value.record.id}/complete`, { method: 'POST', cookie: memberCookie, body: { version: saved.value.record.version } });
  assert.equal(completed.status, 200, JSON.stringify(completed.value));
  const verified = await api(`/api/records/${saved.value.record.id}/verify`, {
    method: 'POST',
    cookie: memberCookie,
    body: { result: '已核对', adjustment: '保持现状', outcome: '好', process: '差' }
  });
  assert.equal(verified.status, 200, JSON.stringify(verified.value));
  assert.equal(verified.value.record.verification.outcome, null);
  assert.equal(verified.value.record.verification.process, null);
  assert.ok(adminId);
});

test('finance storage refuses to reuse stored secretKey when endpoint or accessKey changes', async () => {
  const initial = await api('/api/finance/storage', {
    method: 'PUT',
    cookie: memberCookie,
    body: {
      version: 0,
      config: { endpoint: 'https://93.184.216.34', region: 'auto', bucket: 'receipts', directory: 'shendu', accessKey: 'ak-one', secretKey: 'sk-secret-value', pathStyle: true }
    }
  });
  assert.equal(initial.status, 200);

  const changedEndpoint = await api('/api/finance/storage', {
    method: 'PUT',
    cookie: memberCookie,
    body: {
      version: initial.value.version,
      config: { endpoint: 'https://93.184.216.35', region: 'auto', bucket: 'receipts', directory: 'shendu', accessKey: 'ak-one', pathStyle: true }
    }
  });
  assert.equal(changedEndpoint.status, 400);
  assert.equal(changedEndpoint.value.error, 'finance_storage_invalid');

  const changedAccessKey = await api('/api/finance/storage', {
    method: 'PUT',
    cookie: memberCookie,
    body: {
      version: initial.value.version,
      config: { endpoint: 'https://93.184.216.34', region: 'auto', bucket: 'receipts', directory: 'shendu', accessKey: 'ak-two', pathStyle: true }
    }
  });
  assert.equal(changedAccessKey.status, 400);
  assert.equal(changedAccessKey.value.error, 'finance_storage_invalid');

  const testEndpointOracle = await api('/api/finance/storage/test', {
    method: 'POST',
    cookie: memberCookie,
    body: {
      version: initial.value.version,
      config: { endpoint: 'https://93.184.216.35', region: 'auto', bucket: 'receipts', directory: 'shendu', accessKey: 'ak-one', pathStyle: true }
    }
  });
  assert.equal(testEndpointOracle.status, 400);
  assert.equal(testEndpointOracle.value.error, 'finance_storage_invalid');
});

test('finance ledger rejects predated refunds, preserves zero on income-only days, and respects higher version during merge', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE users(id TEXT PRIMARY KEY)');
    let lastResponse = null;
    const ledger = createFinanceLedger({
      db,
      now: () => '2026-11-26T08:00:00.000Z',
      today: () => '2026-11-26',
      encryptData: value => JSON.stringify(value),
      decryptData: value => JSON.parse(value),
      dataScope: (...parts) => parts.join(':'),
      withActivity: (_userId, _action, _meta, fn) => fn(),
      readJson: async req => req.body,
      json: (_res, status, value) => { lastResponse = { status, value }; },
      error: (_res, status, message, code) => { lastResponse = { status, value: { message, error: code } }; }
    });
    const uid = randomUUID();
    db.prepare('INSERT INTO users(id) VALUES(?)').run(uid);
    const call = async (method, path, body = {}) => {
      lastResponse = null;
      await ledger.handle({ method, body }, {}, new URL('http://localhost' + path), { id: uid });
      return lastResponse;
    };

    const expRes = await call('POST', '/api/finance/entries', { id: randomUUID(), date: '2026-11-20', kind: 'expense', expression: '50', purpose: '午餐' });
    assert.equal(expRes.status, 201);
    await assert.rejects(
      () => call('POST', '/api/finance/entries', { id: randomUUID(), date: '2026-11-19', kind: 'refund', expression: '20', purpose: '退回午餐', refundOf: expRes.value.entry.id }),
      error => error.status === 400 && /不能早于原支出日期/.test(error.message)
    );

    // Income-only day marked explicitly as zero expense stays 'zero'
    const incRes = await call('POST', '/api/finance/entries', { id: randomUUID(), date: '2026-11-21', kind: 'income', expression: '1000', purpose: '工资' });
    assert.equal(incRes.status, 201);
    const dayRes = await call('POST', '/api/finance/day', { date: '2026-11-21', state: 'zero' });
    assert.equal(dayRes.status, 200);
    assert.equal(dayRes.value.day.state, 'zero');
    assert.equal(ledger.snapshot(uid, '2026-11-21').state, 'zero');

    // Merge import applies higher version even when imported updatedAt is slightly older (clock skew)
    const exp2Res = await call('POST', '/api/finance/entries', { id: randomUUID(), date: '2026-11-22', kind: 'expense', expression: '30', purpose: '打车' });
    assert.equal(exp2Res.status, 201);
    const exp2 = exp2Res.value.entry;
    const envelope = ledger.exportUser(uid);
    const cloned = structuredClone(envelope);
    const target = cloned.entries.find(item => item.id === exp2.id);
    target.purpose = '新版用途';
    target.version = exp2.version + 2;
    target.updatedAt = '2026-11-20T00:00:00.000Z';
    ledger.importUser(uid, cloned, { replace: false });
    const queried = await call('GET', '/api/finance?date=2026-11-22');
    const updated = queried.value.entries.find(item => item.id === exp2.id);
    assert.equal(updated.purpose, '新版用途');
    assert.equal(updated.version, exp2.version + 2);
  } finally {
    db.close();
  }
});

test('app.js weekValue computes ISO weeks accurately across 2026/2027 year boundaries', () => {
  const source = readFileSync(join(appDir, 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function isoDate(');
  const end = source.indexOf('function defaultPeriod(');
  assert.ok(start > 0 && end > start);
  const weekValue = runInNewContext(`${source.slice(start, end)}; weekValue`, { today: () => '2027-01-04' });
  assert.equal(weekValue('2026-11-26'), '2026-W48');
  assert.equal(weekValue('2027-01-01'), '2026-W53');
  assert.equal(weekValue('2027-01-04'), '2027-W01');
  assert.equal(weekValue('2027-01-10'), '2027-W01');
  assert.equal(weekValue('2027-12-30'), '2027-W52');
});

test('receipt JPEG header parser handles truncated/padding 0xFF bytes without RangeError', () => {
  const malformed = [
    Buffer.from([0xff, 0xd8, 0xff]),
    Buffer.from([0xff, 0xd8, 0xff, 0xff, 0xff, 0xff]),
    Buffer.from([0xff, 0xd8, 0xff, 0x01, 0xff, 0xd9]),
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01])
  ];
  for (const buf of malformed) {
    assert.throws(() => inspectReceiptImage(buf, 'image/jpeg'), err => !(err instanceof RangeError) && /格式/.test(err.message));
  }
});
