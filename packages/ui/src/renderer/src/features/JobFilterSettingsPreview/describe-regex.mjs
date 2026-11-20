import { RegExpParser } from '@eslint-community/regexpp'

// This explains saved rules only. The original expression remains the execution rule.
export function describeRegex(source = '', { workExperience = false } = {}) {
  if (!source.trim()) return { rules: [], empty: true, complete: true }
  let complete = true
  const anyText = node => node?.type === 'Quantifier' && node.min === 0 && node.max === Infinity && node.element.raw === '[\\s\\S]'
  const unique = values => [...new Set(values.filter(Boolean))]
  function words(node) {
    if (node.type === 'Character') return [String.fromCodePoint(node.value)]
    if (node.type === 'Assertion' && node.kind === 'word' && !node.negate) return ['']
    if (node.type === 'CharacterSet' && node.kind === 'space' && !node.negate) return ['']
    if (node.type === 'CharacterClass' && node.raw === '[ -]') return ['']
    if (node.type === 'CharacterClass' && node.raw === '[ .]') return ['', '.']
    if (node.type === 'Alternative') {
      let result = ['']
      for (const element of node.elements) {
        const next = words(element)
        if (!next || result.length * next.length > 2000) return null
        result = result.flatMap(prefix => next.map(value => prefix + value))
      }
      return result
    }
    if (['Pattern', 'Group', 'CapturingGroup'].includes(node.type)) {
      const values = node.alternatives.map(words)
      return values.some(value => !value) ? null : values.flat()
    }
    if (node.type === 'Quantifier') {
      if (node.min === 0 && ['\\s', '[ -]'].includes(node.element.raw)) return ['']
      const values = words(node.element)
      if (values && node.min === 0 && node.max === 1) return ['', ...values]
    }
    return null
  }
  const spacing = node => node.type === 'CharacterSet' && node.kind === 'space' && !node.negate || node.type === 'Quantifier' && node.element.type === 'CharacterSet' && node.element.kind === 'space' && !node.element.negate
  const characters = node => node?.type === 'Character' ? [String.fromCodePoint(node.value)] : node?.type === 'CharacterClass' && !node.negate && node.elements.every(item => item.type === 'Character') ? node.elements.map(item => String.fromCodePoint(item.value)) : []
  const onlyCharacters = (node, allowed) => { const values = characters(node); return values.length > 0 && values.every(value => allowed.includes(value)) }
  function amount(nodes, start) {
    let end = start
    while (nodes[end]?.type === 'Character' && /[0-9]/.test(String.fromCodePoint(nodes[end].value))) end++
    if (end > start) return { text: nodes.slice(start, end).map(node => String.fromCodePoint(node.value)).join(''), end }
    const node = nodes[start]
    if (!node) return null
    if (node.type === 'Quantifier' && node.min === 1 && node.max === Infinity && node.element.type === 'CharacterSet' && node.element.kind === 'digit' && !node.element.negate) return { text: '若干', end: start + 1 }
    if (node.type === 'CharacterClass' && !node.negate && node.elements.length && node.elements.every(item => item.type === 'Character' && item.value >= 48 && item.value <= 57 || item.type === 'CharacterClassRange' && item.min.value >= 48 && item.max.value <= 57)) {
      return { text: node.elements.map(item => item.type === 'Character' ? String.fromCodePoint(item.value) : `${String.fromCodePoint(item.min.value)}至${String.fromCodePoint(item.max.value)}`).join('或'), end: start + 1 }
    }
    if (['Group', 'CapturingGroup'].includes(node.type)) {
      const values = words(node)
      if (values?.length && values.every(value => /^\d+$/.test(value))) return { text: unique(values).join('或'), end: start + 1 }
    }
    return null
  }
  function schedule(elements) {
    const nodes = elements.filter(node => !spacing(node) && !(node.type === 'Quantifier' && node.min === 0 && node.max === 1 && onlyCharacters(node.element, ',，、;；')))
    const days = amount(nodes, 0)
    if (!days || !onlyCharacters(nodes[days.end], '天') || !onlyCharacters(nodes[days.end + 1], '/／') || !onlyCharacters(nodes[days.end + 2], '周')) return null
    const months = amount(nodes, days.end + 3)
    if (!months) return null
    let end = months.end, rangeSeparator = ''
    const range = nodes[end]
    if (range?.type === 'Quantifier' && range.min === 0 && range.max === 1 && ['Group', 'CapturingGroup'].includes(range.element.type) && range.element.alternatives.length === 1) {
      const parts = range.element.alternatives[0].elements.filter(node => !spacing(node))
      const other = amount(parts, 1)
      if (onlyCharacters(parts[0], '-～~至') && other?.end === parts.length && other.text === '若干' && months.text === '若干') { rangeSeparator = characters(parts[0])[0]; end++ }
    }
    const optionalUnit = nodes[end] && words(nodes[end])
    const hasUnit = optionalUnit?.length && optionalUnit.every(value => value === '' || value === '个') && optionalUnit.includes('个')
    if (hasUnit) end++
    if (!onlyCharacters(nodes[end], '月') || end + 1 !== nodes.length) return null
    return `每周${days.text}天，持续${months.text}个月` + (rangeSeparator ? `；月数也可写为范围，例如“3${rangeSeparator}6${hasUnit ? '个' : ''}月”` : '')
  }
  function phrases(alternative) {
    const nodes = workExperience ? alternative.elements.filter(node => !(node.type === 'Assertion' && ['start', 'end'].includes(node.kind))) : alternative.elements
    if (workExperience) {
      const description = schedule(nodes)
      if (description) return [description]
    }
    const years = nodes?.[0] && words(nodes[0])
    if (years?.length && years.every(value => /^\d{2,4}$/.test(value)) && /毕业|届/.test(alternative.raw)) {
      return unique(years.map(year => (year.length === 2 ? '20' + year : year) + '届或当年毕业'))
    }
    if (nodes?.length === 3 && nodes[1].type === 'Quantifier' && nodes[1].min === 0 && nodes[1].max === 20 && nodes[1].element.type === 'CharacterClass' && nodes[1].element.negate) {
      const before = words(nodes[0]), after = words(nodes[2])
      if (before && after) return [`先出现${unique(before).join('、')}中的一项，再出现${unique(after).join('、')}中的一项；两者间隔不超过20字，不能跨句号、分号或换行。`]
    }
    const values = words(workExperience ? { ...alternative, elements: nodes } : alternative)
    if (values) return unique(values)
    complete = false
    return ['这项包含尚未解读的自定义条件，请到编辑页核对。']
  }
  const itemsFor = nodes => nodes.length === 1 && ['Group', 'CapturingGroup'].includes(nodes[0].type)
    ? unique(nodes[0].alternatives.flatMap(phrases))
    : phrases({ type: 'Alternative', elements: nodes, raw: nodes.map(node => node.raw).join('') })
  try {
    const pattern = new RegExpParser().parsePattern(source)
    if (pattern.alternatives.length !== 1) return { rules: [{ label: '命中其中一个即可', items: unique(pattern.alternatives.flatMap(phrases)) }], complete }
    const rules = [], remaining = []
    for (const node of pattern.alternatives[0].elements) {
      if (node.type === 'Assertion' && node.kind === 'lookahead') {
        const nodes = node.alternatives.length === 1 ? node.alternatives[0].elements : []
        const nested = nodes[1]
        if (node.negate && nodes[0]?.kind === 'start' && nested?.kind === 'lookahead' && nested.negate && nested.alternatives.length === 1 && nested.alternatives[0].elements.length === 2 && anyText(nested.alternatives[0].elements[0]) && anyText(nodes[2]) && nodes.slice(3).every(item => item.type === 'Character')) {
          const term = nodes.slice(3).map(item => String.fromCodePoint(item.value)).join('')
          rules.push({ label: `名称出现“${term}”时，还需带有下面至少一个方向词`, items: itemsFor([nested.alternatives[0].elements[1]]) })
        } else if (nodes.length && anyText(nodes[0])) {
          const pair = !node.negate && nodes.length === 5 && nodes[1].type === 'CapturingGroup' && anyText(nodes[2]) && nodes[3].type === 'Assertion' && nodes[3].negate && nodes[3].alternatives?.[0]?.elements?.[0]?.resolved === nodes[1] && nodes[4].type === 'Group' && nodes[1].alternatives.map(item => item.raw).join('|') === nodes[4].alternatives.map(item => item.raw).join('|')
          rules.push(pair
            ? { label: '正文至少匹配两处', note: '以下条件需在正文中先后匹配两处；后一处不能重复以前一处匹配到的相同文本开头。', items: itemsFor([nodes[1]]) }
            : { label: node.negate ? '出现这些文字就排除' : '包含下面任意一个表达即可', items: itemsFor(nodes.slice(1)) })
        } else {
          complete = false
          rules.push({ label: '自定义条件', items: ['这项需要在编辑页进一步核对，预览不改变筛选结果。'] })
        }
      } else if (!(node.type === 'Assertion' && ['start', 'end'].includes(node.kind)) && !anyText(node)) remaining.push(node)
    }
    if (remaining.length) rules.push({ label: '匹配表达', items: itemsFor(remaining) })
    if (!rules.length) rules.push({ label: '匹配范围', items: ['任意文本'] })
    return { rules, complete }
  } catch { return { rules: [{ label: '需要核对', items: ['当前规则无法生成中文预览，请在编辑页核对。'] }], complete: false } }
}
