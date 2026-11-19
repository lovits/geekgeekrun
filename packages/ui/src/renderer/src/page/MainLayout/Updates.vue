<template>
  <div class="updates-page">
    <h2>自动更新</h2>
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
    <p class="note">只从我的仓库下载对应系统与架构的正式安装包；更新说明来自 GitHub Release。自动下载后由你手动安装，不会启动安装包或中断任务。</p>
  </div>
</template>
<script setup lang="ts">
import { useUpdateStore } from '@renderer/store'
import useBuildInfo from '@renderer/hooks/useBuildInfo'
import { projectRepository, projectUrl, upstreamUrl } from '@geekgeekrun/utils/project-links.mjs'
const store = useUpdateStore(), { buildInfo } = useBuildInfo()
function open(url: string) { window.electron.ipcRenderer.send('open-external-link', url) }
</script>
<style scoped>
.updates-page { padding: 24px; width: 100%; box-sizing: border-box; max-width: 1000px; line-height: 1.8; }
h2 { margin-top: 0; } .actions { margin: 16px 0; } pre { white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; }.note { font-size: 13px; color: var(--el-text-color-secondary); }
</style>
