export async function clickFilterOption(page, option) {
  const dropdown = (await option.evaluateHandle(el =>
    el.closest('.condition-filter-select, .condition-industry-select')
  )).asElement()
  if (dropdown) {
    await page.mouse.move(0, 0)
    await dropdown.hover()
  }
  await option.scrollIntoView()
  await page.waitForFunction(el => {
    const rect = el.getBoundingClientRect()
    if (!el.isConnected || !rect.width || !rect.height) return false
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
    return target === el || el.contains(target)
  }, { timeout: 5000 }, option)
  const [response] = await Promise.all([
    page.waitForResponse(response => [
      '/wapi/zpgeek/search/joblist.json',
      '/wapi/zpgeek/pc/recommend/job/list.json'
    ].includes(new URL(response.url()).pathname), { timeout: 15000 }),
    option.click()
  ])
  await response.buffer()
}

export async function setEmploymentTypeFilter(page, name) {
  if (!name) return

  // A preceding filter response can replace this dropdown while it is being clicked.
  for (let attempt = 0; attempt < 2; attempt++) {
    const dropdown = (await page.evaluateHandle(() => {
      const bar = document.querySelector('.page-jobs-main .filter-condition-inner')
      return bar?.__vue__?.$children?.find(it => it.placeholder === '求职类型')?.$el ?? null
    })).asElement()
    if (!dropdown) {
      if (name === '不限') return
      throw new Error('找不到 BOSS 求职类型筛选菜单，请检查登录状态或页面版本')
    }

    await dropdown.scrollIntoView()
    await dropdown.hover()
    await page.waitForFunction((el, name) => {
      return [...el.querySelectorAll('[ka], li')].some(it => it.textContent.trim() === name)
    }, { timeout: 5000 }, dropdown, name)
    const option = (await dropdown.evaluateHandle((el, name) => {
      return [...el.querySelectorAll('[ka], li')].find(it => it.textContent.trim() === name) ?? null
    }, name)).asElement()
    if (!option) throw new Error(`BOSS 求职类型中找不到“${name}”，已停止处理职位`)

    const alreadySelected = await dropdown.evaluate((el, name) => {
      const active = [...el.querySelectorAll('.active')]
      return active.some(it => it.textContent.trim() === name) || (name === '不限' && !active.length)
    }, name)
    if (!alreadySelected) {
      await clickFilterOption(page, option)
    }
    try {
      await page.waitForFunction(name => {
        const bar = document.querySelector('.page-jobs-main .filter-condition-inner')
        const el = bar?.__vue__?.$children?.find(it => it.placeholder === '求职类型')?.$el
        if (!el) return false
        const active = [...el.querySelectorAll('.active')]
        return active.some(it => it.textContent.trim() === name) || (name === '不限' && !active.length)
      }, { timeout: 5000 }, name)
    } catch (error) {
      if (attempt === 1) throw new Error(`无法确认 BOSS 求职类型已选中“${name}”，已停止处理职位`, { cause: error })
      continue
    }
    await page.mouse.move(0, 0)
    return
  }
}

export async function setNationwideCity(page, dropdown) {
  if (await dropdown.evaluate(el => el.textContent.trim() === '全国')) return

  await dropdown.click()
  await page.waitForSelector('.city-select-dialog .city-select-wrapper', { visible: true, timeout: 5000 })
  const option = (await page.evaluateHandle(() => {
    const wrapper = document.querySelector('.city-select-dialog .city-select-wrapper')
    return [...wrapper.querySelectorAll('a, li, span')].find(it =>
      it.textContent.trim() === '全国' && ![...it.children].some(child => child.textContent.trim() === '全国')
    ) ?? null
  })).asElement()
  if (!option) throw new Error('BOSS 城市菜单中找不到“全国”，已停止处理职位')
  await clickFilterOption(page, option)
  await page.waitForFunction(() => {
    return document.querySelector('.page-jobs-main .filter-condition-inner [ka="switch_city_dialog_open"]')?.textContent.trim() === '全国'
  }, { timeout: 5000 })
}
