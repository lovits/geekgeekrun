<template>
  <div class="group-item">
    <div class="group-title">运行数据</div>
    <div flex flex-col class="link-list">
      <RouterLink to="./ApplicationSimulation">模拟开聊
        <el-tooltip placement="right" :enterable="false">
          <template #content><div style="max-width: 360px; line-height: 1.7">
            <div>模拟只筛选和记录，不发送消息。「拟沟通」是模拟匹配候选，「未沟通」是不符合条件，「已沟通」只表示真实任务已确认开聊成功。缺失信息保留在原因和快照里。</div>
            <div>本地职位库模式重评已采集岗位；BOSS 在线模式复用自动开聊的网页查找与筛选流程，但不点击沟通、不发送消息，不符合的岗位会在网站标记不合适。</div>
            <div>两种模拟结果都保存在这里。在线采集和本地不合适记录照常保存；真实开聊记录只在实际开聊成功后增加。</div>
            <div>开启 AI 筛选才会产生 AI 分数；规则直接排除的岗位没有分数。快照查看保存的信息，详情打开岗位网页。</div>
          </div></template>
          <QuestionFilled w-1em h-1em mr10px aria-label="模拟开聊说明" />
        </el-tooltip>
      </RouterLink>
      <RouterLink to="./StartChatRecord">开聊记录</RouterLink>
      <RouterLink to="./MarkAsNotSuitRecord">标记不合适记录</RouterLink>
      <RouterLink to="./JobLibrary">职位库</RouterLink>

      <RouterLink to="./BossLibrary">BOSS库</RouterLink>
      <RouterLink to="./CompanyLibrary">公司库</RouterLink>
      <RecordExport />
    </div>
  </div>
</template>

<script setup lang="ts">
import RecordExport from '@renderer/features/RecordExport/index.vue'
import { QuestionFilled } from '@element-plus/icons-vue'
</script>

<style scoped lang="scss" src="./style.scss"></style>
