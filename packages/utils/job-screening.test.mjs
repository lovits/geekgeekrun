import test from 'node:test'
import assert from 'node:assert/strict'
import { internshipIssue, bossActivityIssue } from './job-screening.mjs'
import { simulateApplication } from './application-simulation.mjs'
import { jobRegexFailures } from './job-filter-options.mjs'

test('all internship seasons and monthly-paid internships qualify; formal jobs and incidental experience do not', () => {
  for (const name of ['日常实习', '寒假实习', '暑期实习', '在读实习', '转正实习', 'Backend Intern']) {
    assert.equal(internshipIssue({ jobName: name, salaryDesc: '5-8K' }), '')
  }
  assert.equal(internshipIssue({ jobName: 'AI应用工程师', jobType: 4 }), '')
  assert.equal(internshipIssue({ jobName: '后端工程师', description: '在读本科，可连续实习三个月' }), '')
  for (const job of [
    { jobName: '后端工程师', jobType: 0, description: '有实习经历优先' },
    { jobName: '校招后端工程师', description: '招聘应届生' },
    { jobName: '后端工程师', description: '有实习经历优先', salaryDesc: '300元/天' },
    { jobName: '后端实习', invalidStatus: true },
  ]) assert.ok(internshipIssue(job))
})

test('three-day activity includes the boundary, fails old activity, and preserves unknown state', () => {
  for (const text of ['3日内活跃', '昨日活跃', '今日活跃', '刚刚活跃']) assert.equal(bossActivityIssue(text, 9), '')
  assert.match(bossActivityIssue('本周活跃', 9), /不满足/)
  assert.match(bossActivityIssue('', 9), /未记录/)
  assert.equal(bossActivityIssue('', 0), '')
})

test('simulation records concrete exclusions without AI; unknown activity cannot become a verified recommendation', async () => {
  const config = { aiFilters: { jobName: true }, filterContext: { employmentType: '实习', activityCutoff: 9 } }
  const candidate = { jobName: 'Agent开发暑期实习', jobType: 4, description: 'Agent服务开发' }
  const yes = async () => ({ match: true, score: 80, reason: 'Agent工程实践匹配' })
  assert.equal((await simulateApplication(candidate, config, {}, yes)).status, 'verify')
  assert.equal((await simulateApplication({ ...candidate, bossActiveTimeDesc: '3日内活跃' }, config, {}, yes)).status, 'recommend')
  for (const job of [{ ...candidate, jobType: 0 }, { ...candidate, bossActiveTimeDesc: '本月活跃' }]) {
    const result = await simulateApplication(job, config, {}, () => assert.fail('must not call'))
    assert.equal(result.status, 'reject')
    assert.equal(result.aiEvaluated, false)
    assert.ok(!result.reason.includes('岗位正则'))
  }
  assert.match(jobRegexFailures({ jobName: '产品经理实习' }, { jobName: '后端' })[0], /岗位名称.*产品经理实习/)
  assert.deepEqual(jobRegexFailures({ jobName: 'Agent', positionName: '算法' }, { jobName: 'Agent', positionName: '后端' }, 2), [])
})
