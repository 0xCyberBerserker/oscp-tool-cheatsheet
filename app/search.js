(function exposeSearch(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.OSCPSearch = api;
}(typeof globalThis !== "undefined" ? globalThis : window, function createSearch() {
  "use strict";

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9+#.]+/g, " ")
      .trim();
  }

  function distance(left, right) {
    if (left === right) return 0;
    if (!left.length) return right.length;
    if (!right.length) return left.length;
    const row = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let i = 1; i <= left.length; i += 1) {
      let diagonal = row[0];
      row[0] = i;
      for (let j = 1; j <= right.length; j += 1) {
        const previous = row[j];
        row[j] = Math.min(
          row[j] + 1,
          row[j - 1] + 1,
          diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
        );
        diagonal = previous;
      }
    }
    return row[right.length];
  }

  function threshold(token) {
    if (token.length <= 4) return 1;
    if (token.length <= 8) return 2;
    return 3;
  }

  function isAdjacentSwap(left, right) {
    if (left.length !== right.length) return false;
    const differences = [];
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) differences.push(index);
    }
    return differences.length === 2
      && differences[1] === differences[0] + 1
      && left[differences[0]] === right[differences[1]]
      && left[differences[1]] === right[differences[0]];
  }

  function fuzzyDistance(token, word) {
    if (isAdjacentSwap(token, word)) return 1;
    const prefix = word.slice(0, token.length);
    if (isAdjacentSwap(token, prefix)) return 1;
    return Math.min(distance(token, word), distance(token, prefix));
  }

  function score(tool, query) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return tool.curated ? 2 : 1;
    const name = normalize(tool.name);
    const haystack = normalize(tool.searchText);
    if (name === normalizedQuery) return 120;
    if (name.startsWith(normalizedQuery)) return 90;
    if (name.includes(normalizedQuery)) return 75;
    if (!normalizedQuery.includes(" ")) {
      const nameDistance = fuzzyDistance(normalizedQuery, name);
      if (nameDistance <= threshold(normalizedQuery)) return 70 - nameDistance;
    }
    if (haystack.includes(normalizedQuery)) return 55;

    const words = haystack.split(" ").filter(Boolean);
    const tokens = normalizedQuery.split(" ").filter(Boolean);
    let total = 0;
    for (const token of tokens) {
      if (words.some((word) => word.startsWith(token))) {
        total += 16;
        continue;
      }
      const closest = words.reduce((best, word) => Math.min(best, fuzzyDistance(token, word)), Infinity);
      if (closest > threshold(token)) return 0;
      total += 10 - closest;
    }
    return total;
  }

  function search(tools, query) {
    return tools
      .map((tool) => ({ tool, rank: score(tool, query) }))
      .filter((entry) => entry.rank > 0)
      .sort((left, right) => right.rank - left.rank || left.tool.name.localeCompare(right.tool.name))
      .map((entry) => entry.tool);
  }

  return { distance, normalize, score, search };
}));
