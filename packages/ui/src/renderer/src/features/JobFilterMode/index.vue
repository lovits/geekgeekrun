<template>
  <div :style="{ margin: compact ? '0' : '16px 0' }">
    <div v-if="scope !== 'ai'">
      <strong>正则与公司条件</strong>
      <div v-for="item in regexItems" :key="item.key">
        <el-checkbox v-model="settings.regexFilters[item.key]" :disabled="settings.loading" @change="save">{{ item.label }}</el-checkbox>
      </div>
    </div>
    <div v-if="scope !== 'regex'" style="margin-top: 12px">
      <strong v-if="!compact">AI 模型筛选</strong>
      <div><el-checkbox v-model="settings.aiFilters.jobName" :disabled="settings.loading" @change="save">AI 筛选岗位名称</el-checkbox></div>
      <div><el-checkbox v-model="settings.aiFilters.postDescription" :disabled="settings.loading" @change="save">AI 筛选岗位描述</el-checkbox></div>
    </div>
    <el-button v-if="scope === 'all'" @click="openRegex">配置公共职位正则筛选</el-button>
    <el-button v-if="scope === 'all'" @click="$router.push('/main-layout/AiJobMatch')">配置 AI 简历和偏好</el-button>
  </div>
</template>
<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
import { onMounted, onActivated } from 'vue'
import { ElMessage } from 'element-plus'
import { useJobFilterSettings } from '@renderer/store/job-filter-settings'
const props = withDefaults(defineProps<{ scope?: 'all' | 'regex' | 'ai'; compact?: boolean }>(), { scope: 'all', compact: false })
const settings = useJobFilterSettings()
const regexItems = [{ key: 'jobName', label: '正则筛选岗位名称' }, { key: 'positionName', label: '正则筛选职位类型' }, { key: 'postDescription', label: '正则筛选岗位描述' }, { key: 'companies', label: '启用期望投递公司名单' }, { key: 'blockedCompanies', label: '启用不期望投递公司正则' }]
async function refresh() { try { await settings.refresh() } catch (error) { ElMessage.error(String(error)) } }
onMounted(refresh)
onActivated(refresh)
async function save() {
  try { await settings.save(props.scope); ElMessage.success('筛选开关已保存') }
  catch (error) { ElMessage.error(String(error)) }
}
function openRegex() { router.push('/main-layout/CommonJobConditionConfig') }
</script>
