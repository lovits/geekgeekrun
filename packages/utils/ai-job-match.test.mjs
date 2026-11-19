import test from 'node:test'
import assert from 'node:assert/strict'
import { matchJobWithResume } from './ai-job-match.mjs'
const config = { enabled: true, resumeText: 'Go网关、Python Agent与RAG开发', preferences: '只要技术实习，不要产品与校招' }
const candidate = { jobInfo: { jobName: '后端实习', postDescription: 'Python后端开发，协助产品人员细化需求，在读实习生' } }
const model = { provider: 'codex-cli', model: '' }
test('passes resume and preferences to the configured model and preserves evidence', async () => {
  const result = await matchJobWithResume(config, candidate, model, async (provider, messages) => {
    assert.equal(provider.provider, 'codex-cli')
    const data = JSON.parse(messages[1].content)
    assert.equal(data.resume, config.resumeText)
    assert.equal(data.preferences, config.preferences)
    assert.equal(data.job.postDescription, candidate.jobInfo.postDescription)
    return { choices: [{ message: { content: '{"match":true,"score":85,"criteriaSummary":["技术实习"],"reason":"Python后端实习与项目匹配","gaps":[]}' } }] }
  })
  assert.equal(result.match, true)
})
test('missing evidence never calls model', async () => {
  const result = await matchJobWithResume({ ...config, resumeText: '' }, candidate, model, () => { throw Error('must not call') })
  assert.equal(result.match, false)
})
test('model rejection, malformed output and unavailable service cannot approve a job', async () => {
  for (const content of ['{"match":false,"score":20,"criteriaSummary":["技术实习"],"reason":"全职校招非实习","gaps":[]}', '{"match":"true","reason":"ok","gaps":[]}', '同意', '{"match":true}']) {
    assert.equal((await matchJobWithResume(config, candidate, model, async () => ({ choices: [{ message: { content } }] }))).match, false)
  }
  assert.equal((await matchJobWithResume(config, candidate, model, async () => { throw Error('network') })).match, false)
})
