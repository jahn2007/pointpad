# 桌游计分板

一个纯 HTML、CSS、JavaScript 实现的多人桌游累加计分网页。无需构建、无需后端、没有第三方依赖，托管在 GitHub Pages。

这是一个纯 Vibe Coding 项目，产品构思、界面设计和代码实现均通过人与 AI 的持续对话协作完成。

## 功能

- 2～12 位玩家，支持自定义姓名和颜色
- 每轮快捷加减分或直接输入整数
- 可在设置中开启小数分数并调整小数位数
- 已累计分数排名只统计已提交轮次，不会改变计分卡顺序
- 统一提交轮次，自动累加总分和计算并列排名
- 查看、修改和删除历史轮次
- 中途新增、暂停、调整顺序或永久删除玩家
- 多步撤销
- 浏览器本地自动保存，刷新或关闭页面后可继续
- 最终排名、最高单轮分数和完整成绩表
- 手机、平板和桌面端响应式布局
- 标题栏头像和 GitHub 项目入口均可通过配置管理

## 本地使用

直接打开 `index.html` 即可。也可以在项目目录启动任意静态文件服务器，例如：

```bash
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`。

## 部署到 GitHub Pages

1. 将本目录中的所有文件提交到 GitHub 仓库。
2. 打开仓库的 **Settings → Pages**。
3. 在 **Build and deployment** 中选择 **Deploy from a branch**。
4. 选择存放本项目的分支和目录，保存后等待部署完成。

项目全部使用相对路径，因此既可以放在仓库根目录，也可以作为项目页面部署在子路径下。

## 站点配置

基础配置集中在 `js/config.js`：

- `site.browserTitle`：浏览器标签页标题
- `site.headerTitle`：网页最上端显示的品牌标题
- `site.description`：网页描述
- `site.faviconPath`：浏览器图标和标题栏左侧头像；留空表示隐藏头像
- `site.githubUrl`：标题栏右侧 GitHub 链接；留空表示隐藏入口
- `site.themeColor`：浏览器主题色
- `game.defaultName`：默认对局名称
- `game.defaultPlayerCount`：默认玩家数量
- `game.minPlayers` / `game.maxPlayers`：人数限制
- `game.quickScores`：计分卡上的快捷分值
- `game.allowDecimalScores`：新对局是否默认允许小数分数
- `game.decimalPlaces`：新对局默认保留的小数位数
- `game.minDecimalPlaces` / `game.maxDecimalPlaces`：前端可设置的小数位数范围
- `playerColors`：默认玩家颜色
- `storage.key`：浏览器本地存储键名

首页海盗船使用 `asset/ship.png`，原图透明背景上的深色线条通过 CSS 反色显示，并使用低开销的位移动画。操作系统开启“减少动态效果”后动画会自动停用。

页面采用响应式布局；低宽度设备会重排工具栏、底部操作按钮和设置项，成绩表等宽内容则在自身容器内滚动，不会让整个页面产生横向滚动。海盗船容器始终限制在页面宽度内，仅通过不参与布局计算的 CSS 变换放大画面。

如果日后修改了已上线站点的数据结构，建议同时更换 `storage.key`，避免旧版数据和新版代码不兼容。

## 目录结构

```text
pointpad/
├── AI_HANDOFF.md       面向后续 AI 会话的项目交接文档
├── index.html          页面结构与对话框
├── asset/
│   ├── ship.png        首页海盗船图片
│   ├── favicon.png     网页图标原图
│   └── favicon-compressed.png  压缩后的网页图标
├── css/
│   ├── base.css        基础样式、控件和弹窗
│   └── app.css         各业务页面与响应式布局
└── js/
    ├── config.js       站点与计分参数配置
    ├── storage.js      本地存储
    ├── scoring.js      总分、排名和格式化逻辑
    └── app.js          状态管理和页面交互
```

## 数据说明

对局数据仅保存在当前浏览器的 `localStorage` 中，不会上传到服务器。清理浏览器站点数据会同时删除未完成的对局。
