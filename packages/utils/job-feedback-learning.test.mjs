import test from 'node:test'
import assert from 'node:assert/strict'
import { hasConfiguredLlm, learnJobPreferences } from './job-feedback-learning.mjs'
import { matchingPayload, matchJobWithResume } from './ai-job-match.mjs'
import { applyFeedbackScore } from './job-feedback.mjs'
import { matchInputSources } from './job-filter-options.mjs'

test('feedback is unavailable without an enabled configured model', async () => {
  for (const model of [null, {}, { provider: 'openai', model: 'x' }, { provider: 'codex-cli', enabled: false }]) assert.equal(hasConfiguredLlm(model), false)
  assert.equal(hasConfiguredLlm({ provider: 'codex-cli', enabled: true }), true)
  await assert.rejects(learnJobPreferences([], '', null), /配置并启用/)
})

test('unmarked and cancelled jobs produce no learned preference or score change', async () => {
  const noRequest = () => { throw Error('must not call') }
  assert.equal(await learnJobPreferences([], '', { provider: 'codex-cli' }, noRequest), '')
  assert.equal(await learnJobPreferences([{ value: 'neutral' }], '', { provider: 'codex-cli' }, noRequest), '')
  assert.deepEqual(applyFeedbackScore({ score: 85, match: true }, null), { score: 85, match: true, baseScore: 85, feedbackAdjustment: 0 })
})

test('learning uses explicit feedback and preserves manual preferences as a separate input', async () => {
  const learned = await learnJobPreferences([{ value: 'like', jobName: 'Agent开发', description: 'RAG工具调用' }, { value: 'neutral', jobName: 'ignore' }], '只找实习', { provider: 'codex-cli', contextWindowTokens: 32000 }, async (settings, messages) => {
    assert.equal(settings.contextWindowTokens, 32000)
    const input = JSON.parse(messages[1].content)
    assert.equal(input.manualPreferences, '只找实习')
    assert.equal(input.feedback.length, 1)
    return { choices: [{ message: { content: '{"learnedPreferences":"倾向RAG工具开发，依据一条喜欢记录"}' } }] }
  })
  const data = matchingPayload({ enabled: true, preferences: '只找实习', learnedPreferences: learned }, {})
  assert.equal(data.preferences, '只找实习')
  assert.equal(data.learnedPreferences, learned)
  assert.ok(!('learnedPreferences' in matchingPayload({ learnedPreferences: learned, inputSources: { feedback: false } }, {})))
})

test('disabling feedback removes exact dislike and historical influence', async () => {
  const result = await matchJobWithResume({ enabled: true, resumeText: 'Python', preferences: '实习', learnedPreferences: 'should not send', inputSources: { feedback: false }, feedbackRecords: [{ jobId: 'one', value: 'dislike' }] }, { jobInfo: { encryptId: 'one', postDescription: 'Python开发实习' } }, { provider: 'codex-cli' }, async (_, messages) => {
    const data = JSON.parse(messages[1].content)
    assert.ok(!('feedbackExamples' in data)); assert.ok(!('learnedPreferences' in data))
    return { choices: [{ message: { content: '{"match":true,"score":80,"criteriaSummary":[],"reason":"匹配","gaps":[]}' } }] }
  })
  assert.equal(result.match, true)
  assert.equal(result.feedbackAdjustment, 0)
})

test('defaults include only resume, preferences, employment/traversal and feedback', () => {
  assert.deepEqual(matchInputSources(), { resume: true, preferences: true, employmentAndTraversal: true, feedback: true, activity: true, regexRules: false, pageFilters: false, companyRules: false })
})
