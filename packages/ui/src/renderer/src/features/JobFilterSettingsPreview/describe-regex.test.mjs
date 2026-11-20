import test from 'node:test'
import assert from 'node:assert/strict'
import { describeRegex } from './describe-regex.mjs'

test('shows complete, plain job expressions and keeps exclusions separate', () => {
  const value = describeRegex('^(?![\\s\\S]*(?:产品|销售))(?=[\\s\\S]*(?:后\\s*端|Agent[ -]*(?:应用[ -]*)?(?:开发|评测)))[\\s\\S]*$')
  assert.equal(value.complete, true)
  assert.deepEqual(value.rules[0].items, ['产品', '销售'])
  assert.deepEqual(value.rules[1].items, ['后端', 'Agent开发', 'Agent评测', 'Agent应用开发', 'Agent应用评测'])
  assert.doesNotMatch(JSON.stringify(value), /任选|可选|连续|第1组|\[\\\\s/)
})
test('preserves algorithm exception, company alternatives and literal plus signs', () => {
  const value = describeRegex('^(?!^(?![\\s\\S]*(?:Agent|智能体))[\\s\\S]*算法)[\\s\\S]*$')
  assert.match(value.rules[0].label, /算法.*至少一个方向词/)
  assert.deepEqual(value.rules[0].items, ['Agent', '智能体'])
  assert.deepEqual(describeRegex('微软|Google|C\\+\\+').rules[0].items, ['微软', 'Google', 'C++'])
})
test('explains years, nearby development duties and two distinct matches without parser jargon', () => {
  const value = describeRegex('^(?![\\s\\S]*(?:(?:2026|26)\\s*(?:届|年毕业)))(?=[\\s\\S]*?(代码|(?:系统|服务)[^。；\\n]{0,20}(?:开发|研发))[\\s\\S]*?(?!\\1)(?:代码|(?:系统|服务)[^。；\\n]{0,20}(?:开发|研发)))[\\s\\S]*$')
  assert.equal(value.complete, true)
  assert.deepEqual(value.rules[0].items, ['2026届或当年毕业'])
  assert.equal(value.rules[1].label, '正文至少匹配两处')
  assert.match(value.rules[1].items[1], /先出现系统、服务.*再出现开发、研发.*不超过20字/)
  assert.doesNotMatch(JSON.stringify(value), /任选|可选|除以下|连续|第1组/)
  assert.equal(describeRegex('').empty, true)
  assert.equal(describeRegex('[').complete, false)
})

test('preview follows changed rules rather than retaining personal words or the two-match explanation', () => {
  const pair = describeRegex('^(?=[\\s\\S]*?(销售|管理)[\\s\\S]*?(?!\\1)(?:销售|管理))[\\s\\S]*$')
  assert.deepEqual(pair.rules[0].items, ['销售', '管理'])
  assert.equal(pair.rules[0].label, '正文至少匹配两处')
  assert.doesNotMatch(JSON.stringify(pair), /技术|Agent|后端/)
  const single = describeRegex('^(?=[\\s\\S]*(?:设计|运营))[\\s\\S]*$')
  assert.deepEqual(single.rules[0].items, ['设计', '运营'])
  assert.doesNotMatch(JSON.stringify(single), /两处|销售|管理|后端/)
})

test('work experience preview explains schedules from the expression without changing other previews', () => {
  const source = String.raw`在校|应届|\d+\s*天\s*[/／]\s*周\s*[,，、;；]?\s*\d+(?:\s*[-～~至]\s*\d+)?\s*(?:个)?月`
  const value = describeRegex(source, { workExperience: true })
  assert.equal(value.complete, true)
  assert.deepEqual(value.rules[0].items, ['在校', '应届', '每周若干天，持续若干个月；月数也可写为范围，例如“3-6个月”'])
  assert.doesNotMatch(JSON.stringify(value), /尚未解读|编辑页|免检/)
  assert.equal(describeRegex(source).complete, false)
})

test('work experience preview follows edited amounts, choices, grouping and separators', () => {
  for (const [source, expected] of [
    [String.raw`^应届$|^5天/周\s*6个月$`, ['应届', '每周5天，持续6个月']],
    [String.raw`^(?:在读|[3-5]天／周\s*(?:3|6)个月)$`, ['在读', '每周3至5天，持续3或6个月']],
    [String.raw`应届|\d+天/周\d+个月`, ['应届', '每周若干天，持续若干个月']],
    ['应届|经验不限', ['应届', '经验不限']]
  ]) {
    const value = describeRegex(source, { workExperience: true })
    assert.equal(value.complete, true, source)
    assert.deepEqual(value.rules[0].items, expected)
  }
  assert.equal(describeRegex('[', { workExperience: true }).complete, false)
})

test('work experience preview does not mistake non-digit or non-space constraints for a schedule', () => {
  for (const source of [String.raw`\D+天/周\d+个月`, String.raw`\d+\S+天/周\d+个月`]) {
    assert.equal(describeRegex(source, { workExperience: true }).complete, false)
  }
})
