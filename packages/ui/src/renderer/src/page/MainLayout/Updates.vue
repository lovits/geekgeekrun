<template>
  <div class="updates-page">
    <h2>设置</h2>
    <h3>配置管理</h3>
    <div class="actions"><el-button @click="exportConfig">导出配置</el-button><el-button @click="importConfig">导入配置</el-button></div>
    <p>配置包含个人简历文字和求职偏好，请妥善保管。登录信息和本机路径不会导出。</p>
    <h3>自动更新</h3>
    <p>当前版本：{{ buildInfo.version }}</p>
    <p><el-link @click="open(projectUrl)">我的仓库：{{ projectRepository }}</el-link></p>
    <p><el-link @click="open(upstreamUrl)">原仓库：geekgeekrun/geekgeekrun</el-link></p>
    <el-checkbox :model-value="store.autoCheck" @change="store.setAutoCheck(Boolean($event))">启动时检查，每天最多自动检查一次；有新版自动下载</el-checkbox>
    <div class="actions"><el-button :loading="store.checking" @click="store.checkUpdate(true)">检查更新</el-button></div>
    <el-alert v-if="store.updateError" :title="store.updateError" type="error" :closable="false" />
    <p v-if="store.checking">正在检查更新…</p>
    <section v-else-if="store.checkStatus === 'available' && store.availableNewRelease">
      <h3>发现新版本 {{ store.availableNewRelease.releaseVersion }}</h3>
      <pre>{{ store.availableNewRelease.releaseNote }}</pre>
      <el-button type="primary" :loading="store.downloading" @click="store.downloadUpdate">{{ store.downloading ? '正在下载' : '下载安装包' }}</el-button>
      <p v-if="store.downloaded">已下载：{{ store.downloaded.path }}（请手动安装）</p>
      <el-alert v-if="store.downloadError" :title="store.downloadError" type="error" :closable="false" />
      <el-button @click="open(store.availableNewRelease.releasePageUrl)">查看发布页</el-button>
    </section>
    <p v-else-if="store.checkStatus === 'latest'">已是最新版本（当前系统与架构）。</p>
    <p v-else-if="store.checkStatus === 'error'">检查更新失败，请重试。</p>
    <p v-if="store.lastCheckedAt">上次检查：{{ store.lastCheckedAt }}</p>
  </div>
</template>
<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUpdateStore } from '@renderer/store'
import useBuildInfo from '@renderer/hooks/useBuildInfo'
import { projectRepository, projectUrl, upstreamUrl } from '@geekgeekrun/utils/project-links.mjs'
const store = useUpdateStore(), { buildInfo } = useBuildInfo()
async function exportConfig() {
  try { const result = await window.electron.ipcRenderer.invoke('export-portable-config', { autoCheckUpdates: store.autoCheck }); if (result) ElMessage.success(`配置已导出：${result.path}`) }
  catch (error) { ElMessage.error(String(error)) }
}
async function importConfig() {
  try {
    await ElMessageBox.confirm('导入将覆盖当前对应设置，并自动备份。登录信息和本机路径保持不变；简历 PDF 需在本机重新导入。', '导入配置', { type: 'warning', confirmButtonText: '选择配置', cancelButtonText: '取消' })
    const result = await window.electron.ipcRenderer.invoke('import-portable-config')
    if (result) {
      if (typeof result.autoCheckUpdates === 'boolean') localStorage.setItem('auto-check-updates', String(result.autoCheckUpdates))
      await ElMessageBox.alert('配置已导入，请重启应用使所有设置生效。', '导入成功')
    }
  } catch (error) { if (error !== 'cancel' && error !== 'close') ElMessage.error(String(error)) }
}
function open(url: string) { window.electron.ipcRenderer.send('open-external-link', url) }
</script>
<style scoped>
.updates-page { padding: 24px; width: 100%; box-sizing: border-box; max-width: 1000px; line-height: 1.8; }
h2 { margin-top: 0; } .actions { margin: 16px 0; } pre { white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; }
</style>
