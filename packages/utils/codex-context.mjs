import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export async function codexContextLimits(model, directory = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')) {
  for (const file of ['models_cache.json', 'models_cache.codex_work_desktop.json']) {
    try {
      const catalog = JSON.parse(await fs.readFile(path.join(directory, file), 'utf8'))
      const metadata = catalog.models?.find(item => item.slug === model)
      const defaultTokens = metadata?.context_window
      const maxTokens = metadata?.max_context_window || defaultTokens
      if (Number.isSafeInteger(defaultTokens) && defaultTokens > 0 && Number.isSafeInteger(maxTokens) && maxTokens >= defaultTokens) {
        return { minTokens: Math.min(4096, defaultTokens), defaultTokens, maxTokens }
      }
    } catch (error) { if (!(error instanceof SyntaxError) && error.code !== 'ENOENT') throw error }
  }
  return null
}

export function validateContextWindow(value, limits) {
  if (value == null || value === 0) return
  if (!limits || !Number.isSafeInteger(value) || value < limits.minTokens || value > limits.maxTokens) throw new Error('上下文长度超出当前模型可设置的范围')
  return value
}
