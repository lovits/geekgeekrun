const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { Arch } = require('builder-util')

function verifyNativeBinary(bytes, platform, arch) {
  let valid = false
  if (platform === 'win32' && bytes.length >= 64 && bytes.toString('ascii', 0, 2) === 'MZ') {
    const offset = bytes.readUInt32LE(0x3c)
    valid = offset + 6 <= bytes.length && bytes.readUInt32LE(offset) === 0x4550 && bytes.readUInt16LE(offset + 4) === 0x8664 && arch === 'x64'
  } else if (platform === 'darwin' && bytes.length >= 8) {
    valid = bytes.readUInt32LE(0) === 0xfeedfacf && bytes.readUInt32LE(4) === ({ arm64: 0x100000c, x64: 0x1000007 })[arch]
  } else if (platform === 'linux' && bytes.length >= 20) {
    valid = bytes.toString('hex', 0, 4) === '7f454c46' && bytes[4] === 2 && bytes.readUInt16LE(18) === ({ arm64: 183, x64: 62 })[arch]
  }
  if (!valid) throw new Error(`Invalid ${platform} ${arch} SQLite binary`)
}

// Download per target into a temporary directory; never replace the host dependency.
module.exports = async context => {
  const platform = context.electronPlatformName
  const arch = Arch[context.arch]
  if (!['win32', 'darwin', 'linux'].includes(platform)) return
  if (!['x64', 'arm64'].includes(arch) || (platform === 'win32' && arch !== 'x64')) throw new Error(`Unsupported database target: ${platform} ${arch}`)
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ggr-native-'))
  try {
    const manifest = require('better-sqlite3/package.json')
    await fs.writeFile(path.join(directory, 'package.json'), JSON.stringify(manifest))
    await promisify(execFile)(process.execPath, [require.resolve('prebuild-install/bin.js'), '--runtime=electron', `--target=${context.packager.info.framework.version}`, `--platform=${platform}`, `--arch=${arch}`, '--force'], { cwd: directory, timeout: 180000 })
    const binary = path.join(directory, 'build/Release/better_sqlite3.node')
    verifyNativeBinary(await fs.readFile(binary), platform, arch)
    const resources = platform === 'darwin' ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app/Contents/Resources`) : path.join(context.appOutDir, 'resources')
    const target = path.join(resources, 'app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node')
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.copyFile(binary, target)
    if (platform === 'darwin') {
      const app = path.dirname(path.dirname(resources))
      await promisify(execFile)('codesign', ['--force', '--deep', '--sign', '-', app])
      await promisify(execFile)('codesign', ['--verify', '--deep', '--strict', app])
      console.log(`Ad-hoc signature verified: ${arch}`)
    }
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
}
module.exports.verifyNativeBinary = verifyNativeBinary
