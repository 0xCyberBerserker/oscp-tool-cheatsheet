"use strict";

const assert = require("node:assert/strict");

global.window = {};
require("../app/data.js");
const searchApi = require("../app/search.js");

const phaseById = new Map(window.OSCP_DATA.phases.map((phase) => [phase.id, phase]));
const tools = window.OSCP_DATA.tools.map((tool) => ({
  ...tool,
  searchText: [
    tool.name,
    tool.package,
    tool.descriptionEn,
    tool.descriptionEs,
    ...tool.aliases,
    ...tool.phases.flatMap((id) => Object.values(phaseById.get(id) || {})),
  ].join(" "),
}));

assert.equal(window.OSCP_DATA.recipeCount, window.OSCP_DATA.toolCount);
assert.equal(window.OSCP_DATA.completeCount, window.OSCP_DATA.toolCount);
assert.ok(tools.every((tool) => tool.recipes.length > 0));
assert.ok(tools.every((tool) => tool.syntax.length > 0 && tool.options.length > 0));
assert.ok(tools.every((tool) => tool.recipes.every((recipe) => recipe[2].trim().length > 0)));

function names(query) {
  return searchApi.search(tools, query).slice(0, 12).map((tool) => tool.name);
}

const boundaryTool = {
  ...tools[0],
  name: "a".repeat(256),
  searchText: "a".repeat(256),
};

assert.equal(names("nmap")[0], "nmap");
assert.equal(names("namp")[0], "nmap");
assert.ok(names("ferx").includes("feroxbuster"));
assert.ok(names("escanear puertos").includes("nmap"));
assert.ok(names("escalar linux").includes("linpeas"));
assert.ok(names("directrios web").some((name) => ["feroxbuster", "ffuf"].includes(name)));
assert.ok(names("contraseñas").some((name) => ["hydra", "john", "hashcat"].includes(name)));
assert.ok(names("contrasen\u0303as").some((name) => ["hydra", "john", "hashcat"].includes(name)));
assert.equal(searchApi.search([boundaryTool], "a".repeat(256))[0], boundaryTool);
assert.deepEqual(names("a".repeat(257)), []);
assert.ok(names(Array(16).fill("nmap").join(" ")).includes("nmap"));
assert.deepEqual(names(Array(17).fill("a").join(" ")), []);
assert.equal(searchApi.score(tools[0], "a".repeat(257)), 0);
assert.deepEqual(Object.keys(searchApi).sort(), ["normalize", "score", "search"]);

console.log("search tests: OK");
