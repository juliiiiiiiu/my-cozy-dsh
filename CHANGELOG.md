# Changelog

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
