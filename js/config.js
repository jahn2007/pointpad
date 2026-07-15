/*
 * 站点基础配置
 * 修改此文件即可调整页面标题、图标、人数限制、快捷分值和默认颜色。
 * faviconPath 留空表示暂不使用网页图标；填写相对路径后会自动加载。
 */
window.SCOREKEEPER_CONFIG = Object.freeze({
  site: {
    // 浏览器标签页显示的标题（待站长填写）
    browserTitle: "桌游计分板",
    // 网页最上端品牌区域显示的标题（待站长填写）
    headerTitle: "A Mirror送给海盗们的桌游计分板",
    shortName: "计分板",
    description: "一个纯Vibe Coding的项目",
    faviconPath: "/asset/favicon-compressed.png",
    themeColor: "#10131a"
  },
  game: {
    defaultName: "今晚的桌游",
    defaultPlayerCount: 4,
    minPlayers: 2,
    maxPlayers: 12,
    quickScores: [-10, -5, -1, 1, 5, 10],
    allowDecimalScores: false,
    decimalPlaces: 2,
    minDecimalPlaces: 1,
    maxDecimalPlaces: 4,
    maxUndoSteps: 30,
    unusuallyLargeScore: 200
  },
  playerColors: [
    "#ff6b52",
    "#6c8cff",
    "#35c98d",
    "#f2b84b",
    "#b77aff",
    "#f46ca5",
    "#43b9cf",
    "#9bc14f",
    "#ff8a47",
    "#7b7fea",
    "#26a69a",
    "#d76a6a"
  ],
  storage: {
    key: "board-game-scorekeeper-state-v1"
  }
});
