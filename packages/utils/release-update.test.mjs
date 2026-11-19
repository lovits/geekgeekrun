import test from 'node:test'
import assert from 'node:assert/strict'
import { selectReleaseUpdate } from './release-update.mjs'
const asset = name => ({ name, browser_download_url: 'https://github.com/lovits/geekgeekrun-pro/releases/download/ui-v0.18.0/' + name })
const release = { tag_name: 'ui-v0.18.0', html_url: 'https://github.com/lovits/geekgeekrun-pro/releases/tag/ui-v0.18.0', assets: [asset('app_arm64.dmg'), asset('app_x64.dmg'), asset('app_x64_setup.exe')] }
test('checks newer stable releases and selects the current platform and architecture', () => {
  assert.equal(selectReleaseUpdate([release], '0.17.4', 'win32', 'x64').assetName, 'app_x64_setup.exe')
  assert.equal(selectReleaseUpdate([release], '0.17.4', 'darwin', 'arm64').assetName, 'app_arm64.dmg')
  assert.equal(selectReleaseUpdate([release], '0.18.0', 'darwin', 'arm64'), null)
  assert.equal(selectReleaseUpdate([release], '0.17.4', 'win32', 'arm64'), null)
  assert.equal(selectReleaseUpdate([{...release, prerelease:true}], '0.17.4', 'darwin', 'arm64'), null)
  assert.equal(selectReleaseUpdate([{...release, tag_name:'not-a-version'}], '0.17.4', 'darwin', 'arm64'), null)
  assert.equal(selectReleaseUpdate([{...release, assets:[]}], '0.17.4', 'darwin', 'arm64'), null)
  assert.equal(selectReleaseUpdate([], '0.17.4', 'darwin', 'arm64'), null)
  assert.throws(()=>selectReleaseUpdate({},'0.17.4','win32','x64'))
})
