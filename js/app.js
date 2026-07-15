(function () {
  "use strict";

  const config = window.SCOREKEEPER_CONFIG;
  const store = window.ScoreStore;
  const scoreMath = window.ScoreMath;

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const clone = (value) => JSON.parse(JSON.stringify(value));

  let state = createFreshState();
  let savedState = normalizeState(store.load());
  let pendingConfirmation = null;

  const elements = {
    setupView: $("#setup-view"),
    gameView: $("#game-view"),
    resultsView: $("#results-view"),
    siteName: $("#site-name"),
    siteAvatar: $("#site-avatar"),
    githubLink: $("#github-link"),
    gameNameInput: $("#game-name-input"),
    setupPlayerList: $("#setup-player-list"),
    playerCount: $("#player-count"),
    resumeBanner: $("#resume-banner"),
    resumeDetail: $("#resume-detail"),
    currentGameName: $("#current-game-name"),
    currentRound: $("#current-round"),
    gameSummary: $("#game-summary"),
    scoreGrid: $("#score-grid"),
    draftTotal: $("#draft-total"),
    submitRound: $("#submit-round"),
    undoAction: $("#undo-action"),
    historyDialog: $("#history-dialog"),
    historyContent: $("#history-content"),
    settingsDialog: $("#settings-dialog"),
    settingsGameName: $("#settings-game-name"),
    settingsAllowDecimals: $("#settings-allow-decimals"),
    settingsDecimalPlaces: $("#settings-decimal-places"),
    settingsPlayerList: $("#settings-player-list"),
    confirmDialog: $("#confirm-dialog"),
    confirmTitle: $("#confirm-title"),
    confirmMessage: $("#confirm-message"),
    confirmAction: $("#confirm-action"),
    toastRegion: $("#toast-region"),
    winnerTitle: $("#winner-title"),
    winnerCopy: $("#winner-copy"),
    podium: $("#podium"),
    resultsGameName: $("#results-game-name"),
    resultsRoundCount: $("#results-round-count"),
    resultsTable: $("#results-table")
  };

  function makeId(prefix) {
    const suffix = window.crypto && window.crypto.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix}-${suffix}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function safeColor(value, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(value)) ? value : fallback;
  }

  function decimalPlacesValue(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return config.game.decimalPlaces;
    return Math.min(config.game.maxDecimalPlaces, Math.max(config.game.minDecimalPlaces, parsed));
  }

  function scoreValue(value, allowDecimals = state.allowDecimals, decimalPlaces = state.decimalPlaces) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    if (!allowDecimals) return Math.round(parsed);
    return scoreMath.normalizeScore(parsed, decimalPlaces);
  }

  function defaultPlayers(count = config.game.defaultPlayerCount) {
    return Array.from({ length: count }, (_, index) => ({
      id: makeId("player"),
      name: `玩家 ${index + 1}`,
      color: config.playerColors[index % config.playerColors.length],
      active: true
    }));
  }

  function createFreshState(players) {
    const playerList = players ? clone(players) : defaultPlayers();
    return {
      version: 1,
      screen: "setup",
      gameName: config.game.defaultName,
      players: playerList,
      rounds: [],
      draft: Object.fromEntries(playerList.map((player) => [player.id, 0])),
      allowDecimals: config.game.allowDecimalScores,
      decimalPlaces: config.game.decimalPlaces,
      ended: false,
      undoStack: [],
      createdAt: null,
      updatedAt: null
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.players) || raw.players.length < 1) {
      return null;
    }

    const seenIds = new Set();
    const players = raw.players.slice(0, config.game.maxPlayers).map((player, index) => {
      let id = typeof player.id === "string" && player.id ? player.id : makeId("player");
      if (seenIds.has(id)) id = makeId("player");
      seenIds.add(id);
      return {
        id,
        name: String(player.name || `玩家 ${index + 1}`).slice(0, 24),
        color: safeColor(player.color, config.playerColors[index % config.playerColors.length]),
        active: player.active !== false
      };
    });

    const validIds = new Set(players.map((player) => player.id));
    const allowDecimals = typeof raw.allowDecimals === "boolean"
      ? raw.allowDecimals
      : config.game.allowDecimalScores;
    const decimalPlaces = decimalPlacesValue(raw.decimalPlaces);
    const rounds = Array.isArray(raw.rounds)
      ? raw.rounds.map((round) => ({
        id: typeof round.id === "string" ? round.id : makeId("round"),
        scores: Object.fromEntries(players.map((player) => [
          player.id,
          validIds.has(player.id) ? scoreValue(round.scores && round.scores[player.id], allowDecimals, decimalPlaces) : 0
        ])),
        createdAt: round.createdAt || new Date().toISOString()
      }))
      : [];

    const screen = ["game", "results"].includes(raw.screen) ? raw.screen : "game";
    return {
      version: 1,
      screen,
      gameName: String(raw.gameName || config.game.defaultName).slice(0, 40),
      players,
      rounds,
      draft: Object.fromEntries(players.map((player) => [player.id, scoreValue(raw.draft && raw.draft[player.id], allowDecimals, decimalPlaces)])),
      allowDecimals,
      decimalPlaces,
      ended: Boolean(raw.ended || screen === "results"),
      undoStack: Array.isArray(raw.undoStack) ? raw.undoStack.slice(-config.game.maxUndoSteps) : [],
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || new Date().toISOString()
    };
  }

  function snapshot() {
    return clone({
      screen: state.screen,
      gameName: state.gameName,
      players: state.players,
      rounds: state.rounds,
      draft: state.draft,
      allowDecimals: state.allowDecimals,
      decimalPlaces: state.decimalPlaces,
      ended: state.ended,
      createdAt: state.createdAt
    });
  }

  function pushUndo(label) {
    state.undoStack.push({ label, data: snapshot() });
    state.undoStack = state.undoStack.slice(-config.game.maxUndoSteps);
  }

  function persist() {
    if (state.screen === "setup") return;
    state.updatedAt = new Date().toISOString();
    store.save(state);
  }

  function setSiteConfiguration() {
    document.title = config.site.browserTitle;
    elements.siteName.textContent = config.site.headerTitle;
    if (config.site.githubUrl) {
      elements.githubLink.href = config.site.githubUrl;
    } else {
      elements.githubLink.hidden = true;
    }
    const description = $('meta[name="description"]');
    const themeColor = $('meta[name="theme-color"]');
    if (description) description.content = config.site.description;
    if (themeColor) themeColor.content = config.site.themeColor;
    if (config.site.faviconPath) {
      elements.siteAvatar.src = config.site.faviconPath;
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = config.site.faviconPath;
      document.head.append(link);
    } else {
      elements.siteAvatar.closest(".brand-mark").hidden = true;
    }
  }

  function showView(name) {
    elements.setupView.hidden = name !== "setup";
    elements.gameView.hidden = name !== "game";
    elements.resultsView.hidden = name !== "results";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderAll() {
    showView(state.screen);
    if (state.screen === "setup") renderSetup();
    if (state.screen === "game") renderGame();
    if (state.screen === "results") renderResults();
  }

  function renderSetup() {
    elements.gameNameInput.value = state.gameName;
    elements.playerCount.textContent = `${state.players.length} 位玩家`;
    elements.setupPlayerList.innerHTML = state.players.map((player, index) => `
      <div class="player-editor-row" data-player-id="${escapeHtml(player.id)}">
        <span class="player-index">${String(index + 1).padStart(2, "0")}</span>
        <input class="player-name-input" type="text" maxlength="24" value="${escapeHtml(player.name)}" aria-label="玩家 ${index + 1} 的姓名">
        <input class="color-input" type="color" value="${safeColor(player.color, config.playerColors[index % config.playerColors.length])}" aria-label="玩家 ${index + 1} 的颜色">
        <button class="remove-player" type="button" data-remove-player="${escapeHtml(player.id)}" aria-label="删除${escapeHtml(player.name)}">×</button>
      </div>
    `).join("");

    if (savedState) {
      elements.resumeBanner.hidden = false;
      elements.resumeDetail.textContent = `${savedState.gameName} · 已完成 ${savedState.rounds.length} 轮`;
    } else {
      elements.resumeBanner.hidden = true;
    }
  }

  function updateSetupFromInputs() {
    state.gameName = elements.gameNameInput.value.trim() || config.game.defaultName;
    $$(".player-editor-row", elements.setupPlayerList).forEach((row) => {
      const player = state.players.find((item) => item.id === row.dataset.playerId);
      if (!player) return;
      player.name = $(".player-name-input", row).value.trim();
      player.color = $(".color-input", row).value;
    });
  }

  function validatePlayers(players) {
    if (players.length < config.game.minPlayers) {
      toast(`至少需要 ${config.game.minPlayers} 位玩家`);
      return false;
    }
    const names = players.map((player, index) => player.name.trim() || `玩家 ${index + 1}`);
    const normalized = names.map((name) => name.toLocaleLowerCase("zh-CN"));
    if (new Set(normalized).size !== normalized.length) {
      toast("玩家姓名不能重复");
      return false;
    }
    players.forEach((player, index) => { player.name = names[index]; });
    return true;
  }

  function startGame() {
    updateSetupFromInputs();
    if (!validatePlayers(state.players)) return;
    state.screen = "game";
    state.ended = false;
    state.rounds = [];
    state.draft = Object.fromEntries(state.players.map((player) => [player.id, 0]));
    state.undoStack = [];
    state.createdAt = new Date().toISOString();
    savedState = null;
    persist();
    renderAll();
  }

  function renderGame() {
    const totals = scoreMath.getTotals(state.players, state.rounds, state.decimalPlaces);
    const rankings = scoreMath.getRankings(state.players, totals);
    const rankMap = Object.fromEntries(rankings.map((player) => [player.id, player.rank]));
    const activePlayers = state.players.filter((player) => player.active);
    const roundNumber = state.rounds.length + 1;
    const hasAccumulatedScore = state.rounds.length > 0;

    elements.currentGameName.textContent = state.gameName;
    elements.currentRound.textContent = `第 ${roundNumber} 轮`;
    elements.submitRound.textContent = `提交第 ${roundNumber} 轮`;
    elements.undoAction.disabled = state.undoStack.length === 0;
    elements.gameSummary.innerHTML = `
      <div class="ranking-heading">
        <span>已累计分数排名</span>
        <small>已提交 ${state.rounds.length} 轮</small>
      </div>
      <ol class="live-ranking">
        ${rankings.map((player) => `
          <li style="--player-color:${safeColor(player.color, "#6c8cff")}">
            <span class="live-rank">${player.rank}</span>
            <span class="live-player"><i aria-hidden="true"></i>${escapeHtml(player.name)}</span>
            <strong>${scoreMath.formatScore(player.total, false, state.decimalPlaces)} 分</strong>
          </li>
        `).join("")}
      </ol>
    `;

    elements.scoreGrid.innerHTML = activePlayers.map((player) => {
      const rank = rankMap[player.id];
      const draft = scoreValue(state.draft[player.id]);
      const quickButtons = config.game.quickScores.map((score) => `
        <button class="quick-score-button ${score > 0 ? "positive" : "negative"}" type="button" data-player-id="${escapeHtml(player.id)}" data-score="${score}">
          ${scoreMath.formatScore(score, true, state.decimalPlaces)}
        </button>
      `).join("");
      return `
        <article class="score-card ${rank === 1 && hasAccumulatedScore ? "is-leader" : ""}" style="--player-color: ${safeColor(player.color, "#6c8cff")}">
          <header class="score-card-header">
            <div class="player-ident">
              <span class="player-dot" aria-hidden="true"></span>
              <h2>${escapeHtml(player.name)}</h2>
            </div>
            <span class="rank-label ${rank === 1 && hasAccumulatedScore ? "is-first" : ""}">累计第 ${rank} 名</span>
          </header>
          <div class="score-display">
            <div class="total-score">
              <span>分数</span>
              <strong>${scoreMath.formatScore(totals[player.id], false, state.decimalPlaces)}</strong>
            </div>
            <label class="draft-score">
              <span>本轮分数</span>
              <span class="score-input-wrap">
                <input class="score-input" type="number" inputmode="${state.allowDecimals ? "decimal" : "numeric"}" step="${state.allowDecimals ? 1 / (10 ** state.decimalPlaces) : 1}" value="${draft}" data-score-input="${escapeHtml(player.id)}" aria-label="${escapeHtml(player.name)}的本轮分数">
              </span>
            </label>
          </div>
          <div class="quick-scores" aria-label="${escapeHtml(player.name)}的快捷分值">${quickButtons}</div>
        </article>
      `;
    }).join("");

    const draftTotal = scoreMath.normalizeScore(activePlayers.reduce((sum, player) => sum + scoreValue(state.draft[player.id]), 0), state.decimalPlaces);
    elements.draftTotal.textContent = `合计 ${scoreMath.formatScore(draftTotal, true, state.decimalPlaces)} 分`;
  }

  function changeDraft(playerId, nextValue, undoLabel) {
    const player = state.players.find((item) => item.id === playerId && item.active);
    if (!player) return;
    const value = scoreValue(nextValue);
    if (Math.abs(value) > config.game.unusuallyLargeScore) {
      toast(`提示：${player.name} 本轮分数较大，请确认`);
    }
    if (value === scoreValue(state.draft[playerId])) return;
    pushUndo(undoLabel || `修改 ${player.name} 的本轮分数`);
    state.draft[playerId] = value;
    persist();
    renderGame();
  }

  function submitCurrentRound() {
    const activePlayers = state.players.filter((player) => player.active);
    const allZero = activePlayers.every((player) => scoreValue(state.draft[player.id]) === 0);
    if (allZero) {
      askConfirm({
        title: "本轮全部为 0 分",
        message: "所有参与玩家的本轮分数都是 0，仍然提交这一轮吗？",
        confirmLabel: "仍然提交",
        danger: false
      }, commitRound);
      return;
    }
    commitRound();
  }

  function commitRound() {
    pushUndo(`提交第 ${state.rounds.length + 1} 轮`);
    const scores = Object.fromEntries(state.players.map((player) => [
      player.id,
      player.active ? scoreValue(state.draft[player.id]) : 0
    ]));
    state.rounds.push({ id: makeId("round"), scores, createdAt: new Date().toISOString() });
    state.draft = Object.fromEntries(state.players.map((player) => [player.id, 0]));
    persist();
    renderGame();
    toast(`第 ${state.rounds.length} 轮已提交`);
  }

  function undoLastAction() {
    const entry = state.undoStack.pop();
    if (!entry) return;
    const remainingUndo = state.undoStack;
    Object.assign(state, clone(entry.data));
    state.undoStack = remainingUndo;
    persist();
    renderAll();
    toast(`已撤销：${entry.label}`);
  }

  function clearDraft() {
    const hasScore = state.players.some((player) => scoreValue(state.draft[player.id]) !== 0);
    if (!hasScore) {
      toast("本轮分数已经是空的");
      return;
    }
    pushUndo("清空本轮分数");
    state.draft = Object.fromEntries(state.players.map((player) => [player.id, 0]));
    persist();
    renderGame();
  }

  function renderHistory() {
    if (!state.rounds.length) {
      elements.historyContent.innerHTML = '<div class="empty-state">还没有已提交的轮次。</div>';
      $("#save-history").disabled = true;
      return;
    }

    $("#save-history").disabled = false;
    const totals = scoreMath.getTotals(state.players, state.rounds, state.decimalPlaces);
    const head = state.players.map((player) => `<th style="color:${safeColor(player.color, "#fff")}">${escapeHtml(player.name)}</th>`).join("");
    const rows = state.rounds.map((round, index) => `
      <tr>
        <td>
          <span class="round-cell">
            <button class="delete-round" type="button" data-delete-round="${escapeHtml(round.id)}" aria-label="删除第 ${index + 1} 轮">×</button>
            第 ${index + 1} 轮
          </span>
        </td>
        ${state.players.map((player) => `
          <td><input class="history-score-input" type="number" inputmode="${state.allowDecimals ? "decimal" : "numeric"}" step="${state.allowDecimals ? 1 / (10 ** state.decimalPlaces) : 1}" value="${scoreValue(round.scores[player.id])}" data-round-id="${escapeHtml(round.id)}" data-player-id="${escapeHtml(player.id)}" aria-label="第 ${index + 1} 轮${escapeHtml(player.name)}的分数"></td>
        `).join("")}
      </tr>
    `).join("");

    elements.historyContent.innerHTML = `
      <div class="table-wrap">
        <table class="history-table">
          <thead><tr><th>轮次</th>${head}</tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td>总分</td>${state.players.map((player) => `<td>${totals[player.id] || 0}</td>`).join("")}</tr></tfoot>
        </table>
      </div>
    `;
  }

  function saveHistoryChanges() {
    let changed = false;
    const nextRounds = clone(state.rounds);
    $$(".history-score-input", elements.historyContent).forEach((input) => {
      const round = nextRounds.find((item) => item.id === input.dataset.roundId);
      if (!round) return;
      const nextValue = scoreValue(input.value);
      if (nextValue !== scoreValue(round.scores[input.dataset.playerId])) changed = true;
      round.scores[input.dataset.playerId] = nextValue;
    });
    if (changed) {
      pushUndo("修改历史分数");
      state.rounds = nextRounds;
      persist();
      renderGame();
      toast("历史分数已更新");
    }
    elements.historyDialog.close();
  }

  function deleteRound(roundId) {
    const index = state.rounds.findIndex((round) => round.id === roundId);
    if (index < 0) return;
    askConfirm({
      title: `删除第 ${index + 1} 轮？`,
      message: "该轮所有玩家的分数都会被移除，后续轮次将自动重新编号。",
      confirmLabel: "删除本轮"
    }, () => {
      pushUndo(`删除第 ${index + 1} 轮`);
      state.rounds.splice(index, 1);
      persist();
      renderHistory();
      renderGame();
      toast("该轮记录已删除");
    });
  }

  function settingsPlayerRow(player, index) {
    return `
      <div class="settings-player-row" data-settings-player="${escapeHtml(player.id)}">
        <div class="player-order-controls" aria-label="调整${escapeHtml(player.name)}的顺序">
          <button type="button" data-move-player="up" title="上移" aria-label="上移${escapeHtml(player.name)}">↑</button>
          <button type="button" data-move-player="down" title="下移" aria-label="下移${escapeHtml(player.name)}">↓</button>
        </div>
        <input class="color-input" type="color" value="${safeColor(player.color, config.playerColors[index % config.playerColors.length])}" aria-label="玩家颜色">
        <input class="player-name-input" type="text" maxlength="24" value="${escapeHtml(player.name)}" aria-label="玩家姓名">
        <div class="settings-player-actions">
          <button class="settings-remove-player" type="button" data-remove-settings-player="${escapeHtml(player.id)}" title="删除玩家" aria-label="删除${escapeHtml(player.name)}">×</button>
          <label class="active-toggle">
            <input type="checkbox" ${player.active ? "checked" : ""}>
            <span>参与</span>
          </label>
        </div>
      </div>
    `;
  }

  function renderSettings() {
    elements.settingsGameName.value = state.gameName;
    elements.settingsAllowDecimals.checked = state.allowDecimals;
    elements.settingsDecimalPlaces.value = state.decimalPlaces;
    elements.settingsDecimalPlaces.min = config.game.minDecimalPlaces;
    elements.settingsDecimalPlaces.max = config.game.maxDecimalPlaces;
    elements.settingsDecimalPlaces.disabled = !state.allowDecimals;
    elements.settingsPlayerList.innerHTML = state.players.map(settingsPlayerRow).join("");
    refreshSettingsMoveButtons();
  }

  function refreshSettingsMoveButtons() {
    const rows = $$(".settings-player-row", elements.settingsPlayerList);
    rows.forEach((row, index) => {
      $("[data-move-player='up']", row).disabled = index === 0;
      $("[data-move-player='down']", row).disabled = index === rows.length - 1;
      $("[data-remove-settings-player]", row).disabled = rows.length <= config.game.minPlayers;
    });
  }

  function moveSettingsPlayer(button) {
    const row = button.closest(".settings-player-row");
    if (!row) return;
    if (button.dataset.movePlayer === "up" && row.previousElementSibling) {
      elements.settingsPlayerList.insertBefore(row, row.previousElementSibling);
    }
    if (button.dataset.movePlayer === "down" && row.nextElementSibling) {
      elements.settingsPlayerList.insertBefore(row.nextElementSibling, row);
    }
    refreshSettingsMoveButtons();
  }

  function removeSettingsPlayer(button) {
    const rows = $$(".settings-player-row", elements.settingsPlayerList);
    if (rows.length <= config.game.minPlayers) {
      toast(`至少保留 ${config.game.minPlayers} 位玩家`);
      return;
    }

    const row = button.closest(".settings-player-row");
    if (!row) return;
    const playerId = row.dataset.settingsPlayer;
    const playerName = $(".player-name-input", row).value.trim() || "该玩家";
    const isExistingPlayer = state.players.some((player) => player.id === playerId);
    const removeRow = () => {
      row.remove();
      refreshSettingsMoveButtons();
    };

    if (!isExistingPlayer) {
      removeRow();
      return;
    }

    askConfirm({
      title: `删除${playerName}？`,
      message: "保存设置后，该玩家及其所有历史分数都会被永久移除。此操作可在计分页面撤销。",
      confirmLabel: "删除玩家"
    }, removeRow);
  }

  function appendSettingsPlayer() {
    const rows = $$(".settings-player-row", elements.settingsPlayerList);
    if (rows.length >= config.game.maxPlayers) {
      toast(`最多支持 ${config.game.maxPlayers} 位玩家`);
      return;
    }
    const index = rows.length;
    const player = {
      id: makeId("player"),
      name: `玩家 ${index + 1}`,
      color: config.playerColors[index % config.playerColors.length],
      active: true
    };
    elements.settingsPlayerList.insertAdjacentHTML("beforeend", settingsPlayerRow(player, index));
    refreshSettingsMoveButtons();
  }

  function saveSettings() {
    const players = $$(".settings-player-row", elements.settingsPlayerList).map((row, index) => ({
      id: row.dataset.settingsPlayer,
      name: $(".player-name-input", row).value.trim() || `玩家 ${index + 1}`,
      color: $(".color-input", row).value,
      active: $(".active-toggle input", row).checked
    }));

    if (!validatePlayers(players)) return;
    if (players.filter((player) => player.active).length < config.game.minPlayers) {
      toast(`至少需要 ${config.game.minPlayers} 位玩家参与计分`);
      return;
    }

    const nextName = elements.settingsGameName.value.trim() || config.game.defaultName;
    const nextAllowDecimals = elements.settingsAllowDecimals.checked;
    const nextDecimalPlaces = decimalPlacesValue(elements.settingsDecimalPlaces.value);
    const changed = JSON.stringify(players) !== JSON.stringify(state.players)
      || nextName !== state.gameName
      || nextAllowDecimals !== state.allowDecimals
      || nextDecimalPlaces !== state.decimalPlaces;
    if (changed) {
      pushUndo("修改对局设置");
      state.gameName = nextName;
      state.players = players;
      state.allowDecimals = nextAllowDecimals;
      state.decimalPlaces = nextDecimalPlaces;
      const remainingPlayerIds = new Set(players.map((player) => player.id));
      Object.keys(state.draft).forEach((playerId) => {
        if (!remainingPlayerIds.has(playerId)) delete state.draft[playerId];
      });
      state.rounds.forEach((round) => {
        Object.keys(round.scores).forEach((playerId) => {
          if (!remainingPlayerIds.has(playerId)) delete round.scores[playerId];
        });
      });
      players.forEach((player) => {
        if (!(player.id in state.draft) || !player.active) state.draft[player.id] = 0;
        state.draft[player.id] = scoreValue(state.draft[player.id], nextAllowDecimals, nextDecimalPlaces);
        state.rounds.forEach((round) => {
          if (!(player.id in round.scores)) round.scores[player.id] = 0;
          round.scores[player.id] = scoreValue(round.scores[player.id], nextAllowDecimals, nextDecimalPlaces);
        });
      });
      persist();
      renderGame();
      toast("对局设置已保存");
    }
    elements.settingsDialog.close();
  }

  function finishGame() {
    if (!state.rounds.length) {
      toast("至少完成一轮后才能结束对局");
      return;
    }
    askConfirm({
      title: "结束当前对局？",
      message: "将生成最终排名。结束后仍然可以返回修改分数。",
      confirmLabel: "查看结果",
      danger: false
    }, () => {
      pushUndo("结束对局");
      state.ended = true;
      state.screen = "results";
      persist();
      renderAll();
    });
  }

  function renderResults() {
    const totals = scoreMath.getTotals(state.players, state.rounds, state.decimalPlaces);
    const rankings = scoreMath.getRankings(state.players, totals);
    const winners = rankings.filter((player) => player.rank === 1);
    elements.winnerTitle.textContent = winners.length > 1 ? "并列冠军" : `${winners[0].name} 获胜`;
    elements.winnerCopy.textContent = winners.length > 1
      ? `${winners.map((player) => player.name).join("、")} 以 ${scoreMath.formatScore(winners[0].total, false, state.decimalPlaces)} 分并列第一`
      : `最终得分 ${scoreMath.formatScore(winners[0].total, false, state.decimalPlaces)} 分`;

    elements.podium.innerHTML = rankings.slice(0, 3).map((player) => `
      <article class="podium-card" style="--player-color:${safeColor(player.color, "#fff")}">
        <span>第 ${player.rank} 名</span>
        <h2>${escapeHtml(player.name)}</h2>
        <div class="podium-score">${scoreMath.formatScore(player.total, false, state.decimalPlaces)}</div>
        <div class="podium-detail">最高单轮 ${scoreMath.getHighestRound(player.id, state.rounds, state.decimalPlaces)} 分</div>
      </article>
    `).join("");

    elements.resultsGameName.textContent = state.gameName;
    elements.resultsRoundCount.textContent = `共 ${state.rounds.length} 轮`;
    const head = state.players.map((player) => `<th style="color:${safeColor(player.color, "#fff")}">${escapeHtml(player.name)}</th>`).join("");
    const body = state.rounds.map((round, index) => `
      <tr><td>第 ${index + 1} 轮</td>${state.players.map((player) => `<td>${scoreMath.formatScore(round.scores[player.id], true, state.decimalPlaces)}</td>`).join("")}</tr>
    `).join("");
    elements.resultsTable.innerHTML = `
      <table class="results-table">
        <thead>
          <tr><th>玩家</th>${head}</tr>
          <tr class="results-total-row"><th>总分</th>${state.players.map((player) => `<th>${scoreMath.formatScore(totals[player.id], false, state.decimalPlaces)}</th>`).join("")}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    `;
  }

  function returnToGame() {
    pushUndo("返回对局");
    state.ended = false;
    state.screen = "game";
    persist();
    renderAll();
  }

  function restartWithSamePlayers() {
    askConfirm({
      title: "使用相同玩家再来一局？",
      message: "当前成绩会被新对局替代。建议确认大家已经看完本局结果。",
      confirmLabel: "开始新一局"
    }, () => {
      const players = state.players.map((player) => ({ ...player, active: true }));
      const allowDecimals = state.allowDecimals;
      const decimalPlaces = state.decimalPlaces;
      state = createFreshState(players);
      state.gameName = config.game.defaultName;
      state.allowDecimals = allowDecimals;
      state.decimalPlaces = decimalPlaces;
      state.screen = "game";
      state.createdAt = new Date().toISOString();
      persist();
      renderAll();
    });
  }

  function createNewGame() {
    askConfirm({
      title: "创建全新对局？",
      message: "当前对局将从本机移除，玩家和分数不会保留。",
      confirmLabel: "创建新对局"
    }, () => {
      store.clear();
      savedState = null;
      state = createFreshState();
      renderAll();
    });
  }

  function askConfirm(options, callback) {
    pendingConfirmation = callback;
    elements.confirmTitle.textContent = options.title;
    elements.confirmMessage.textContent = options.message;
    elements.confirmAction.textContent = options.confirmLabel || "确认";
    elements.confirmAction.className = `button ${options.danger === false ? "button-primary" : "button-danger"}`;
    elements.confirmDialog.returnValue = "";
    elements.confirmDialog.showModal();
  }

  function toast(message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    elements.toastRegion.append(node);
    window.setTimeout(() => node.remove(), 2600);
  }

  function bindEvents() {
    $("#add-player").addEventListener("click", () => {
      updateSetupFromInputs();
      if (state.players.length >= config.game.maxPlayers) {
        toast(`最多支持 ${config.game.maxPlayers} 位玩家`);
        return;
      }
      const index = state.players.length;
      state.players.push({
        id: makeId("player"),
        name: `玩家 ${index + 1}`,
        color: config.playerColors[index % config.playerColors.length],
        active: true
      });
      renderSetup();
    });

    elements.setupPlayerList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove-player]");
      if (!button) return;
      updateSetupFromInputs();
      if (state.players.length <= config.game.minPlayers) {
        toast(`至少保留 ${config.game.minPlayers} 位玩家`);
        return;
      }
      state.players = state.players.filter((player) => player.id !== button.dataset.removePlayer);
      renderSetup();
    });

    $("#start-game").addEventListener("click", startGame);
    $("#resume-game").addEventListener("click", () => {
      if (!savedState) return;
      state = savedState;
      savedState = null;
      renderAll();
    });
    $("#discard-game").addEventListener("click", () => {
      askConfirm({
        title: "放弃已保存的对局？",
        message: "本机保存的玩家、轮次和分数都会被清除。",
        confirmLabel: "放弃对局"
      }, () => {
        store.clear();
        savedState = null;
        renderSetup();
      });
    });

    elements.scoreGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-score]");
      if (!button) return;
      const playerId = button.dataset.playerId;
      const player = state.players.find((item) => item.id === playerId);
      changeDraft(playerId, scoreValue(state.draft[playerId]) + Number(button.dataset.score), `调整 ${player ? player.name : "玩家"} 的本轮分数`);
    });

    elements.scoreGrid.addEventListener("change", (event) => {
      const input = event.target.closest("[data-score-input]");
      if (!input) return;
      changeDraft(input.dataset.scoreInput, input.value, "手动输入本轮分数");
    });

    $("#submit-round").addEventListener("click", submitCurrentRound);
    $("#clear-round").addEventListener("click", clearDraft);
    $("#undo-action").addEventListener("click", undoLastAction);
    $("#end-game").addEventListener("click", finishGame);

    $("#open-history").addEventListener("click", () => {
      renderHistory();
      elements.historyDialog.showModal();
    });
    $("#save-history").addEventListener("click", (event) => {
      event.preventDefault();
      saveHistoryChanges();
    });
    elements.historyContent.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-round]");
      if (button) deleteRound(button.dataset.deleteRound);
    });

    $("#open-settings").addEventListener("click", () => {
      renderSettings();
      elements.settingsDialog.showModal();
    });
    $("#settings-add-player").addEventListener("click", appendSettingsPlayer);
    elements.settingsAllowDecimals.addEventListener("change", () => {
      elements.settingsDecimalPlaces.disabled = !elements.settingsAllowDecimals.checked;
    });
    elements.settingsPlayerList.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-remove-settings-player]");
      if (removeButton) {
        removeSettingsPlayer(removeButton);
        return;
      }
      const moveButton = event.target.closest("[data-move-player]");
      if (moveButton) moveSettingsPlayer(moveButton);
    });
    $("#save-settings").addEventListener("click", (event) => {
      event.preventDefault();
      saveSettings();
    });

    elements.confirmDialog.addEventListener("close", () => {
      const callback = pendingConfirmation;
      pendingConfirmation = null;
      if (elements.confirmDialog.returnValue === "confirm" && callback) callback();
    });

    $("#return-game").addEventListener("click", returnToGame);
    $("#restart-same").addEventListener("click", restartWithSamePlayers);
    $("#create-new").addEventListener("click", createNewGame);
    $("#brand-button").addEventListener("click", () => {
      if (state.screen === "setup") return;
      createNewGame();
    });

    window.addEventListener("beforeunload", () => {
      if (state.screen !== "setup") store.save(state);
    });
  }

  setSiteConfiguration();
  bindEvents();
  renderAll();
})();
