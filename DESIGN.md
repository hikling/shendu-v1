---
version: alpha
name: "慎独"
description: "供个人复盘使用的中文索引卡与回看长卷界面"
colors:
  overview-background: "#F5F7F5"
  overview-surface: "#FFFFFF"
  overview-ink: "#202B31"
  overview-muted: "#617178"
  overview-line: "#DCE4E2"
  primary-default: "#176B67"
typography:
  display:
    fontFamily: '"Songti SC", "Noto Serif SC", "STSong", serif'
  body:
    fontFamily: '"Noto Sans SC", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif'
rounded:
  category-card: "16px"
  record-card: "20px"
  menu: "18px"
spacing:
  overview-content-max: "1140px"
  top-navigation-height: "72px"
components:
  category-card: {}
  record-card: {}
  top-navigation: {}
---

# 慎独视觉规范

## Overview

### Creative North Star

一个人翻看自己写下的索引卡与长卷。概览的主句和六种时间尺度先建立方向，底部的真实记录缓慢经过；旧页面保留熟悉的书写工具气质。使用者是项目所有者本人，界面默认中文，日期按既有北京时间格式。

概览借鉴用户提供的参考图的四段布局和一处持续移动效果。它是产品首页，主句有品牌表达，导航和记录卡保持工具的清晰度。不要出现 ClassDojo 标识、角色、照片或文案，也不要把全部旧页面一起改成营销首页。六类入口采用紧凑图标菜单，参考 Coffee options 的小方块与名称展开反馈；由真实已完成复盘组成的弧形长卷承接下方。

**Token 归属：** 运行代码是规范值来源。`shendu/public/styles.css` 的 `.app-shell` 定义概览局部语义变量，`shendu/public/app.js` 的 `applyTheme()` 写入现有 `--primary` 等账户主题色。本文件镜像这些值并解释用途；改动两处时应在同一提交中核对映射。

## Colors

`overview-background` → `--overview-bg`：概览画布。`overview-surface` → `--overview-surface`：菜单和记录卡。`overview-ink` → `--overview-ink`：主句与标题。`overview-muted` → `--overview-muted`：说明、日期。`overview-line` → `--overview-line`：边界。交互强调色仍由账户主题的 `--primary` 决定，默认值为 `primary-default`；前景色使用既有 `--primary-contrast`。六类入口使用既有 `--type-color` / `--type-soft`，颜色只作辅助，不能替代语义图标和可访问名称。类别名称在悬停或键盘聚焦时向图标左侧展开，屏幕阅读器始终可读取入口名称。

这些概览颜色局限于新首页和顶部导航；旧复盘表单继续使用现有 `--paper`、`--ink` 等变量，直到各页面以后分别重做。

## Typography

主句与区域标题使用中文宋体类系统字形，体现静下来回看的节奏；菜单、入口、卡片和帮助文本使用中文无衬线栈，优先可读性。字族均有本地系统回退，不加载远程字体。长记录在卡片内限为短摘录，打开原记录后才阅读完整正文。数字与日期保持现有格式，不使用装饰性拉丁手写字体承载中文功能文字。

## Layout

顶部导航为 `top-navigation-height`，在窄屏缩为 64px。概览内容上限 `overview-content-max`，从居中主句进入紧凑图标菜单，再进入弧形回看。主句顶部留白由概览 `.overview-hero` 的 `clamp(30px,3vw,48px)` 控制，主句前不再放置「私人复盘空间」标签；六类入口前不放「选择一个时间尺度」。入口区域上限 780px，桌面图标方块为 64px；名称展开时按钮宽度增加，邻近图标随之让位。680px 以下三列排布，540px 以下方块为 44px，380px 以下为两列；窄屏按钮单元保留名称展开所需空间，展开不改变行数。长卷不设可见标题，紧接图标菜单，运动路径顶部基准为 60px。旧页面主体仍由既有 `.workspace` 与 `.main` 管理。底部运动只发生在独立内容窗口，不让文档产生横向溢出。

## Elevation & Depth

入口以细边和很浅的阴影区分画布；移动记录卡的阴影略深，以轻微错位表达纸卡的实体感。菜单浮层使用一层明确阴影，不叠加复杂玻璃或大面积渐变。文字始终落在纯色或近纯色面上。

## Shapes

入口、记录卡和菜单分别采用 frontmatter 中的圆角。图标方块桌面圆角 16px，窄屏随尺寸缩至 14px / 12px；顶部「慎」印有更紧的圆角。记录卡沿弧线切线方向轻微倾斜；键盘阅读或减少动态效果时改为摆正的静态列表。

## Components

### Foundational visual states

按钮、菜单和卡片有可见的悬停与 `:focus-visible` 状态。当前页面在顶部导航以文字、底色和短下划线同时标记。减少动态效果开启时，回看长卷停止自动移动，转为可滚动静态列表。

### Navigation and data display

顶部导航保留所有原有入口和权限条件。六类入口卡始终出现；顶部「复盘」菜单中的 90 天入口尊重阶段设置。记录卡只展示当前账户已完成或已验证的标题、类别、日期与短摘录；草稿不入长卷。卡片是进入原记录的按钮，不是装饰图片。

### Iconography and motion

六类入口复用 `NAV_ICON_PATHS` 的语义 SVG，与顶部菜单相同。悬停或键盘聚焦时，类别名称从图标左侧展开，图标短暂弹动；单击或 Enter 通过原有 `data-nav` 进入对应页面。方框内只放图标，名称在框外。减少动态效果时名称仍立即显示，关闭展开过渡和图标弹动。长卷沿两侧高、中央低的浅半圆弧连续移动，卡片随轨迹改变高度和角度；以自适应二次曲线路径呈现，循环复位位于可视窗口外。`bindOverviewArc()` 根据窗口和卡片尺寸生成路径、间距与时长，`.overview-record-card` 通过 CSS motion path 实际移动。界面不设暂停按钮；悬停暂停，键盘焦点进入可滚动静态列表，系统和账户减少动态效果设置拥有最终优先级。不显示「回看长卷」「已经写下的记录」及随机拾页说明。

## Do's and Don'ts

- **Do:** 从真实复盘内容建立画面，让用户一眼知道六类入口和过去完成的记录。
- **Do:** 把主题色、键盘焦点、窄屏和减少动态效果一起验证。
- **Don't:** 复制参考网站的品牌或把私人内容放在未登录页面。
- **Don't:** 为概览的视觉表达改变旧页面的复盘、保存、加密或备份规则。
