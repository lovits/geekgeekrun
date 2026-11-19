import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { randomUUID } from 'node:crypto'

const directory = path.join(os.homedir(), '.geekgeekrun/storage/resumes')
export function resumeDocumentPath(id, root = directory) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}\.pdf$/.test(id)) throw new Error('没有可预览的原始PDF，请重新选择简历文件')
  return path.join(root, id)
}
export async function saveResumeDocument(file, root = directory) {
  if (path.extname(file).toLowerCase() !== '.pdf') return ''
  const stat = await fs.stat(file)
  if (stat.size > 10 * 1024 * 1024) throw new Error('简历文件不能超过10MB')
  const handle = await fs.open(file, 'r')
  try {
    const header = Buffer.alloc(5)
    await handle.read(header, 0, 5, 0)
    if (header.toString() !== '%PDF-') throw new Error('请选择有效的PDF简历')
  } finally { await handle.close() }
  await fs.mkdir(root, { recursive: true, mode: 0o700 })
  const id = randomUUID() + '.pdf'
  const destination = resumeDocumentPath(id, root)
  await fs.copyFile(file, destination)
  await fs.chmod(destination, 0o600)
  return id
}
