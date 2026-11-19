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
        <el-form-item prop="expectCompanies" mb0>
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
              期望投递公司
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
            屏蔽公司
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
        <section class="settings-card">
        <div mt16px>
          <div font-size-14px mb8px>工作地</div>
          <div
            :style="{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '10px'
            }"
          >
            <el-form-item prop="expectCityList" mb0>
              <div
                font-size-12px
                :style="{
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%'
                }"
              >
                <city-chooser v-model="formContent.expectCityList">
                  <template #default="{ modelValue, showDialog, clearValue }">
                    <div v-if="modelValue?.length">
                      <div>当前已选择城市：</div>
                      <div flex flex-wrap gap-10px>
                        <el-tag v-for="it in modelValue" :key="it">
                          {{ it }}
                        </el-tag>
                      </div>
                    </div>
                    <div v-else>
                      <div>当前未选择任何期望城市，将不会按照城市进行筛选</div>
                    </div>
                    <div
                      line-height-1
                      :style="{
                        marginTop: modelValue?.length ? '10px' : ''
                      }"
                    >
                      <el-button
                        size="small"
                        type="primary"
                        @click="
                          () => {
                            // isDialogVisible = true
                            showDialog()
                            gtagRenderer('choose_city_entry_button_clicked')
                          }
                        "
                        >选择城市</el-button
                      >
                      <el-button
                        v-if="modelValue?.length"
                        size="small"
                        type="danger"
                        @click="clearValue"
                        >清空已选择的所有城市</el-button
                      >
                    </div>
                  </template>
                </city-chooser>
              </div>
            </el-form-item>
          </div>
        </div>
        <div class="h-1px bg-#f0f0f0" mt16px mb16px />
        <div mt16px>
          <div font-size-14px mb8px>
            薪资（不限时保留日薪实习和未注明薪资的职位；设置范围时仅比较月薪）
          </div>
          <div
            :style="{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '10px'
            }"
          >
            <div>
              <el-form-item prop="expectSalaryLow" mb10px>
                <div w-full>
                  <div font-size-12px>薪资筛选方式</div>
                  <el-select
                    v-model="formContent.expectSalaryCalculateWay"
                    @change="handleExpectSalaryCalculateWayChanged"
                  >
                    <el-option
                      v-for="op in expectSalaryCalculateWayOption"
                      :key="op.value"
                      :label="op.name"
                      :value="op.value"
                      >{{ op.name }}</el-option
                    >
                  </el-select>
                </div>
              </el-form-item>
              <el-form-item prop="expectSalaryLow" mb10px>
                <div>
                  <div font-size-12px>期望薪资范围</div>
                  <div>
                    <el-input-number
                      v-model="formContent.expectSalaryLow"
                      controls-position="right"
                      :min="0"
                      :step="0.25"
                      placeholder="不设置"
                      @change="
                        () => {
                          gtagRenderer('expect_salary_low_changed')
                          ensureSalaryRangeCorrect({ formContent })
                        }
                      "
                    >
                      <template #prefix>下限</template>
                      <template #suffix>
                        <template v-if="formContent.expectSalaryLow">
                          <template
                            v-if="
                              formContent.expectSalaryCalculateWay ===
                              SalaryCalculateWay.MONTH_SALARY
                            "
                            >k</template
                          >
                          <template
                            v-if="
                              formContent.expectSalaryCalculateWay ===
                              SalaryCalculateWay.ANNUAL_PACKAGE
                            "
                            >W</template
                          >
                        </template>
                      </template>
                    </el-input-number>
                    -
                    <el-input-number
                      v-model="formContent.expectSalaryHigh"
                      controls-position="right"
                      :min="0"
                      :step="0.25"
                      placeholder="不设置"
                      @change="
                        () => {
                          gtagRenderer('expect_salary_high_changed')
                          ensureSalaryRangeCorrect({ formContent })
                        }
                      "
                    >
                      <template #prefix>上限</template>
                      <template #suffix>
                        <template v-if="formContent.expectSalaryHigh">
                          <template
                            v-if="
                              formContent.expectSalaryCalculateWay ===
                              SalaryCalculateWay.MONTH_SALARY
                            "
                            >k</template
                          >
                          <template
                            v-if="
                              formContent.expectSalaryCalculateWay ===
                              SalaryCalculateWay.ANNUAL_PACKAGE
                            "
                            >W</template
                          >
                        </template>
                      </template>
                    </el-input-number>
                  </div>
                </div>
              </el-form-item>
              <el-form-item
                v-if="
                  formContent.expectSalaryCalculateWay === SalaryCalculateWay.ANNUAL_PACKAGE &&
                  (formContent.expectSalaryLow || formContent.expectSalaryHigh)
                "
                mb10px
              >
                <div>
                  <div font-size-12px>薪资范围满足以下条件的职位将会被匹配</div>
                  <div>
                    <div flex flex-nowrap flex-items-start>
                      <template
                        v-for="(mGroup, index) in [
                          [12, 13, 14, 15, 16, 17, 18],
                          [19, 20, 21, 22, 23, 24]
                        ]"
                        :key="index"
                      >
                        <table
                          :style="{
                            lineHeight: '1.25em'
                          }"
                        >
                          <tr>
                            <th
                              v-for="(text, i) in ['月薪下限', '月薪上限', '']"
                              :key="i"
                              :style="{
                                borderBottom: '2px solid #f0f0f0'
                              }"
                            >
                              {{ text }}
                            </th>
                          </tr>
                          <tr v-for="m in mGroup" :key="m">
                            <td>
                              {{
                                formContent.expectSalaryLow
                                  ? ((formContent.expectSalaryLow / m) * 10).toFixed(2)
                                  : '无下限'
                              }}<small v-if="formContent.expectSalaryLow" class="color-#999 ml-2px"
                                >k</small
                              >
                            </td>
                            <td>
                              {{
                                formContent.expectSalaryHigh
                                  ? ((formContent.expectSalaryHigh / m) * 10).toFixed(2)
                                  : '无上限'
                              }}<small v-if="formContent.expectSalaryHigh" class="color-#999 ml-2px"
                                >k</small
                              >
                            </td>
                            <td>{{ m }}薪</td>
                          </tr>
                        </table>
                        <div v-if="index !== 1" class="bg-#f0f0f0 w-2px flex-self-stretch"></div>
                      </template>
                    </div>
                  </div>
                </div>
              </el-form-item>
            </div>
          </div>
        </div>
        </section>
        <section class="settings-card">
        <div>
          <div
            flex
            :style="{
              alignItems: 'center',
              justifyContent: 'space-between'
            }"
          >
            <div font-size-14px>期望职位信息</div>
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
                    v-model="formContent.expectJobNameRegExpStr"
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
                    v-model="formContent.expectJobTypeRegExpStr"
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
                    v-model="formContent.expectJobDescRegExpStr"
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
import CompanyTags from '@renderer/features/CompanyTags/index.vue'
import JobFilterMode from '@renderer/features/JobFilterMode/index.vue'
import { useRouter } from 'vue-router'
const { embedded = false } = defineProps<{ embedded?: boolean }>()
const router = useRouter()
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'
import { JobDetailRegExpMatchLogic, SalaryCalculateWay } from '@geekgeekrun/sqlite-plugin/src/enums'
import CityChooser from '../MainLayout/GeekAutoStartChatWithBoss/components/CityChooser.vue'
import { ArrowDown } from '@element-plus/icons-vue'

import {
  getJobDetailRegExpMatchLogicConfig,
  expectSalaryCalculateWayOption,
  ensureSalaryRangeCorrect,
  expectCompanyTemplateList,
  blockCompanyNameRegExpTemplateList,
  getHandlerForBlockCompanyNameRegExpTemplateClicked,
  getHandlerForExpectCompanyTemplateClicked,
  getHandlerForExpectJobFilterTemplateClicked,
  getRuleOfExpectJobNameRegExpStr,
  getRuleOfExpectJobDescRegExpStr,
  getRuleOfExpectJobTypeRegExpStr,
  getRuleOfBlockCompanyNameRegExpStr,
  jobDetailRegExpMatchLogicOptions,
  getHandlerForExpectSalaryCalculateWayChanged
} from '../MainLayout/GeekAutoStartChatWithBoss/common'
import { computed, ref, onActivated } from 'vue'
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
  expectCityList: [],
  jobDetailRegExpMatchLogic: JobDetailRegExpMatchLogic.EVERY,
  expectJobNameRegExpStr: '',
  expectJobTypeRegExpStr: '',
  expectJobDescRegExpStr: '',
  expectSalaryCalculateWay: SalaryCalculateWay.ANNUAL_PACKAGE,
  expectSalaryHigh: null,
  expectSalaryLow: null,
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


const handleExpectSalaryCalculateWayChanged = getHandlerForExpectSalaryCalculateWayChanged({
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
