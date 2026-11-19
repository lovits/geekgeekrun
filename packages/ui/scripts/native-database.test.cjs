const test = require('node:test')
const assert = require('node:assert/strict')
const { verifyNativeBinary } = require('./native-database.cjs')

test('database target validation rejects host binaries and truncated files', () => {
  const macho = Buffer.alloc(32)
  macho.writeUInt32LE(0xfeedfacf, 0)
  for (const [arch, cpu] of [['arm64', 0x100000c], ['x64', 0x1000007]]) {
    macho.writeUInt32LE(cpu, 4)
    verifyNativeBinary(macho, 'darwin', arch)
    assert.throws(() => verifyNativeBinary(macho, 'darwin', arch === 'x64' ? 'arm64' : 'x64'))
    assert.throws(() => verifyNativeBinary(macho, 'win32', 'x64'))
  }
  const pe = Buffer.alloc(128)
  pe.write('MZ'); pe.writeUInt32LE(64, 0x3c); pe.writeUInt32LE(0x4550, 64); pe.writeUInt16LE(0x8664, 68)
  verifyNativeBinary(pe, 'win32', 'x64')
  assert.throws(() => verifyNativeBinary(pe, 'win32', 'arm64'))
  pe.writeUInt32LE(0xffffffff, 0x3c)
  assert.throws(() => verifyNativeBinary(pe, 'win32', 'x64'), /Invalid/)
  const elf = Buffer.alloc(32); Buffer.from('7f454c46', 'hex').copy(elf); elf[4] = 2; elf.writeUInt16LE(62, 18)
  verifyNativeBinary(elf, 'linux', 'x64')
  assert.throws(() => verifyNativeBinary(elf, 'linux', 'arm64'))
  for (const platform of ['win32', 'darwin', 'linux']) assert.throws(() => verifyNativeBinary(Buffer.alloc(2), platform, 'x64'), /Invalid/)
})
