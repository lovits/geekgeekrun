const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { Arch } = require('builder-util')

// Fetch into a temporary directory so a Windows build never replaces the Mac dependency.
module.exports = async context => {
  if (context.electronPlatformName !== 'win32') return
  const arch = Arch[context.arch]
  if (arch !== 'x64') throw new Error('Windows installer currently targets x64')
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-windows-native-'))
  try {
    const manifest = require('better-sqlite3/package.json')
    await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify(manifest))
    await promisify(execFile)(process.execPath, [require.resolve('prebuild-install/bin.js'), '--runtime=electron', `--target=${context.packager.info.framework.version}`, '--platform=win32', `--arch=${arch}`, '--force'], { cwd: directory, timeout: 180000 })
    const binary = path.join(directory, 'build/Release/better_sqlite3.node')
    const bytes = await fs.readFile(binary)
    if (bytes.toString('ascii', 0, 2) !== 'MZ' || bytes.readUInt16LE(bytes.readUInt32LE(0x3c) + 4) !== 0x8664) throw new Error('Invalid Windows x64 SQLite binary')
    const target = path.join(context.appOutDir, 'resources/app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node')
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.copyFile(binary, target)
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
}
