import { activeDescList } from '../geek-auto-start-chat-with-boss/constant.mjs'

export function jobExperienceIssue(job = {}, pattern = '') {
  if (!pattern?.trim()) return ''
  try {
    const experienceRegex = new RegExp(pattern, 'im')
    return experienceRegex.test(job.experienceName || job.experience || '')
      ? '' : `工作经验未通过已开启的规则：“${job.experienceName || job.experience || '未提供'}”`
  } catch { return '工作经验正则无效' }
}

export function internshipIssue(job = {}) {
  if (job.invalidStatus) return '岗位已失效或停止招聘'
  if (Number(job.jobType) === 0 && job.jobType != null) return 'BOSS职位类型为全职／社招，不是实习'
  const title = job.jobName || ''
  if (/(?:校招|校园招聘|秋招|春招)/i.test(title) && !/(?:实习|intern)/i.test(title)) return '岗位为校招正式岗，不是实习'
  if (Number(job.jobType) === 4) return ''
  if (/(?:实习|\bintern(?:ship)?\b)/i.test(title)) return ''
  const description = job.description || job.postDescription || ''
  if (/(?:招[聘收募]?[^。；\n]{0,12}实习|实习生|实习岗位|实习期间|可[^。；\n]{0,8}实习|实习[时周期限安]|\bintern(?:ship)?\b)/i.test(description)) return ''
  return '未找到明确的实习身份依据；在校／应届或日薪本身不能证明是实习'
}

export function bossActivityIssue(description, cutoff = 0) {
  if (!cutoff) return ''
  const index = activeDescList.indexOf(description)
  const required = activeDescList[cutoff + 1] || '当前设置的活跃范围'
  if (index <= 0) return `BOSS活跃状态未记录，需重新核验是否满足${required}要求`
  return index <= cutoff ? `BOSS${description}，不满足${required}要求` : ''
}
