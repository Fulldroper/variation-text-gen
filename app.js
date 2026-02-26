const STORAGE_KEY = "variant-generator-data";
const ANALYTICS_CONSENT_KEY = "ga-consent";
const GA_MEASUREMENT_ID = "G-1DXE7GYS2M";
const GA_DEBUG_PARAM = "gtag_debug";
const GA_DEBUG_MODE = new URLSearchParams(window.location.search).has(
  GA_DEBUG_PARAM
);

const state = {
  lists: [],
  instances: [],
  activeInstanceId: "",
  lastResult: null,
  singleLine: false,
  variantCount: 1,
};

const fieldTypes = [
  { value: "number", label: "Число" },
  { value: "string", label: "Строка" },
  { value: "number_string", label: "Число + Строка" },
  { value: "sub", label: "Підпункт" },
];

const elements = {
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  uploadBtn: document.getElementById("uploadBtn"),
  listsContainer: document.getElementById("listsContainer"),
  addField: document.getElementById("addField"),
  fieldsContainer: document.getElementById("fieldsContainer"),
  instanceSelect: document.getElementById("instanceSelect"),
  addInstance: document.getElementById("addInstance"),
  cloneInstance: document.getElementById("cloneInstance"),
  renameInstance: document.getElementById("renameInstance"),
  deleteInstance: document.getElementById("deleteInstance"),
  generateBtn: document.getElementById("generateBtn"),
  generateHint: document.getElementById("generateHint"),
  resultOutput: document.getElementById("resultOutput"),
  variantCount: document.getElementById("variantCount"),
  singleLineToggle: document.getElementById("singleLineToggle"),
  importInput: document.getElementById("importInput"),
  importBtn: document.getElementById("importBtn"),
  exportBtn: document.getElementById("exportBtn"),
  toast: document.getElementById("toast"),
  resetStorage: document.getElementById("resetStorage"),
  consentBanner: document.getElementById("consentBanner"),
  acceptAnalytics: document.getElementById("acceptAnalytics"),
  declineAnalytics: document.getElementById("declineAnalytics"),
};

const StorageService = {
  load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};

function loadGoogleAnalytics() {
  if (window.gtagInitialized) return;
  const analyticsScriptId = "google-analytics-tag";
  const initializeAnalytics = () => {
    if (window.gtagInitialized) return;
    gtag("js", new Date());
    if (GA_DEBUG_MODE) {
      gtag("config", GA_MEASUREMENT_ID, { debug_mode: true });
    } else {
      gtag("config", GA_MEASUREMENT_ID);
    }
    window.gtagInitialized = true;
  };

  const existingScript = document.getElementById(analyticsScriptId);
  if (existingScript) {
    if (existingScript.dataset.loaded === "true") {
      initializeAnalytics();
    } else {
      existingScript.addEventListener("load", initializeAnalytics, { once: true });
    }
    return;
  }

  {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.id = analyticsScriptId;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        initializeAnalytics();
      },
      { once: true }
    );
    document.head.appendChild(script);
  }
}

function setConsentBannerVisible(isVisible) {
  if (!elements.consentBanner) return;
  elements.consentBanner.classList.toggle("show", isVisible);
}

function getAnalyticsConsent() {
  try {
    return localStorage.getItem(ANALYTICS_CONSENT_KEY);
  } catch {
    return null;
  }
}

function setAnalyticsConsent(value) {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, value);
    return true;
  } catch {
    return false;
  }
}

function applyAnalyticsConsent() {
  const consent = getAnalyticsConsent();
  if (consent === "granted") {
    setConsentBannerVisible(false);
    loadGoogleAnalytics();
    return;
  }
  if (consent === "denied") {
    setConsentBannerVisible(false);
    return;
  }
  setConsentBannerVisible(true);
}

function ensureInstances() {
  if (!state.instances.length) {
    state.instances = [
      {
        id: crypto.randomUUID(),
        name: "Схема 1",
        fields: [],
      },
    ];
  }

  const hasActive = state.instances.some(
    (instance) => instance.id === state.activeInstanceId
  );
  if (!hasActive) {
    state.activeInstanceId = state.instances[0].id;
  }
}

function normalizeField(field) {
  let format = field.format ?? "";
  if (!format && (field.labelFormat || field.valueFormat)) {
    const labelPart = field.labelFormat?.trim() || "{label}";
    const valuePart = field.valueFormat?.trim() || "{value}";
    format = `${labelPart}: ${valuePart}`;
  }
  if (!format) {
    format = "{label}: {value}";
  }
  return { ...field, format };
}

function normalizeInstances(instances) {
  return instances.map((instance) => ({
    ...instance,
    fields: Array.isArray(instance.fields)
      ? instance.fields.map((field) => normalizeField(field))
      : [],
  }));
}

function cloneInstanceData(instance) {
  const idMap = new Map();
  const clonedFields = instance.fields.map((field) => {
    const newId = crypto.randomUUID();
    idMap.set(field.id, newId);
    return { ...field, id: newId };
  });

  const remappedFields = clonedFields.map((field) => {
    if (!field.subFieldId) return field;
    return {
      ...field,
      subFieldId: idMap.get(field.subFieldId) || "",
    };
  });

  return {
    id: crypto.randomUUID(),
    name: `${instance.name} (копія)`,
    fields: remappedFields,
  };
}

function applyImportedData(data) {
  if (!data || typeof data !== "object") {
    showToast("Некоректний формат JSON", true);
    return;
  }

  state.lists = Array.isArray(data.lists) ? data.lists : [];

  if (Array.isArray(data.instances) && data.instances.length) {
    state.instances = normalizeInstances(data.instances);
    state.activeInstanceId = data.activeInstanceId || "";
  } else if (Array.isArray(data.fields)) {
    state.instances = [
      {
        id: crypto.randomUUID(),
        name: "Схема 1",
        fields: data.fields.map((field) => normalizeField(field)),
      },
    ];
    state.activeInstanceId = "";
  } else {
    state.instances = [];
    state.activeInstanceId = "";
  }

  state.singleLine = !!data.singleLine;
  state.variantCount = Number(data.variantCount) || 1;
  state.lastResult = null;

  ensureInstances();
  persist();
  elements.singleLineToggle.checked = state.singleLine;
  elements.variantCount.value = String(state.variantCount || 1);
  renderInstances();
  renderLists();
  renderFields();
  renderResult({ variants: [] });
  showToast("Дані імпортовано");
}

function exportAllData() {
  const payload = {
    lists: state.lists,
    instances: state.instances,
    activeInstanceId: state.activeInstanceId,
    singleLine: state.singleLine,
    variantCount: state.variantCount,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "generator-data.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getActiveInstance() {
  return state.instances.find(
    (instance) => instance.id === state.activeInstanceId
  );
}

function getFields() {
  return getActiveInstance()?.fields || [];
}

function setFields(fields) {
  const instance = getActiveInstance();
  if (instance) {
    instance.fields = fields;
  }
}

function applyTemplate(template, fallback, data) {
  if (!template || !template.trim()) return fallback;
  return template
    .replaceAll("{label}", data.label)
    .replaceAll("{value}", data.value)
    .replaceAll("{index}", String(data.index));
}

const ListManager = {
  addList(list) {
    state.lists.push(list);
    persist();
    renderLists();
    renderFields();
  },
  removeList(id) {
    state.lists = state.lists.filter((list) => list.id !== id);
    state.instances = state.instances.map((instance) => ({
      ...instance,
      fields: instance.fields.map((field) =>
        field.listId === id ? { ...field, listId: "" } : field
      ),
    }));
    persist();
    renderLists();
    renderFields();
  },
};

const FieldManager = {
  addField() {
    const fields = getFields();
    setFields([
      ...fields,
      {
        id: crypto.randomUUID(),
        label: "",
        type: "number",
        min: 1,
        max: 10,
        listId: "",
        subFieldId: "",
        format: "",
      },
    ]);
    persist();
    renderFields();
  },
  updateField(id, patch, options = { render: true }) {
    const fields = getFields();
    setFields(
      fields.map((field) => (field.id === id ? { ...field, ...patch } : field))
    );
    persist();
    if (options.render) {
      renderFields();
    } else {
      updateGenerateState();
    }
  },
  removeField(id) {
    const fields = getFields();
    let nextFields = fields.filter((field) => field.id !== id);
    nextFields = nextFields.map((field) =>
      field.subFieldId === id ? { ...field, subFieldId: "" } : field
    );
    setFields(nextFields);
    persist();
    renderFields();
  },
};

const GeneratorEngine = {
  generate() {
    const fields = getFields();
    const count = Math.max(1, Number(state.variantCount) || 1);
    const variants = [];

    for (let i = 0; i < count; i += 1) {
      variants.push(generateSingleVariant(fields, i + 1));
    }

    state.lastResult = { variants };
    return state.lastResult;
  },
};

function generateSingleVariant(fields, variantIndex) {
  const results = {};
  const outputLines = [];

  for (const field of fields) {
    const rawLabel = field.label?.trim() || "Назва поля";
    let rawValue = "";

    if (field.type === "number") {
      const min = Number(field.min);
      const max = Number(field.max);
      if (!isValidRange(min, max)) {
          rawValue = "[Некоректний діапазон]";
      } else {
          rawValue = randomInt(min, max).toString();
      }
    }

    if (field.type === "string") {
      const list = state.lists.find((item) => item.id === field.listId);
        rawValue = list ? getRandomItem(list).value : "";
    }

    if (field.type === "number_string") {
      const min = Number(field.min);
      const max = Number(field.max);
      const list = state.lists.find((item) => item.id === field.listId);
      if (isValidRange(min, max) && list) {
          rawValue = `${randomInt(min, max)} ${getRandomItem(list).value}`;
      } else {
          rawValue = "";
      }
    }

    if (field.type === "sub") {
      const parent = fields.find((item) => item.id === field.subFieldId);
        const parentValue = parent ? results[parent.id]?.rawValue : "";
      if (parentValue && parent?.listId) {
        const list = state.lists.find((item) => item.id === parent.listId);
          rawValue = list ? findSubItem(list, parentValue) : "";
      } else {
          rawValue = "";
      }
    }

    const formattedLine = applyTemplate(
      field.format,
      `${rawLabel}: ${rawValue}`,
      {
        label: rawLabel,
        value: rawValue,
        index: variantIndex,
      }
    );

    results[field.id] = {
      label: rawLabel,
      value: rawValue,
      rawValue,
      formattedLine,
    };
    outputLines.push(formattedLine.trim());
  }

  return { results, outputLines };
}

function randomInt(min, max) {
  const minValue = Math.ceil(min);
  const maxValue = Math.floor(max);
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
}

function getRandomItem(list) {
  if (!list.items.length) {
    return { value: "", sub: null };
  }
  return list.items[Math.floor(Math.random() * list.items.length)];
}

function findSubItem(list, value) {
  const match = list.items.find((item) => item.value === value);
  return match?.sub || "";
}

function isValidRange(min, max) {
  return Number.isFinite(min) && Number.isFinite(max) && min <= max;
}

function persist() {
  StorageService.save({
    lists: state.lists,
    instances: state.instances,
    activeInstanceId: state.activeInstanceId,
    singleLine: state.singleLine,
    variantCount: state.variantCount,
  });
}

function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.style.borderColor = isError ? "rgba(255, 123, 123, 0.6)" : "";
  elements.toast.classList.add("show");
  setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

function renderLists() {
  elements.listsContainer.innerHTML = "";
  if (!state.lists.length) {
    elements.listsContainer.innerHTML =
      "<p class=\"hint\">Поки що немає списків. Додайте .txt файл.</p>";
    return;
  }

  state.lists.forEach((list) => {
    const card = document.createElement("div");
    card.className = "list-card";
    card.innerHTML = `
      <div>
        <h4>${escapeHtml(list.name)}</h4>
        <small>${list.items.length} варіантів</small>
      </div>
      <button class="icon-btn" data-id="${list.id}">Видалити</button>
    `;

    card.querySelector("button").addEventListener("click", () => {
      ListManager.removeList(list.id);
    });

    elements.listsContainer.appendChild(card);
  });
}

function renderInstances() {
  ensureInstances();
  if (!elements.instanceSelect) return;

  elements.instanceSelect.innerHTML = state.instances
    .map(
      (instance) =>
        `<option value="${instance.id}">${escapeHtml(instance.name)}</option>`
    )
    .join("");

  elements.instanceSelect.value = state.activeInstanceId;
  elements.deleteInstance.disabled = state.instances.length <= 1;
}

function renderFields() {
  ensureInstances();
  const fields = getFields();
  elements.fieldsContainer.innerHTML = "";

  if (!fields.length) {
    elements.fieldsContainer.innerHTML =
      "<p class=\"hint\">Додайте перше поле для генерації.</p>";
  }

  fields.forEach((field, index) => {
    const card = document.createElement("div");
    card.className = "field-card";

    const badge = fieldTypes.find((type) => type.value === field.type)?.label || "";

    card.innerHTML = `
      <header>
        <div>
          <h4>Поле ${index + 1}</h4>
          <span class="badge">${badge}</span>
        </div>
        <button class="icon-btn" data-remove="${field.id}">Видалити</button>
      </header>
      <div class="field-grid">
        <div>
          <input class="input" data-field="label" placeholder="Назва поля" value="${escapeHtml(
            field.label
          )}" />
        </div>
        <div>
          <select class="select" data-field="type">
            ${fieldTypes
              .map(
                (type) =>
                  `<option value="${type.value}" ${
                    type.value === field.type ? "selected" : ""
                  }>${type.label}</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="format-row" data-format></div>
        <div class="field-extra" data-extra></div>
      </div>
    `;

    const removeBtn = card.querySelector("[data-remove]");
    removeBtn.addEventListener("click", () => FieldManager.removeField(field.id));

    const labelInput = card.querySelector("[data-field='label']");
    labelInput.addEventListener("input", (event) => {
      FieldManager.updateField(
        field.id,
        { label: event.target.value },
        { render: false }
      );
    });

    const typeSelect = card.querySelector("[data-field='type']");
    typeSelect.addEventListener("change", (event) => {
      FieldManager.updateField(field.id, { type: event.target.value });
    });

    const formatSlot = card.querySelector("[data-format]");
    formatSlot.appendChild(renderFormatInput(field, "format", "Формат рядка (MD)", false));

    const extra = card.querySelector("[data-extra]");
    extra.appendChild(renderExtraControls(field, index));

    elements.fieldsContainer.appendChild(card);
  });

  updateGenerateState();
}

function renderExtraControls(field, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "field-row";

  if (field.type === "number" || field.type === "number_string") {
    wrapper.appendChild(renderNumberInput(field, "min", "Мін"));
    wrapper.appendChild(renderNumberInput(field, "max", "Макс"));
  }

  if (field.type === "string" || field.type === "number_string") {
    wrapper.appendChild(renderListSelect(field));
  }

  if (field.type === "sub") {
    wrapper.appendChild(renderSubFieldSelect(field, index));
  }

  return wrapper;
}

function renderFormatInput(field, key, label, isFullRow = false) {
  const container = document.createElement("div");
  if (isFullRow) {
    container.className = "format-row";
  }
  container.innerHTML = `
    <label class="hint">${label}</label>
    <input class="input" type="text" value="${escapeHtml(field[key] ?? "")}" />
    <p class="hint">Форматування (MD) підтримує плейсхолдери: {label}, {value}, {index}. Приклад: **{label}** або _{value}_.</p>
  `;

  const input = container.querySelector("input");
  input.addEventListener("input", (event) => {
    FieldManager.updateField(
      field.id,
      { [key]: event.target.value },
      { render: false }
    );
  });

  return container;
}

function renderNumberInput(field, key, label) {
  const container = document.createElement("div");
  container.className = "field-inline";
  container.innerHTML = `
    <label class="hint">${label}</label>
    <input class="input" type="number" value="${field[key] ?? ""}" />
  `;

  const input = container.querySelector("input");
  input.addEventListener("input", (event) => {
    FieldManager.updateField(
      field.id,
      { [key]: event.target.value },
      { render: false }
    );
  });

  return container;
}

function renderListSelect(field) {
  const container = document.createElement("div");
  container.className = "field-inline";
  const options = state.lists
    .map(
      (list) =>
        `<option value="${list.id}" ${
          list.id === field.listId ? "selected" : ""
        }>${escapeHtml(list.name)}</option>`
    )
    .join("");

  container.innerHTML = `
    <label class="hint">Список</label>
    <select class="select">
      <option value="">Оберіть список</option>
      ${options}
    </select>
  `;

  const select = container.querySelector("select");
  select.addEventListener("change", (event) => {
    FieldManager.updateField(field.id, { listId: event.target.value });
  });

  return container;
}

function renderSubFieldSelect(field, index) {
  const container = document.createElement("div");
  container.className = "field-inline";
  const candidates = getFields().filter((item, idx) =>
    idx < index && ["string", "number_string"].includes(item.type)
  );

  if (!candidates.length) {
    container.innerHTML = `<p class="hint">Немає доступних полів для підпункту.</p>`;
    return container;
  }

  container.innerHTML = `
    <label class="hint">Поле для підпункту</label>
    <select class="select">
      <option value="">Оберіть поле</option>
      ${candidates
        .map(
          (item) =>
            `<option value="${item.id}" ${
              item.id === field.subFieldId ? "selected" : ""
            }>${escapeHtml(item.label || "Поле")}</option>`
        )
        .join("")}
    </select>
  `;

  const select = container.querySelector("select");
  select.addEventListener("change", (event) => {
    FieldManager.updateField(field.id, { subFieldId: event.target.value });
  });

  return container;
}

function updateGenerateState() {
  const fields = getFields();
  const hasFields = fields.length > 0;
  const hasConfig = fields.some((field) => {
    if (field.type === "number") return isValidRange(Number(field.min), Number(field.max));
    if (field.type === "string") return !!field.listId;
    if (field.type === "number_string") {
      return (
        isValidRange(Number(field.min), Number(field.max)) && !!field.listId
      );
    }
    if (field.type === "sub") return !!field.subFieldId;
    return false;
  });

  elements.generateBtn.disabled = !hasFields || !hasConfig;
  elements.generateHint.textContent = elements.generateBtn.disabled
    ? "Додайте хоча б одне поле з налаштуваннями."
    : "Готово до генерації.";
}

function renderResult(result) {
  if (!result) return;

  const variants = result.variants || [];
  if (!variants.length) {
    elements.resultOutput.textContent = "";
    return;
  }

  if (state.singleLine) {
    if (variants.length === 1) {
      elements.resultOutput.textContent = variants[0].outputLines.join(" | ");
      return;
    }

    elements.resultOutput.textContent = variants
      .map(
        (variant, index) =>
          `Варіант ${index + 1}: ${variant.outputLines.join(" | ")}`
      )
      .join("\n");
    return;
  }

  if (variants.length === 1) {
    elements.resultOutput.textContent = `${variants[0].outputLines.join("\n")}`;
    return;
  }

  elements.resultOutput.textContent = variants
    .map(
      (variant, index) =>
        `${variant.outputLines.join("\n")}`
    )
    .join("\n\n");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function handleFiles(files) {
  const txtFiles = Array.from(files).filter((file) =>
    file.name.toLowerCase().endsWith(".txt")
  );

  if (!txtFiles.length) {
    showToast("Потрібні .txt файли", true);
    return;
  }

  txtFiles.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const listName = file.name.replace(/\.txt$/i, "");
      const lines = String(reader.result || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const items = lines.map((line) => {
        const [value, sub] = line.split(";");
        return { value: value.trim(), sub: sub ? sub.trim() : null };
      });

      if (!items.length) {
        showToast(`Файл ${file.name} порожній`, true);
        return;
      }

      ListManager.addList({
        id: crypto.randomUUID(),
        name: listName,
        items,
      });

      showToast(`Список "${listName}" додано`);
    };
    reader.readAsText(file, "utf-8");
  });
}

function init() {
  const saved = StorageService.load();
  if (saved) {
    state.lists = saved.lists || [];
    if (saved.instances && saved.instances.length) {
      state.instances = normalizeInstances(saved.instances);
      state.activeInstanceId = saved.activeInstanceId || "";
    } else if (saved.fields) {
      state.instances = [
        {
          id: crypto.randomUUID(),
          name: "Схема 1",
          fields: saved.fields.map((field) => normalizeField(field)),
        },
      ];
    }
    state.singleLine = saved.singleLine || false;
    state.variantCount = Number(saved.variantCount) || 1;
  }

  ensureInstances();
  setFields(getFields().map((field) => normalizeField(field)));
  persist();

  elements.singleLineToggle.checked = state.singleLine;
  elements.variantCount.value = String(state.variantCount || 1);

  renderInstances();
  renderLists();
  renderFields();
  renderResult(state.lastResult);
}

function setupEvents() {
  if (elements.acceptAnalytics && elements.declineAnalytics) {
    elements.acceptAnalytics.addEventListener("click", () => {
      setAnalyticsConsent("granted");
      setConsentBannerVisible(false);
      loadGoogleAnalytics();
    });

    elements.declineAnalytics.addEventListener("click", () => {
      setAnalyticsConsent("denied");
      setConsentBannerVisible(false);
    });
  }

  elements.uploadBtn.addEventListener("click", () => elements.fileInput.click());
  elements.fileInput.addEventListener("change", (event) => {
    handleFiles(event.target.files);
    event.target.value = "";
  });

  elements.dropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("active");
  });

  elements.dropZone.addEventListener("dragleave", () => {
    elements.dropZone.classList.remove("active");
  });

  elements.dropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("active");
    if (event.dataTransfer?.files?.length) {
      handleFiles(event.dataTransfer.files);
    }
  });

  elements.addField.addEventListener("click", () => FieldManager.addField());

  elements.instanceSelect.addEventListener("change", (event) => {
    state.activeInstanceId = event.target.value;
    state.lastResult = null;
    persist();
    renderInstances();
    renderFields();
    renderResult({ variants: [] });
  });

  elements.addInstance.addEventListener("click", () => {
    const nextIndex = state.instances.length + 1;
    const name = prompt("Назва схеми", `Схема ${nextIndex}`);
    if (!name || !name.trim()) {
      showToast("Назва схеми порожня", true);
      return;
    }

    const instance = {
      id: crypto.randomUUID(),
      name: name.trim(),
      fields: [],
    };

    state.instances.push(instance);
    state.activeInstanceId = instance.id;
    state.lastResult = null;
    persist();
    renderInstances();
    renderFields();
    renderResult({ variants: [] });
  });

  elements.cloneInstance.addEventListener("click", () => {
    const instance = getActiveInstance();
    if (!instance) return;
    const clone = cloneInstanceData(instance);
    state.instances.push(clone);
    state.activeInstanceId = clone.id;
    state.lastResult = null;
    persist();
    renderInstances();
    renderFields();
    renderResult({ variants: [] });
    showToast("Схему клоновано");
  });

  elements.renameInstance.addEventListener("click", () => {
    const instance = getActiveInstance();
    if (!instance) return;
    const name = prompt("Нова назва схеми", instance.name);
    if (!name || !name.trim()) {
      showToast("Назва схеми порожня", true);
      return;
    }
    instance.name = name.trim();
    persist();
    renderInstances();
  });

  elements.deleteInstance.addEventListener("click", () => {
    if (state.instances.length <= 1) {
      showToast("Потрібно хоча б одну схему", true);
      return;
    }
    const instance = getActiveInstance();
    if (!instance) return;
    const confirmed = confirm(`Видалити схему "${instance.name}"?`);
    if (!confirmed) return;

    state.instances = state.instances.filter((item) => item.id !== instance.id);
    ensureInstances();
    state.lastResult = null;
    persist();
    renderInstances();
    renderFields();
    renderResult({ variants: [] });
  });

  elements.generateBtn.addEventListener("click", () => {
    if (elements.generateBtn.disabled) {
      showToast("Налаштуйте хоча б одне поле", true);
      return;
    }

    const result = GeneratorEngine.generate();
    renderResult(result);
  });

  elements.singleLineToggle.addEventListener("change", (event) => {
    state.singleLine = event.target.checked;
    persist();
    if (state.lastResult) renderResult(state.lastResult);
  });

  elements.variantCount.addEventListener("input", (event) => {
    const value = Math.max(1, Math.min(50, Number(event.target.value) || 1));
    state.variantCount = value;
    event.target.value = String(value);
    persist();
  });

  elements.exportBtn.addEventListener("click", () => {
    exportAllData();
    showToast("Дані експортовано");
  });

  elements.importBtn.addEventListener("click", () => {
    elements.importInput.click();
  });

  elements.importInput.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || "{}"));
        applyImportedData(data);
      } catch {
        showToast("Некоректний формат JSON", true);
      }
    };
    reader.readAsText(file, "utf-8");
    event.target.value = "";
  });

  elements.resetStorage.addEventListener("click", () => {
    StorageService.clear();
    state.lists = [];
    state.instances = [];
    state.activeInstanceId = "";
    state.lastResult = null;
    state.variantCount = 1;
    elements.variantCount.value = "1";
    ensureInstances();
    renderInstances();
    renderLists();
    renderFields();
    renderResult({ variants: [] });
    showToast("Дані очищено");
  });
}

setupEvents();
init();
applyAnalyticsConsent();
