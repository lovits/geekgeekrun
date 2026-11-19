import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export const onlineSimulationFile = path.join(os.homedir(), '.geekgeekrun/storage/online-application-simulation.json')
export const onlineSimulationWorker = 'geekSimulateApplications'

export function onlineSimulationRunning(state) {
  if (!state?.running) return false
  if (!state.ownerPid) return true
  try { process.kill(state.ownerPid, 0); return true } catch { return false }
}

export function createOnlineSimulation(limit, onProgress = async () => {}) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('在线模拟数量必须为正整数')
  const processed = new Set()
  return {
    summary: () => ({ processed: processed.size, target: limit }),
    async complete(jobId) {
      if (!jobId) throw new Error('在线模拟缺少岗位ID')
      if (!processed.has(jobId)) {
        processed.add(jobId)
        await onProgress({ processed: processed.size, target: limit })
      }
      if (processed.size >= limit) throw new Error('ONLINE_SIMULATION_COMPLETE')
    }
  }
}

export async function readOnlineSimulation(file = onlineSimulationFile) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return null; throw error }
}

export async function saveOnlineSimulation(state, file = onlineSimulationFile) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temporary = file + '.' + process.pid + '.tmp'
  await fs.writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 })
  await fs.rename(temporary, file)
}
