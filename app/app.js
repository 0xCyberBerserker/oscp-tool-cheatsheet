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
  const legacyCompleted = storedObject("oscp-path-completed");
  const legacyNotes = storedObject("oscp-path-notes");
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
    completed: {},
    notes: {},
  };
  let installPrompt = null;
  let profileStore = null;
  let profileHasVault = false;
  let profileUnlocked = false;
  let authenticatedSubject = "";
  let syncAvailable = false;
  let profileSaveQueue = Promise.resolve();
  let profileSaveFailed = false;
  let profileInitialized = false;
  let syncedVaultId = "";
  let profileSyncConflict = false;
  let profileStorageFailed = false;

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
      selectedPath: "Ruta seleccionada",
      pathProgress: (completed, total) => `${completed}/${total} pasos completados`,
      pathPageTitle: "¿Qué quieres repasar?",
      pathIntro: "Recorre metodología y referencias públicas. El progreso y las notas permanecen en este perfil del navegador.",
      pathIndex: "Rutas",
      pathCount: (count) => `${count} rutas`,
      currentStep: "Paso actual",
      stepCount: (current, total) => `${current} de ${total}`,
      notes: "Notas locales",
      notesScope: "Solo en este perfil del navegador · no escribas secretos",
      notesPlaceholder: "Anota señales, hipótesis o próximos pasos…",
      saveNote: "Guardar nota",
      noteSaved: "Nota guardada localmente",
      classicFallback: "Alternativa clásica de Linux",
      reviewedSource: "Fuente revisada",
      previous: "Anterior",
      next: "Siguiente",
      complete: "Marcar completado",
      completed: "Completado",
      install: "Instalar",
      readyOffline: "Disponible sin conexión tras la primera carga.",
      offline: "Sin conexión · usando copia local.",
      profile: "Perfil cifrado",
      profileLocked: "Perfil cifrado bloqueado.",
      profileUnlocked: "Perfil cifrado desbloqueado.",
      profileAnonymous: "Sin sesión GitHub. Los datos locales aún no están cifrados.",
      profileUnavailable: "La sincronización cifrada aún no está desplegada en este origen.",
      profileChecking: "Comprobando el perfil local cifrado…",
      profileConflict: "Conflicto de sincronización: se conserva la copia local sin sobrescribir la nube.",
      profileReady: "Cuenta GitHub verificada. Crea el perfil cifrado.",
      connectGithub: "Conectar GitHub",
      passphrase: "Frase de cifrado independiente",
      confirmPassphrase: "Repetir frase",
      createProfile: "Crear y migrar",
      unlockProfile: "Desbloquear",
      lockProfile: "Bloquear",
      logoutGithub: "Cerrar sesión GitHub",
      profileWarning: "GitHub identifica la cuenta, pero no puede descifrar tus datos. Si pierdes la frase, pierdes el acceso.",
      passphraseMismatch: "Las frases no coinciden o tienen menos de 16 caracteres.",
      profileError: "No se pudo abrir el perfil cifrado.",
      profileStorageError: "Almacenamiento cifrado no disponible. Edición bloqueada para evitar guardar datos en claro.",
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
      selectedPath: "Selected path",
      pathProgress: (completed, total) => `${completed}/${total} steps completed`,
      pathPageTitle: "What do you want to review?",
      pathIntro: "Navigate public methodology and references. Progress and notes stay in this browser profile.",
      pathIndex: "Paths",
      pathCount: (count) => `${count} paths`,
      currentStep: "Current step",
      stepCount: (current, total) => `${current} of ${total}`,
      notes: "Local notes",
      notesScope: "This browser profile only · do not write secrets",
      notesPlaceholder: "Record signals, hypotheses or next steps…",
      saveNote: "Save note",
      noteSaved: "Note saved locally",
      classicFallback: "Classic Linux fallback",
      reviewedSource: "Reviewed source",
      previous: "Previous",
      next: "Next",
      complete: "Mark complete",
      completed: "Completed",
      install: "Install",
      readyOffline: "Available offline after the first load.",
      offline: "Offline · using local copy.",
      profile: "Encrypted profile",
      profileLocked: "Encrypted profile locked.",
      profileUnlocked: "Encrypted profile unlocked.",
      profileAnonymous: "No GitHub session. Local data is not encrypted yet.",
      profileUnavailable: "Encrypted sync is not deployed on this origin yet.",
      profileChecking: "Checking the local encrypted profile…",
      profileConflict: "Synchronization conflict: the local copy is preserved without overwriting cloud data.",
      profileReady: "GitHub account verified. Create the encrypted profile.",
      connectGithub: "Connect GitHub",
      passphrase: "Independent encryption passphrase",
      confirmPassphrase: "Repeat passphrase",
      createProfile: "Create and migrate",
      unlockProfile: "Unlock",
      lockProfile: "Lock",
      logoutGithub: "Sign out from GitHub",
      profileWarning: "GitHub identifies the account but cannot decrypt your data. Losing the passphrase means losing access.",
      passphraseMismatch: "Passphrases do not match or contain fewer than 16 characters.",
      profileError: "Unable to open the encrypted profile.",
      profileStorageError: "Encrypted storage is unavailable. Editing is blocked to prevent plaintext fallback.",
    },
  };

  const nodes = Object.fromEntries([
    "search", "inventory-line", "eyebrow", "page-title", "intro", "search-hint", "quick-intents",
    "phase-title", "phase-list", "clear-filters", "curated-only", "curated-label", "results-kicker",
    "results-title", "result-count", "results", "empty-state", "scope-note", "language-toggle",
    "readable-toggle", "theme-toggle", "toast",
    "install-app", "tools-mode", "paths-mode", "tools-search", "tools-view", "paths-view",
    "path-index-title", "path-count", "path-list", "roadmap-kicker", "roadmap-title",
    "path-description", "path-progress", "path-progress-label", "step-roadmap", "path-kicker",
    "path-title", "step-count", "path-summary", "path-body", "path-source", "notes-title",
    "notes-scope", "local-note", "save-note",
    "previous-step", "complete-step", "next-step", "offline-status", "profile-open",
    "profile-dialog", "profile-title", "profile-status", "github-connect", "profile-unlock",
    "profile-passphrase", "profile-passphrase-confirm", "profile-passphrase-label",
    "profile-confirm-label", "profile-action", "profile-lock", "github-logout", "profile-warning",
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
      tool.recipes.forEach(([labelEn, labelEs, command, classicFallback]) => {
        const row = element("div", "recipe");
        row.append(element("span", "recipe-label", state.language === "es" ? labelEs : labelEn));
        const code = element("code", "", command);
        const button = element("button", "copy-button", text.copy);
        button.type = "button";
        button.addEventListener("click", () => copyCommand(command));
        row.append(code, button);
        if (classicFallback) {
          const fallback = element("div", "recipe-standard");
          fallback.append(
            element("span", "recipe-label", text.classicFallback),
            element("code", "", classicFallback),
          );
          row.append(fallback);
        }
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

  function noteKey(path, step) {
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
    nodes["path-source"].replaceChildren();
    if (card.source?.ref?.startsWith("https://")) {
      const link = element("a", "tool-link", `${copy[state.language].reviewedSource} ↗`);
      link.href = card.source.ref;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      nodes["path-source"].append(link);
    }
  }

  function renderStepRoadmap(selected) {
    const { path } = selected;
    const completed = path.steps.filter((step) => state.completed[completionKey(path, step)]).length;
    nodes["roadmap-title"].textContent = knowledgeUi.localized(path.title, state.language);
    nodes["path-description"].textContent = knowledgeUi.localized(path.description, state.language);
    nodes["path-progress"].max = path.steps.length;
    nodes["path-progress"].value = completed;
    nodes["path-progress-label"].textContent = copy[state.language].pathProgress(completed, path.steps.length);
    nodes["step-roadmap"].replaceChildren();
    path.steps.forEach((step, index) => {
      const card = knowledgeUi.cardMap(knowledge).get(step.cardId);
      const item = element("li", "roadmap-step");
      const button = element("button");
      button.type = "button";
      button.dataset.completed = String(Boolean(state.completed[completionKey(path, step)]));
      if (index === selected.index) button.setAttribute("aria-current", "step");
      button.append(
        element("span", "roadmap-step-number", String(index + 1)),
        element("span", "roadmap-step-title", knowledgeUi.localized(card?.title, state.language)),
      );
      button.addEventListener("click", () => {
        persistCurrentNote(false);
        state.stepIndex = index;
        renderPaths();
        syncUrl();
      });
      item.append(button);
      nodes["step-roadmap"].append(item);
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
        persistCurrentNote(false);
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
    const currentNoteKey = noteKey(selected.path, selected.step);
    nodes["path-title"].textContent = knowledgeUi.localized(selected.card.title, state.language);
    nodes["path-summary"].textContent = knowledgeUi.localized(selected.card.summary, state.language);
    nodes["step-count"].textContent = text.stepCount(selected.index + 1, selected.path.steps.length);
    nodes["local-note"].value = state.notes[currentNoteKey] || state.notes[selected.card.id] || "";
    nodes["previous-step"].disabled = selected.index === 0;
    nodes["next-step"].disabled = selected.step.next.length === 0;
    nodes["complete-step"].setAttribute("aria-pressed", String(Boolean(state.completed[key])));
    nodes["complete-step"].textContent = state.completed[key] ? text.completed : text.complete;
    renderStepRoadmap(selected);
    renderPathBody(selected.card);
  }

  function persistCurrentNote(showConfirmation) {
    if (!profileInitialized) return;
    const selected = currentPathStep();
    if (!selected?.card) return;
    const key = noteKey(selected.path, selected.step);
    const note = nodes["local-note"].value.trim();
    if (note) state.notes[key] = note;
    else delete state.notes[key];
    delete state.notes[selected.card.id];
    const persisted = persistPrivateState("oscp-path-notes", state.notes);
    if (showConfirmation) persisted.then(() => {
      if (!profileSaveFailed) showToast(copy[state.language].noteSaved);
    });
  }

  function privateSnapshot() {
    return { notes: state.notes, completed: state.completed };
  }

  async function syncPut(path, body) {
    if (!syncAvailable || !authenticatedSubject) return null;
    return fetch(path, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function pushPrivateRecord() {
    const envelope = await profileStore.exportRecord("private_state");
    if (!envelope || envelope.subject !== authenticatedSubject || envelope.vaultId !== syncedVaultId) return false;
    const baseRevision = await profileStore.getSyncRevision("private_state");
    const response = await syncPut("/api/v1/records", {
      recordId: envelope.recordId,
      revision: envelope.revision,
      baseRevision,
      envelope,
    });
    if (response?.ok) {
      await profileStore.setSyncRevision("private_state", envelope.revision);
      profileSyncConflict = false;
      return true;
    }
    if (response?.status === 409) profileSyncConflict = true;
    return false;
  }

  async function pullPrivateRecords() {
    if (!syncAvailable || !authenticatedSubject) return;
    const response = await fetch("/api/v1/records", { credentials: "include", cache: "no-store" });
    if (!response.ok || !response.headers.get("Content-Type")?.includes("application/json")) return;
    const body = await response.json();
    for (const record of Array.isArray(body.records) ? body.records : []) {
      if (record?.envelope?.subject === authenticatedSubject) {
        if (record.envelope.vaultId !== syncedVaultId) continue;
        const local = await profileStore.exportRecord(record.envelope.recordId);
        const confirmed = await profileStore.getSyncRevision(record.envelope.recordId);
        if (local && local.revision === record.envelope.revision && local.ciphertext === record.envelope.ciphertext) {
          await profileStore.setSyncRevision(record.envelope.recordId, record.envelope.revision);
          continue;
        }
        if (local && local.revision > confirmed) {
          if (record.envelope.revision > confirmed && record.envelope.ciphertext !== local.ciphertext) {
            profileSyncConflict = true;
          }
          continue;
        }
        await profileStore.importRecord(record.envelope);
        await profileStore.setSyncRevision(record.envelope.recordId, record.envelope.revision);
      }
    }
  }

  function persistPrivateState(legacyKey, legacyValue) {
    if (!profileInitialized || profileStorageFailed) return Promise.resolve();
    if (profileUnlocked) {
      const snapshot = structuredClone(privateSnapshot());
      profileSaveQueue = profileSaveQueue
        .then(async () => {
          await profileStore.save("private_state", snapshot);
          const verified = await profileStore.load("private_state");
          if (JSON.stringify(verified) !== JSON.stringify(snapshot)) throw new Error("Encrypted save verification failed");
          profileSaveFailed = false;
          try { await pushPrivateRecord(); } catch (_) { /* Local encrypted state remains authoritative. */ }
        })
        .catch(() => {
          profileSaveFailed = true;
          showToast(copy[state.language].profileError);
        });
      return profileSaveQueue;
    } else if (!profileHasVault) {
      localStorage.setItem(legacyKey, JSON.stringify(legacyValue));
    }
    return Promise.resolve();
  }

  function renderProfile() {
    const text = copy[state.language];
    nodes["profile-open"].textContent = text.profile;
    nodes["profile-title"].textContent = text.profile;
    nodes["github-connect"].textContent = text.connectGithub;
    nodes["profile-passphrase-label"].textContent = text.passphrase;
    nodes["profile-confirm-label"].textContent = text.confirmPassphrase;
    nodes["profile-lock"].textContent = text.lockProfile;
    nodes["github-logout"].textContent = text.logoutGithub;
    nodes["profile-warning"].textContent = text.profileWarning;
    nodes["profile-status"].textContent = profileStorageFailed
      ? text.profileStorageError
      : profileSyncConflict
      ? text.profileConflict
      : !profileInitialized
      ? text.profileChecking
      : profileUnlocked
      ? text.profileUnlocked
      : profileHasVault
        ? text.profileLocked
          : authenticatedSubject
          ? text.profileReady
          : syncAvailable
            ? text.profileAnonymous
            : text.profileUnavailable;
    nodes["github-connect"].hidden = Boolean(authenticatedSubject) || !syncAvailable;
    nodes["github-logout"].hidden = !authenticatedSubject;
    nodes["profile-unlock"].hidden = profileUnlocked || (!profileHasVault && !authenticatedSubject);
    nodes["profile-passphrase-confirm"].hidden = profileHasVault;
    nodes["profile-confirm-label"].hidden = profileHasVault;
    nodes["profile-action"].textContent = profileHasVault ? text.unlockProfile : text.createProfile;
    nodes["profile-lock"].hidden = !profileUnlocked;
    const privateStateLocked = !profileInitialized || profileStorageFailed || (profileHasVault && !profileUnlocked);
    nodes["local-note"].disabled = privateStateLocked;
    nodes["save-note"].disabled = privateStateLocked;
    nodes["complete-step"].disabled = privateStateLocked;
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
    nodes["readable-toggle"].textContent = "Aa · Mono";
    nodes["tools-mode"].textContent = text.toolsMode;
    nodes["paths-mode"].textContent = text.pathsMode;
    nodes["roadmap-kicker"].textContent = text.selectedPath;
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
    renderProfile();
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
    persistCurrentNote(false);
    state.stepIndex = Math.max(0, state.stepIndex - 1);
    renderPaths();
    syncUrl();
  });
  nodes["next-step"].addEventListener("click", () => {
    const selected = currentPathStep();
    if (!selected) return;
    persistCurrentNote(false);
    const nextId = selected.step.next[0];
    const nextIndex = selected.path.steps.findIndex((step) => step.id === nextId);
    state.stepIndex = nextIndex >= 0 ? nextIndex : selected.index;
    renderPaths();
    syncUrl();
  });
  nodes["complete-step"].addEventListener("click", () => {
    const selected = currentPathStep();
    if (!selected) return;
    const key = completionKey(selected.path, selected.step);
    state.completed[key] = !state.completed[key];
    persistPrivateState("oscp-path-completed", state.completed);
    renderPaths();
  });
  nodes["save-note"].addEventListener("click", () => {
    persistCurrentNote(true);
  });
  nodes["profile-open"].addEventListener("click", () => nodes["profile-dialog"].showModal());
  nodes["profile-dialog"].addEventListener("close", () => {
    nodes["profile-passphrase"].value = "";
    nodes["profile-passphrase-confirm"].value = "";
  });
  nodes["github-connect"].addEventListener("click", () => window.location.assign("/auth/github/start"));
  nodes["profile-action"].addEventListener("click", async () => {
    const text = copy[state.language];
    const passphrase = nodes["profile-passphrase"].value;
    const confirmation = nodes["profile-passphrase-confirm"].value;
    nodes["profile-action"].disabled = true;
    try {
      if (profileHasVault) {
        const unlocked = await profileStore.unlock(passphrase);
        if (authenticatedSubject && unlocked.subject !== authenticatedSubject) throw new Error("Account mismatch");
      } else {
        if (!authenticatedSubject || passphrase !== confirmation || [...passphrase].length < 16) {
          showToast(text.passphraseMismatch);
          return;
        }
        await profileStore.create(authenticatedSubject, passphrase, { private_state: privateSnapshot() });
        const verified = await profileStore.load("private_state");
        if (JSON.stringify(verified) !== JSON.stringify(privateSnapshot())) throw new Error("Migration verification failed");
        localStorage.removeItem("oscp-path-notes");
        localStorage.removeItem("oscp-path-completed");
        profileHasVault = true;
        try {
          const localVault = await profileStore.exportVault();
          const response = await syncPut("/api/v1/vault", { revision: 1, baseRevision: 0, envelope: localVault });
          if (response?.ok) {
            syncedVaultId = localVault.vaultId;
            await pushPrivateRecord();
          } else if (response?.status === 409) {
            profileSyncConflict = true;
          }
        } catch (_) { /* Creation remains valid offline. */ }
      }
      try { await pullPrivateRecords(); } catch (_) { /* Use the verified local copy. */ }
      const snapshot = await profileStore.load("private_state");
      state.notes = snapshot?.notes || {};
      state.completed = snapshot?.completed || {};
      try { await pushPrivateRecord(); } catch (_) { /* Retry remains backed by the local encrypted record. */ }
      profileUnlocked = true;
      render();
    } catch (_) {
      if (profileStore) profileStore.lock();
      profileUnlocked = false;
      showToast(text.profileError);
    } finally {
      nodes["profile-passphrase"].value = "";
      nodes["profile-passphrase-confirm"].value = "";
      nodes["profile-action"].disabled = false;
    }
  });
  nodes["profile-lock"].addEventListener("click", async () => {
    await profileSaveQueue;
    if (profileSaveFailed) {
      showToast(copy[state.language].profileError);
      return;
    }
    profileStore.lock();
    profileUnlocked = false;
    state.notes = {};
    state.completed = {};
    render();
  });
  nodes["github-logout"].addEventListener("click", async () => {
    await profileSaveQueue;
    if (profileSaveFailed) {
      showToast(copy[state.language].profileError);
      return;
    }
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
    } finally {
      authenticatedSubject = "";
      if (profileStore) profileStore.lock();
      profileUnlocked = false;
      state.notes = {};
      state.completed = {};
      render();
    }
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

  (async function initializeEncryptedProfile() {
    try {
      profileStore = window.OSCPProfileStore.createStore({
        backend: window.OSCPProfileStore.indexedDbBackend(window.indexedDB),
        crypto: window.OSCPProfileCrypto,
      });
      const localSubject = await profileStore.activeSubject();
      if (localSubject) profileStore.selectSubject(localSubject);
      profileHasVault = localSubject ? await profileStore.hasVault(localSubject) : false;
      if (profileHasVault) {
        state.notes = {};
        state.completed = {};
      } else {
        state.notes = legacyNotes;
        state.completed = legacyCompleted;
      }
      if (window.location.protocol.startsWith("http")) {
        const response = await fetch("/api/v1/session", { credentials: "include", cache: "no-store" });
        if (response.headers.get("Content-Type")?.includes("application/json")) {
          syncAvailable = [200, 401].includes(response.status);
        }
        if (response.ok && syncAvailable) {
          const session = await response.json();
          authenticatedSubject = typeof session.subject === "string" ? session.subject : "";
          if (/^gh1_[A-Za-z0-9_-]{43}$/u.test(authenticatedSubject)) {
            profileStore.lock();
            profileStore.selectSubject(authenticatedSubject);
            profileHasVault = await profileStore.hasVault(authenticatedSubject);
            if (profileHasVault) {
              state.notes = {};
              state.completed = {};
            } else {
              state.notes = legacyNotes;
              state.completed = legacyCompleted;
            }
            const vaultResponse = await fetch("/api/v1/vault", { credentials: "include", cache: "no-store" });
            if (vaultResponse.ok && vaultResponse.headers.get("Content-Type")?.includes("application/json")) {
              const remote = await vaultResponse.json();
              if (remote.envelope?.binding?.subject === authenticatedSubject) {
                if (!profileHasVault) {
                  await profileStore.importVault(remote.envelope);
                  profileHasVault = true;
                  state.notes = {};
                  state.completed = {};
                }
                const localVault = await profileStore.exportVault();
                if (localVault?.vaultId === remote.envelope.vaultId) syncedVaultId = localVault.vaultId;
                else profileSyncConflict = true;
              } else if (!remote.envelope && profileHasVault) {
                const localVault = await profileStore.exportVault();
                const upload = await syncPut("/api/v1/vault", { revision: 1, baseRevision: 0, envelope: localVault });
                if (upload?.ok) syncedVaultId = localVault.vaultId;
                else if (upload?.status === 409) profileSyncConflict = true;
              }
            }
          }
        }
      }
    } catch (_) {
      profileStore = null;
      profileStorageFailed = true;
      state.notes = legacyNotes;
      state.completed = legacyCompleted;
    }
    profileInitialized = true;
    render();
  })();
  if (window.location.protocol.startsWith("http") && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
  }
}());
