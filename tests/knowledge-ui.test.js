"use strict";

const assert = require("node:assert/strict");

global.window = {};
require("../app/knowledge.js");
const ui = require("../app/knowledge-ui.js");

const pack = global.window.OSCP_KNOWLEDGE;
assert.equal(pack.cards.length, 45);
assert.equal(pack.paths.length, 16);

const selected = ui.pathStep(pack, "machine-assessment", 999);
assert.equal(selected.index, selected.path.steps.length - 1);
assert.equal(selected.card.id, "method.postmortem");
assert.equal(ui.localized({ en: "English", es: "Español" }, "es"), "Español");

const blocks = ui.parseMarkdown("## Title\n\n- one\n- two\n\n```text\necho safe\n```\n\n<script>alert(1)</script>");
assert.deepEqual(blocks.map((block) => block.type), ["heading", "list", "code", "paragraph"]);
assert.equal(blocks[2].text, "echo safe");
assert.equal(blocks[3].text, "<script>alert(1)</script>");

console.log("knowledge UI checks: OK");
