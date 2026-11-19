import test from 'node:test'
import assert from 'node:assert/strict'
import { parseResumeWithAi } from './resume-ai-parser.mjs'
test('keeps original text and uncertainty notes alongside the AI transcription', async () => {
  const parsed = await parseResumeWithAi('原始：Go 网关 10K QPS', { provider: 'openai' }, { request: async (config, messages) => {
    assert.equal(config.maxTokens, 12000)
    assert.ok(messages[0].content.includes('不能改写'))
    return { choices: [{ message: { content: '{"resumeMarkdown":"# 经历\nGo 网关 10K QPS","uncertainties":["请核对时间"]}' .replace(/\n/g, '\\n') } }] }
  } })
  assert.equal(parsed.resumeSourceText, '原始：Go 网关 10K QPS')
  assert.deepEqual(parsed.resumeParsingNotes, ['请核对时间'])
})
test('invalid parsing output is rejected instead of replacing the resume', async () => {
  await assert.rejects(parseResumeWithAi('原文', {}, { request: async () => ({ choices: [{ message: { content: 'bad' } }] }) }), /格式无效/)
})
