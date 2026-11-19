import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { findCodex } from './codex-request.mjs'
import { codexContextLimits } from './codex-context.mjs'

export async function listCodexModels({ binary, timeout = 20000 } = {}) {
  const executable = binary || await findCodex()
  const result = await new Promise((resolve, reject) => {
    const child = spawn(executable, ['app-server', '--listen', 'stdio://'], { stdio: ['pipe', 'pipe', 'ignore'] })
    const lines = createInterface({ input: child.stdout })
    let finished = false
    const models = []
    const cursors = new Set()
    const timer = setTimeout(() => finish(new Error('读取Codex模型列表超时，请刷新或检查登录')), timeout)
    function finish(error) {
      if (finished) return
      finished = true
      clearTimeout(timer)
      lines.close()
      child.stdin.destroy()
      child.kill()
      if (error) reject(error)
      else resolve(models.filter(model => !model.hidden).map(model => ({ id: model.model || model.id, displayName: model.displayName, isDefault: model.isDefault, defaultReasoningEffort: model.defaultReasoningEffort, supportedReasoningEfforts: model.supportedReasoningEfforts || [] })))
    }
    function send(message) { child.stdin.write(JSON.stringify(message) + '\n') }
    child.on('error', () => finish(new Error('无法启动Codex CLI，请检查安装')))
    child.stdin.on('error', () => finish(new Error('Codex模型列表连接中断')))
    child.on('exit', () => { if (!finished) finish(new Error('Codex在返回模型列表前退出')) })
    lines.on('line', line => {
      let message
      try { message = JSON.parse(line) } catch { return }
      if (message.error) { finish(new Error('Codex模型列表请求失败')); return }
      if (message.id === 1) {
        send({ method: 'initialized' })
        send({ id: 2, method: 'model/list', params: { limit: 100 } })
      } else if (message.id === 2) {
        if (!Array.isArray(message.result?.data)) { finish(new Error('Codex模型列表格式无效')); return }
        models.push(...message.result.data)
        const cursor = message.result.nextCursor
        if (cursor && !cursors.has(cursor)) { cursors.add(cursor); send({ id: 2, method: 'model/list', params: { limit: 100, cursor } }) }
        else finish()
      }
    })
    send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'geekgeekrun', version: '0.17.4' }, capabilities: { experimentalApi: true } } })
  })
  return Promise.all(result.map(async model => ({ ...model, contextLimits: await codexContextLimits(model.id) })))
}
