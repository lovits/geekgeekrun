<template>
  <div class="read-no-reply-reminder__wrap">
    <div class="form-wrap">
      <header class="page-heading"><h2>已读不回自动复聊</h2></header>
      <el-form
        ref="formRef"
        :rules="formRules"
        :model="formContent.autoReminder"
        label-position="top"
      >
        <section class="settings-card">
          <h3>跟进范围</h3>
          <el-form-item>
            <el-checkbox v-if="!expectJobTypeRegExpStrForRender?.trim()" :model-value="false" disabled>仅跟进职位类型符合期望的岗位</el-checkbox>
            <el-checkbox v-else v-model="formContent.autoReminder.onlyRemindBossWithExpectJobType">仅跟进职位类型符合期望的岗位</el-checkbox>
          </el-form-item>
          <el-form-item class="mb0">
            <el-checkbox v-if="!blockCompanyNameRegExpStrForRender?.trim()" :model-value="false" disabled>跳过屏蔽公司</el-checkbox>
            <el-checkbox v-else v-model="formContent.autoReminder.onlyRemindBossWithoutBlockCompanyName">跳过屏蔽公司</el-checkbox>
          </el-form-item>
        </section>
        <section class="settings-card">
          <h3>回复内容</h3>
        <el-form-item label="开场白回复方式">
          <el-radio-group v-model="formContent.autoReminder.openContentSource" w-full>
            <div w-full>
              <el-radio :label="OPEN_CONTENT_SOURCE.CONSTANT_CONTENT"> 默认回复 </el-radio>
              <el-input
                v-if="
                  formContent.autoReminder.openContentSource ===
                  OPEN_CONTENT_SOURCE.CONSTANT_CONTENT
                "
                v-model="formContent.autoReminder.constantOpenContent"
                w-full
                :autosize="{ minRows: 3 }"
                max-h-8lh
                type="textarea"
                :placeholder="defaultConstantOpenContent"
                class="pl-30px mb10px"
                :style="{
                  boxSizing: 'border-box'
                }"
              />
            </div>
            <div>
              <el-radio :label="OPEN_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT">
                大模型回复
              </el-radio>
              <div
                v-if="
                  formContent.autoReminder.openContentSource ===
                  OPEN_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT
                "
                ml30px
              >
                <el-form-item class="mb4px">
                  <div>
                    <div>
                      <el-button
                        size="small"
                        type="primary"
                        @click="
                          handleClickEditPrompt({
                            type: 'open'
                          })
                        "
                      >
                        编辑开场白提示词
                      </el-button>
                      <el-button
                        size="small"
                        type="primary"
                        @click="
                          () => {
                            restoreDefaultTemplate({
                              type: 'open',
                              gaEvName: 'reset_template_clicked_in_main_form'
                            })
                          }
                        "
                      >
                        还原默认提示词
                      </el-button>
                    </div>
                  </div>
                </el-form-item>
              </div>
            </div>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="跟进回复方式">
          <el-radio-group v-model="formContent.autoReminder.rechatContentSource">
            <div>
              <el-tooltip
                effect="light"
                placement="right"
                :enterable="false"
                @show="gtagRenderer('tooltip_show_about_lfr_emotion_figure')"
              >
                <template #content>
                  <img block h-100px src="./resources/look-forward-reply-emotion.gif" />
                </template>
                <el-radio :label="RECHAT_CONTENT_SOURCE.LOOK_FORWARD_EMOTION">
                  默认回复（盼回复表情）
                </el-radio>
              </el-tooltip>
              <br />
              <div>
                <el-radio :label="RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT">
                  大模型回复
                </el-radio>
                <div
                  v-if="
                    formContent.autoReminder.rechatContentSource ===
                    RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT
                  "
                  ml30px
                >
                  <el-form-item class="mb4px">
                    <div>
                      <div>
                        <el-button
                          size="small"
                          type="primary"
                          @click="
                            handleClickEditPrompt({
                              type: 'rechat'
                            })
                          "
                        >
                          编辑跟进提示词
                        </el-button>
                        <el-button
                          size="small"
                          type="primary"
                          @click="
                            () => {
                              restoreDefaultTemplate({
                                type: 'rechat',
                                gaEvName: 'reset_template_clicked_in_main_form'
                              })
                            }
                          "
                        >
                          还原默认提示词
                        </el-button>
                      </div>
                    </div>
                  </el-form-item>
                </div>
              </div>
            </div>
          </el-radio-group>
        </el-form-item>
        </section>
        <section class="settings-card">
          <h3>模型与预览</h3>
          <template
            v-if="
              [
                formContent.autoReminder.rechatContentSource,
                formContent.autoReminder.openContentSource
              ].includes(RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT)
            "
          >
            <div ml-30px>
              <el-form-item class="mb4px">
                <div>
                  <el-button size="small" type="primary" @click="handleClickEditResume">
                    编辑简历
                  </el-button>
                  <div class="font-size-12px color-#666">
                    简历内容将提交给大语言模型，以用于生成已读不回提醒消息；提交内容及生成消息中不会包含期望薪资
                  </div>
                </div>
              </el-form-item>
              <el-form-item prop="recentMessageQuantityForLlm">
                <div>
                  携带最近
                  <el-input-number
                    v-model="formContent.autoReminder.recentMessageQuantityForLlm"
                    class="w-120px"
                    :min="8"
                    :max="20"
                    :precision="0"
                    :step="1"
                  ></el-input-number>
                  次聊天内容作为上下文生成新消息
                </div>
              </el-form-item>
              <el-form-item label="当配置的所有大模型均不可使用时">
                <div class="flex flex-items-center">
                  <el-select
                    v-model="formContent.autoReminder.rechatLlmFallback"
                    class="w200px"
                    label="name"
                  >
                    <el-option
                      v-for="option in rechatLlmFallbackOptions"
                      :key="option.value"
                      :value="option.value"
                      :label="option.name"
                    />
                  </el-select>
                </div>
              </el-form-item>
            </div>
          </template>
          <el-form-item ml-30px>
            <el-button size="small" type="primary" @click="handleTestEffectClicked"
              >模拟回复效果</el-button
            >
          </el-form-item>
        </section>
        <section class="settings-card">
          <h3>跟进频率</h3>
        <el-form-item label="跟进间隔（分钟）" prop="throttleIntervalMinutes">
          <el-input-number
            v-model="formContent.autoReminder.throttleIntervalMinutes"
            class="w-150px"
            :min="3"
            :precision="1"
            :step="0.5"
            @blur="handleThrottleIntervalMinutesBlur"
          />&nbsp;分钟内不多次跟进同一BOSS
        </el-form-item>
        <el-form-item label="跟进时限（天）" prop="rechatLimitDay" mb-0>
          <div>
            <div><el-checkbox v-model="enableRechatLimit" />&nbsp;启用</div>
            <el-input-number
              v-model="formContent.autoReminder.rechatLimitDay"
              class="w-150px"
              :min="0"
              :precision="1"
              :step="0.5"
              :disabled="!enableRechatLimit"
            />&nbsp;天<br />
            <div v-if="enableRechatLimit">
              不再跟进&nbsp;（<span class="text-orange">{{ rechatLimitDateString }}</span
              >）之前列表中没有进展的聊天
            </div>
            <div v-else>这将会跟进列表中所有聊天（<span class="text-orange">不建议</span>）</div>
          </div>
        </el-form-item>
        </section>
        <el-form-item>
          <el-tooltip
            effect="light"
            placement="bottom-start"
            @show="gtagRenderer('tooltip_show_about_stop_trace_one_boss')"
          >
            <template #content>
              <ul m0 line-height-1.5em w-300px pl2em>
                <li>
                  请向你不想继续提醒的Boss发送任意消息，发送后立即撤回的这条消息即可。
                  <br />
                  <br />
                  对于PC端BOSS直聘，鼠标移动到要撤回的消息，点按鼠标右键调出菜单，再鼠标左键点击菜单中的“撤回”。如图所示：
                  <br />
                  <img block w-full src="./resources/withdraw-message-guide.png" />
                </li>
              </ul>
            </template>
            <el-button type="text" font-size-12px
              ><span><QuestionFilled w-1em h-1em mr2px /></span
              >停止跟进帮助</el-button
            >
          </el-tooltip>
        </el-form-item>
        <el-form-item class="last-form-item settings-footer" flex>
          <el-button type="primary" @click="handleSubmit">开始提醒</el-button>
        </el-form-item>
      </el-form>
    </div>
    <div
      class="running-overlay__wrap"
      :style="{
        pointerEvents: 'none'
      }"
    >
      <RunningOverlay
        ref="runningOverlayRef"
        :worker-id="CURRENT_WORKER_ID"
        :run-record-id="runRecordId"
      >
        <template #op-buttons="{ currentRunningStatus }">
          <div>
            <template v-if="currentRunningStatus === RUNNING_STATUS_ENUM.RUNNING">
              <el-button
                type="danger"
                plain
                :loading="isStopButtonLoading"
                @click="handleStopButtonClick"
                >结束任务</el-button
              >
            </template>
            <template v-else>
              <el-button
                type="primary"
                @click="
                  () => {
                    runningOverlayRef?.hide?.()
                  }
                "
                >关闭</el-button
              >
            </template>
          </div>
        </template>
      </RunningOverlay>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { dayjs, ElForm, ElMessage, ElMessageBox, ElSelect, ElOption } from 'element-plus'
import { useRouter } from 'vue-router'
import {
  OPEN_CONTENT_SOURCE,
  // OPEN_LLM_FALLBACK,
  RECHAT_CONTENT_SOURCE,
  RECHAT_LLM_FALLBACK,
  RUNNING_STATUS_ENUM
} from '../../../../common/enums/auto-start-chat'
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'
import mittBus from '../../utils/mitt'
import { QuestionFilled } from '@element-plus/icons-vue'
import RunningOverlay from '@renderer/features/RunningOverlay/index.vue'
import { DEFAULT_CONSTANT_OPEN_CONTENT_SEGS } from '../../../../common/constant'
import { useTaskManagerStore } from '@renderer/store'
const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'rnrr-config',
    ...params
  })
}
const router = useRouter()
const formContent = ref({
  autoReminder: {
    throttleIntervalMinutes: 10,
    rechatLimitDay: 21,
    rechatContentSource: 1,
    recentMessageQuantityForLlm: 8,
    rechatLlmFallback: RECHAT_LLM_FALLBACK.SEND_LOOK_FORWARD_EMOTION,
    onlyRemindBossWithExpectJobType: true,
    onlyRemindBossWithoutBlockCompanyName: true,
    openContentSource: OPEN_CONTENT_SOURCE.CONSTANT_CONTENT,
    // openLlmFallback: OPEN_LLM_FALLBACK.SEND_CONSTANT_CONTENT,
    constantOpenContent: ''
  }
})

const enableRechatLimit = computed({
  get() {
    return Boolean(formContent.value.autoReminder?.rechatLimitDay)
  },
  set(val) {
    if (!val) {
      gtagRenderer('rechat_limit_disabled')
      formContent.value.autoReminder.rechatLimitDay = 0
    } else {
      gtagRenderer('rechat_limit_enabled')
      formContent.value.autoReminder.rechatLimitDay = 21
    }
  }
})

electron.ipcRenderer.invoke('fetch-config-file-content').then((res) => {
  const conf = res.config['boss.json']?.autoReminder || {}
  conf.throttleIntervalMinutes = conf.throttleIntervalMinutes ?? 10
  conf.rechatLimitDay = conf.rechatLimitDay ?? 21
  conf.rechatContentSource = conf.rechatContentSource ?? 1
  conf.recentMessageQuantityForLlm =
    typeof conf.recentMessageQuantityForLlm === 'number'
      ? conf.recentMessageQuantityForLlm > 20
        ? 20
        : conf.recentMessageQuantityForLlm < 8
          ? 8
          : parseInt(conf.recentMessageQuantityForLlm)
      : 8
  conf.onlyRemindBossWithExpectJobType = conf.onlyRemindBossWithExpectJobType ?? true
  conf.onlyRemindBossWithoutBlockCompanyName = conf.onlyRemindBossWithoutBlockCompanyName ?? true
  conf.rechatLlmFallback = conf.rechatLlmFallback ?? RECHAT_LLM_FALLBACK.SEND_LOOK_FORWARD_EMOTION
  conf.openContentSource = conf.openContentSource ?? OPEN_CONTENT_SOURCE.CONSTANT_CONTENT
  conf.constantOpenContent = conf.constantOpenContent ?? ''
  formContent.value.autoReminder = conf
})

const expectJobTypeRegExpStr = ref('')
const blockCompanyNameRegExpStr = ref('')
const fieldsForUseCommonConfig = ref<Record<string, boolean>>({})
async function fetchAutoStartChatConfig() {
  await electron.ipcRenderer.invoke('fetch-config-file-content').then((res) => {
    expectJobTypeRegExpStr.value = res.config['boss.json']?.expectJobTypeRegExpStr
    blockCompanyNameRegExpStr.value = res.config['boss.json']?.blockCompanyNameRegExpStr
    fieldsForUseCommonConfig.value = res.config['boss.json']?.fieldsForUseCommonConfig ?? {}
    commonJobConditionConfig.value = res.config['common-job-condition-config.json']
  })
}
fetchAutoStartChatConfig()
mittBus.on('auto-start-chat-with-boss-config-saved', fetchAutoStartChatConfig)
onUnmounted(() => {
  mittBus.off('auto-start-chat-with-boss-config-saved', fetchAutoStartChatConfig)
})
const commonJobConditionConfig = ref<Record<string, any>>({})
const unListenCommonJobConditionConfig = electron.ipcRenderer.on(
  'common-job-condition-config-updated',
  (_, { config }) => {
    commonJobConditionConfig.value = {
      ...config,
      expectCompanies: config?.expectCompanies?.map((it) => it.trim())?.join(',') ?? ''
    }
  }
)
onUnmounted(() => {
  unListenCommonJobConditionConfig()
})

const expectJobTypeRegExpStrForRender = computed(() => {
  return !fieldsForUseCommonConfig.value.jobDetail
    ? expectJobTypeRegExpStr.value
    : commonJobConditionConfig.value.expectJobTypeRegExpStr
})
const blockCompanyNameRegExpStrForRender = computed(() => {
  return !fieldsForUseCommonConfig.value.blockCompanyNameRegExpStr
    ? blockCompanyNameRegExpStr.value
    : commonJobConditionConfig.value.blockCompanyNameRegExpStr
})


const resumeContent = ref<string | null>(null)
async function fetchResumeContent() {
  await electron.ipcRenderer.invoke('fetch-resume-content').then((res) => {
    resumeContent.value = res
  })
}

fetchResumeContent()

const formRules = {
  throttleIntervalMinutes: {
    validator(_, value, cb) {
      if (/[^0-9.]/.test(String(value)) || isNaN(parseFloat(value)) || isNaN(Number(value))) {
        cb(new Error(`请输入数字！`))
      } else {
        cb()
      }
    }
  },
  rechatLimitDay: {
    validator(_, value, cb) {
      if (/[^0-9.]/.test(String(value)) || isNaN(parseFloat(value)) || isNaN(Number(value))) {
        cb(new Error(`请输入数字！`))
      } else {
        cb()
      }
    }
  }
}

const formRef = ref<InstanceType<typeof ElForm>>()
watch(
  () => formContent.value.autoReminder,
  () => {
    nextTick(() => {
      formRef.value?.validate?.()
    })
  },
  {
    immediate: true
  }
)

async function checkIsCanRun() {
  if (!(await electron.ipcRenderer.invoke('check-is-resume-content-valid'))) {
    gtagRenderer('cannot_launch_for_invalid_rc_dialog_show')
    try {
      await ElMessageBox.confirm(`简历内容无效；您需要编辑一下您的简历`, {
        cancelButtonText: '取消',
        confirmButtonText: '好的，去编辑我的简历',
        dangerouslyUseHTMLString: true
      })
      gtagRenderer('invalid_rc_dialog_click_confirm')
      try {
        await electron.ipcRenderer.invoke('resume-edit')
        await fetchResumeContent()
      } catch (err) {
        console.log(err)
      }
    } catch {
      gtagRenderer('invalid_rc_dialog_click_cancel')
    }
    return false
  }
  try {
    await electron.ipcRenderer.invoke('check-if-llm-config-list-valid')
  } catch (err) {
    if ((err instanceof Error ? err.message : undefined)?.includes(`CANNOT_FIND_VALID_CONFIG`)) {
      gtagRenderer('cannot_launch_for_invalid_llm_config')
      console.log(`大模型配置无效`, err)
      ElMessageBox.confirm(
        '大模型配置不存在或者包含无效配置<br />您是否希望查看并修正当前大模型配置？',
        '',
        {
          confirmButtonText: '是',
          cancelButtonText: '否',
          type: 'warning',
          closeOnClickModal: false,
          dangerouslyUseHTMLString: true
        }
      )
        .then(async () => {
          gtagRenderer('invalid_llm_config_tip_dialog_confirm')
          try {
            await router.push('/main-layout/LlmConfig')
          } catch (err) {
            console.log(err)
          }
        })
        .catch(() => {
          gtagRenderer('invalid_llm_config_tip_dialog_cancel')
        })
    } else {
      gtagRenderer('cannot_launch_for_check_llm_config_error', { err })
      ElMessage({
        type: 'error',
        message: '大模型配置检查未通过，请重试'
      })
    }
    return false
  }
  try {
    await electron.ipcRenderer.invoke('check-if-auto-remind-prompt-valid', { type: 'rechat' })
  } catch (err) {
    console.log(err)
    if ((err instanceof Error ? err.message : undefined)?.includes(`RESUME_PLACEHOLDER_NOT_EXIST`)) {
      gtagRenderer('cannot_launch_for_no_resume_placehold')
      console.log(`提示词模板无效`, err)
      ElMessageBox.confirm(
        '提示词模板缺少简历内容占位符：<br /><b>__REPLACE_REAL_RESUME_HERE__</b><br /><br />您是否希望还原默认的提示词模板？',
        '',
        {
          confirmButtonText: '是',
          cancelButtonText: '否',
          type: 'warning',
          closeOnClickModal: false,
          dangerouslyUseHTMLString: true
        }
      )
        .then(async () => {
          await restoreDefaultTemplate({
            type: 'rechat',
            gaEvName: 'confirm_invalid_rt_tip_dialog'
          })
        })
        .catch(() => {
          gtagRenderer('close_invalid_rt_tip_dialog')
        })
    } else {
      gtagRenderer('cannot_launch_for_check_prompt_error', { err })
      ElMessage({
        type: 'error',
        message: '用于生成自动提醒消息的提示词检查未通过，请重试'
      })
    }
    return false
  }

  return true
}
const runRecordId = ref<number>()
const runningOverlayRef = ref<InstanceType<typeof RunningOverlay>>()
const taskManagerStore = useTaskManagerStore()
const CURRENT_WORKER_ID = 'readNoReplyAutoReminderMain'

onMounted(async () => {
  await taskManagerStore.getRunningTasks()
  const existingWorker = taskManagerStore.runningTasks?.find(
    (it) => it.workerId === CURRENT_WORKER_ID
  )
  if (existingWorker) {
    runRecordId.value = existingWorker.runtimeStorage?.stepStatusMapByStepId
      ? Object.values(existingWorker.runtimeStorage.stepStatusMapByStepId)[0]?.runRecordId
      : undefined
    if (runRecordId.value) {
      runningOverlayRef.value?.show()
    }
  }
})

const handleSubmit = async () => {
  gtagRenderer('run_read_no_reply_reminder_clicked', {
    throttle_interval_minutes: formContent.value.autoReminder.throttleIntervalMinutes,
    rechat_limit_day: formContent.value.autoReminder.rechatLimitDay,
    rechat_content_source: formContent.value.autoReminder.rechatContentSource,
    recent_message_quantity_for_llm: formContent.value.autoReminder.recentMessageQuantityForLlm,
    only_remind_boss_with_expect_job_type:
      formContent.value.autoReminder.onlyRemindBossWithExpectJobType,
    only_remind_boss_without_block_company_name:
      formContent.value.autoReminder.onlyRemindBossWithoutBlockCompanyName,
    rechat_llm_fallback: formContent.value.autoReminder.rechatLlmFallback,
    open_content_source: formContent.value.autoReminder.openContentSource,
    constant_open_content_text_length: formContent.value.autoReminder.constantOpenContent.length ?? 0
  })
  await formRef.value!.validate()
  await electron.ipcRenderer.invoke('save-config-file-from-ui', JSON.stringify(formContent.value))
  gtagRenderer('config_saved')
  if (
    formContent.value.autoReminder?.rechatContentSource ===
      RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT ||
    formContent.value.autoReminder?.openContentSource ===
      OPEN_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT
  ) {
    if (!(await checkIsCanRun())) {
      return
    }
    if (!(await electron.ipcRenderer.invoke('resume-content-enough-detect'))) {
      gtagRenderer('rc_not_enough_dialog_show')
      try {
        await ElMessageBox.confirm(
          `简历内容可能不够充足（各个部分内容长度相加 <800 字）<br />后续大模型根据简历生成的内容将可能不符合预期（例如相同内容重复生成、生成预期之外的内容）<br /><br />要继续运行吗？`,
          {
            cancelButtonText: '不，我再看看',
            confirmButtonText: '是的，继续运行',
            dangerouslyUseHTMLString: true
          }
        )
        gtagRenderer('rc_not_enough_dialog_click_confirm')
      } catch {
        gtagRenderer('rc_not_enough_dialog_click_cancel')
        return
      }
    }
  }
  gtagRenderer('run_read_no_reply_reminder_launched')

  try {
    runningOverlayRef.value?.show()
    const { runRecordId: rrId } = await electron.ipcRenderer.invoke(
      'run-read-no-reply-auto-reminder'
    )
    runRecordId.value = rrId
  } catch (err) {
    if (err instanceof Error && err.message.includes('NEED_TO_CHECK_RUNTIME_DEPENDENCIES')) {
      gtagRenderer('rnrr_cannot_run_for_corrupt')
      ElMessage.error({
        message: `核心组件损坏，正在尝试修复`
      })
      router.replace('/')
    }
    console.error(err)
    gtagRenderer('rnrr_cannot_run_for_unknown_error', { err })
  }

  // {
  //   path: '/geekAutoStartChatWithBoss/prepareRun',
  //   query: { flow: 'read-no-reply-reminder' }
  // }
}
function handleThrottleIntervalMinutesBlur() {
  if (formContent.value.autoReminder.throttleIntervalMinutes < 3) {
    formContent.value.autoReminder.throttleIntervalMinutes = 3
  }
  formContent.value.autoReminder.throttleIntervalMinutes = Number(
    formContent.value.autoReminder.throttleIntervalMinutes
  )
}

const restoreDefaultTemplate = async ({ type, gaEvName }) => {
  gtagRenderer(gaEvName)
  await electron.ipcRenderer.invoke('overwrite-auto-remind-prompt-with-default', { type })
  ElMessage({
    type: 'success',
    message: '模板还原成功'
  })
}

const currentStamp = ref(new Date())
let timer = 0
function updateCurrentStamp() {
  currentStamp.value = new Date()
  timer = window.setTimeout(updateCurrentStamp, 1000)
}
updateCurrentStamp()
onUnmounted(() => {
  window.clearTimeout(timer)
})

const rechatLimitDateString = computed(() => {
  return dayjs(
    +currentStamp.value - formContent.value.autoReminder.rechatLimitDay * 24 * 60 * 60 * 1000
  ).format('YYYY-MM-DD HH:mm:ss')
})

const handleClickEditResume = async () => {
  gtagRenderer('edit_resume_clicked')
  try {
    await electron.ipcRenderer.invoke('resume-edit')
    await fetchResumeContent()
  } catch (err) {
    console.log(err)
  }
}

const handleClickEditPrompt = async ({ type }) => {
  gtagRenderer('edit_prompt_clicked', { type })
  await electron.ipcRenderer.send('no-reply-reminder-prompt-edit', { type })
}

// for 跟进话术
const rechatLlmFallbackOptions = [
  {
    name: '发送“[盼回复]”表情',
    value: RECHAT_LLM_FALLBACK.SEND_LOOK_FORWARD_EMOTION
  },
  {
    name: '退出已读不回自动复聊',
    value: RECHAT_LLM_FALLBACK.EXIT_REMINDER_PROGRAM
  }
]

// // for 开场白话术
// const openLlmFallbackOptions = [
//   {
//     name: '发送固定文案',
//     value: OPEN_LLM_FALLBACK.SEND_CONSTANT_CONTENT
//   },
//   {
//     name: '退出已读不回自动复聊',
//     value: OPEN_LLM_FALLBACK.EXIT_REMINDER_PROGRAM
//   }
// ]

async function handleTestEffectClicked() {
  gtagRenderer('goto_mock_chat_clicked')
  if (!(await checkIsCanRun())) {
    return
  }
  electron.ipcRenderer.send('test-llm-config-effect', {
    autoReminderConfig: JSON.parse(JSON.stringify(formContent.value.autoReminder))
  })
}

const needToCheckRuntimeDependenciesHandler = () => {
  router.replace('/')
}
electron.ipcRenderer.on('need-to-check-runtime-dependencies', needToCheckRuntimeDependenciesHandler)
onUnmounted(() => {
  electron.ipcRenderer.removeListener(
    'need-to-check-runtime-dependencies',
    needToCheckRuntimeDependenciesHandler
  )
})

const isStopButtonLoading = ref(false)
const handleStopButtonClick = async () => {
  gtagRenderer('rnrr_stop_button_clicked')
  isStopButtonLoading.value = true
  try {
    electron.ipcRenderer.invoke('stop-read-no-reply-auto-reminder')
    runningOverlayRef.value?.hide()
  } finally {
    isStopButtonLoading.value = false
  }
}

const defaultConstantOpenContent = computed(() => {
  if (
    formContent.value.autoReminder.rechatContentSource ===
    RECHAT_CONTENT_SOURCE.GEMINI_WITH_CHAT_CONTEXT
  ) {
    return DEFAULT_CONSTANT_OPEN_CONTENT_SEGS.join('；')
  }
  return DEFAULT_CONSTANT_OPEN_CONTENT_SEGS[0]
})
</script>

<style lang="scss">
.read-no-reply-reminder__wrap {
  position: relative;
  width: 100%;
  min-width: 0;
  color: var(--el-text-color-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  .page-heading { max-width: 1000px; margin: 0 auto 20px; }
  h2 { margin: 0; font-size: 24px; font-weight: 600; }
  h3 { margin: 0 0 16px; font-size: 16px; font-weight: 600; }
  .settings-card { padding: 22px; margin-bottom: 16px; border: 1px solid var(--el-border-color-light); border-radius: 12px; background: var(--el-bg-color); box-shadow: 0 2px 8px rgba(15, 23, 42, .025); }
  .settings-footer { padding: 16px 0; border-top: 1px solid var(--el-border-color-light); }
  .el-checkbox, .el-radio { height: auto; min-height: 32px; }
  .el-checkbox__label, .el-radio__label { white-space: normal; line-height: 1.6; }
  .form-wrap {
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
    overflow: auto;
    padding: 24px;
    .el-form {
      margin: 0 auto;
      max-width: 1000px;

    }
    .last-form-item {
      .el-form-item__content {
        margin-top: 0px;
        justify-content: flex-end;
      }
    }
  }
  .running-overlay__wrap {
    position: absolute;
    inset: 0;
  }
}
</style>
