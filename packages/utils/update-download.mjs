import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createHash, randomUUID } from 'node:crypto'
import { projectRepository } from './project-links.mjs'

export async function downloadReleaseAsset(release, directory, { request = fetch } = {}) {
  const name = release.assetName
  if (!name || path.basename(name) !== name || !/\.(exe|dmg|deb)$/i.test(name)) throw new Error('安装包文件名无效')
  const url = new URL(release.assetUrl)
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || !url.pathname.startsWith(`/${projectRepository}/releases/download/`)) throw new Error('安装包必须来自个人仓库的 GitHub Release')
  await fs.mkdir(directory, { recursive: true })
  const target = path.join(directory, name), partial = target + '.' + randomUUID() + '.part'
  try {
    const response = await request(url, { signal: AbortSignal.timeout(10 * 60 * 1000) })
    if (!response.ok || !response.body) throw new Error(`下载安装包失败（HTTP ${response.status}）`)
    const hash = createHash('sha256')
    let count = 0
    async function* chunks() {
      for await (const chunk of Readable.fromWeb(response.body)) { count += chunk.length; hash.update(chunk); yield chunk }
    }
    await pipeline(chunks(), createWriteStream(partial, { flags: 'wx', mode: 0o600 }))
    const size = Number(response.headers.get('content-length'))
    if (!count || (size && count !== size)) throw new Error('安装包下载不完整，请重试')
    const digest = hash.digest('hex')
    if (release.assetDigest && release.assetDigest !== 'sha256:' + digest) throw new Error('安装包校验失败，请重试')
    await fs.rename(partial, target)
    return { path: target, sha256: digest, version: release.releaseVersion }
  } finally { await fs.rm(partial, { force: true }) }
}
