# Fork 设置与更新

项目：https://github.com/lovits/geekgeekrun 。保留原项目来源与许可证。

## 输入预览与活跃度

模型输入预览隐藏“待匹配岗位”占位段落。实际匹配仍按 AI 开关提供岗位名称或描述。输入资料旁的问号解释已勾选资料的用途。

活跃度在岗位筛选预览中展示，并可在 AI 输入中勾选，统一读取自动开聊的设置。例如“三日内活跃”，实际 BOSS 状态未提供时不能推断为活跃。关闭模型输入不会关闭程序独立的活跃度规则。

## Codex 识别

大语言模型设置提供自动识别与手动文件选择。自动识别显示找到的路径和登录状态；手动路径用于模型列表、匹配、简历解析、反馈和回复。

Mac 示例：`/opt/homebrew/bin/codex`、`/usr/local/bin/codex`、`/Applications/Codex.app/Contents/Resources/codex`。

Windows 示例：`C:\Users\用户名\.local\bin\codex.exe`。npm 安装的原生程序可能在 `%APPDATA%\npm\node_modules\@openai\codex\vendor\x86_64-pc-windows-msvc\codex\codex.exe` 或平台包的 `vendor` 目录，以实际安装为准。不选择 `.cmd` / `.bat`，不通过 shell 拼接简历内容。

## 更新提醒

左下角「项目首页／反馈问题／自动更新」指向个人 Fork。默认启动时及每 30 分钟检查 GitHub 正式版本，可关闭自动检查或手动检查。网络错误会显示。

发布使用 `ui-v0.18.1` 或 `v0.18.1` 形式的版本号，不能标记 draft / prerelease，并上传相应平台与架构的安装包，例如 `..._x64_setup.exe`、`..._arm64.dmg`。仅推送代码不会触发提醒。

提醒后由用户点击下载并安装，不静默覆盖安装，也不自动中断正在进行的任务。个人简历、密钥、登录信息和运行历史不随代码上传。
