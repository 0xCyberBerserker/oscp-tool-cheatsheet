(function startApp() {
  "use strict";

  const data = window.OSCP_DATA;
  const knowledge = window.OSCP_KNOWLEDGE;
  const searchApi = window.OSCPSearch;
  const knowledgeUi = window.OSCPKnowledgeUi;
  const phaseById = new Map(data.phases.map((phase) => [phase.id, phase]));
  const params = new URLSearchParams(window.location.search);
  const requestedLanguage = params.get("lang");
  const requestedPhase = params.get("phase");

  function storedObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch (_) {
      return {};
    }
  }

  const requestedPath = params.get("path");
  const firstPath = knowledge.paths[0]?.id || "";
  const state = {
    language: ["es", "en"].includes(requestedLanguage) ? requestedLanguage : (localStorage.getItem("oscp-language") || "es"),
    theme: localStorage.getItem("oscp-theme") || "dark",
    readable: localStorage.getItem("oscp-readable") !== "false",
    phase: requestedPhase === "all" || phaseById.has(requestedPhase) ? requestedPhase : "all",
    verifiedOnly: params.get("sources") === "1",
    query: params.get("q") || "",
    view: params.get("view") === "paths" ? "paths" : "tools",
    pathId: knowledge.paths.some((path) => path.id === requestedPath) ? requestedPath : firstPath,
    stepIndex: Math.max(Number.parseInt(params.get("step") || "0", 10) || 0, 0),
    completed: storedObject("oscp-path-completed"),
    notes: storedObject("oscp-path-notes"),
  };
  let installPrompt = null;

  const copy = {
    es: {
      inventory: `${data.toolCount} herramientas · ${data.completeCount} fichas completas · ${data.sourceVerifiedCount} guías revisadas`,
      eyebrow: "Laboratorios autorizados · consulta offline",
      title: "¿Qué necesitas hacer?",
      intro: "Busca por programa, fase o intención. Tolera nombres incompletos y pequeños errores.",
      placeholder: "Ej.: puertos, SMB, privesc Linux, ferox…",
      hint: "Prueba: “no recuerdo el escáner de directorios”, “contraseñas” o “pivoting”.",
      phases: "Fases",
      clear: "Limpiar",
      curated: "Solo guías revisadas",
      kicker: "Arsenal disponible",
      tools: "Herramientas",
      results: (count) => `${count} resultado${count === 1 ? "" : "s"}`,
      empty: "No hay coincidencias. Prueba una intención más general.",
      scope: "Solo para sistemas y laboratorios autorizados.",
      copy: "Copiar",
      copied: "Comando copiado",
      reference: "Referencia oficial de Kali",
      syntax: "Sintaxis",
      options: "Opciones y controles clave",
      source: "Fuente",
      inventoryOnly: "Inventariada y clasificada. Consulta la referencia oficial para su sintaxis completa.",
      all: "Todas",
      quick: ["escanear puertos", "directorios web", "SMB", "contraseñas", "escalar Linux", "pivoting"],
      toolsMode: "Herramientas",
      pathsMode: "Rutas interactivas",
      pathPageTitle: "¿Qué quieres repasar?",
      pathIntro: "Recorre metodología y referencias públicas. El progreso y las notas permanecen en este dispositivo.",
      pathIndex: "Rutas",
      pathCount: (count) => `${count} rutas`,
      currentStep: "Paso actual",
      stepCount: (current, total) => `${current} de ${total}`,
      notes: "Notas locales",
      notesScope: "Solo en este dispositivo · no escribas secretos",
      notesPlaceholder: "Anota señales, hipótesis o próximos pasos…",
      saveNote: "Guardar nota",
      noteSaved: "Nota guardada localmente",
      previous: "Anterior",
      next: "Siguiente",
      complete: "Marcar completado",
      completed: "Completado",
      install: "Instalar",
      readyOffline: "Disponible sin conexión tras la primera carga.",
      offline: "Sin conexión · usando copia local.",
    },
    en: {
      inventory: `${data.toolCount} tools · ${data.completeCount} complete sheets · ${data.sourceVerifiedCount} reviewed guides`,
      eyebrow: "Authorized labs · offline reference",
      title: "What do you need to do?",
      intro: "Search by program, phase or intent. Partial names and small typos are supported.",
      placeholder: "Example: ports, SMB, Linux privesc, ferox…",
      hint: "Try: “directory scanner”, “passwords” or “pivoting”.",
      phases: "Phases",
      clear: "Clear",
      curated: "Reviewed guides only",
      kicker: "Available arsenal",
      tools: "Tools",
      results: (count) => `${count} result${count === 1 ? "" : "s"}`,
      empty: "No matches. Try a broader intent.",
      scope: "Authorized systems and labs only.",
      copy: "Copy",
      copied: "Command copied",
      reference: "Official Kali reference",
      syntax: "Syntax",
      options: "Key options and controls",
      source: "Source",
      inventoryOnly: "Inventoried and classified. Check the official reference for complete syntax.",
      all: "All",
      quick: ["scan ports", "web directories", "SMB", "passwords", "Linux privesc", "pivoting"],
      toolsMode: "Tools",
      pathsMode: "Interactive paths",
      pathPageTitle: "What do you want to review?",
      pathIntro: "Navigate public methodology and references. Progress and notes stay on this device.",
      pathIndex: "Paths",
      pathCount: (count) => `${count} paths`,
      currentStep: "Current step",
      stepCount: (current, total) => `${current} of ${total}`,
      notes: "Local notes",
      notesScope: "This device only · do not write secrets",
      notesPlaceholder: "Record signals, hypotheses or next steps…",
      saveNote: "Save note",
      noteSaved: "Note saved locally",
      previous: "Previous",
      next: "Next",
      complete: "Mark complete",
      completed: "Completed",
      install: "Install",
      readyOffline: "Available offline after the first load.",
      offline: "Offline · using local copy.",
    },
  };

  const nodes = Object.fromEntries([
    "search", "inventory-line", "eyebrow", "page-title", "intro", "search-hint", "quick-intents",
    "phase-title", "phase-list", "clear-filters", "curated-only", "curated-label", "results-kicker",
    "results-title", "result-count", "results", "empty-state", "scope-note", "language-toggle",
    "readable-toggle", "theme-toggle", "toast",
    "install-app", "tools-mode", "paths-mode", "tools-search", "tools-view", "paths-view",
    "path-index-title", "path-count", "path-list", "path-kicker", "path-title", "step-count",
    "path-summary", "path-body", "notes-title", "notes-scope", "local-note", "save-note",
    "previous-step", "complete-step", "next-step", "offline-status",
  ].map((id) => [id, document.getElementById(id)]));

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function phaseLabel(id) {
    const phase = phaseById.get(id);
    return phase ? phase[state.language] : id;
  }

  const tools = data.tools.map((tool) => ({
    ...tool,
    searchText: [
      tool.name,
      tool.package,
      tool.descriptionEn,
      tool.descriptionEs,
      tool.syntax,
      ...tool.options.flat(),
      ...tool.recipes.flat(),
      ...tool.aliases,
      ...tool.phases.flatMap((id) => {
        const phase = phaseById.get(id);
        return phase ? [phase.en, phase.es] : [id];
      }),
    ].join(" "),
  }));

  function visibleTools() {
    return searchApi.search(tools, state.query).filter((tool) => {
      if (state.phase !== "all" && !tool.phases.includes(state.phase)) return false;
      if (state.verifiedOnly && !tool.sourceVerified) return false;
      return true;
    });
  }

  function showToast(message) {
    nodes.toast.textContent = message;
    nodes.toast.classList.add("visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => nodes.toast.classList.remove("visible"), 1600);
  }

  async function copyCommand(command) {
    try {
      await navigator.clipboard.writeText(command);
    } catch (_) {
      const area = element("textarea");
      area.value = command;
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    showToast(copy[state.language].copied);
  }

  function renderTool(tool) {
    const text = copy[state.language];
    const details = element("details", "tool");
    const summary = element("summary");
    const identity = element("span", "tool-name");
    identity.append(element("strong", "", tool.name), element("small", "", tool.package));
    summary.append(
      identity,
      element("span", "tool-description", state.language === "es" ? tool.descriptionEs : tool.descriptionEn),
      element("span", "tool-marker", "+"),
    );
    details.append(summary);

    const body = element("div", "tool-detail");
    const tags = element("div", "phase-tags");
    tool.phases.forEach((phase) => tags.append(element("span", "phase-tag", phaseLabel(phase))));
    body.append(tags);

    const syntax = element("section", "cheat-section");
    syntax.append(element("h3", "cheat-heading", text.syntax));
    const syntaxRow = element("div", "syntax-row");
    syntaxRow.append(element("code", "", tool.syntax));
    const syntaxCopy = element("button", "copy-button", text.copy);
    syntaxCopy.type = "button";
    syntaxCopy.addEventListener("click", () => copyCommand(tool.syntax));
    syntaxRow.append(syntaxCopy);
    syntax.append(syntaxRow);
    body.append(syntax);

    const options = element("section", "cheat-section");
    options.append(element("h3", "cheat-heading", text.options));
    const optionList = element("dl", "option-list");
    tool.options.forEach(([flag, descriptionEn, descriptionEs]) => {
      optionList.append(
        element("dt", "", flag),
        element("dd", "", state.language === "es" ? descriptionEs : descriptionEn),
      );
    });
    options.append(optionList);
    body.append(options);

    if (tool.recipes.length) {
      const recipes = element("div", "recipes");
      tool.recipes.forEach(([labelEn, labelEs, command]) => {
        const row = element("div", "recipe");
        row.append(element("span", "recipe-label", state.language === "es" ? labelEs : labelEn));
        const code = element("code", "", command);
        const button = element("button", "copy-button", text.copy);
        button.type = "button";
        button.addEventListener("click", () => copyCommand(command));
        row.append(code, button);
        recipes.append(row);
      });
      body.append(recipes);
    } else {
      body.append(element("p", "inventory-note", text.inventoryOnly));
    }

    if (tool.officialUrl) {
      const link = element("a", "tool-link", `${text.reference} ↗`);
      link.href = tool.officialUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      body.append(link);
    }
    body.append(element("p", "source-note", `${text.source}: ${tool.sourceType} · ${tool.sourceRef}`));
    details.append(body);
    return details;
  }

  function renderPhases() {
    nodes["phase-list"].replaceChildren();
    const counts = new Map(data.phases.map((phase) => [phase.id, tools.filter((tool) => tool.phases.includes(phase.id)).length]));
    [{ id: "all", en: "All", es: "Todas" }, ...data.phases].forEach((phase) => {
      const button = element("button", "phase-button");
      button.type = "button";
      button.dataset.phase = phase.id;
      button.setAttribute("aria-pressed", String(state.phase === phase.id));
      button.append(
        element("span", "", phase[state.language]),
        element("small", "", String(phase.id === "all" ? tools.length : counts.get(phase.id) || 0)),
      );
      button.addEventListener("click", () => {
        state.phase = state.phase === phase.id ? "all" : phase.id;
        render();
      });
      nodes["phase-list"].append(button);
    });
  }

  function renderQuickIntents() {
    nodes["quick-intents"].replaceChildren();
    copy[state.language].quick.forEach((intent) => {
      const button = element("button", "", intent);
      button.type = "button";
      button.addEventListener("click", () => {
        state.query = intent;
        nodes.search.value = intent;
        renderResults();
      });
      nodes["quick-intents"].append(button);
    });
  }

  function renderResults() {
    const matches = visibleTools();
    nodes.results.replaceChildren(...matches.map(renderTool));
    nodes["result-count"].textContent = copy[state.language].results(matches.length);
    nodes["empty-state"].hidden = matches.length > 0;
  }

  function currentPathStep() {
    return knowledgeUi.pathStep(knowledge, state.pathId, state.stepIndex);
  }

  function completionKey(path, step) {
    return `${path.id}:${step.id}`;
  }

  function syncUrl() {
    const next = new URL(window.location.href);
    next.searchParams.set("view", state.view);
    if (state.view === "paths") {
      next.searchParams.set("path", state.pathId);
      next.searchParams.set("step", String(state.stepIndex));
    } else {
      next.searchParams.delete("path");
      next.searchParams.delete("step");
    }
    window.history.replaceState(null, "", next);
  }

  function renderPathBody(card) {
    nodes["path-body"].replaceChildren();
    const blocks = knowledgeUi.parseMarkdown(knowledgeUi.localized(card.body, state.language));
    blocks.forEach((block) => {
      if (block.type === "heading") {
        nodes["path-body"].append(element(block.level > 2 ? "h4" : "h3", "", block.text));
      } else if (block.type === "paragraph") {
        nodes["path-body"].append(element("p", "", block.text));
      } else if (block.type === "list") {
        const list = element("ul");
        block.items.forEach((item) => list.append(element("li", "", item)));
        nodes["path-body"].append(list);
      } else if (block.type === "code") {
        const wrapper = element("div", "path-code");
        const pre = element("pre");
        pre.append(element("code", "", block.text));
        const button = element("button", "copy-button", copy[state.language].copy);
        button.type = "button";
        button.addEventListener("click", () => copyCommand(block.text));
        wrapper.append(pre, button);
        nodes["path-body"].append(wrapper);
      }
    });
  }

  function renderPathList() {
    const text = copy[state.language];
    nodes["path-list"].replaceChildren();
    knowledge.paths.forEach((path) => {
      const completed = path.steps.filter((step) => state.completed[completionKey(path, step)]).length;
      const button = element("button", "path-button");
      button.type = "button";
      button.setAttribute("aria-pressed", String(path.id === state.pathId));
      button.append(
        element("strong", "", knowledgeUi.localized(path.title, state.language)),
        element("small", "", `${completed}/${path.steps.length}`),
      );
      button.addEventListener("click", () => {
        state.pathId = path.id;
        state.stepIndex = 0;
        renderPaths();
        syncUrl();
      });
      nodes["path-list"].append(button);
    });
    nodes["path-count"].textContent = text.pathCount(knowledge.paths.length);
  }

  function renderPaths() {
    const text = copy[state.language];
    const selected = currentPathStep();
    renderPathList();
    if (!selected?.card) return;
    state.pathId = selected.path.id;
    state.stepIndex = selected.index;
    const key = completionKey(selected.path, selected.step);
    nodes["path-title"].textContent = knowledgeUi.localized(selected.card.title, state.language);
    nodes["path-summary"].textContent = knowledgeUi.localized(selected.card.summary, state.language);
    nodes["step-count"].textContent = text.stepCount(selected.index + 1, selected.path.steps.length);
    nodes["local-note"].value = state.notes[selected.card.id] || "";
    nodes["previous-step"].disabled = selected.index === 0;
    nodes["next-step"].disabled = selected.index >= selected.path.steps.length - 1;
    nodes["complete-step"].setAttribute("aria-pressed", String(Boolean(state.completed[key])));
    nodes["complete-step"].textContent = state.completed[key] ? text.completed : text.complete;
    renderPathBody(selected.card);
  }

  function setView(view) {
    state.view = view;
    render();
    syncUrl();
  }

  function renderCopy() {
    const text = copy[state.language];
    document.documentElement.lang = state.language;
    nodes["inventory-line"].textContent = text.inventory;
    nodes.eyebrow.textContent = text.eyebrow;
    nodes["page-title"].textContent = state.view === "paths" ? text.pathPageTitle : text.title;
    nodes.intro.textContent = state.view === "paths" ? text.pathIntro : text.intro;
    nodes.search.placeholder = text.placeholder;
    nodes["search-hint"].textContent = text.hint;
    nodes["phase-title"].textContent = text.phases;
    nodes["clear-filters"].textContent = text.clear;
    nodes["curated-label"].textContent = text.curated;
    nodes["results-kicker"].textContent = text.kicker;
    nodes["results-title"].textContent = text.tools;
    nodes["empty-state"].textContent = text.empty;
    nodes["scope-note"].textContent = text.scope;
    nodes["language-toggle"].textContent = state.language === "es" ? "EN" : "ES";
    nodes["readable-toggle"].textContent = state.language === "es" ? "Aa · Dislexia" : "Aa · Readable";
    nodes["tools-mode"].textContent = text.toolsMode;
    nodes["paths-mode"].textContent = text.pathsMode;
    nodes["path-index-title"].textContent = text.pathIndex;
    nodes["path-kicker"].textContent = text.currentStep;
    nodes["notes-title"].textContent = text.notes;
    nodes["notes-scope"].textContent = text.notesScope;
    nodes["local-note"].placeholder = text.notesPlaceholder;
    nodes["save-note"].textContent = text.saveNote;
    nodes["previous-step"].textContent = text.previous;
    nodes["next-step"].textContent = text.next;
    nodes["install-app"].textContent = text.install;
    nodes["offline-status"].textContent = navigator.onLine ? text.readyOffline : text.offline;
  }

  function render() {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.readable = String(state.readable);
    nodes["readable-toggle"].setAttribute("aria-pressed", String(state.readable));
    nodes["theme-toggle"].textContent = state.theme === "dark" ? "☼" : "☾";
    renderCopy();
    nodes["tools-mode"].setAttribute("aria-pressed", String(state.view === "tools"));
    nodes["paths-mode"].setAttribute("aria-pressed", String(state.view === "paths"));
    nodes["tools-search"].hidden = state.view !== "tools";
    nodes["tools-view"].hidden = state.view !== "tools";
    nodes["paths-view"].hidden = state.view !== "paths";
    if (state.view === "tools") {
      renderQuickIntents();
      renderPhases();
      renderResults();
    } else {
      renderPaths();
    }
  }

  nodes.search.addEventListener("input", (event) => {
    state.query = event.target.value;
    renderResults();
  });
  nodes["curated-only"].addEventListener("change", (event) => {
    state.verifiedOnly = event.target.checked;
    renderResults();
  });
  nodes["clear-filters"].addEventListener("click", () => {
    state.phase = "all";
    state.query = "";
    state.verifiedOnly = false;
    nodes.search.value = "";
    nodes["curated-only"].checked = false;
    render();
    nodes.search.focus();
  });
  nodes["language-toggle"].addEventListener("click", () => {
    state.language = state.language === "es" ? "en" : "es";
    localStorage.setItem("oscp-language", state.language);
    render();
  });
  nodes["readable-toggle"].addEventListener("click", () => {
    state.readable = !state.readable;
    localStorage.setItem("oscp-readable", String(state.readable));
    render();
  });
  nodes["theme-toggle"].addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    localStorage.setItem("oscp-theme", state.theme);
    render();
  });
  nodes["tools-mode"].addEventListener("click", () => setView("tools"));
  nodes["paths-mode"].addEventListener("click", () => setView("paths"));
  nodes["previous-step"].addEventListener("click", () => {
    state.stepIndex = Math.max(0, state.stepIndex - 1);
    renderPaths();
    syncUrl();
  });
  nodes["next-step"].addEventListener("click", () => {
    const selected = currentPathStep();
    if (!selected) return;
    state.stepIndex = Math.min(selected.path.steps.length - 1, selected.index + 1);
    renderPaths();
    syncUrl();
  });
  nodes["complete-step"].addEventListener("click", () => {
    const selected = currentPathStep();
    if (!selected) return;
    const key = completionKey(selected.path, selected.step);
    state.completed[key] = !state.completed[key];
    localStorage.setItem("oscp-path-completed", JSON.stringify(state.completed));
    renderPaths();
  });
  nodes["save-note"].addEventListener("click", () => {
    const selected = currentPathStep();
    if (!selected?.card) return;
    const note = nodes["local-note"].value.trim();
    if (note) state.notes[selected.card.id] = note;
    else delete state.notes[selected.card.id];
    localStorage.setItem("oscp-path-notes", JSON.stringify(state.notes));
    showToast(copy[state.language].noteSaved);
  });
  window.addEventListener("online", renderCopy);
  window.addEventListener("offline", renderCopy);
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    nodes["install-app"].hidden = false;
  });
  nodes["install-app"].addEventListener("click", async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    installPrompt = null;
    nodes["install-app"].hidden = true;
  });
  document.addEventListener("keydown", (event) => {
    const typing = ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName);
    if (event.ctrlKey && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (state.view !== "tools") setView("tools");
      nodes.search.focus();
    }
    if (state.view === "tools" && event.key === "/" && !typing) {
      event.preventDefault();
      nodes.search.focus();
    }
    if (event.key === "Escape" && document.activeElement === nodes.search) {
      nodes.search.value = "";
      state.query = "";
      renderResults();
    }
  });

  nodes.search.value = state.query;
  nodes["curated-only"].checked = state.verifiedOnly;
  render();
  if (window.location.protocol.startsWith("http") && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}());
