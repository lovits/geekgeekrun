<template>
  <div class="llm-config-page" :class="{ embedded }">
    <header class="window-heading"><h2>大语言模型设置</h2></header>
    <div class="main-wrapper"><main>
      <section class="provider-card">
        <el-form label-position="top"><el-form-item label="接入方式">
          <el-select v-model="activeProvider" @change="ensureProviderConfig"><el-option label="本机 Codex" value="codex-cli" /><el-option label="API 接入（OpenAI 兼容）" value="openai" /></el-select>
        </el-form-item></el-form>
      </section>
      <el-form ref="formRef" :model="formContentForElForm" :rules="formRulesForElForm" label-position="top" class="llm-config-form" :validate-on-rule-change="false">
        <section v-for="{ conf, index } in visibleConfigEntries" :key="conf.id" class="model-card">
          <div v-if="visibleConfigEntries.length > 1" class="model-card-heading"><strong>模型 {{ visibleConfigEntries.findIndex(item => item.index === index) + 1 }}</strong><div class="model-order"><el-button circle size="small" :icon="ArrowUp" aria-label="模型上移" :disabled="index <= visibleConfigEntries[0].index" @click="moveConfigUp(index)" /><el-button circle size="small" :icon="ArrowDown" aria-label="模型下移" :disabled="index >= visibleConfigEntries[visibleConfigEntries.length - 1].index" @click="moveConfigDown(index)" /><el-button circle size="small" :icon="Delete" aria-label="删除备用模型" @click="removeConfig(index)" /></div></div>
          <div v-if="conf.provider === 'codex-cli'" class="account-panel">
            <el-form-item label="Codex 识别方式"><el-radio-group v-model="conf.codexDetectionMode" @change="refreshCodex(conf)"><el-radio value="auto">自动识别</el-radio><el-radio value="manual">手动选择</el-radio></el-radio-group></el-form-item>
            <el-form-item v-if="conf.codexDetectionMode === 'manual'" label="Codex 可执行文件"><el-input v-model="conf.codexBinaryPath" placeholder="选择 codex 或 codex.exe"><template #append><el-button @click="chooseCodex(conf)">选择文件</el-button></template></el-input><p class="helper">本机自动识别路径：{{ codexAccount.binary || '尚未识别，请点刷新' }}</p><p class="helper">Windows npm 安装示例：C:\Users\用户名\AppData\Roaming\npm\node_modules\@openai\codex\vendor\x86_64-pc-windows-msvc\codex\codex.exe（以本机实际安装目录为准，不选择 codex.cmd）。</p></el-form-item>

            <div class="account-summary"><el-tag :type="codexAccount.loggedIn ? 'success' : 'info'" effect="plain">{{ codexAccount.loggedIn ? '已登录' : '未登录' }}</el-tag><span>{{ codexAccount.email || '使用本机 Codex 登录账号' }}</span></div>
            <div class="account-actions"><el-button size="small" @click="refreshCodex">刷新账号与模型</el-button><el-button size="small" :loading="testingCodex" @click="testCodex(conf)">测试连接</el-button></div>
            <p v-if="codexTestResult" class="connection-result" role="status">{{ codexTestResult }}</p>
            <el-collapse class="quiet-collapse"><el-collapse-item title="CLI 与登录信息" name="cli"><p class="path-text">{{ codexAccount.binary }}</p><p>{{ codexAccount.loginMethod }}</p><p class="helper">模型目录不代表账号权限，以测试连接为准。</p></el-collapse-item></el-collapse>
          </div>
          <template v-else>
            <el-form-item :prop="`${index}_providerCompleteApiUrl`" label="服务地址 Base URL"><el-input ref="firstInputRefList" v-model="conf.providerCompleteApiUrl" placeholder="https://…/v1" /></el-form-item>
            <div class="api-tools"><el-dropdown @command="item => handlePresetClick(item, index)"><el-button size="small">配置模板<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-for="item in llmPresetList" :key="item.name" :command="item">{{ item.name }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
              <el-dropdown @command="item => openExternalLink(item.url)"><el-button size="small">获取 API Secret<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item v-for="item in providerList" :key="item.name" :command="item">{{ item.name }}</el-dropdown-item></el-dropdown-menu></template></el-dropdown>
            </div>
          </template>
          <el-form-item label="模型">
            <el-select v-if="conf.provider === 'codex-cli'" v-model="conf.model" placeholder="自动选择" filterable @change="() => { conf.reasoningEffort = ''; conf.contextWindowTokens = 0 }"><el-option label="自动选择（Codex 默认）" value="" /><el-option v-for="item in codexModels" :key="item.id" :label="item.displayName || item.id" :value="item.id" /></el-select>
            <el-input v-else v-model="conf.model" placeholder="模型名称" />
          </el-form-item>
          <template v-if="conf.provider === 'codex-cli'">
            <div class="parameter-grid">
              <el-form-item label="推理强度"><el-select v-model="conf.reasoningEffort" placeholder="模型默认"><el-option label="模型默认" value="" /><el-option v-for="item in reasoningOptions(conf.model)" :key="item.reasoningEffort" :label="item.reasoningEffort" :value="item.reasoningEffort" /></el-select></el-form-item>
              <el-form-item label="上下文长度（tokens）"><el-input-number v-if="contextLimits(conf.model)" :model-value="conf.contextWindowTokens || contextLimits(conf.model).defaultTokens" :min="contextLimits(conf.model).minTokens" :max="contextLimits(conf.model).maxTokens" :step="1000" :precision="0" @update:model-value="value => { conf.contextWindowTokens = value || 0 }" /><span v-else class="helper">跟随模型默认</span></el-form-item>
            </div>
            <div v-if="contextLimits(conf.model)" class="context-info"><span>默认 {{ contextLimits(conf.model).defaultTokens.toLocaleString() }} · 范围 {{ contextLimits(conf.model).minTokens.toLocaleString() }}–{{ contextLimits(conf.model).maxTokens.toLocaleString() }}</span><el-button link type="primary" @click="conf.contextWindowTokens = 0">恢复默认</el-button></div>
            <p v-if="modelListError" class="error-text">{{ modelListError }}</p>
            <el-collapse class="quiet-collapse"><el-collapse-item title="关于上下文" name="context"><p class="helper">范围来自本机模型资料，实际支持以连接测试为准。调整长度不能增加模型上限；未自定义时使用模型默认值。</p></el-collapse-item></el-collapse>
          </template>
          <el-form-item v-else label="API Secret"><el-input v-model="conf.providerApiSecret" type="password" show-password autocomplete="off" /></el-form-item>
          <div class="enable-row"><el-checkbox v-model="conf.enabled" v-if="visibleConfigEntries.length > 1">启用此模型</el-checkbox><el-checkbox v-else :model-value="true" disabled>启用此模型</el-checkbox><label class="weight-control">权重 <el-input-number v-if="visibleConfigEntries.length > 1" v-model="conf.serveWeight" :min="1" :max="100" :precision="0" size="small" /><el-input-number v-else :model-value="SINGLE_ITEM_DEFAULT_SERVE_WEIGHT" disabled size="small" /></label></div>
          <el-collapse v-if="conf.provider === 'openai'" class="quiet-collapse"><el-collapse-item title="API 兼容与数据说明" name="api"><p class="helper">需兼容 OpenAI Chat Completions。当前请求参数不适用于部分推理模型。勾选的简历和岗位资料会发送给此服务，请确认服务商。</p></el-collapse-item></el-collapse>
        </section>
      </el-form>
    </main></div>
    <footer><el-button link type="primary" @click="addConfig">添加备用模型</el-button><div><el-button @click="handleCancel">取消</el-button><el-button type="primary" @click="handleSubmit">保存配置</el-button></div></footer>
  </div>
</template>
<script lang="ts" setup>
import { useRouter } from 'vue-router'
const { embedded = false } = defineProps<{ embedded?: boolean }>()
const router = useRouter()
import {
  ElForm,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElIcon,
  ElButton,
  ElInput,
  ElMessage
} from 'element-plus'
import { ArrowUp, ArrowDown, Delete } from '@element-plus/icons-vue'
import { ref, onMounted, onActivated, nextTick, computed } from 'vue'
import { gtagRenderer as baseGtagRenderer } from '@renderer/utils/gtag'
import { SINGLE_ITEM_DEFAULT_SERVE_WEIGHT } from '../../../../common/constant'
import { v4 as uuid } from 'uuid'
interface LlmConfigItem {
  id: string
  provider?: string
  codexDetectionMode?: string
  codexBinaryPath?: string
  providerCompleteApiUrl: string
  providerApiSecret: string
  model: string
  reasoningEffort?: string
  contextWindowTokens?: number
  serveWeight: number
  enabled: boolean
}

const gtagRenderer = (name, params?: object) => {
  return baseGtagRenderer(name, {
    scene: 'llm-config',
    ...params
  })
}

function getNewConfigItem(): LlmConfigItem {
  return {
    id: uuid(),
    codexDetectionMode: 'auto', codexBinaryPath: '',
    provider: 'openai',
    providerCompleteApiUrl: '',
    providerApiSecret: '',
    model: '',
    reasoningEffort: '',
    contextWindowTokens: 0,
    serveWeight: 10,
    enabled: true
  }
}
const codexAccount = ref({ loggedIn: false, email: '', binary: '', loginMethod: '' })
const testingCodex = ref(false)
const codexTestResult = ref('')
const codexModels = ref<any[]>([])
const modelListError = ref('')
function contextLimits(model: string) { return codexModels.value.find(it => it.id === model)?.contextLimits }
function reasoningOptions(model: string) { return (codexModels.value.find(it => it.id === model)?.supportedReasoningEfforts || []).filter(item => ['low', 'medium', 'high', 'xhigh', 'max'].includes(item.reasoningEffort)) }
async function refreshCodex(settings?: any) {
  const config = settings?.provider ? settings : formContent.value.find(it => it.provider === 'codex-cli') || {}
  if (config.codexDetectionMode === 'manual' && !config.codexBinaryPath) config.codexBinaryPath = codexAccount.value.binary || ''
  try { codexAccount.value = await electron.ipcRenderer.invoke('codex-status', JSON.parse(JSON.stringify(config))) }
  catch(error) { codexAccount.value = { loggedIn: false, email: '', binary: config.codexBinaryPath || '', loginMethod: '识别失败' }; codexModels.value = []; modelListError.value = String(error); return }
  modelListError.value = ''
  try { codexModels.value = await electron.ipcRenderer.invoke('codex-models', JSON.parse(JSON.stringify(config))) }
  catch (error) { modelListError.value = String(error) }
}

async function chooseCodex(config: LlmConfigItem) {
  const result = await electron.ipcRenderer.invoke('choose-file', { fileChooserConfig: { title: '选择 Codex 可执行文件', properties: ['openFile'] } })
  if (result?.filePaths?.[0]) { config.codexBinaryPath = result.filePaths[0]; await refreshCodex(config) }
}

async function testCodex(config: LlmConfigItem) {
  testingCodex.value = true
  try {
    codexTestResult.value = await electron.ipcRenderer.invoke('test-codex-connection', { codexDetectionMode: config.codexDetectionMode, codexBinaryPath: config.codexBinaryPath, model: config.model, reasoningEffort: config.reasoningEffort || '', contextWindowTokens: config.contextWindowTokens || 0 })
  } catch (error) {
    codexTestResult.value = String(error)
  } finally {
    testingCodex.value = false
  }
}
const formRef = ref<InstanceType<typeof ElForm>>()
const formContent = ref<LlmConfigItem[]>([getNewConfigItem()])
const activeProvider = ref('openai')
const visibleConfigEntries = computed(() => formContent.value.map((conf, index) => ({ conf, index })).filter(({ conf }) => (conf.provider || 'openai') === activeProvider.value))
function ensureProviderConfig() {
  if (!visibleConfigEntries.value.length) formContent.value.push({ ...getNewConfigItem(), provider: activeProvider.value, providerCompleteApiUrl: activeProvider.value === 'codex-cli' ? 'codex://local' : '' })
}


const formContentForElForm = computed(() => {
  const valueMap = {}
  formContent.value.forEach((configItem, i) => {
    valueMap[`${i}_providerCompleteApiUrl`] = configItem.providerCompleteApiUrl
  })
  return valueMap
})
const formRulesForElForm = computed(() => {
  const valueMap = {}
  formContent.value.forEach((conf, i) => {
    if ((conf.provider || 'openai') !== activeProvider.value || conf.provider === 'codex-cli') return
    valueMap[`${i}_providerCompleteApiUrl`] = [
      {
        required: true,
        message: '请输入服务提供商 Base URL'
      },
      {
        trigger: 'blur',
        validator(_, value, cb) {
          try {
            new URL(value?.trim())
          } catch (err) {
            cb(`URL 格式无效，请重新输入`)
          }
          if (/^http(s)?:\/\//.test(value)) {
            cb()
            return
          }
          cb(`服务提供商 Base URL 无效，请重新输入`)
        }
      }
    ]
  })
  return valueMap
})

const handleCancel = () => {
  gtagRenderer('cancel_clicked')
  if (embedded) router.push('/main-layout/SettingsPreview')
  else electron.ipcRenderer.send('close-llm-config')
  gtagRenderer('cancel_done')
}

const handleSubmit = async () => {
  gtagRenderer('submit_clicked', { llm_config_length: formContent.value.length })
  await formRef.value?.validate()
  const selectedConfigs = visibleConfigEntries.value.map(it => it.conf)
  if (selectedConfigs.length === 1) selectedConfigs[0].enabled = true
  if (!selectedConfigs.some(it => it.enabled)) { ElMessage.warning('请至少启用一个模型'); return }
  formContent.value.forEach(it => { if ((it.provider || 'openai') !== activeProvider.value) it.enabled = false })
  if (!formContent.value.length) {
    gtagRenderer('empty_model_list')
    ElMessage.warning({
      message: '可选模型列表为空，请出现填写'
    })
    formContent.value = [getNewConfigItem()]
    return
  } else if (formContent.value.length > 1) {
    const firstEnabledModel = formContent.value.find(it => it.enabled)
    if (!firstEnabledModel) {
      gtagRenderer('no_enabled_model_find_in_model_list')
      ElMessage.warning({
        dangerouslyUseHTMLString: true,
        grouping: true,
        message: '<div style="white-space: nowrap">所有模型均被禁用；请至少启用一个模型</div>'
      })
      return
    }
  }
  try {
    await electron.ipcRenderer.invoke('save-llm-config', JSON.parse(JSON.stringify(formContent.value)), { embedded })
    gtagRenderer('submit_done')
    if (embedded) ElMessage.success('模型配置已保存')
  } catch (error) { ElMessage.error(String(error)) }
}

async function loadSettings() {
  await refreshCodex()
  const savedFileContent = (await electron.ipcRenderer.invoke('fetch-config-file-content'))
    ?.config?.['llm.json']
  if (!savedFileContent?.length) {
    return
  }
  const keyOfItem = Object.keys(getNewConfigItem())
  formContent.value = savedFileContent.map((it) => {
    const conf: any = {}
    for (const k of keyOfItem) {
      conf[k] = it[k]
    }
    if (!it.id) {
      conf.id = uuid()
    }
    conf.provider = conf.provider || 'openai'
    conf.codexDetectionMode ||= 'auto'
    conf.codexBinaryPath ||= ''
    return conf
  })
  activeProvider.value = formContent.value.find(it => it.enabled)?.provider || formContent.value[0]?.provider || 'openai'
}
onMounted(() => { if (!embedded) loadSettings() })
onActivated(() => { if (embedded) loadSettings() })

const llmPresetList: {
  name: string
  config: Omit<LlmConfigItem, 'id'>
}[] = [
  {
    name: '由 DeepSeek 提供的 DeepSeek-V3 模型',
    config: {
      model: 'deepseek-chat',
      providerApiSecret: '',
      providerCompleteApiUrl: 'https://api.deepseek.com/v1',
      serveWeight: 100,
      enabled: true
    }
  },
  {
    name: '由 火山引擎 提供的 DeepSeek-V3 模型',
    config: {
      model: 'deepseek-v3-250324',
      providerApiSecret: '',
      providerCompleteApiUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      serveWeight: 100,
      enabled: true
    }
  },
  {
    name: '由 阿里云百炼 提供的 DeepSeek-V3 模型',
    config: {
      model: 'deepseek-v3',
      providerApiSecret: '',
      providerCompleteApiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      serveWeight: 100,
      enabled: true
    }
  },
  // TODO:
  // {
  //   name: '通过 Ollama 部署的 DeepSeek-R1（14B）模型',
  //   config: {
  //     model: 'deepseek-r1:14b',
  //     providerApiSecret: 'ollama',
  //     providerCompleteApiUrl: 'http://127.0.0.1:11434/v1',
  //     serveWeight: 10,
  //     enabled: true
  //   }
  // },
  {
    name: '由 free.v36.cm 提供的 GPT-4o mini 模型',
    config: {
      model: 'gpt-4o-mini',
      providerApiSecret: 'YOUR_API_KEY',
      providerCompleteApiUrl: 'https://free.v36.cm/v1',
      serveWeight: 20,
      enabled: true
    }
  },
  {
    name: '通过 Ollama 部署的 Qwen2.5（7B）模型',
    config: {
      model: 'qwen2.5:7b',
      providerApiSecret: 'ollama',
      providerCompleteApiUrl: 'http://127.0.0.1:11434/v1',
      serveWeight: 10,
      enabled: true
    }
  }
]

const providerList: Array<{ name: string; url: string }> = [
  {
    name: 'DeepSeek',
    url: 'https://platform.deepseek.com/'
  },
  {
    name: '火山引擎 - 火山方舟',
    url: 'https://console.volcengine.com/ark'
  },
  {
    name: '阿里云百炼',
    url: 'https://bailian.console.aliyun.com/?tab=model#/api-key'
  },
  {
    name: 'OpenAI (国内可能不可用)',
    url: 'https://platform.openai.com/api-keys'
  },
  {
    name: 'FREE-CHATGPT-API (免费)',
    url: 'https://github.com/popjane/free_chatgpt_api'
  }
]

function handlePresetClick(selected: (typeof llmPresetList)[number], index) {
  gtagRenderer('model_preset_clicked', {
    name: selected.name
  })
  for (const k of Object.keys(formContent.value[index])) {
    formContent.value[index][k] = selected.config[k]
  }
  if (!formContent.value[index].id) {
    formContent.value[index].id = uuid()
  }
  formContent.value[index].provider = activeProvider.value
}

const firstInputRefList = ref<InstanceType<typeof ElInput>[]>([])
function addConfig() {
  gtagRenderer('new_config_item_added', { config_list_length_before_add: formContent.value.length })
  formContent.value.push({ ...getNewConfigItem(), provider: activeProvider.value, providerCompleteApiUrl: activeProvider.value === 'codex-cli' ? 'codex://local' : '' })
  nextTick(() => {
    firstInputRefList.value[firstInputRefList.value.length - 1]?.focus()
  })
}
function moveConfigUp(index) {
  ;[formContent.value[index], formContent.value[index - 1]] = [
    formContent.value[index - 1],
    formContent.value[index]
  ]
  gtagRenderer('config_item_moved_up')
}

function moveConfigDown(index) {
  ;[formContent.value[index], formContent.value[index + 1]] = [
    formContent.value[index + 1],
    formContent.value[index]
  ]
  gtagRenderer('config_item_moved_down')
}

function removeConfig(index) {
  formContent.value.splice(index, 1)
  gtagRenderer('config_item_removed')
}

const openExternalLink = (url) => {
  electron.ipcRenderer.send('open-external-link', url)
}

// function handleTestAvailability() {}
</script>

<style lang="scss" scoped>
.llm-config-page { height: 100vh; display: flex; flex-direction: column; min-width: 0; overflow: hidden; color: var(--el-text-color-primary); background: var(--el-bg-color); font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif; font-size: 14px; }
.window-heading { width: 100%; max-width: 1056px; box-sizing: border-box; margin: 0 auto; padding: 24px 28px 0; background: var(--el-bg-color); } h2 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -.4px; } .window-heading p { margin: 6px 0 0; font-size: 13px; color: var(--el-text-color-secondary); }
.main-wrapper { flex: 1; min-height: 0; min-width: 0; overflow-y: auto; overflow-x: hidden; } main { box-sizing: border-box; width: 100%; max-width: 1040px; padding: 24px 28px; margin: 0 auto; }
.provider-card, .model-card { box-sizing: border-box; min-width: 0; padding: 22px; margin-bottom: 16px; box-shadow: 0 2px 8px rgba(15, 23, 42, .025); border: 1px solid var(--el-border-color-light); border-radius: 12px; background: var(--el-bg-color); }
.model-card-heading, .account-summary, .account-actions, .api-tools, .context-info, .enable-row, .model-order { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; } .model-card-heading { justify-content: space-between; margin-bottom: 18px; } .model-order { gap: 4px; } .model-order .el-button + .el-button { margin-left: 0; }
.account-panel { padding: 14px 16px 6px; margin-bottom: 20px; background: var(--el-color-primary-light-9); border-radius: 8px; min-width: 0; } .account-summary span { overflow-wrap: anywhere; font-size: 13px; } .account-actions { margin-top: 12px; } .account-actions .el-button + .el-button { margin-left: 0; } .connection-result { font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.helper, .path-text, .context-info { font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.7; overflow-wrap: anywhere; white-space: normal; } .helper { margin: 4px 0; } .path-text { font-family: ui-monospace, monospace; } .parameter-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px; } .context-info { justify-content: space-between; gap: 8px; margin-top: -8px; } .context-info .el-button { margin-left: auto; }
.enable-row { justify-content: space-between; margin-top: 12px; } .weight-control { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--el-text-color-regular); } .weight-control .el-input-number { width: 110px; } .api-tools { margin: -4px 0 20px; } .error-text { color: var(--el-color-danger); font-size: 13px; overflow-wrap: anywhere; }
.quiet-collapse { border: 0; } .quiet-collapse :deep(.el-collapse-item__header) { height: 36px; background: transparent; border: 0; font-size: 12px; line-height: 1.6; } .quiet-collapse :deep(.el-collapse-item__wrap) { background: transparent; border: 0; } .quiet-collapse :deep(.el-collapse-item__content) { padding-bottom: 12px; }
.llm-config-form, .llm-config-form :deep(.el-form-item__content) { min-width: 0; } :deep(.el-select), .parameter-grid :deep(.el-input-number) { width: 100%; } :deep(.el-input__wrapper) { min-width: 0; } footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 16px 28px; background: var(--el-bg-color); border-top: 1px solid var(--el-border-color-light); flex-shrink: 0; }
@media (max-width: 640px) { .parameter-grid { grid-template-columns: minmax(0, 1fr); gap: 0; } main { padding: 16px; } .window-heading { padding: 20px; } footer { padding: 14px 20px; } }
.llm-config-page.embedded { height: 100%; flex: 1; min-height: 0; }
</style>
