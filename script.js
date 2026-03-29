const STORAGE_KEY = "my-media-list-v2";

// API KEYS: reemplaza estos valores por tus claves reales.
const TMDB_API_KEY = "3f5a361e20e40f9b8f6d577c84b00e0b";
const LASTFM_API_KEY = "ed1d83b5405a28b6961f53980ba34269";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const FALLBACK_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='750'%3E%3Crect width='100%25' height='100%25' fill='%231e293b'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23cbd5e1' font-size='28' font-family='Arial'%3ESin imagen%3C/text%3E%3C/svg%3E";

const state = {
  items: [],
  filter: "all",
  searchResults: []
};

const els = {
  searchForm: document.getElementById("searchForm"),
  searchType: document.getElementById("searchType"),
  searchInput: document.getElementById("searchInput"),
  searchMessage: document.getElementById("searchMessage"),
  searchResults: document.getElementById("searchResults"),
  myList: document.getElementById("myList"),
  itemsCount: document.getElementById("itemsCount"),
  exportScope: document.getElementById("exportScope"),
  exportListBtn: document.getElementById("exportListBtn"),
  importFileInput: document.getElementById("importFileInput"),
  exportImageBtn: document.getElementById("exportImageBtn"),
  resetListBtn: document.getElementById("resetListBtn"),
  rankingMovie: document.getElementById("rankingMovie"),
  rankingSeries: document.getElementById("rankingSeries"),
  rankingMusic: document.getElementById("rankingMusic"),
  exportBoard: document.getElementById("exportBoard"),
  exportBoardTitle: document.getElementById("exportBoardTitle"),
  exportBoardSubtitle: document.getElementById("exportBoardSubtitle"),
  exportChecklist: document.getElementById("exportChecklist"),
  searchCardTemplate: document.getElementById("searchCardTemplate"),
  listCardTemplate: document.getElementById("listCardTemplate")
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  loadState();
  bindEvents();
  renderAll();
}

function bindEvents() {
  els.searchForm.addEventListener("submit", onSearch);

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderList();
    });
  });

  els.exportListBtn.addEventListener("click", exportListFile);
  els.importFileInput.addEventListener("change", importListFile);
  els.exportImageBtn.addEventListener("click", exportSummaryImage);
  els.resetListBtn.addEventListener("click", resetList);
}

function renderAll() {
  renderList();
  renderSearchResults();
  renderRankings();
}

async function onSearch(event) {
  event.preventDefault();
  const query = els.searchInput.value.trim();
  const type = els.searchType.value;

  if (!query) {
    return;
  }

  els.searchMessage.textContent = "Buscando...";

  try {
    if (type === "music") {
      assertApiKey(LASTFM_API_KEY, "Last.fm");
      state.searchResults = await searchMusic(query);
    } else {
      assertApiKey(TMDB_API_KEY, "TMDb");
      state.searchResults = await searchTmdb(query, type);
    }

    const total = state.searchResults.length;
    els.searchMessage.textContent = total
      ? `Se encontraron ${total} resultados.`
      : "No se encontraron resultados para esa busqueda.";
    renderSearchResults();
  } catch (error) {
    console.error(error);
    state.searchResults = [];
    renderSearchResults();
    els.searchMessage.textContent = error.message;
  }
}

function assertApiKey(keyValue, apiName) {
  if (!keyValue || keyValue.includes("PON_AQUI")) {
    throw new Error(`Falta configurar la API KEY de ${apiName} en script.js`);
  }
}

async function searchTmdb(query, type) {
  const endpoint = type === "movie" ? "movie" : "tv";
  const url = `https://api.themoviedb.org/3/search/${endpoint}?api_key=${TMDB_API_KEY}&language=es-ES&query=${encodeURIComponent(
    query
  )}&page=1`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Error consultando TMDb. Revisa tu API KEY o conexion.");
  }

  const data = await res.json();
  return (data.results || []).slice(0, 18).map((item) => {
    const rawDate = endpoint === "movie" ? item.release_date : item.first_air_date;
    return {
      sourceId: String(item.id),
      mediaType: endpoint === "movie" ? "movie" : "series",
      title: endpoint === "movie" ? item.title : item.name,
      year: (rawDate || "").slice(0, 4) || "-",
      image: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : FALLBACK_IMAGE,
      source: "tmdb",
      notes: "",
      status: "pending",
      rank: 0
    };
  });
}

async function searchMusic(query) {
  const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(
    query
  )}&api_key=${LASTFM_API_KEY}&format=json&limit=20`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error("Error consultando Last.fm. Revisa tu API KEY o conexion.");
  }

  const data = await res.json();
  const tracks = data?.results?.trackmatches?.track || [];
  const list = Array.isArray(tracks) ? tracks : [tracks];

  return list
    .filter((track) => track?.name)
    .map((track) => ({
      sourceId: `${track.artist || "unknown"}-${track.name || "track"}`.toLowerCase(),
      mediaType: "music",
      title: `${track.name} - ${track.artist || "Artista desconocido"}`,
      year: "-",
      image: pickLastFmImage(track.image),
      source: "lastfm",
      notes: "",
      status: "pending",
      rank: 0
    }));
}

function pickLastFmImage(images = []) {
  if (!Array.isArray(images)) {
    return FALLBACK_IMAGE;
  }

  const preferred =
    images.find((img) => img.size === "extralarge" && img["#text"]) ||
    images.find((img) => img.size === "large" && img["#text"]) ||
    images.find((img) => img["#text"]);

  return preferred?.["#text"] || FALLBACK_IMAGE;
}

function renderSearchResults() {
  els.searchResults.innerHTML = "";

  if (!state.searchResults.length) {
    return;
  }

  const fragment = document.createDocumentFragment();

  state.searchResults.forEach((result) => {
    const node = els.searchCardTemplate.content.cloneNode(true);
    const card = node.querySelector("article");
    const img = node.querySelector(".result-image");
    const title = node.querySelector(".result-title");
    const year = node.querySelector(".result-year");
    const addBtn = node.querySelector(".add-btn");

    img.src = result.image || FALLBACK_IMAGE;
    img.alt = result.title;
    title.textContent = result.title;
    year.textContent = `Ano: ${result.year || "-"}`;

    const exists = state.items.some(
      (item) => item.sourceId === result.sourceId && item.mediaType === result.mediaType
    );

    if (exists) {
      addBtn.disabled = true;
      addBtn.classList.add("cursor-not-allowed", "opacity-50");
      addBtn.textContent = "Ya esta en tu lista";
    } else {
      addBtn.addEventListener("click", () => addItem(result));
    }

    card.dataset.type = result.mediaType;
    fragment.appendChild(node);
  });

  els.searchResults.appendChild(fragment);
}

function addItem(itemData) {
  const newItem = {
    localId: createLocalId(),
    sourceId: itemData.sourceId,
    mediaType: itemData.mediaType,
    title: itemData.title,
    year: itemData.year || "-",
    image: itemData.image || FALLBACK_IMAGE,
    source: itemData.source,
    notes: "",
    status: "pending",
    rank: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.items.unshift(newItem);
  persistState();
  renderAll();
}

function renderList() {
  els.myList.innerHTML = "";

  const visibleItems = state.items.filter(
    (item) => state.filter === "all" || item.mediaType === state.filter
  );

  if (!visibleItems.length) {
    els.myList.innerHTML =
      '<p class="col-span-full rounded-xl border border-dashed border-slate-600 p-6 text-center text-slate-400">No hay elementos para este filtro todavia.</p>';
  } else {
    const fragment = document.createDocumentFragment();

    visibleItems.forEach((item) => {
      const node = els.listCardTemplate.content.cloneNode(true);
      const card = node.querySelector("article");
      const img = node.querySelector(".list-image");
      const type = node.querySelector(".list-type");
      const title = node.querySelector(".list-title");
      const year = node.querySelector(".list-year");
      const notes = node.querySelector(".list-notes");
      const rankSelect = node.querySelector(".rank-select");
      const toggleBtn = node.querySelector(".toggle-btn");
      const editBtn = node.querySelector(".edit-btn");
      const deleteBtn = node.querySelector(".delete-btn");

      img.src = item.image || FALLBACK_IMAGE;
      img.alt = item.title;
      type.textContent = labelMediaType(item.mediaType);
      title.textContent = item.title;
      year.textContent = `Ano: ${item.year || "-"}`;
      notes.textContent = item.notes || "Sin notas";
      rankSelect.value = String(item.rank || 0);

      toggleBtn.textContent = item.status === "done" ? "Desmarcar" : "Tachar";

      if (item.status === "done") {
        card.classList.add("is-done");
      }

      rankSelect.addEventListener("change", (event) => {
        setItemRank(item.localId, Number(event.target.value));
      });
      toggleBtn.addEventListener("click", () => toggleItemStatus(item.localId));
      editBtn.addEventListener("click", () => editItem(item.localId));
      deleteBtn.addEventListener("click", () => deleteItem(item.localId));

      fragment.appendChild(node);
    });

    els.myList.appendChild(fragment);
  }

  const doneCount = state.items.filter((item) => item.status === "done").length;
  els.itemsCount.textContent = `${state.items.length} elementos guardados | ${doneCount} completados`;
}

function labelMediaType(type) {
  if (type === "movie") return "Cine";
  if (type === "series") return "Series";
  return "Musica";
}

function setItemRank(localId, rank) {
  state.items = state.items.map((item) => {
    if (item.localId !== localId) {
      return item;
    }

    return {
      ...item,
      rank,
      updatedAt: new Date().toISOString()
    };
  });

  persistState();
  renderRankings();
}

function toggleItemStatus(localId) {
  state.items = state.items.map((item) => {
    if (item.localId !== localId) {
      return item;
    }

    return {
      ...item,
      status: item.status === "done" ? "pending" : "done",
      updatedAt: new Date().toISOString()
    };
  });

  persistState();
  renderList();
}

function editItem(localId) {
  const target = state.items.find((item) => item.localId === localId);
  if (!target) return;

  const newTitle = prompt("Editar titulo:", target.title);
  if (newTitle === null) return;

  const newNotes = prompt("Anade o edita notas:", target.notes || "");
  if (newNotes === null) return;

  state.items = state.items.map((item) => {
    if (item.localId !== localId) {
      return item;
    }

    return {
      ...item,
      title: newTitle.trim() || item.title,
      notes: newNotes.trim(),
      updatedAt: new Date().toISOString()
    };
  });

  persistState();
  renderAll();
}

function deleteItem(localId) {
  const ok = confirm("Eliminar este elemento de tu lista?");
  if (!ok) return;

  state.items = state.items.filter((item) => item.localId !== localId);
  persistState();
  renderAll();
}

function exportListFile() {
  const exportType = els.exportScope.value;
  const selectedItems = getFilteredItemsForExport(exportType);

  if (!selectedItems.length) {
    alert("No hay elementos para exportar con ese filtro.");
    return;
  }

  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    exportType,
    items: selectedItems
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });

  const date = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `mi-lista-${exportType}-${date}.mylist`);
}

function importListFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = String(reader.result || "");
      const parsed = JSON.parse(raw);
      const incomingItems = Array.isArray(parsed) ? parsed : parsed.items;

      if (!Array.isArray(incomingItems)) {
        throw new Error("Archivo invalido: no contiene una lista valida.");
      }

      const shouldReplace = confirm(
        "Se reemplazara tu lista local actual por la lista importada. Continuar?"
      );
      if (!shouldReplace) {
        return;
      }

      state.items = incomingItems
        .filter((item) => item && item.title && item.mediaType)
        .map((item) => ({
          localId: item.localId || createLocalId(),
          sourceId: item.sourceId || createLocalId(),
          mediaType: item.mediaType,
          title: item.title,
          year: item.year || "-",
          image: item.image || FALLBACK_IMAGE,
          source: item.source || "import",
          notes: item.notes || "",
          status: item.status === "done" ? "done" : "pending",
          rank: clampRank(Number(item.rank || 0)),
          createdAt: item.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

      persistState();
      renderAll();
      els.searchMessage.textContent = "Lista cargada correctamente.";
    } catch (error) {
      console.error(error);
      alert(error.message || "No se pudo importar el archivo.");
    } finally {
      event.target.value = "";
    }
  };

  reader.readAsText(file);
}

async function exportSummaryImage() {
  const exportType = els.exportScope.value;
  const selectedItems = getFilteredItemsForExport(exportType);

  if (!selectedItems.length) {
    alert("No hay elementos para exportar con ese filtro.");
    return;
  }

  try {
    els.exportImageBtn.disabled = true;
    els.exportImageBtn.textContent = "Generando imagen...";

    buildExportBoard(selectedItems, exportType);
    els.exportBoard.classList.remove("hidden");

    const canvas = await html2canvas(els.exportBoard, {
      backgroundColor: "#0f172a",
      scale: 2,
      useCORS: true
    });

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) {
      throw new Error("No se pudo generar la imagen.");
    }

    const date = new Date().toISOString().slice(0, 10);
    downloadBlob(blob, `resumen-${exportType}-${date}.png`);
  } catch (error) {
    console.error(error);
    alert("No se pudo exportar el resumen en imagen.");
  } finally {
    els.exportBoard.classList.add("hidden");
    els.exportImageBtn.disabled = false;
    els.exportImageBtn.textContent = "Exportar Resumen (imagen)";
  }
}

function buildExportBoard(items, exportType) {
  const done = items.filter((item) => item.status === "done").length;
  const scopeLabel = exportType === "all" ? "Todo" : labelMediaType(exportType);

  els.exportBoardTitle.textContent = `Lista: ${scopeLabel}`;
  els.exportBoardSubtitle.textContent = `${items.length} elementos | ${done} completados | ${new Date().toLocaleDateString("es-ES")}`;

  const grouped = {
    movie: items.filter((item) => item.mediaType === "movie"),
    series: items.filter((item) => item.mediaType === "series"),
    music: items.filter((item) => item.mediaType === "music")
  };

  const groupsToRender = [
    { key: "movie", title: "Peliculas" },
    { key: "series", title: "Series" },
    { key: "music", title: "Canciones" }
  ].filter((group) => grouped[group.key].length > 0);

  els.exportChecklist.innerHTML = "";

  groupsToRender.forEach((group) => {
    const wrapper = document.createElement("article");
    wrapper.className = "export-group";

    const title = document.createElement("h3");
    title.className = "export-group-title";
    title.textContent = group.title;
    wrapper.appendChild(title);

    grouped[group.key].forEach((item) => {
      const row = document.createElement("div");
      row.className = "export-row";

      const checkbox = document.createElement("span");
      checkbox.className = "export-checkbox";
      checkbox.textContent = item.status === "done" ? "✓" : "";

      const text = document.createElement("span");
      text.className = `export-text ${item.status === "done" ? "done" : ""}`;
      text.textContent = item.title;

      const score = document.createElement("span");
      score.className = "export-score";
      score.textContent = item.rank > 0 ? `${item.rank}/10` : "-";

      row.appendChild(checkbox);
      row.appendChild(text);
      row.appendChild(score);
      wrapper.appendChild(row);
    });

    els.exportChecklist.appendChild(wrapper);
  });
}

function renderRankings() {
  renderRankingForType(els.rankingMovie, "movie");
  renderRankingForType(els.rankingSeries, "series");
  renderRankingForType(els.rankingMusic, "music");
}

function renderRankingForType(container, mediaType) {
  const ranked = state.items
    .filter((item) => item.mediaType === mediaType && Number(item.rank) > 0)
    .sort((a, b) => Number(b.rank) - Number(a.rank) || a.title.localeCompare(b.title))
    .slice(0, 10);

  container.innerHTML = "";

  if (!ranked.length) {
    container.innerHTML = '<li class="ranking-empty">Sin items puntuados todavia.</li>';
    return;
  }

  const fragment = document.createDocumentFragment();

  ranked.forEach((item) => {
    const li = document.createElement("li");
    li.className = "ranking-item";

    const name = document.createElement("span");
    name.textContent = item.title;

    const score = document.createElement("span");
    score.className = "ranking-score";
    score.textContent = `${item.rank}/10`;

    li.appendChild(name);
    li.appendChild(score);
    fragment.appendChild(li);
  });

  container.appendChild(fragment);
}

function resetList() {
  if (!state.items.length) {
    alert("La lista ya esta vacia.");
    return;
  }

  const ok = confirm("Se borrara toda la lista local y rankings. Continuar?");
  if (!ok) return;

  state.items = [];
  state.searchResults = [];
  persistState();
  renderAll();
  els.searchMessage.textContent = "Lista reseteada correctamente.";
}

function getFilteredItemsForExport(exportType) {
  if (exportType === "all") {
    return [...state.items];
  }

  return state.items.filter((item) => item.mediaType === exportType);
}

function clampRank(value) {
  if (Number.isNaN(value)) {
    return 0;
  }

  if (value < 0) return 0;
  if (value > 10) return 10;
  return Math.round(value);
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      state.items = [];
      return;
    }

    const parsed = JSON.parse(raw);
    state.items = Array.isArray(parsed.items)
      ? parsed.items.map((item) => ({
          ...item,
          rank: clampRank(Number(item.rank || 0))
        }))
      : [];
  } catch (error) {
    console.error("Error leyendo LocalStorage:", error);
    state.items = [];
  }
}

function persistState() {
  const payload = {
    version: 2,
    items: state.items,
    savedAt: new Date().toISOString()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function createLocalId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
