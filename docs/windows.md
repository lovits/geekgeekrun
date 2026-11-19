# Windows 10 / Windows 11

本项目保留 macOS 版本，并支持 Windows 10 / 11 x64 的 NSIS 安装包。不是 ARM64 原生包。Windows 端沿用相同的正则筛选、AI 匹配、模拟、反馈、导出、开聊和回复功能。

## 安装使用

运行 `geekgeekrun-ui_0.17.4_x64_setup.exe`，可选择安装目录。安装包未进行商业代码签名，系统可能提示“未知发布者”；请核对来源后再决定是否安装。首次启动选择 Chrome 或软件提供的 Chrome for Testing，在 Windows 上重新登录 BOSS。不要复制 Mac 上的浏览器可执行路径和登录凭据。

- API 模式：在大模型配置中填写本人接口信息。
- Codex 模式：在 Windows 安装官方 Codex CLI 并运行 `codex login`，重新启动软件。程序寻找 `codex.exe`，包含 npm 全局安装目录中的原生二进制；不会通过 `.cmd` 拼接含简历的命令。
- PDF 导入需要 Poppler 的 `pdfinfo`、`pdftotext`、`pdftoppm` 在 PATH 中。没有安装时会显示提示，也可导入 TXT / Markdown；Poppler 不包含在此安装包内。
- 用户数据放在本人目录下的 `.geekgeekrun`，安装包不包含个人简历、账号、API 密钥或历史记录。Mac 和 Windows 的数据相互独立。

## 从源码构建

安装 Node.js 22 和 pnpm 8.15.9，在仓库根目录运行：

```powershell
pnpm install --frozen-lockfile
pnpm --dir packages/ui typecheck
pnpm --dir packages/ui build:win
```

产物在 `packages/ui/dist`。打包钩子仅对 Windows 生效，取得与 Electron 版本匹配的 Windows x64 SQLite 预编译文件，验证 PE 架构并放入安装包，不修改本机 Mac 的 SQLite 文件。构建时需联网下载 Electron、NSIS 和数据库预编译文件。已有 `build:mac` 入口继续保留。

手动运行 GitHub Actions 的 `Windows compatibility build` 可以在 Windows runner 构建并检查包内数据库和中文路径。工作流只上传构建产物，不发布 Release。本地改动未提交或推送时，远端工作流不包含这些改动。

macOS 上的单元测试和安装包检查不能代替 Win10 / Win11 真机上的登录、窗口、自动开聊和自动回复验收。
