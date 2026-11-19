export function formatJobSalary(job = {}) {
  if (job.salaryDesc?.trim()) return job.salaryDesc.trim()
  if (!Number.isFinite(job.salaryLow) || !Number.isFinite(job.salaryHigh)) return '未记录'
  return `${job.salaryLow}-${job.salaryHigh}k` + (job.salaryMonth ? `* ${job.salaryMonth}薪` : '')
}
