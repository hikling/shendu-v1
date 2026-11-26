import { openSync, closeSync, writeFileSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, createDecipheriv } from 'node:crypto';

export function validBase64(value, bytes) {
  if (typeof value !== 'string' || !value.length || (bytes !== undefined && value.length !== Math.ceil(bytes / 3) * 4) || value.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) return false;
  const decoded = Buffer.from(value, 'base64');
  return (bytes === undefined || decoded.length === bytes) && decoded.toString('base64') === value;
}

// Write beside the destination so a failed/interrupted write cannot truncate its previous contents.
export function atomicWriteFile(file, contents) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  let fd;
  try {
    fd = openSync(temporary, 'wx', 0o600);
    writeFileSync(fd, contents); fsyncSync(fd); closeSync(fd); fd = undefined;
    renameSync(temporary, file);
    // Windows does not support opening/syncing directories through this fs API.
    // The file itself was synced before rename; keep the directory sync on POSIX.
    if (process.platform !== 'win32') {
      const directory = openSync(dirname(file), 'r');
      try { fsyncSync(directory); } finally { closeSync(directory); }
    }
  } finally {
    if (fd !== undefined) closeSync(fd);
    try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

// A syntactically valid key is not enough: authenticate every encrypted field in the snapshot.
export function validateSnapshotDatabase(db, keyHex) {
  if (!/^[a-f0-9]{64}$/i.test(keyHex)) throw new Error('快照缺少有效的内部数据加密密钥');
  db.exec('PRAGMA trusted_schema = OFF;');
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type IN ('trigger','view')").get()) throw new Error('快照数据库包含不支持的触发器或视图');
  const integrity = db.prepare('PRAGMA integrity_check').all();
  if (integrity.length !== 1 || Object.values(integrity[0])[0] !== 'ok' || db.prepare('PRAGMA foreign_key_check').all().length) throw new Error('快照数据库完整性校验失败');
  const key = Buffer.from(keyHex, 'hex');
  const encrypted = db.prepare("SELECT value FROM schema_meta WHERE key='data_encryption'").get()?.value === 'AES-256-GCM';
  const content = (value, scope) => {
    if (!String(value).startsWith('sd1.')) {
      if (encrypted) throw new Error('快照中的加密字段缺失');
      if (!scope.endsWith(':title')) JSON.parse(value);
      return;
    }
    const parts = value.split('.'); if (parts.length !== 4) throw new Error('快照中的加密字段格式无效');
    const iv = Buffer.from(parts[1], 'base64url');
    if (iv.length !== 12) throw new Error('快照中的加密字段 IV 无效');
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    decipher.setAAD(Buffer.from(`shendu:data:v1:${scope}`)); decipher.setAuthTag(Buffer.from(parts[2], 'base64url'));
    JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64url')), decipher.final()]).toString('utf8'));
  };
  const credential = (value, expectedScope = null) => {
    const x = JSON.parse(value), iv = Buffer.from(x.iv, 'base64');
    if (iv.length !== 12) throw new Error('快照中的凭据 IV 无效');
    const decipher = createDecipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    if (x.v === 2) {
      if (!expectedScope) throw new Error('快照中的凭据作用域缺失');
      decipher.setAAD(Buffer.from(`shendu:secret:v2:${expectedScope}`));
    }
    decipher.setAuthTag(Buffer.from(x.tag, 'base64'));
    JSON.parse(Buffer.concat([decipher.update(Buffer.from(x.data, 'base64')), decipher.final()]).toString('utf8'));
  };
  try {
    for (const row of db.prepare('SELECT id,user_id,title,data,verification FROM records').all()) {
      for (const field of ['title', 'data', 'verification']) if (field !== 'verification' || row[field] !== null) content(row[field], `record:${row.user_id}:${row.id}:${field}`);
    }
    for (const row of db.prepare('SELECT user_id,key,value FROM user_settings').all()) {
      if (row.key === 'backup_secret') { const wrapped = JSON.parse(row.value); if (wrapped) credential(wrapped, `backup-secret:${row.user_id}`); }
      else content(row.value, `setting:${row.user_id}:${row.key}`);
    }
    const targetCols = new Set(db.prepare('PRAGMA table_info(backup_targets)').all().map(col => col.name));
    if (targetCols.has('id') && targetCols.has('user_id')) {
      for (const row of db.prepare('SELECT id,user_id,encrypted_config FROM backup_targets').all()) credential(row.encrypted_config, `backup-target:${row.user_id}:${row.id}`);
    } else {
      for (const row of db.prepare('SELECT encrypted_config FROM backup_targets').all()) credential(row.encrypted_config);
    }
    // Older snapshots predate finance. Authenticate every field when its table
    // exists, using the same owner/identity AAD as the live ledger and receipts.
    for (const [table, identity, scope, suffix] of [
      ['finance_entries', 'id', 'finance-entry', ''],
      ['finance_categories', 'id', 'finance-category', ''],
      ['finance_days', 'date', 'finance-day', ''],
      ['finance_receipts', 'id', 'finance-receipt', ':data']
    ]) {
      if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)) continue;
      for (const row of db.prepare(`SELECT user_id,${identity} AS identity,data FROM ${table}`).all()) {
        content(row.data, `${scope}:${row.user_id}:${row.identity}${suffix}`);
      }
    }
  } catch {
    throw new Error('内部密钥与快照数据库不匹配，或加密数据损坏；操作已停止');
  }
}
