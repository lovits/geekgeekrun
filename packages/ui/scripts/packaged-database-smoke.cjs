const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createRequire } = require('node:module')
const requireApp = createRequire(path.resolve(process.argv[2], 'package.json'))
const Database = requireApp('better-sqlite3')
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'GeekGeekRun Pro 中文路径 '))
try {
  const db = new Database(path.join(directory, 'test.db'))
  try {
    db.exec('CREATE TABLE smoke (value TEXT)')
    db.prepare('INSERT INTO smoke VALUES (?)').run('Windows 10/11')
    assert.equal(db.prepare('SELECT value FROM smoke').get().value, 'Windows 10/11')
  } finally { db.close() }
  console.log(process.platform + ' packaged SQLite / Chinese path smoke passed; Electron ABI ' + process.versions.modules)
} finally { fs.rmSync(directory, { recursive: true, force: true }) }
