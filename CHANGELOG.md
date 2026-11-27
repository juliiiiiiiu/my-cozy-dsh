# Changelog

## 1.0.12

- 安装或更新后，首次打开并满足展示条件就出现加星便签，不再等 48 小时；旧版的关闭记录不再生效。
- 一键加星失败或超时（包括未安装或未登录 GitHub CLI）时，主按钮改为「去 GitHub 加星」。仅打开链接不算加星。
- 第一次关闭后七天再提醒一次；第二次关闭或一键加星成功后不再提醒。
- 修复三栏布局：打开右栏时收起小狗和椅子，小猫头贴着中栏输入框，右栏边框随面板移动，不再留下重复描边。
- The star note appears once the conversation settles after installing or updating, without a 48-hour delay. Previous dismissals no longer apply.
- If one-click starring fails or times out, including when GitHub CLI is missing or signed out, the main button links to GitHub. Opening the link does not count as starring.
- The note returns once seven days after the first dismissal. A second dismissal or a confirmed star stops future reminders.
- In three-column mode, the dog and chair tuck away, the cat head stays on the middle composer, and the inspector's border no longer leaves a duplicate stroke while resizing.

## 1.0.11

- 加星优先使用现有 HTTPS 代理环境变量，否则在 macOS 读取已启用的手动 HTTPS 代理，并尊重 GitHub 的代理例外。不修改系统设置。
- Use the existing HTTPS proxy environment or the eligible manual macOS HTTPS proxy for GitHub CLI. No proxy address is bundled.

## 1.0.10

- 点击「加一颗星」才尝试使用宿主上 GitHub CLI 的登录给 GitHub 仓库加星。未授权时，按钮原地变为「去 GitHub 加星」，再次点击才打开仓库；网络错误可重试。
- Replace the local-only star with a GitHub-confirmed star, an explicit GitHub link when authorization is unavailable, and a retry on temporary failures.

## 1.0.9

- 新增爱心橘猫点星便签。首次使用主题满 48 小时后，便签会在会话中自动出现，无需点击猫咪；输入或打开对话框时暂缓。
- 点星和关闭状态只保存在当前设备，不跳转，也不提交到 GitHub。
- Added a dismissible orange-tabby star note that opens automatically in conversation after 48 hours. Stars are saved only on the current device; no GitHub action is taken.

## 1.0.8

### 修复

- 修复浅色模式下 Remote 等弹窗面板透明、透出灰色遮罩的问题。仅在弹窗容器内恢复不透明纸色底，保留主界面壁纸透出效果；深色模式不应用此规则。
- 保留 1.0.7 的原生调宽、自适应装饰和灯光透明度功能。

### Fixed

- Restore opaque paper surfaces inside light-mode dialogs, including the Remote workbench, instead of letting their dark scrims show through. Keep the app shell transparent for the wallpaper; the new rule does not apply in dark mode.
- Retain the native width controls, adaptive decorations, and lamp transparency features from 1.0.7.

### Verification

- Automated source and unit tests, JavaScript syntax validation, and release-package content checks.
- Added a source regression check for the light-mode dialog rule, paper token, and transparent shell. This does not replace browser computed-style verification; live visual verification was not independently repeated for this release.

## 1.0.7

### 修复

- 恢复信息流左右两侧原生拖拽调宽，正文与输入框同步变化并保留用户偏好，移除主题对宽度及首次拖动基准的覆盖。
- 保留两侧装饰跟随、缩放和空间不足时独立隐藏的规则：左侧不足 90px 隐藏狗狗、椅子和地毯；右侧不足 80px 隐藏柜子和鱼缸；空间恢复后重新显示。
- 将连续柔边灯光和 Transparency 控件一同纳入正式发布。暖光、白光和彩虹光支持 0–100% 透明度，设置可保存，输入框区域不被灯光覆盖。

### Fixed

- Restore native conversation-width dragging, synchronized transcript/composer sizing, and saved preferences without a conflicting theme width or first-drag baseline.
- Retain adaptive scene decorations, independent narrow-gutter hiding, and automatic restoration.
- Ship continuous feathered lighting and persistent 0–100% Transparency controls for Warm, White, and Rainbow modes, with the composer excluded from the light field.

### Verification

- Real pointer drags and screenshots in the running Harness app verified both handles, decoration scaling, hide/restore behavior, and width persistence after refresh.
- Source and unit regressions cover native width ownership, decoration thresholds/resize observation, all lighting modes, transparency endpoints, and transparency persistence.
