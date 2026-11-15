# 复盘切题视觉过渡

## Goal
六类复盘切换题目时，文字、输入区和插画柔和过渡，避免整页突然闪现。按钮和鼠标滚轮保持同一种反馈。

## Requirements
- 上一题、下一题及滚轮触发统一过渡，区分前进与后退；同阶段及跨阶段都有效。
- 短淡出衔接淡入和小幅位移，稳定背景、导航和版式，不做整页白闪或大范围飞动。
- 快速连续操作不叠加、不排长队、不跳错题；取消或页面替换后没有迟到回调。
- 必填校验失败时原位展示错误，输入节点和值、只读、保存保护及焦点语义保持。
- 尊重账户减少动态效果和系统prefers-reduced-motion；不支持动画时照常切题。

## Acceptance
- [x] 六类按钮和滚轮均走同一动画入口，有行为测试验证时序和清理。
- [x] 错误校验、输入保留、只读、忙碌、快速导航和减少动态回归通过。
- [x] 检查构建及354项应用测试、13项交接测试通过，文档同步。
- [ ] 提交main并核对GitHub构建发布。

Browser access was unavailable in the preceding task; the user chose code and automated acceptance. Attempt access when available without repeating a permission request, and record remaining visual acceptance honestly.
