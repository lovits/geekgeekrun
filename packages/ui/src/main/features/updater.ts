import packageJson from '../../../package.json'
import os from 'node:os'
import { releasesApi } from '@geekgeekrun/utils/project-links.mjs'
import { selectReleaseUpdate } from '@geekgeekrun/utils/release-update.mjs'
import { NewReleaseInfo } from '../../common/types/update'

export const currentOsPlatform = os.platform()
export const checkUpdateForUi = async (): Promise<NewReleaseInfo | null> => {
  const response = await fetch(releasesApi, { headers: { Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`GitHub 检查更新失败（HTTP ${response.status}），请稍后重试`)
  return selectReleaseUpdate(await response.json(), packageJson.version, os.platform(), os.arch())
}
