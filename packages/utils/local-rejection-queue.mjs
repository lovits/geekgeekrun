import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

// Persist a small queue entry before acknowledging it; database writes run serially.
export function createLocalRejectionQueue(directory, write, onError = console.error) {
  let tail = Promise.resolve()
  const failed = new Set()
  const schedule = file => {
    tail = tail.then(async () => {
      try {
        const payload = JSON.parse(await fs.readFile(file, 'utf8'))
        await write(payload)
        await fs.unlink(file)
        failed.delete(file)
      } catch (error) { failed.add(file); onError(error) }
    })
  }
  return {
    async recover() {
      await fs.mkdir(directory, { recursive: true, mode: 0o700 })
      for (const name of (await fs.readdir(directory)).filter(name => name.endsWith('.json')).sort()) schedule(path.join(directory, name))
    },
    async enqueue(payload) {
      // Clone before any await: the browser may change the current job immediately.
      const text = JSON.stringify(payload)
      await fs.mkdir(directory, { recursive: true, mode: 0o700 })
      const file = path.join(directory, Date.now() + '-' + randomUUID() + '.json')
      await fs.writeFile(file + '.tmp', text, { mode: 0o600 })
      await fs.rename(file + '.tmp', file)
      schedule(file)
    },
    async flush() {
      await tail
      for (const file of [...failed]) schedule(file)
      await tail
      if (failed.size) throw Object.assign(new Error(`本地不合适记录保存失败，${failed.size} 条已保留，下一次运行将重试`), { code: 'LOCAL_REJECTION_SAVE_FAILED' })
    }
  }
}
