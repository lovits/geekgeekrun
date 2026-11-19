import test from 'node:test'
import assert from 'node:assert/strict'
import { companyListMemberships, setCompanyListMembership as set } from './company-list-actions.mjs'

test('expected company toggle appends once, removes on demand and preserves public/private settings', () => {
  const before = { common: { expectCompanies: ['甲公司'], keep: 1 }, boss: { keep: 2 }, targets: ['乙公司'] }
  const added = set(before, ' 新公司 ', 'expected', true)
  assert.deepEqual(added.common.expectCompanies, ['甲公司', '新公司'])
  assert.deepEqual(added.targets, ['乙公司', '新公司'])
  assert.deepEqual(set(added, '新公司', 'expected', true), added)
  const removed = set(added, '新公司', 'expected', false)
  assert.deepEqual(removed.common.expectCompanies, ['甲公司']); assert.deepEqual(removed.targets, ['乙公司'])
  assert.equal(removed.boss.keep, 2); assert.equal(removed.common.keep, 1)
  assert.deepEqual(before.common.expectCompanies, ['甲公司'])
})
test('expected and blocked direct entries are mutually exclusive and removable in either order', () => {
  let state = set({}, 'A+B(研发).公司', 'expected', true)
  assert.throws(() => set(state, 'A+B(研发).公司', 'blocked', true), /另一份名单/)
  state = set(state, 'A+B(研发).公司', 'expected', false)
  state = set(state, 'A+B(研发).公司', 'blocked', true)
  assert.equal(state.blocked, true)
  assert(!new RegExp(state.common.blockCompanyNameRegExpStr).test('AAAB研发X公司'))
  assert.throws(() => set(state, 'a+b(研发).公司', 'expected', true), /另一份名单/)
  state = set(state, 'A+B(研发).公司', 'blocked', false)
  assert.equal(state.blocked, false); assert.equal(state.common.blockCompanyNameRegExpStr, '')
  assert(set(state, 'A+B(研发).公司', 'expected', true).memberships.expected.includes('A+B(研发).公司'))
})
test('removing company entries from grouped and anchored rules preserves other regex behavior', () => {
  const before = { common: { blockCompanyNameRegExpStr: '^(?:甲公司|乙公司)$|^外包.*$' }, boss: { fieldsForUseCommonConfig: { blockCompanyNameRegExpStr: true } } }
  assert.deepEqual(companyListMemberships(before).blocked, ['甲公司', '乙公司'])
  const removed = set(before, '甲公司', 'blocked', false)
  const regex = new RegExp(removed.common.blockCompanyNameRegExpStr)
  assert(!regex.test('甲公司')); assert(regex.test('乙公司')); assert(!regex.test('某乙公司分部')); assert(regex.test('外包研发'))
  assert.equal(removed.boss.blockCompanyNameRegExpStr, undefined)
  const last = set({ common: { blockCompanyNameRegExpStr: '(?:甲公司)' } }, '甲公司', 'blocked', false)
  assert.equal(last.common.blockCompanyNameRegExpStr, '')
})
test('shared selections ignore inactive private memberships, and legacy conflicting entries can be removed', () => {
  const config = { common: { expectCompanies: ['甲公司'], blockCompanyNameRegExpStr: '甲公司' }, boss: { fieldsForUseCommonConfig: { expectCompanies: true, blockCompanyNameRegExpStr: true }, blockCompanyNameRegExpStr: '私有公司' }, targets: ['私有公司'] }
  assert.deepEqual(companyListMemberships(config), { expected: ['甲公司'], blocked: ['甲公司'], valid: true })
  const result = set(config, '甲公司', 'expected', false)
  assert.deepEqual(result.memberships.expected, []); assert.deepEqual(result.memberships.blocked, ['甲公司'])
  assert.deepEqual(result.targets, ['私有公司'])
})
test('invalid input and broken regex reject changes without guessing membership', () => {
  for (const company of ['', ' ', null, 'x'.repeat(201), 'a,b', 'a\nb']) assert.throws(() => set({}, company, 'expected', true))
  assert.throws(() => set({}, '公司', 'wrong', true)); assert.throws(() => set({}, '公司', 'expected', 'yes'))
  assert.equal(companyListMemberships({ common: { blockCompanyNameRegExpStr: '[' } }).valid, false)
  assert.throws(() => set({ common: { blockCompanyNameRegExpStr: '[' } }, '公司', 'blocked', true))
})
