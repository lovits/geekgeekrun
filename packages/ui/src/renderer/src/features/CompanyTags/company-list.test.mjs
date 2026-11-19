import test from 'node:test'
import assert from 'node:assert/strict'
import { companyEntries, addCompany, removeCompany } from './company-list.mjs'
test('company tags preserve literals, escape new blocked company names and remove one tag', () => {
  assert.deepEqual(companyEntries('腾讯,阿里').map(item => item.label), ['腾讯', '阿里'])
  assert.equal(addCompany('腾讯', '腾讯'), '腾讯')
  assert.equal(addCompany('腾讯', '阿里'), '腾讯,阿里')
  const blocked = addCompany('外包|^派遣.*$', 'A+B(服务)', true)
  assert.equal(new RegExp(blocked).test('AAB服务'), false)
  assert.equal(new RegExp(blocked).test('A+B(服务)'), true)
  assert.equal(companyEntries(blocked, true)[2].label, 'A+B(服务)')
  assert.equal(removeCompany(blocked, 0, true), '^派遣.*$|A\\+B\\(服务\\)')
  assert.equal(removeCompany('[', 1, true), '[')
})
