import { RegExpParser } from '@eslint-community/regexpp'

const key = name => name.trim().toLowerCase()
const expectedNames = value => Array.isArray(value) ? [...value] : (value || '').split(',').filter(Boolean)
const literal = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function blockedEntries(pattern = '', remove) {
  const names = []
  const visit = alternatives => alternatives.flatMap(alternative => {
    let elements = alternative.elements
    if (elements[0]?.type === 'Assertion' && elements[0].kind === 'start' && elements.at(-1)?.type === 'Assertion' && elements.at(-1).kind === 'end') elements = elements.slice(1, -1)
    if (elements.length && elements.every(node => node.type === 'Character')) {
      const name = elements.map(node => String.fromCodePoint(node.value)).join('')
      names.push(name)
      return remove && key(name) === key(remove) ? [] : [alternative.raw]
    }
    // A standalone noncapturing group can be edited without changing capture numbering or other rules.
    if (elements.length === 1 && elements[0].type === 'Group') {
      const children = visit(elements[0].alternatives)
      return children.length ? [pattern.slice(alternative.start, elements[0].start) + `(?:${children.join('|')})` + pattern.slice(elements[0].end, alternative.end)] : []
    }
    return [alternative.raw]
  })
  const parts = visit(new RegExpParser().parsePattern(pattern || '').alternatives)
  return { names, pattern: parts.join('|') }
}

export function companyListMemberships({ common = {}, boss = {}, targets = [] }) {
  const expected = [...expectedNames(common.expectCompanies), ...(!boss.fieldsForUseCommonConfig?.expectCompanies ? expectedNames(targets) : [])]
  try {
    const blocked = [...blockedEntries(common.blockCompanyNameRegExpStr).names, ...(!boss.fieldsForUseCommonConfig?.blockCompanyNameRegExpStr ? blockedEntries(boss.blockCompanyNameRegExpStr).names : [])]
    return { expected, blocked, valid: true }
  } catch { return { expected, blocked: [], valid: false } }
}

export function setCompanyListMembership({ common = {}, boss = {}, targets = [] }, company, list, enabled) {
  if (typeof company !== 'string' || !company.trim() || company.trim().length > 200 || /[,，\r\n]/.test(company)) throw new Error('公司名称为空或格式无效')
  if (!['expected', 'blocked'].includes(list) || typeof enabled !== 'boolean') throw new Error('公司名单操作无效')
  const name = company.trim(), memberships = companyListMemberships({ common, boss, targets })
  if (!memberships.valid) throw new Error('已有屏蔽正则无效，请先在筛选设置中修复')
  const contains = kind => memberships[kind].some(item => key(item) === key(name))
  if (enabled && !contains(list) && contains(list === 'expected' ? 'blocked' : 'expected')) throw new Error('请先从另一份名单移除该公司，再加入此名单')
  const next = { common: { ...common }, boss: { ...boss }, targets: [...targets] }
  const updateExpected = value => {
    const items = expectedNames(value)
    return enabled ? items.some(item => key(item) === key(name)) ? items : [...items, name] : items.filter(item => key(item) !== key(name))
  }
  const updateBlocked = (value = '') => {
    if (!enabled) return blockedEntries(value, name).pattern
    return blockedEntries(value).names.some(item => key(item) === key(name)) ? value : value ? `${value}|${literal(name)}` : literal(name)
  }
  if (list === 'expected') {
    next.common.expectCompanies = updateExpected(common.expectCompanies)
    if (!boss.fieldsForUseCommonConfig?.expectCompanies) next.targets = updateExpected(targets)
  } else {
    next.common.blockCompanyNameRegExpStr = updateBlocked(common.blockCompanyNameRegExpStr)
    if (!boss.fieldsForUseCommonConfig?.blockCompanyNameRegExpStr) next.boss.blockCompanyNameRegExpStr = updateBlocked(boss.blockCompanyNameRegExpStr)
  }
  const pattern = boss.fieldsForUseCommonConfig?.blockCompanyNameRegExpStr ? next.common.blockCompanyNameRegExpStr : next.boss.blockCompanyNameRegExpStr
  return { ...next, blocked: Boolean(pattern && new RegExp(pattern, 'im').test(name)), memberships: companyListMemberships(next) }
}
