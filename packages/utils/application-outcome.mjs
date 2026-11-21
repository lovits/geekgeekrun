// Simulated matches and confirmed real chats are different outcomes.
export function applicationOutcome(job) {
  if (job.status === 'chatted') return 'delivered'
  if (['pending', 'observed', 'error'].includes(job.status)) return null
  if (job.status === 'reject') return 'ineligible'
  if (job.match === false || job.rulePass === false) return 'ineligible'
  if (job.status === 'recommend' || (job.status === 'verify' && job.rulePass === true)) return 'eligible'
  return null
}

export function filterApplicationRecords(jobs, { outcome = 'all', score = 'all', reason = '', sortBy = '', sortOrder = '', date = '' } = {}) {
  const keyword = reason.trim().toLocaleLowerCase()
  const timestamp = job => {
    const date = Date.parse(job.recordedAt || job.evaluatedAt || job.chattedAt || job.sourceUpdatedAt || job.snapshot?.date || '')
    return Number.isFinite(date) ? date : -Infinity
  }
  return jobs.filter(job =>
    (!date || applicationRecordDay(job) === date) &&
    (outcome === 'all' || (outcome === 'failed' ? job.status === 'error' : applicationOutcome(job) === outcome)) &&
    (score === 'all' || (score === 'scored' ? Number.isFinite(job.score) : !Number.isFinite(job.score))) &&
    (!keyword || (job.reason || '').toLocaleLowerCase().includes(keyword))
  ).sort((a, b) => {
    if (['company', 'score', 'reason'].includes(sortBy) && ['ascending', 'descending'].includes(sortOrder)) {
      const av = a[sortBy], bv = b[sortBy]
      const emptyA = av == null || av === '' || (sortBy === 'score' && !Number.isFinite(av))
      const emptyB = bv == null || bv === '' || (sortBy === 'score' && !Number.isFinite(bv))
      if (emptyA !== emptyB) return emptyA ? 1 : -1
      if (!emptyA) {
        const groupOrder = sortBy === 'score' ? av - bv : String(av).localeCompare(String(bv), 'zh-CN', { sensitivity: 'base' })
        if (groupOrder) return sortOrder === 'descending' ? -groupOrder : groupOrder
      }
    }
    return timestamp(b) - timestamp(a)
  })
}
export function applicationRecordDay(job) {
  const value = job.recordedAt || job.evaluatedAt || job.chattedAt || job.sourceUpdatedAt || job.snapshot?.date
  if (typeof value !== 'string' || !value) return ''
  const normalized = value.replace(' ', 'T')
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : normalized + 'Z')
  if (!Number.isFinite(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
