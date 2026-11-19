import fs from 'node:fs'
import { randomUUID } from 'node:crypto'

export async function atomicWriteFile(file, content, { isSync = false } = {}) {
  const temp = file + '.' + randomUUID() + '.tmp'
  if (isSync) {
    try {
      fs.writeFileSync(temp, content, { mode: 0o600 })
      fs.renameSync(temp, file)
    } finally { fs.rmSync(temp, { force: true }) }
  } else {
    try {
      await fs.promises.writeFile(temp, content, { mode: 0o600 })
      await fs.promises.rename(temp, file)
    } finally { await fs.promises.rm(temp, { force: true }) }
  }
}
