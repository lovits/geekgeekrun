import { jobFilterOptions, jobRegexPatterns, jobRegexFailures } from './job-filter-options.mjs'
import { internshipIssue, bossActivityIssue } from './job-screening.mjs'
import { matchJobWithResume } from './ai-job-match.mjs'

export function simulationCandidates(jobs, contactedIds = [], limit = 100) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('模拟数量必须为正整数')
  const seen = new Set(contactedIds)
  return jobs.filter(job => {
    if (!job.encryptJobId || seen.has(job.encryptJobId) || !job.description?.trim()) return false
    seen.add(job.encryptJobId)
    return true
  }).slice(0, limit).map(job => ({
    jobId: job.encryptJobId, company: job.companyName || '', jobName: job.jobName || '',
    city: job.address || '', positionName: job.positionName || '', description: job.description,
    experience: job.experienceName || '', sourceUpdatedAt: job.sourceUpdatedAt || '',
    bossName: job.bossName || '', bossTitle: job.bossTitle || '',
    jobType: job.jobType, invalidStatus: job.invalidStatus, salaryDesc: job.salaryDesc || '',
    bossActiveTimeDesc: job.bossActiveTimeDesc || '',
    snapshot: { ...job },
    url: `https://www.zhipin.com/job_detail/${encodeURIComponent(job.encryptJobId)}.html`,
    status: 'pending',
  }))
}

export function nextSimulationTarget(state, batchSize) {
  if (!Number.isSafeInteger(batchSize) || batchSize < 1) throw new Error('每批数量必须为正整数')
  const target = state.target || 0
  if (state.jobs.slice(0, target).some(job => ['pending', 'error'].includes(job.status))) return target
  return Math.min(state.jobs.length, target + Math.min(batchSize, state.jobs.length))
}

export async function simulateApplication(job, config, model, match = matchJobWithResume) {
  const { regex, enabled } = jobFilterOptions(config)
  const context = config.filterContext || {}
  const rules = []
  if (context.employmentType === '实习') {
    const issue = internshipIssue(job)
    if (issue) rules.push(issue)
  }
  const activityIssue = bossActivityIssue(job.bossActiveTimeDesc, context.activityCutoff)
  if (activityIssue && job.bossActiveTimeDesc) rules.push(activityIssue)
  if (regex.companies && context.companies?.length && !context.companies.some(name => job.company.toLowerCase().includes(name.toLowerCase()))) rules.push('不在期望公司名单中')
  try {
    if (regex.blockedCompanies && context.blockedCompaniesRegex?.trim() && new RegExp(context.blockedCompaniesRegex, 'im').test(job.company)) rules.push('命中屏蔽公司规则')
  } catch { return { status: 'error', reason: '屏蔽公司正则无效，请检查设置' } }
  const candidate = { bossInfo: { activeTimeDesc: job.bossActiveTimeDesc }, jobInfo: { encryptId: job.jobId, jobName: job.jobName, positionName: job.positionName, postDescription: job.description, jobType: job.jobType, experienceName: job.experience, invalidStatus: job.invalidStatus }, selectedJob: { brandName: job.company, cityName: job.city } }
  const patterns = jobRegexPatterns(context.regex || {}, config)
  try { for (const pattern of Object.values(patterns)) if (pattern?.trim()) new RegExp(pattern, 'im') }
  catch { return { status: 'error', reason: '岗位正则无效，请检查设置' } }
  rules.push(...jobRegexFailures(candidate.jobInfo, patterns, context.combinationLogic))
  if (rules.length) return { status: 'reject', reason: rules.join('；'), rulePass: false, aiEvaluated: false }
  if (!enabled) return { status: activityIssue ? 'verify' : 'recommend', reason: activityIssue || '已开启的规则通过，未启用AI检查', rulePass: true, aiEvaluated: false }
  try {
    const decision = await match(config, candidate, model)
    if (!Number.isInteger(decision.score)) return { status: 'error', reason: decision.reason || '模型未返回有效评分', rulePass: true, aiEvaluated: true }
    return { ...decision, status: decision.match ? activityIssue ? 'verify' : 'recommend' : 'reject', reason: [decision.reason, decision.match && activityIssue].filter(Boolean).join('；'), rulePass: true, aiEvaluated: true }
  } catch { return { status: 'error', reason: '模型调用失败，请重试', rulePass: true, aiEvaluated: true } }
}

// This runner only evaluates and saves a separate report; it has no browser or outreach dependency.
export async function runApplicationSimulation(state, config, model, save, match = matchJobWithResume) {
  if (!Number.isSafeInteger(state.target) || state.target < 1) throw new Error('模拟数量必须为正整数')
  state.running = true
  state.ownerPid = process.pid
  let writes = Promise.resolve()
  const checkpoint = () => {
    state.updatedAt = new Date().toISOString()
    const snapshot = JSON.parse(JSON.stringify(state))
    writes = writes.then(() => save(snapshot))
    return writes
  }
  const queue = state.jobs.slice(0, state.target).filter(job => ['pending', 'error'].includes(job.status))
  let cursor = 0
  try {
    await checkpoint()
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (cursor < queue.length) {
        const job = queue[cursor++]
        Object.assign(job, await simulateApplication(job, config, model, match), { evaluatedAt: new Date().toISOString() })
        await checkpoint()
      }
    }))
  } finally {
    state.running = false
    await checkpoint()
  }
  return state
}
