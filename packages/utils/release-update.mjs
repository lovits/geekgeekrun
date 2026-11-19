import semver from 'semver'

export function selectReleaseUpdate(releases, currentVersion, platform, arch) {
  if (!Array.isArray(releases)) throw new Error('GitHub 未返回有效版本列表')
  const extension = { win32: '.exe', darwin: '.dmg', linux: '.deb' }[platform]
  if (!extension) return null
  const candidates = releases.filter(r => !r.draft && !r.prerelease && semver.valid(r.tag_name?.replace(/^(ui-v|v)/, '')))
    .sort((a, b) => semver.rcompare(a.tag_name.replace(/^(ui-v|v)/, ''), b.tag_name.replace(/^(ui-v|v)/, '')))
  for (const release of candidates) {
    const version = release.tag_name.replace(/^(ui-v|v)/, '')
    if (!semver.gt(version, currentVersion)) continue
    const assets = (release.assets || []).filter(a => a.name.endsWith(extension) && /^https:\/\/github\.com\//.test(a.browser_download_url || ''))
    const asset = assets.find(a => a.name.includes(`_${arch}`) || a.name.includes(`-${arch}`)) || assets.find(a => !/(?:x64|arm64|ia32)/.test(a.name))
    if (asset) return { releaseVersion: version, releasePageUrl: release.html_url, assetUrl: asset.browser_download_url, assetName: asset.name, releaseNote: release.body || '' }
  }
  return null
}
