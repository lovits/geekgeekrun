import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { test } from 'node:test'
import puppeteer from 'puppeteer'
import { clickFilterOption, setEmploymentTypeFilter, setNationwideCity } from './page-filters.mjs'
import { formatStaticCombineFilters, combineFiltersWithConstraintsGenerator } from './combineCalculator.mjs'

const source = readFileSync(new URL('./index.mjs', import.meta.url), 'utf8')
const require = createRequire(import.meta.url)
const { parseSalary } = require('../sqlite-plugin/dist/utils/parser.js')

test('filter verification returns before the chat path', async () => {
  const writes = []
  const scope = vm.createContext({
    filterCheckOnly: true, filterCondition: { experienceList: [108], degreeList: [203] },
    filterConditionIndex: 0, filterCheckResults: [],
    page: { evaluate: async () => '全国 实习 在校生 本科', screenshot: async () => {} },
    os: { homedir: () => '/test' }, path: require('node:path'),
    writeStorageFile: async (name, result) => writes.push({ name, result }),
    chatStarted: false
  })
  const start = source.indexOf('        if (filterCheckOnly) {')
  const end = source.indexOf('        try {', start)
  vm.runInContext(`async function verify() { iterateFilterCondition: for (let i = 0; i < 1; i++) { ${source.slice(start, end)} chatStarted = true } }`, scope)
  await scope.verify()
  assert.equal(scope.chatStarted, false)
  const result = scope.filterCheckResults[0]
  assert.equal(result.selectedFilters, '全国 实习 在校生 本科')
  assert.equal(writes[0].name, 'filter-check-result.json')
})

test('salary unlimited retains daily, negotiable and undisclosed internship salaries', async () => {
  const jobs = [
    { encryptJobId: 'daily', salaryDesc: '200-300元/天' },
    { encryptJobId: 'negotiable', salaryDesc: '面议' },
    { encryptJobId: 'missing', salaryDesc: '' },
    { encryptJobId: 'monthly', salaryDesc: '5-8K' }
  ]
  const scope = vm.createContext({
    page: { evaluate: async () => jobs },
    jobListData: [], blockJobNotSuit: new Set(), parseSalary, jobNameFilterForList: null,
    isSalaryFilterEnabled: false, expectSalaryLow: null, expectSalaryHigh: null,
    expectCityList: [], expectWorkExpList: [],
    expectCityNotMatchStrategy: 1, expectWorkExpNotMatchStrategy: 1,
    strategyScopeOptionWhenMarkSalaryNotMatch: 1,
    MarkAsNotSuitOp: { NO_OP: 3 }
  })
  vm.runInContext(source.slice(source.indexOf('async function updateJobListData ()'), source.indexOf('await updateJobListData()')), scope)
  vm.runInContext(source.slice(source.indexOf('function checkIfSalarySuit('), source.indexOf('function getTempTargetJobIndexToCheckDetail')), scope)
  await scope.updateJobListData()
  assert.equal(scope.blockJobNotSuit.size, 0)
  for (const job of jobs) assert.equal(scope.checkIfSalarySuit(job.salaryDesc), true)
  scope.isSalaryFilterEnabled = true
  await scope.updateJobListData()
  assert.deepEqual([...scope.blockJobNotSuit], ['daily', 'negotiable', 'missing'])
})

test('page controls select nationwide, internships and all six experience/degree combinations', async () => {
  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setRequestInterception(true)
    page.on('request', request => request.respond({
      status: 200, contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' }, body: '{}'
    }))
    await page.setContent(`
      <div class="page-jobs-main"><div class="filter-condition-inner">
        <button ka="switch_city_dialog_open" class="active">西安</button>
        <div id="employment"><span>求职类型</span><ul>
          <li ka="employment-0">不限</li><li ka="employment-1901" class="active">全职</li>
          <li ka="employment-1902">实习</li><li ka="employment-1903">兼职</li>
        </ul></div>
        <div id="salary" class="is-select"><li ka="sel-job-rec-salary-0">不限</li><li ka="sel-job-rec-salary-402">3K以下</li><li ka="sel-job-rec-salary-403">3-5K</li><li ka="sel-job-rec-salary-404">5-10K</li><li ka="sel-job-rec-salary-405" class="active">10-20K</li></div>
        <div id="experience" class="is-select"><li ka="sel-job-rec-exp-0">不限</li><li ka="sel-job-rec-exp-108">在校生</li><li ka="sel-job-rec-exp-102">应届生</li><li ka="sel-job-rec-exp-101">经验不限</li><li ka="sel-job-rec-exp-104" class="active">1-3年</li></div>
        <div id="degree" class="is-select"><li ka="sel-job-rec-degree-0">不限</li><li ka="sel-job-rec-degree-203">本科</li><li ka="sel-job-rec-degree-204">硕士</li><li ka="sel-job-rec-degree-205" class="active">博士</li></div>
        <div id="scale" class="is-select"><li ka="sel-job-rec-scale-0">不限</li><li ka="sel-job-rec-scale-303" class="active">100-499人</li><li ka="sel-job-rec-scale-304">500-999人</li><li ka="sel-job-rec-scale-305">1000-9999人</li><li ka="sel-job-rec-scale-306">10000人以上</li></div>
      </div></div>
      <div class="city-select-dialog" style="display:none"><div class="city-select-wrapper"><ul><li><a>全国</a></li></ul></div></div>
      <script>
        document.addEventListener('click', event => {
          if (event.target.closest('li, .city-select-wrapper a')) {
            fetch('https://filter.test/wapi/zpgeek/search/joblist.json')
          }
        })
        const bar = document.querySelector('.filter-condition-inner')
        bar.__vue__ = { $children: [
          ['求职类型', 'employment'], ['薪资待遇', 'salary'], ['工作经验', 'experience'], ['学历要求', 'degree'], ['公司规模', 'scale']
        ].map(([placeholder, id]) => ({ placeholder, $el: document.getElementById(id) })) }
        for (const dropdown of bar.querySelectorAll('div[id]')) {
          dropdown.addEventListener('click', event => {
            const option = event.target.closest('li')
            if (!option) return
            if (['employment', 'salary'].includes(dropdown.id) || option.getAttribute('ka').endsWith('-0')) {
              dropdown.querySelectorAll('.active').forEach(it => it.classList.remove('active'))
              option.classList.add('active')
            } else {
              dropdown.querySelector('[ka$="-0"]')?.classList.remove('active')
              option.classList.toggle('active')
            }
          })
        }
        bar.querySelector('button').onclick = () => document.querySelector('.city-select-dialog').style.display = 'block'
        document.querySelector('.city-select-wrapper a').onclick = () => {
          bar.querySelector('button').textContent = '全国'
          document.querySelector('.city-select-dialog').style.display = 'none'
        }
      </script>
    `)
    const scope = vm.createContext({
      page, clickFilterOption, setNationwideCity, sleep: async () => {}, sleepWithRandomDelay: async () => {},
      console: { log() {} }, jobFilterConditionsMapByCode: {}, industryFilterConditionsMapByCode: {}
    })
    vm.runInContext(source.slice(source.indexOf('async function setFilterCondition ('), source.indexOf('async function toRecommendPage (')), scope)
    const conditions = formatStaticCombineFilters([108, 102, 101].flatMap(experience =>
      [203, 204].map(degree => ({ experience, degree }))
    ))
    assert.equal(conditions.length, 6)
    for (const condition of conditions) {
      await scope.setFilterCondition(condition)
      await setEmploymentTypeFilter(page, '实习')
      assert.deepEqual(await page.evaluate(() => ({
        city: document.querySelector('[ka="switch_city_dialog_open"]').textContent,
        employment: document.querySelector('#employment .active').textContent,
        salary: document.querySelector('#salary .active').getAttribute('ka'),
        experience: document.querySelector('#experience .active').getAttribute('ka'),
        degree: document.querySelector('#degree .active').getAttribute('ka')
      })), {
        city: '全国', employment: '实习', salary: 'sel-job-rec-salary-0',
        experience: 'sel-job-rec-exp-' + condition.experienceList[0],
        degree: 'sel-job-rec-degree-' + condition.degreeList[0]
      })
    }
    const combined = [...combineFiltersWithConstraintsGenerator({
      cityList: [], salaryList: [402, 403, 404], experienceList: [108, 102, 101],
      degreeList: [203, 204], scaleList: [304, 305, 306], industryList: []
    })]
    assert.equal(combined.length, 3)
    for (const condition of combined) {
      await scope.setFilterCondition(condition)
      await setEmploymentTypeFilter(page, '实习')
      const selected = await page.evaluate(() => Object.fromEntries(['salary', 'experience', 'degree', 'scale'].map(id => [id, [...document.querySelectorAll('#' + id + ' .active')].map(el => Number(el.getAttribute('ka').split('-').pop())).sort((a,b) => a-b)])))
      assert.deepEqual(selected, { salary: condition.salaryList, experience: [101, 102, 108], degree: [203, 204], scale: [304, 305, 306] })
    }
    await setEmploymentTypeFilter(page, '不限')
    assert.equal(await page.$eval('#employment .active', el => el.textContent), '不限')
    await page.evaluate(() => {
      const oldDropdown = document.querySelector('#employment')
      oldDropdown.addEventListener('click', () => {
        const freshDropdown = oldDropdown.cloneNode(true)
        freshDropdown.querySelectorAll('.active').forEach(el => el.classList.remove('active'))
        freshDropdown.addEventListener('click', event => {
          freshDropdown.querySelectorAll('.active').forEach(el => el.classList.remove('active'))
          event.target.closest('li')?.classList.add('active')
        })
        oldDropdown.replaceWith(freshDropdown)
        document.querySelector('.filter-condition-inner').__vue__.$children.find(it => it.placeholder === '求职类型').$el = freshDropdown
      }, { once: true })
    })
    await setEmploymentTypeFilter(page, '实习')
    assert.equal(await page.$eval('#employment .active', el => el.textContent), '实习')
    await page.evaluate(() => { document.querySelector('.filter-condition-inner').__vue__.$children = [] })
    await assert.rejects(setEmploymentTypeFilter(page, '实习'), /找不到 BOSS 求职类型/)
  } finally {
    await browser.close()
  }
})
