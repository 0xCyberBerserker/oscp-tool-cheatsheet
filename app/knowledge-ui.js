(function exposeKnowledgeUi(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OSCPKnowledgeUi = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function buildKnowledgeUi() {
  "use strict";

  function localized(value, language) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    return value[language] || value.en || value.es || "";
  }

  function cardMap(pack) {
    return new Map((pack.cards || []).map((card) => [card.id, card]));
  }

  function pathStep(pack, pathId, stepIndex) {
    const path = (pack.paths || []).find((item) => item.id === pathId) || pack.paths?.[0];
    if (!path) return null;
    const index = Math.min(Math.max(Number(stepIndex) || 0, 0), Math.max(path.steps.length - 1, 0));
    const step = path.steps[index];
    return step ? { path, step, index, card: cardMap(pack).get(step.cardId) || null } : null;
  }

  function parseMarkdown(source) {
    const blocks = [];
    const lines = String(source || "").replace(/\r\n?/g, "\n").split("\n");
    let paragraph = [];
    let list = [];
    let code = [];
    let inCode = false;

    function flushParagraph() {
      if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }

    function flushList() {
      if (list.length) blocks.push({ type: "list", items: list });
      list = [];
    }

    for (const line of lines) {
      if (line.startsWith("```")) {
        flushParagraph();
        flushList();
        if (inCode) {
          blocks.push({ type: "code", text: code.join("\n") });
          code = [];
        }
        inCode = !inCode;
        continue;
      }
      if (inCode) {
        code.push(line);
        continue;
      }
      const heading = /^(#{2,4})\s+(.+)$/.exec(line);
      if (heading) {
        flushParagraph();
        flushList();
        blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
        continue;
      }
      const listItem = /^-\s+(.+)$/.exec(line);
      if (listItem) {
        flushParagraph();
        list.push(listItem[1]);
        continue;
      }
      if (!line.trim()) {
        flushParagraph();
        flushList();
      } else {
        flushList();
        paragraph.push(line.trim());
      }
    }
    flushParagraph();
    flushList();
    if (inCode || code.length) blocks.push({ type: "code", text: code.join("\n") });
    return blocks;
  }

  return { localized, cardMap, pathStep, parseMarkdown };
}));
