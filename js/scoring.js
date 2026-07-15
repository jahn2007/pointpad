(function () {
  "use strict";

  const config = window.SCOREKEEPER_CONFIG;

  function normalizeScore(value, decimalPlaces = config.game.decimalPlaces) {
    const score = Number(value) || 0;
    const factor = 10 ** decimalPlaces;
    return Math.round((score + Number.EPSILON) * factor) / factor;
  }

  function getTotals(players, rounds, decimalPlaces = config.game.decimalPlaces) {
    const totals = Object.fromEntries(players.map((player) => [player.id, 0]));
    rounds.forEach((round) => {
      players.forEach((player) => {
        totals[player.id] = normalizeScore(totals[player.id] + normalizeScore(round.scores[player.id], decimalPlaces), decimalPlaces);
      });
    });
    return totals;
  }

  function getRankings(players, totals) {
    const sorted = players
      .map((player) => ({ ...player, total: totals[player.id] || 0 }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "zh-CN"));

    let previousScore = null;
    let previousRank = 0;
    return sorted.map((player, index) => {
      const rank = player.total === previousScore ? previousRank : index + 1;
      previousScore = player.total;
      previousRank = rank;
      return { ...player, rank };
    });
  }

  function getHighestRound(playerId, rounds, decimalPlaces = config.game.decimalPlaces) {
    if (!rounds.length) return 0;
    return Math.max(...rounds.map((round) => normalizeScore(round.scores[playerId], decimalPlaces)));
  }

  function formatScore(score, showPlus, decimalPlaces = config.game.decimalPlaces) {
    const value = normalizeScore(score, decimalPlaces);
    return showPlus && value > 0 ? `+${value}` : String(value);
  }

  window.ScoreMath = { normalizeScore, getTotals, getRankings, getHighestRound, formatScore };
})();
