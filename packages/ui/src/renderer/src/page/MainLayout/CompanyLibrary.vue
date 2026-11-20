<template>
  <div class="page-wrap runtime-record-page flex flex-col of-hidden">
    <div v-loading="isTableLoading" class="flex-1 of-hidden">
      <div ref="tableContainerEl" class="h-100% of-hidden">
        <ElTable
          ref="tableRef"
          :max-height="tableMaxHeight"
          :data="tableData"
          row-key="encryptCompanyId"
          size="small"
          table-layout="fixed"
          highlight-current-row
        >
          <ElTableColumn type="expand" width="32">
            <template #default="{ row }"><CompanyJobsPreview :company-id="row.encryptCompanyId" :company-name="row.name" /></template>
          </ElTableColumn>
          <ElTableColumn prop="name" label="公司"  min-width="100" show-overflow-tooltip />
          <ElTableColumn
            :formatter="(row) => formatCompanyScale(row.scaleLow, row.scaleHigh)"
            label="公司规模"
           min-width="130" show-overflow-tooltip />
          <ElTableColumn prop="industryName" label="所在行业"  min-width="140" show-overflow-tooltip />
          <ElTableColumn prop="stageName" label="融资情况"  min-width="130" show-overflow-tooltip />
          <ElTableColumn label="职位" width="90" fixed="right" align="center">
            <template #default="{ row }"><ElButton link type="primary" size="small" :aria-label="'查看职位：' + row.name" @click="tableRef?.toggleRowExpansion(row)">查看职位</ElButton></template>
          </ElTableColumn>
          <ElTableColumn v-for="list in companyLists" :key="list.key" :label="list.label" width="110" fixed="right" align="center" header-align="center">
            <template #default="{ row }">
              <el-tooltip :content="buttonLabel(row, list.key)" placement="top">
                <ElButton link :type="list.key === 'expected' ? 'primary' : 'danger'" size="small" :aria-label="buttonLabel(row, list.key) + '：' + (row.name || '公司未记录')" :aria-pressed="containsCompany(row, list.key)" :disabled="!row.name || savingCompany || !membershipsReady || !memberships.valid || (!containsCompany(row, list.key) && containsCompany(row, list.key === 'expected' ? 'blocked' : 'expected'))" @click="toggleCompany(row, list.key)">{{ containsCompany(row, list.key) ? '−' : '＋' }}</ElButton>
              </el-tooltip>
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
              gtagRenderer('company_library_refresh_clicked')
              getCompanyLibrary()
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
        @size-change="getCompanyLibrary"
        @current-change="getCompanyLibrary"
      />
      <div class="w100px"><RecordExport scope="companies" /></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRecordAutoRefresh } from '@renderer/hooks/useRecordAutoRefresh'
import CompanyJobsPreview from '@renderer/features/CompanyJobsPreview/index.vue'
import RecordExport from '@renderer/features/RecordExport/index.vue'
import { ref, computed, onMounted, onActivated, onBeforeUnmount } from 'vue'
import { ElTable, ElTableColumn, ElButton, ElPagination, ElMessage } from 'element-plus'
import { type VCompanyLibrary } from '@geekgeekrun/sqlite-plugin/src/entity/VCompanyLibrary'
import { PageReq, PagedRes } from '../../../../common/types/pagination'
import { formatCompanyScale } from '@geekgeekrun/sqlite-plugin/src/utils/parser'
import { gtagRenderer } from '@renderer/utils/gtag'

type CompanyList = 'expected' | 'blocked'
const companyLists: { key: CompanyList; label: string }[] = [{ key: 'expected', label: '期望公司' }, { key: 'blocked', label: '屏蔽公司' }]
const memberships = ref({ expected: [] as string[], blocked: [] as string[], valid: true })
const membershipsReady = ref(false)
const savingCompany = ref(false)
const membershipSets = computed(() => ({ expected: new Set(memberships.value.expected.map(name => name.trim().toLowerCase())), blocked: new Set(memberships.value.blocked.map(name => name.trim().toLowerCase())) }))
const containsCompany = (row: VCompanyLibrary, list: CompanyList) => membershipSets.value[list].has((row.name || '').trim().toLowerCase())
const buttonLabel = (row: VCompanyLibrary, list: CompanyList) => (containsCompany(row, list) ? '移出' : '加入') + (list === 'expected' ? '期望公司名单' : '屏蔽公司名单')
async function refreshMemberships() {
  try { memberships.value = await electron.ipcRenderer.invoke('get-company-list-memberships'); membershipsReady.value = true }
  catch (error) { membershipsReady.value = false; ElMessage.error(String(error)) }
}
onActivated(refreshMemberships)
const stopCompanyUpdates = electron.ipcRenderer.on('common-job-condition-config-updated', (_, payload) => { if (payload.memberships) { memberships.value = payload.memberships; membershipsReady.value = true } })
onBeforeUnmount(() => stopCompanyUpdates())
async function toggleCompany(row: VCompanyLibrary, list: CompanyList) {
  const enabled = !containsCompany(row, list)
  savingCompany.value = true
  try {
    const result = await electron.ipcRenderer.invoke('set-company-list-membership', { company: row.name, list, enabled })
    memberships.value = result.memberships
    if (result.warning) ElMessage.warning(result.warning)
    else ElMessage.success(enabled ? '已加入' + (list === 'expected' ? '期望公司名单' : '屏蔽公司名单') : '已移出' + (list === 'expected' ? '期望公司名单' : '屏蔽公司名单'))
  } catch (error) { await refreshMemberships(); ElMessage.error(String(error)) }
  finally { savingCompany.value = false }
}

const tableData = ref<VCompanyLibrary[]>([])
const pageSizeList = ref<number[]>([100, 200, 300, 400])
const pagination = ref<Omit<PageReq & PagedRes<unknown>, 'data'>>({
  pageNo: 1,
  pageSize: pageSizeList.value[0],
  totalItemCount: 0
})

const tableRef = ref<InstanceType<typeof ElTable>>()
const isTableLoading = ref(false)
async function getCompanyLibrary() {
  try {
    gtagRenderer('company_library_request_sent', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize,
    })
    isTableLoading.value = true
    const { data: res } = (await electron.ipcRenderer.invoke('get-company-library', {
      pageNo: pagination.value.pageNo,
      pageSize: pagination.value.pageSize
    })) as { data: PagedRes<VCompanyLibrary> }
    tableData.value = res.data
    pagination.value = {
      totalItemCount: res.totalItemCount,
      pageNo: res.pageNo,
      pageSize: pagination.value.pageSize
    }
    gtagRenderer('company_library_request_success', {
      page_no: pagination.value.pageNo,
      page_size: pagination.value.pageSize,
    })
  } catch (err) {
    gtagRenderer('company_library_request_error', {
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

useRecordAutoRefresh(async () => { if (!isTableLoading.value) await getCompanyLibrary() })
refreshMemberships()

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
