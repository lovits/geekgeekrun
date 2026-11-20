<template>
  <div class="page-wrap runtime-record-page flex flex-col of-hidden">

    <p v-if="savingFeedback">正在保存标记并用大模型更新全局偏好…</p>
    <div v-loading="isTableLoading" class="flex-1 of-hidden">
      <div ref="tableContainerEl" class="h-100% of-hidden">
        <ElTable
          ref="tableRef"
          :max-height="tableMaxHeight"
          :data="tableData"
          :row-key="getRowKey"
          size="small"
          table-layout="fixed"
          highlight-current-row
        >
          <ElTableColumn prop="companyName" label="公司"  min-width="100" show-overflow-tooltip />
          <ElTableColumn prop="jobName" label="职位名称"  min-width="170" show-overflow-tooltip />
          <ElTableColumn prop="positionName" label="职位分类"  min-width="85" show-overflow-tooltip />
          <ElTableColumn
            prop="date"
            label="开聊时间"
            :formatter="
              (_row, _col, val) => transformUtcDateToLocalDate(val).format('YYYY-MM-DD HH:mm:ss')
            "
           min-width="145" show-overflow-tooltip />
          <ElTableColumn prop="experienceName" label="工作经验"  min-width="95" show-overflow-tooltip />
          <ElTableColumn
            label="薪资"
            :formatter="(row) => formatJobSalary(row)"
           min-width="100" show-overflow-tooltip />
          <ElTableColumn label="我的偏好" :width="170" fixed="right" align="left" header-align="left" class-name="feedback-column">

            <template #default="{ row }"><div class="feedback-actions">
              <ElButton size="small" :type="feedback[String(row.encryptJobId)] === 'like' ? 'success' : 'default'" :disabled="!feedbackAvailable || !!savingFeedback" :loading="savingFeedback === String(row.encryptJobId)" :aria-pressed="feedback[String(row.encryptJobId)] === 'like'" @click="markFeedback(row, 'like')">喜欢</ElButton>
              <ElButton size="small" :type="feedback[String(row.encryptJobId)] === 'dislike' ? 'danger' : 'default'" :disabled="!feedbackAvailable || !!savingFeedback" :aria-pressed="feedback[String(row.encryptJobId)] === 'dislike'" @click="markFeedback(row, 'dislike')">不喜欢</ElButton>
            </div></template>
          </ElTableColumn>
          <ElTableColumn label="职位信息" fixed="right" :width="120">
            <template #default="{ row }">
              <ElButton
                link
                type="primary"
                size="small"
                @click="handleViewJobSnapshotButtonClick(row)"
                >快照</ElButton
              >
              <ElButton
                link
                type="primary"
                size="small"
                @click="handleViewJobOnlineButtonClick(row.encryptJobId)"
                >详情</ElButton
              >
            </template>
          </ElTableColumn>
        </ElTable>
      </div>
    </div>
    <div class="flex flex-0 flex-justify-between pt10px pb10px">
      <div class="w100px">
        <el-button
          :loading="isTableLoading"
          size="small"
          @click="
            () => {
              gtagRenderer('start_chat_record_refresh_clicked')
              getAutoStartChatRecord()
            }
          "
          >刷新</el-button
        >
      </div>
      <ElPagination
        v-model:current-page="pagination.pageNo"
        v-model:page-size="pagination.pageSize"
        :page-sizes="pageSizeList"
        small
        :disabled="isTableLoading"
        layout="total, sizes, prev, pager, next, jumper"
        :total="pagination.totalItemCount"
        @size-change="getAutoStartChatRecord"
        @current-change="getAutoStartChatRecord"
      />
      <div class="w100px"><RecordExport scope="chats" /></div>
    </div>
    <ElDrawer v-model="drawVisibleModelValue" size="400px">
      <JobInfoSnapshot
        v-if="selectedJobInfoForViewSnapshot"
        :job-info="selectedJobInfoForViewSnapshot"
        scene="startChatRecord"
        @closed="
          () => {
            gtagRenderer('start_chat_record_closed')
            selectedJobInfoForViewSnapshot = null
          }
        "
      />
    </ElDrawer>
  </div>
</template>

<script setup lang="ts">
import { useRecordAutoRefresh } from '@renderer/hooks/useRecordAutoRefresh'
import { formatJobSalary } from '@geekgeekrun/utils/job-salary.mjs'
import RecordExport from '@renderer/features/RecordExport/index.vue'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { ElTable, ElTableColumn, ElButton, ElPagination, ElDrawer, ElMessage } from 'element-plus'
import { type VChatStartupLog } from '@geekgeekrun/sqlite-plugin/src/entity/VChatStartupLog'
import { transformUtcDateToLocalDate } from '@geekgeekrun/utils/date.mjs'
import { PageReq, PagedRes } from '../../../../common/types/pagination'
import JobInfoSnapshot from '../../features/JobInfoSnapshot/index.vue'
import { gtagRenderer } from '@renderer/utils/gtag'

const tableData = ref<VChatStartupLog[]>([])
const feedback = ref<Record<string, string>>({})
const feedbackAvailable = ref(false)
const savingFeedback = ref('')
async function markFeedback(row: VChatStartupLog, value: string) {
  if (!feedbackAvailable.value || savingFeedback.value) return
  const jobId = String(row.encryptJobId)
  savingFeedback.value = jobId
  const next = feedback.value[jobId] === value ? 'neutral' : value
  try {
    const result = await electron.ipcRenderer.invoke('save-job-feedback', { jobId, value: next, company: row.companyName, jobName: row.jobName, description: row.description || '' })
    if (next === 'neutral') delete feedback.value[jobId]
    else feedback.value[jobId] = next
    if (result.warning) ElMessage.warning(result.warning)
    else ElMessage.success(next === 'neutral' ? '已取消标记并重新整理反馈偏好' : '标记和全局反馈偏好已更新，下次匹配时生效')
  } catch (error) { ElMessage.error(String(error)) }
  finally { savingFeedback.value = '' }
}
const pageSizeList = ref<number[]>([100, 200, 300, 400])
const pagination = ref<Omit<PageReq & PagedRes<unknown>, 'data'>>({
  pageNo: 1,
  pageSize: pageSizeList.value[0],
  totalItemCount: 0
})
const getRowKey = (row: VChatStartupLog) => {
  return `${row.encryptJobId}@${row.date}`
}
const tableRef = ref<InstanceType<typeof ElTable>>()
const isTableLoading = ref(false)
async function getAutoStartChatRecord() {
  try {
    gtagRenderer('start_chat_record_request_sent', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize,
    })
    isTableLoading.value = true
    const { data: res } = (await electron.ipcRenderer.invoke('get-auto-start-chat-record', {
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize
    })) as { data: PagedRes<VChatStartupLog> }
    feedback.value = await electron.ipcRenderer.invoke('get-job-feedback')
    feedbackAvailable.value = await electron.ipcRenderer.invoke('get-job-feedback-availability')
    tableData.value = res.data
    pagination.value = {
      totalItemCount: res.totalItemCount,
      pageNo: res.pageNo,
      pageSize: pagination.value.pageSize
    }
    gtagRenderer('start_chat_record_request_success', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize,
    })
  } catch (err) {
    gtagRenderer('start_chat_record_request_error', {
      err,
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize,
    })
    console.log(err)
    tableData.value = []
  } finally {
    tableRef.value?.setScrollTop(0)
    isTableLoading.value = false
  }
}

useRecordAutoRefresh(async () => { if (!isTableLoading.value) await getAutoStartChatRecord() })

const tableMaxHeight = ref<number | undefined>(undefined)
const tableContainerEl = ref<HTMLElement>()
const setTableMaxHeight = () =>
  (tableMaxHeight.value = tableContainerEl.value?.clientHeight ?? undefined)
onMounted(() => {
  setTableMaxHeight()
  const ro = new ResizeObserver(() => setTableMaxHeight())
  ro.observe(tableContainerEl.value!)
  onBeforeUnmount(() => {
    ro.disconnect()
  })
})

async function handleViewJobOnlineButtonClick(encryptJobId: string) {
  return await electron.ipcRenderer.invoke('open-site-with-boss-cookie', {
    url: `https://www.zhipin.com/job_detail/${encryptJobId}.html`
  })
}

const drawVisibleModelValue = ref(false)
const selectedJobInfoForViewSnapshot = ref<VChatStartupLog | null>(null)

function handleViewJobSnapshotButtonClick(record: VChatStartupLog) {
  selectedJobInfoForViewSnapshot.value = record
  drawVisibleModelValue.value = true
}
</script>

<style scoped lang="scss">
.page-wrap {
  margin: 0 auto;
  max-width: 1000px;
  max-height: 100vh;
  overflow: hidden;
  padding-left: 20px;
  padding-top: 20px;
  :deep(.el-drawer) {
    .el-drawer__header {
      padding: 16px 20px;
      margin-bottom: 0;
    }
    .el-drawer__body {
      padding: 0;
      margin: 0 0 20px 20px;
      padding-right: 20px;
    }
  }
}
</style>

<style scoped>
.feedback-actions { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; min-height: 24px; }.feedback-actions .el-button + .el-button { margin-left: 0; }.page-wrap :deep(.el-table .cell) { text-align: left; vertical-align: middle; }
</style>
