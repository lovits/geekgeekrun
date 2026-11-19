# GeekGeekRun Pro 桌面端

基于 Electron、Vue 和 TypeScript。安装、配置、截图与完整操作步骤见 [项目使用指南](../../README.md)。

从仓库根目录执行：

```bash
pnpm install --frozen-lockfile
pnpm --dir packages/ui dev
pnpm --dir packages/ui typecheck
pnpm --dir packages/ui build:make-dist-for-current-platform
```

使用 Node.js 22 与 pnpm 8.15.9。安装包输出到本目录的 `dist`；当前平台构建命令不发布 GitHub Release。跨平台构建与原生数据库检查见 [发布工作流](../../.github/workflows/release-ui.yml)。
