import { jobExperienceIssue } from './job-screening.mjs'

export function jobFilterOptions(config = {}) {
  const legacyAi = config.enabled === true
  const regex = { experienceName: false, jobName: true, positionName: true, postDescription: !legacyAi, companies: true, blockedCompanies: true, ...config.regexFilters }
  const ai = { jobName: false, postDescription: legacyAi, ...config.aiFilters }
  for (const options of [regex, ai]) {
    for (const key of Object.keys(options)) if (typeof options[key] !== 'boolean') throw new Error('筛选开关必须为布尔值')
  }
  return { regex, ai, enabled: ai.jobName || ai.postDescription }
}

export function jobRegexPatterns(patterns, config) {
  const { regex } = jobFilterOptions(config)
  return Object.fromEntries(Object.entries(patterns).map(([field, pattern]) => [field, regex[field] ? pattern : '']))
}

export function testJobRegex(job, patterns, matchLogic = 1) {
  try {
    if (jobExperienceIssue(job, patterns.experienceName)) return false
    const active = Object.entries(patterns).filter(([field, pattern]) => field !== 'experienceName' && pattern?.trim())
    if (!active.length) return true
    const results = active.map(([field, pattern]) => new RegExp(pattern, 'im').test(job[field]?.replace(/\n/g, '') || ''))
    return matchLogic === 2 ? results.some(Boolean) : results.every(Boolean)
  } catch { return false }
}

export function jobRegexFailures(job, patterns, matchLogic = 1) {
  if (testJobRegex(job, patterns, matchLogic)) return []
  const experienceIssue = jobExperienceIssue(job, patterns.experienceName)
  const labels = { jobName: '岗位名称', positionName: '职位分类', postDescription: '岗位描述' }
  return [experienceIssue, ...Object.entries(patterns).filter(([field, pattern]) => field !== 'experienceName' && pattern?.trim()).flatMap(([field, pattern]) => {
    try {
      if (new RegExp(pattern, 'im').test(job[field]?.replace(/\n/g, '') || '')) return []
      return [`${labels[field] || field}未通过已开启的规则${field === 'postDescription' ? '，需核对职责关键词或排除条件' : `：“${job[field] || '未提供'}”`}`]
    } catch { return [`${labels[field] || field}规则无效`] }
  })].filter(Boolean)
}

export function matchInputSources(config = {}) {
  const sources = { resume: true, preferences: true, employmentAndTraversal: true, regexRules: false, pageFilters: false, companyRules: false, feedback: true, activity: true, ...config.inputSources }
  for (const value of Object.values(sources)) if (typeof value !== 'boolean') throw new Error('输入开关必须为布尔值')
  return sources
}
export function hasRequiredMatchInputs(config = {}) {
  const sources = matchInputSources(config)
  return (!sources.resume || Boolean(config.resumeText?.trim())) && (!sources.preferences || Boolean(config.preferences?.trim()))
}

export function mergeJobFilterSettings(config, patch) {
  const current = jobFilterOptions(config)
  const options = jobFilterOptions({ ...config, regexFilters: { ...current.regex, ...patch.regexFilters }, aiFilters: { ...current.ai, ...patch.aiFilters } })
  return { ...config, enabled: options.enabled, regexFilters: options.regex, aiFilters: options.ai, inputSources: matchInputSources({ inputSources: { ...matchInputSources(config), ...patch.inputSources } }) }
}
