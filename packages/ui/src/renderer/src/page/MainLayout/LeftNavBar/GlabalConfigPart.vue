<template>
  <div class="group-item">
    <div class="group-title">全局设置</div>
    <div flex flex-col class="link-list">
      <RouterLink to="/main-layout/CommonJobConditionConfig">公共职位正则筛选</RouterLink>
      <RouterLink to="/main-layout/AiJobMatch">AI 模型筛选</RouterLink>
      <RouterLink to="/main-layout/SettingsPreview">预览完整设置</RouterLink>
      <RouterLink to="/main-layout/BrowserPreferences">编辑浏览器偏好</RouterLink>
      <RouterLink to="/main-layout/LlmConfig">配置大语言模型</RouterLink>
    </div>
  </div>
</template>
<style scoped lang="scss" src="./style.scss"></style>
