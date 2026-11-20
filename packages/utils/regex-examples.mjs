export function regexExamples(source = '', examples = '', field = '') {
  let pattern
  try { pattern = new RegExp(source, 'im') } catch { return { error: '正则表达式无效', items: [] } }
  return { error: '', items: examples.split('\n').filter(text => text.trim()).map(text => ({ text, matched: pattern.test(field === 'experienceName' ? text : text.replace(/\n/g, '')) })) }
}
