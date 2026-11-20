<template>
  <div class="main-layout-shell">
    <div class="flex flex-col min-w200px w200px pt30px pl30px aside-nav of-hidden">
      <div class="nav-list flex-1 of-auto pl20px ml--20px">
        <RouterLink v-show="false" to="./TaskManager">任务管理</RouterLink>
        <BossPart />
        <hr class="group-divider" />
        <GlobalConfigPart />
        <hr class="group-divider" />
        <RunDataRecordPart />
      </div>
      <div class="pt-16px pb-16px flex-0 font-size-12px">
        <div>
          <div>当前版本: {{ buildInfo.version }}({{ buildInfo.buildVersion }})</div>
          <div class="feedback-button-area flex flex-items-center mt-8px">
            <el-button type="text" size="small" @click="handleGotoProjectPageClick"
              >项目首页</el-button
            >
            |
            <el-button type="text" size="small" @click="handleFeedbackClick">反馈问题</el-button> | <el-button type="text" size="small" @click="$router.push('/main-layout/Updates')">设置</el-button>
          </div>
        </div>
      </div>
    </div>
    <div ref="contentPane" class="router-view-wrap">
      <RouterView v-slot="{ Component }" class="flex-1 of-hidden">
        <KeepAlive>
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { projectUrl } from '@geekgeekrun/utils/project-links.mjs'
import { useRouter, useRoute } from 'vue-router'
import { ref, watch, nextTick } from 'vue'
import useBuildInfo from '@renderer/hooks/useBuildInfo'
import { gtagRenderer } from '@renderer/utils/gtag'
import { useUpdateStore, useTaskManagerStore } from '../../store/index'
import BossPart from './LeftNavBar/BossPart.vue'
import GlobalConfigPart from './LeftNavBar/GlabalConfigPart.vue'
import RunDataRecordPart from './LeftNavBar/RunDataRecordPart.vue'

useRouter()
const route = useRoute()
const contentPane = ref<HTMLElement>()
watch(() => route.fullPath, async () => { await nextTick(); if (contentPane.value) contentPane.value.scrollTop = 0 })

const { buildInfo } = useBuildInfo()
const handleFeedbackClick = () => {
  gtagRenderer('goto_feedback_clicked')
  electron.ipcRenderer.send('send-feed-back-to-github-issue')
}
const handleGotoProjectPageClick = () => {
  gtagRenderer('goto_project_github_clicked')
  electron.ipcRenderer.send('open-external-link', projectUrl)
}

useUpdateStore()

const taskManagerStore = useTaskManagerStore()
void taskManagerStore
</script>

<style lang="scss" scoped>
.main-layout-shell { display: flex; height: 100vh; width: 100%; overflow: hidden; }
.aside-nav { box-sizing: border-box; flex: 0 0 230px; height: 100%; min-height: 0; }
.nav-list { min-height: 0; overscroll-behavior: contain; }

.aside-nav {
  background-image: linear-gradient(45deg, #eaf4f1, #dcf6f2);
  .nav-list {
    hr.group-divider {
      width: 100%;
      border: 0 solid;
      height: 1px;
      background-color: #b3c8c3;
      margin-top: 4px;
      margin-bottom: 4px;
      margin-right: 0;
    }
  }
  .feedback-button-area,
  .update-button-area {
    :deep(.el-button) {
      height: fit-content;
      padding: 0;
      margin-left: 0;
    }
  }
}
.router-view-wrap {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  box-shadow: -4px 1px 20px rgb(50 114 108 / 29%);
}
</style>
