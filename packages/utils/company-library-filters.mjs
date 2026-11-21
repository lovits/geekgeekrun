export function companyLibraryConditions({ scale = '', industry = '' } = {}) {
  const clauses = [], parameters = {}
  if (typeof scale !== 'string' || typeof industry !== 'string' || industry.length > 500) throw new Error('公司筛选条件无效')
  if (scale) {
    let range
    try { range = JSON.parse(scale) } catch { throw new Error('公司规模筛选无效') }
    if (!Array.isArray(range) || range.length !== 2 || !range.every(n => n === null || (Number.isSafeInteger(n) && n >= 0)) || (range[0] !== null && range[1] !== null && range[0] > range[1])) throw new Error('公司规模筛选无效')
    clauses.push('company.scaleLow IS :scaleLow', 'company.scaleHigh IS :scaleHigh')
    Object.assign(parameters, { scaleLow: range[0], scaleHigh: range[1] })
  }
  if (industry) {
    clauses.push('company.industryName = :industry')
    parameters.industry = industry
  }
  return { clauses, parameters }
}
