<template>
  <div class="page-wrap runtime-record-page flex flex-col of-hidden">
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
            label="标记时间"
            :formatter="
              (_row, _col, val) => transformUtcDateToLocalDate(val).format('YYYY-MM-DD HH:mm:ss')
            "
           min-width="145" show-overflow-tooltip />
          <ElTableColumn prop="bossName" label="BOSS" width="64"  show-overflow-tooltip />
          <ElTableColumn prop="markReason" label="标记原因" width="250">
            <template #default="{ row }">
              <el-tooltip :content="(markReasonTopicMap[row.markReason] || '原因未记录') + '\n' + formatMarkReason(row)" placement="top" :show-after="300" popper-class="runtime-record-reason-tooltip">
                <div class="record-reason-preview" tabindex="0"><strong>{{ markReasonTopicMap[row.markReason] || '原因未记录' }}</strong> {{ formatMarkReason(row) }}</div>
              </el-tooltip>
            </template>
          </ElTableColumn>
          <ElTableColumn prop="experienceName" label="工作经验"  min-width="95" show-overflow-tooltip />
          <ElTableColumn
            label="薪资"
            :formatter="(row) => formatJobSalary(row)"
           min-width="100" show-overflow-tooltip />
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
              gtagRenderer('mansr_refresh_clicked')
              getMarkAsNotSuitRecord()
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
        @size-change="getMarkAsNotSuitRecord"
        @current-change="getMarkAsNotSuitRecord"
      />
      <div class="w100px"><RecordExport scope="unsuitable" /></div>
    </div>
    <ElDrawer v-model="drawVisibleModelValue" size="400px">
      <JobInfoSnapshot
        v-if="selectedJobInfoForViewSnapshot"
        :job-info="selectedJobInfoForViewSnapshot"
        scene="markAsNotSuitRecord"
        @closed="
          () => {
            gtagRenderer('mansr_closed')
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
import { ElTable, ElTableColumn, ElButton, ElPagination, ElDrawer } from 'element-plus'
import { type VMarkAsNotSuitLog } from '@geekgeekrun/sqlite-plugin/src/entity/VMarkAsNotSuitLog'
import { PageReq, PagedRes } from '../../../../common/types/pagination'
import JobInfoSnapshot from '../../features/JobInfoSnapshot/index.vue'
import { MarkAsNotSuitReason } from '@geekgeekrun/sqlite-plugin/src/enums'
import { transformUtcDateToLocalDate } from '@geekgeekrun/utils/date.mjs'
import { gtagRenderer } from '@renderer/utils/gtag'

const tableData = ref<VMarkAsNotSuitLog[]>([])
const pageSizeList = ref<number[]>([100, 200, 300, 400])
const pagination = ref<Omit<PageReq & PagedRes<unknown>, 'data'>>({
  pageNo: 1,
  pageSize: pageSizeList.value[0],
  totalItemCount: 0
})
const getRowKey = (row: VMarkAsNotSuitLog) => {
  return `${row.encryptJobId}@${row.date}`
}
const tableRef = ref<InstanceType<typeof ElTable>>()
const isTableLoading = ref(false)
async function getMarkAsNotSuitRecord() {
  try {
    gtagRenderer('mansr_request_sent', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
    isTableLoading.value = true
    const { data: res } = (await electron.ipcRenderer.invoke('get-mark-as-not-suit-record', {
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize
    })) as { data: PagedRes<VMarkAsNotSuitLog> }
    tableData.value = res.data
    pagination.value = {
      totalItemCount: res.totalItemCount,
      pageNo: res.pageNo,
      pageSize: pagination.value.pageSize
    }
    gtagRenderer('mansr_request_success', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
  } catch (err) {
    gtagRenderer('mansr_request_error', {
      err,
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize
    })
    console.log(err)
    tableData.value = []
  } finally {
    tableRef.value?.setScrollTop(0)
    isTableLoading.value = false
  }
}

useRecordAutoRefresh(async () => { if (!isTableLoading.value) await getMarkAsNotSuitRecord() })

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
  gtagRenderer('view_job_online_button_clicked')
  return await electron.ipcRenderer.invoke('open-site-with-boss-cookie', {
    url: `https://www.zhipin.com/job_detail/${encryptJobId}.html`
  })
}

const drawVisibleModelValue = ref(false)
const selectedJobInfoForViewSnapshot = ref<VMarkAsNotSuitLog | null>(null)

function handleViewJobSnapshotButtonClick(record: VMarkAsNotSuitLog) {
  gtagRenderer('view_job_snapshot_button_clicked')
  selectedJobInfoForViewSnapshot.value = record
  drawVisibleModelValue.value = true
}

const markReasonTopicMap = {
  [MarkAsNotSuitReason.BOSS_INACTIVE]: 'BOSS不活跃',
  [MarkAsNotSuitReason.USER_MANUAL_OPERATION_WITH_UNKNOWN_REASON]: '手动标记不合适',
  [MarkAsNotSuitReason.JOB_NOT_SUIT]: '职位不合适',
  [MarkAsNotSuitReason.JOB_CITY_NOT_SUIT]: '工作地不合适',
  [MarkAsNotSuitReason.JOB_WORK_EXP_NOT_SUIT]: '工作经验不合适',
  [MarkAsNotSuitReason.JOB_SALARY_NOT_SUIT]: '薪资不合适',
  [MarkAsNotSuitReason.COMPANY_NAME_NOT_SUIT]: '公司名称不匹配'
}

function formatMarkReason(row: VMarkAsNotSuitLog) {
  let saved: any = null
  try { saved = JSON.parse(row.extInfo) } catch {}
  if (saved?.reason) return saved.reason
  if (row.markReason === MarkAsNotSuitReason.JOB_NOT_SUIT) return '历史记录未保存具体排除依据，不能据此判断职责不匹配。'
  if (row.markReason === MarkAsNotSuitReason.BOSS_INACTIVE && !saved?.bossActiveTimeDesc) return '历史记录未保存BOSS活跃时间，需线上重新核验。'
  switch (row.markReason) {
    case MarkAsNotSuitReason.BOSS_INACTIVE: {
      const extInfo = (() => {
        try {
          return JSON.parse(row.extInfo)
        } catch {
          return null
        }
      })()
      return [
        extInfo?.bossActiveTimeDesc && `BOSS活跃情况：${extInfo.bossActiveTimeDesc}`,
        extInfo?.chosenReasonInUi?.text && `BOSS选项内容：${extInfo.chosenReasonInUi.text}`
      ]
        .filter(Boolean)
        .join('\n')
    }
    case MarkAsNotSuitReason.USER_MANUAL_OPERATION_WITH_UNKNOWN_REASON: {
      const extInfo = (() => {
        try {
          return JSON.parse(row.extInfo)
        } catch {
          return null
        }
      })()
      return [extInfo?.chosenReasonInUi?.text && `BOSS选项内容：${extInfo.chosenReasonInUi.text}`]
        .filter(Boolean)
        .join('\n')
    }
    case MarkAsNotSuitReason.JOB_WORK_EXP_NOT_SUIT:
    case MarkAsNotSuitReason.JOB_CITY_NOT_SUIT: {
      const extInfo = (() => {
        try {
          return JSON.parse(row.extInfo)
        } catch {
          return null
        }
      })()
      return [extInfo?.chosenReasonInUi?.text && `BOSS选项内容：${extInfo.chosenReasonInUi.text}`]
        .filter(Boolean)
        .join('\n')
    }
    case MarkAsNotSuitReason.JOB_SALARY_NOT_SUIT: {
      const extInfo = (() => {
        try {
          return JSON.parse(row.extInfo)
        } catch {
          return null
        }
      })()
      return [
        extInfo?.salaryDesc && `薪资：${extInfo.salaryDesc}`,
        extInfo?.chosenReasonInUi?.text && `BOSS选项内容：${extInfo.chosenReasonInUi.text}`
      ]
        .filter(Boolean)
        .join('\n')
    }
    case MarkAsNotSuitReason.COMPANY_NAME_NOT_SUIT: {
      const extInfo = (() => {
        try {
          return JSON.parse(row.extInfo)
        } catch {
          return null
        }
      })()
      return [extInfo?.chosenReasonInUi?.text && `BOSS选项内容：${extInfo.chosenReasonInUi.text}`]
        .filter(Boolean)
        .join('\n')
    }
    default: {
      return ''
    }
  }
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
