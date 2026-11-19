<template>
  <div class="common-job-condition-config" :class="{ embedded }">
    <header class="window-heading"><h2>公共职位正则筛选</h2></header>
    <div class="main-wrapper">
      <el-form
        ref="formRef"
        :model="formContent"
        :rules="formRules"
        inline-message
        label-position="top"
        class="common-config-form"
      >
        <section class="settings-card"><h3>筛选范围</h3><JobFilterMode scope="regex" compact /></section>
        <section class="settings-card">
        <el-form-item data-setting="companies" tabindex="-1" prop="expectCompanies" mb0>
          <div
            font-size-14px
            flex
            mb6px
            :style="{
              justifyContent: 'space-between',
              alignItems: 'baseline',
              width: '100%',
              lineHeight: '1.25em'
            }"
          >
            <div>
              期望投递公司 <JobFilterHelp kind="expected" />
            </div>
            <el-dropdown @command="handleExpectCompanyTemplateClicked">
              <el-button size="small"
                >公司列表模板 <el-icon class="el-icon--right"><arrow-down /></el-icon
              ></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="item in expectCompanyTemplateList"
                    :key="item.name"
                    :command="item"
                    >{{ item.name }}</el-dropdown-item
                  >
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <CompanyTags v-model="formContent.expectCompanies" label="期望公司" />
        </el-form-item>
        </section>
        <section class="settings-card">
        <div
          ref="blockCompanyNameRegExpSectionEl"
          font-size-14px
          flex
          :style="{
            justifyContent: 'space-between',
            alignItems: 'baseline',
            width: '100%',
            lineHeight: '1.25em'
          }"
        >
          <div mb6px>
            屏蔽公司 <JobFilterHelp kind="blocked" />
          </div>
          <el-dropdown @command="handleBlockCompanyNameRegExpTemplateClicked">
            <el-button size="small"
              >公司列表模板 <el-icon class="el-icon--right"><arrow-down /></el-icon
            ></el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="item in blockCompanyNameRegExpTemplateList"
                  :key="item.name"
                  :command="item"
                  >{{ item.name }}</el-dropdown-item
                >
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <div
          class="block-company-filter-wrap"
          :style="{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '10px'
          }"
        >
          <el-form-item prop="blockCompanyNameRegExpStr" mb0 w-full>
            <CompanyTags v-model="formContent.blockCompanyNameRegExpStr" label="屏蔽公司" regex />
          </el-form-item>
        </div>
        </section>
        <section data-setting="regex" tabindex="-1" class="settings-card">
        <div>
          <div
            flex
            :style="{
              alignItems: 'center',
              justifyContent: 'space-between'
            }"
          >
            <div font-size-14px>期望职位信息 <JobFilterHelp kind="jobs" /></div>
            <div>
              <el-dropdown ml20px @command="handleExpectJobFilterTemplateClicked">
                <el-button size="small"
                  >职位详情筛选模板（按职类区分）
                  <el-icon class="el-icon--right"><arrow-down /></el-icon
                ></el-button>
                <template #dropdown>
                  <el-dropdown-menu
                    :style="{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr'
                    }"
                  >
                    <el-dropdown-item
                      v-for="item in expectJobFilterTemplateList"
                      :key="item.name"
                      :command="item"
                      >{{ item.name }}</el-dropdown-item
                    >
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <div
            :style="{
              width: '100%',
              display: 'flex',
              gap: '10px'
            }"
          >
            <div flex-1>
              <el-form-item mb0 prop="expectJobNameRegExpStr">
                <div font-size-12px>职位名称/类型/描述 正则匹配筛选逻辑</div>
                <el-select
                  v-model="formContent.jobDetailRegExpMatchLogic"
                  @change="(value) => gtagRenderer('job_detail_re_ml_change', { value })"
                >
                  <el-option
                    v-for="op in jobDetailRegExpMatchLogicOptions"
                    :key="op.value"
                    :label="op.name"
                    :value="op.value"
                    >{{ op.name }}</el-option
                  >
                </el-select>
              </el-form-item>
              <div
                :style="{
                  width: '100%',
                  height: '1px',
                  backgroundColor: '#f0f0f0',
                  marginTop: '0.5lh'
                }"
              />
              <div
                :style="{
                  display: 'grid',
                  gridTemplateColumns: '2em 1fr',
                  gap: '5px',
                  flex: 1,
                  alignItems: 'end'
                }"
                class="job-detail-filter-wrap"
              >

                <div></div>
                <el-form-item mb0 prop="expectJobNameRegExpStr">
                  <div font-size-12px>职位名称正则（不区分大小写）</div>
                  <el-input
                    data-setting="jobName" v-model="formContent.expectJobNameRegExpStr"
                    type="textarea"
                    :placeholder="
                      getJobDetailRegExpMatchLogicConfig({ formContent }).inputPlaceholderText
                    "
                    :autosize="{ minRows: 2, maxRows: 6 }"
                    max-h-6lh
                    @blur="
                      formContent.expectJobNameRegExpStr =
                        formContent.expectJobNameRegExpStr?.trim() ?? ''
                    "
                  />
                </el-form-item>
                <div
                  mb0px
                  font-size-12px
                  flex
                  flex-justify-center
                  fw-800
                  flex-self-start
                  position-relative
                  style="top: 42px"
                >
                  {{ getJobDetailRegExpMatchLogicConfig({ formContent }).logicText }}
                </div>
                <el-form-item mb0 prop="expectJobTypeRegExpStr">
                  <div ref="jobDetailRegExpSectionEl" font-size-12px>
                    职位类型正则（推荐填写，不区分大小写）
                  </div>
                  <el-input
                    data-setting="positionName" v-model="formContent.expectJobTypeRegExpStr"
                    type="textarea"
                    :placeholder="
                      getJobDetailRegExpMatchLogicConfig({ formContent }).inputPlaceholderText
                    "
                    :autosize="{ minRows: 2, maxRows: 6 }"
                    max-h-6lh
                    @blur="
                      formContent.expectJobTypeRegExpStr =
                        formContent.expectJobTypeRegExpStr?.trim() ?? ''
                    "
                  />
                </el-form-item>
                <div
                  mb0px
                  font-size-12px
                  flex
                  flex-justify-center
                  fw-800
                  flex-self-start
                  position-relative
                  style="top: 42px"
                >
                  {{ getJobDetailRegExpMatchLogicConfig({ formContent }).logicText }}
                </div>
                <el-form-item mb0 prop="expectJobDescRegExpStr">
                  <div font-size-12px>职位描述正则（不区分大小写）</div>
                  <el-input
                    data-setting="postDescription" v-model="formContent.expectJobDescRegExpStr"
                    type="textarea"
                    :placeholder="
                      getJobDetailRegExpMatchLogicConfig({ formContent }).inputPlaceholderText
                    "
                    :autosize="{ minRows: 2, maxRows: 6 }"
                    max-h-6lh
                    @blur="
                      formContent.expectJobDescRegExpStr =
                        formContent.expectJobDescRegExpStr?.trim() ?? ''
                    "
                  />
                </el-form-item>
              </div>
            </div>
          </div>
        </div>
        </section>
      </el-form>
    </div>
    <div class="settings-footer">
      <div
        :style="{
          display: 'flex',
          justifyContent: 'end',
          maxWidth: '1000px',
          margin: '0 auto',
          paddingLeft: '20px',
          paddingRight: 'calc(20px + 16px)'
        }"
      >
        <el-button @click="handleCancel">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="tsx">
import JobFilterHelp from '@renderer/features/JobFilterHelp/index.vue'
import CompanyTags from '@renderer/features/CompanyTags/index.vue'
import JobFilterMode from '@renderer/features/JobFilterMode/index.vue'
import { useRouter, useRoute } from 'vue-router'
const { embedded = false } = defineProps<{ embedded?: boolean }>()
const router = useRouter()
const route = useRoute()
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'
import { JobDetailRegExpMatchLogic } from '@geekgeekrun/sqlite-plugin/src/enums'
import { ArrowDown } from '@element-plus/icons-vue'

import {
  getJobDetailRegExpMatchLogicConfig,
  expectCompanyTemplateList,
  blockCompanyNameRegExpTemplateList,
  getHandlerForBlockCompanyNameRegExpTemplateClicked,
  getHandlerForExpectCompanyTemplateClicked,
  getHandlerForExpectJobFilterTemplateClicked,
  getRuleOfExpectJobNameRegExpStr,
  getRuleOfExpectJobDescRegExpStr,
  getRuleOfExpectJobTypeRegExpStr,
  getRuleOfBlockCompanyNameRegExpStr,
  jobDetailRegExpMatchLogicOptions
} from '../MainLayout/GeekAutoStartChatWithBoss/common'
import { computed, ref, onActivated, nextTick, watch } from 'vue'
import { ElMessage } from 'element-plus'
import expectJobFilterTemplateList from '../MainLayout/GeekAutoStartChatWithBoss/expectJobFilterTemplateList'
const { ipcRenderer } = window.electron
const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'cjc_config',
    ...params
  })
}

const formContent = ref({
  expectCompanies: '',
  jobDetailRegExpMatchLogic: JobDetailRegExpMatchLogic.EVERY,
  expectJobNameRegExpStr: '',
  expectJobTypeRegExpStr: '',
  expectJobDescRegExpStr: '',
  blockCompanyNameRegExpStr: ''
})

const jobDetailRegExpSectionEl = ref<HTMLDivElement>()
const blockCompanyNameRegExpSectionEl = ref<HTMLDivElement>()
const formRules = computed(() => ({
  expectJobNameRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfExpectJobNameRegExpStr({ gtagRenderer, jobDetailRegExpSectionEl })
  },
  expectJobTypeRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfExpectJobTypeRegExpStr({ gtagRenderer, jobDetailRegExpSectionEl })
  },
  expectJobDescRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfExpectJobDescRegExpStr({ gtagRenderer, jobDetailRegExpSectionEl })
  },
  blockCompanyNameRegExpStr: {
    trigger: 'blur',
    validator: getRuleOfBlockCompanyNameRegExpStr({ gtagRenderer, blockCompanyNameRegExpSectionEl })
  }
}))

const handleBlockCompanyNameRegExpTemplateClicked =
  getHandlerForBlockCompanyNameRegExpTemplateClicked({
    gtagRenderer,
    formContent
  })

const handleExpectCompanyTemplateClicked = getHandlerForExpectCompanyTemplateClicked({
  gtagRenderer,
  formContent
})

const handleExpectJobFilterTemplateClicked = getHandlerForExpectJobFilterTemplateClicked({
  gtagRenderer,
  formContent
})


function handleCancel() {
  //
  if (embedded) router.push('/main-layout/SettingsPreview')
  else window.close()
}

const formRef = ref()
async function handleSave() {
  await formRef.value?.validate()
  await ipcRenderer.invoke(
    'save-common-job-condition-config',
    JSON.parse(
      JSON.stringify({
        ...formContent.value,
        expectCompanies: formContent.value.expectCompanies
          ? formContent.value.expectCompanies.split(',').map((s) => s.trim())
          : []
      })
    ),
    { embedded }
  )
  if (embedded) ElMessage.success('公共职位筛选条件已保存，预览将按新规则显示')
  else ipcRenderer.send('common-job-condition-config-done')
}

async function revealSetting() {
  const focus = String(route.query.focus || '')
  if (!['companies', 'regex', 'jobName', 'positionName', 'postDescription'].includes(focus)) return
  await nextTick()
  const section: HTMLElement | undefined = formRef.value?.$el?.querySelector(`[data-setting="${focus}"]`)
  const input = section?.querySelector<HTMLTextAreaElement>('textarea')
  const target = focus !== 'companies' && input ? input : section
  target?.scrollIntoView({ block: 'center' })
  target?.focus({ preventScroll: true })
}
watch(() => route.query.focus, revealSetting)
async function loadSettings() {
  const res = await ipcRenderer.invoke('fetch-config-file-content')
  const commonJobConditionConfig = res.config?.['common-job-condition-config.json'] ?? {}
  Object.keys(formContent.value).forEach((key) => {
    if (key in commonJobConditionConfig) {
      if (key === 'expectCompanies') {
        formContent.value[key] = (commonJobConditionConfig[key] ?? []).join(',')
      } else {
        formContent.value[key] = commonJobConditionConfig[key]
      }
    }
  })
  await revealSetting()
}
loadSettings()
onActivated(loadSettings)
</script>

<style lang="scss">
.common-job-condition-config { height: 100vh; display: flex; flex-direction: column; min-width: 0; overflow: hidden; color: var(--el-text-color-primary); background: var(--el-bg-color); font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif; font-size: 14px; }
.common-job-condition-config .window-heading { width: 100%; max-width: 1048px; box-sizing: border-box; padding: 24px 24px 0; margin: 0 auto; flex-shrink: 0; }
.common-job-condition-config h2 { margin: 0; font-size: 24px; font-weight: 600; }.common-job-condition-config h3 { margin: 0 0 16px; font-size: 16px; font-weight: 600; }.common-job-condition-config .window-heading p { margin: 6px 0 0; color: var(--el-text-color-secondary); font-size: 13px; line-height: 1.6; }
.common-job-condition-config .main-wrapper { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.common-job-condition-config .common-config-form { width: 100%; max-width: 1048px; box-sizing: border-box; padding: 20px 24px; margin: 0 auto; }
.common-job-condition-config .settings-card { min-width: 0; padding: 22px; margin-bottom: 16px; border: 1px solid var(--el-border-color-light); border-radius: 12px; background: var(--el-bg-color); box-shadow: 0 2px 8px rgba(15, 23, 42, .025); }
.common-job-condition-config .settings-footer { flex-shrink: 0; padding: 16px 0; border-top: 1px solid var(--el-border-color-light); background: var(--el-bg-color); }
.common-job-condition-config .el-form-item__content { min-width: 0; }.common-job-condition-config textarea { line-height: 1.7; }.common-job-condition-config .job-detail-filter-wrap { margin-top: 12px; }
@media (max-width: 700px) { .common-job-condition-config .settings-card { padding: 16px; }.common-job-condition-config .common-config-form { padding: 16px; } }
.common-job-condition-config .el-form-item__error.el-form-item__error--inline {
  margin-left: 0;
}
.common-job-condition-config.embedded { height: 100%; flex: 1; min-height: 0; }
</style>
