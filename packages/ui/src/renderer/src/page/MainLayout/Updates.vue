<template>
  <div class="updates-page">
    <h2>自动更新</h2>
    <p>当前版本：{{ buildInfo.version }}</p>
    <p><el-link @click="open(projectUrl)">GitHub：{{ projectRepository }}</el-link></p>
    <el-checkbox :model-value="store.autoCheck" @change="store.setAutoCheck(Boolean($event))">启动时及每 30 分钟自动检查新版</el-checkbox>
    <div class="actions"><el-button :loading="store.checking" @click="store.checkUpdate">检查更新</el-button></div>
    <el-alert v-if="store.updateError" :title="store.updateError" type="error" :closable="false" />
    <section v-else-if="store.availableNewRelease">
      <h3>发现新版本 {{ store.availableNewRelease.releaseVersion }}</h3>
      <pre>{{ store.availableNewRelease.releaseNote }}</pre>
      <el-button type="primary" @click="open(store.availableNewRelease.assetUrl)">下载对应系统安装包</el-button>
      <el-button @click="open(store.availableNewRelease.releasePageUrl)">查看发布页</el-button>
    </section>
    <p v-else-if="store.lastCheckedAt && !store.checking">当前没有适用于本机的新正式版本。</p>
    <p v-if="store.lastCheckedAt">上次检查：{{ store.lastCheckedAt }}</p>
    <p class="note">GitHub 发布正式版本并上传对应系统安装包后会提醒。下载安装包后手动安装，不会自动中断正在进行的任务。</p>
  </div>
</template>
<script setup lang="ts">
import { useUpdateStore } from '@renderer/store'
import useBuildInfo from '@renderer/hooks/useBuildInfo'
import { projectRepository, projectUrl } from '@geekgeekrun/utils/project-links.mjs'
const store = useUpdateStore(), { buildInfo } = useBuildInfo()
function open(url: string) { window.electron.ipcRenderer.send('open-external-link', url) }
</script>
<style scoped>
.updates-page { padding: 24px; width: 100%; box-sizing: border-box; max-width: 1000px; line-height: 1.8; }
h2 { margin-top: 0; } .actions { margin: 16px 0; } pre { white-space: pre-wrap; overflow-wrap: anywhere; font-family: inherit; }.note { font-size: 13px; color: var(--el-text-color-secondary); }
</style>
