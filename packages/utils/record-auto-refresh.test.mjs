import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../ui/package.json', import.meta.url))
const vue = require('vue')
const ts = require('typescript')

test('record pages refresh every two minutes, pause when hidden, and clean up without duplicate requests', async () => {
  const timers = new Map()
  let id = 0, calls = 0, release
  const source = fs.readFileSync(new URL('../ui/src/renderer/src/hooks/useRecordAutoRefresh.ts', import.meta.url), 'utf8')
  const tasks = vue.reactive({ runningTasks: [] })
  const exports = {}
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, require: name => name === '@renderer/store' ? { useTaskManagerStore: () => tasks } : require(name), console,
    setInterval: (callback, delay) => { assert.equal(delay, 120_000); timers.set(++id, callback); return id },
    clearInterval: timer => timers.delete(timer)
  })
  const renderer = vue.createRenderer({
    createElement: () => ({ children: [] }), createText: () => ({}), createComment: () => ({}),
    setText() {}, setElementText() {}, patchProp() {},
    insert(node, parent) { node.parent = parent; parent.children.push(node) },
    remove(node) { if (node.parent) node.parent.children = node.parent.children.filter(item => item !== node) },
    parentNode: node => node.parent, nextSibling: () => null
  })
  const visible = vue.ref(true)
  const component = {
    setup() {
      exports.useRecordAutoRefresh(() => { calls++; return new Promise(resolve => { release = resolve }) })
      return () => vue.h('div')
    }
  }
  const app = renderer.createApp({ render: () => vue.h(vue.KeepAlive, null, { default: () => visible.value ? vue.h(component) : null }) })
  app.mount({ children: [] })
  assert.equal(calls, 1)
  assert.equal(timers.size, 0, 'idle pages have no refresh timer')
  release()
  await new Promise(resolve => setImmediate(resolve))
  tasks.runningTasks.push({workerId: 'geekAutoStartWithBossMain'})
  await vue.nextTick()
  assert.equal(calls, 2)
  assert.equal(timers.size, 1)
  const tick = [...timers.values()][0]
  await tick()
  assert.equal(calls, 2, 'an unfinished refresh is not started again')
  release()
  await new Promise(resolve => setImmediate(resolve))
  const next = tick()
  assert.equal(calls, 3)
  release()
  await next
  visible.value = false
  await vue.nextTick()
  assert.equal(timers.size, 0)
  visible.value = true
  await vue.nextTick()
  assert.equal(calls, 4, 'returning to a cached page refreshes immediately')
  assert.equal(timers.size, 1)
  release()
  await new Promise(resolve => setImmediate(resolve))
  tasks.runningTasks.splice(0)
  await vue.nextTick()
  assert.equal(timers.size, 0, 'stopping the task removes the refresh timer')
  release()
  app.unmount()
  assert.equal(timers.size, 0)
})
