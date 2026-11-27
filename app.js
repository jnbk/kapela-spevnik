const CLOUD_API_URL = "https://script.google.com/macros/s/AKfycbx8TN0fKA75X5jFnf6czSlwcaXmbF_dNe63aaJSmAYT9mwJzrmyCC61J3ejaeOXS2U7/exec";

const DEFAULT_SONGS = [
    {
        id: "demo-1",
        title: "Voda čo ma drží nad vodou",
        author: "Elán",
        capo: 2,
        content: "(Hmi)Keby bolo (G)niečo, čo sa (D)nedá pove(A)dať,\n(Hmi)keby bolo (G)niečo, čo sa (D)nedá vrátiť (A)späť.\n(G)Tak by som ti (A)povedal, že (D)ľúbim ťa tak (Hmi)veľmi,\n(G)ako voda, (A)čo ma drží (Hmi)nad vodou."
    },
    {
        id: "demo-2",
        title: "Tři kříže",
        author: "Hop Trop",
        capo: 0,
        content: "(Dmi)Dávám sbohem (C)břehům prokla(Ami)tejm,\n(Dmi)který v drápech (C)má ďábel (Dmi)sám.\n(F)Bílou přídí (C)šalupa My (Ami)May\n(Dmi)míří k útesům, (C)který (Dmi)znám.\n\nRef:\n(F)Jen tři kříže z (C)bílýho kame(Ami)ní\n(Dmi)někdo do písku (C)posklá(Dmi)dal."
    }
];

const DEFAULT_PLAYLISTS = [
    {
        id: "pl-koncert-1",
        name: "Koncert – základ",
        songIds: ["demo-1", "demo-2"]
    }
];

let songs = [];
let playlists = [];
let activeSidebarTab = "songs";
let currentPlaylistId = null;
let filteredSongsCache = [];
let lastDeletedSong = null;
let currentSongId = null;
let currentFontSize = parseInt(localStorage.getItem("spevnik_font_size"), 10) || 18;
let transposeSteps = 0;
let hideCapo = false;
let isToolbarCollapsed = localStorage.getItem("spevnik_toolbar_collapsed") === "true";
let chordNotation = localStorage.getItem("spevnik_notation") === "en" ? "en" : "sk";
let isSaving = false;

const viewerToolbarEl = document.getElementById("viewerToolbar");
const toggleToolbarBtnEl = document.getElementById("toggleToolbarBtn");
const notationToggleBtnEl = document.getElementById("notationToggleBtn");
const playlistNavBarEl = document.getElementById("playlistNavBar");
const playlistNavTitleEl = document.getElementById("playlistNavTitle");
const playlistNavCounterEl = document.getElementById("playlistNavCounter");
const prevSongBtnEl = document.getElementById("prevSongBtn");
const nextSongBtnEl = document.getElementById("nextSongBtn");

const tabAllSongsBtnEl = document.getElementById("tabAllSongsBtn");
const tabPlaylistsBtnEl = document.getElementById("tabPlaylistsBtn");
const allSongsControlsEl = document.getElementById("allSongsControls");
const playlistsControlsEl = document.getElementById("playlistsControls");
const playlistSelectEl = document.getElementById("playlistSelect");
const activePlaylistActionsEl = document.getElementById("activePlaylistActions");

const songListEl = document.getElementById("songList");
const searchInputEl = document.getElementById("searchInput");
const songContentAreaEl = document.getElementById("songContentArea");
const songActionsEl = document.getElementById("songActions");
const hideCapoBtnEl = document.getElementById("hideCapoBtn");
const syncStatusEl = document.getElementById("syncStatus");
const refreshCloudBtnEl = document.getElementById("refreshCloudBtn");
const songSidebarEl = document.getElementById("songSidebar");
const bannerMessageEl = document.getElementById("bannerMessage");

const editorModalEl = document.getElementById("editorModal");
const songFormEl = document.getElementById("songForm");
const saveSongBtnEl = document.getElementById("saveSongBtn");
const modalTitleEl = document.getElementById("modalTitle");
const songIdInput = document.getElementById("songId");
const songTitleInput = document.getElementById("songTitleInput");
const songAuthorInput = document.getElementById("songAuthorInput");
const songCapoInput = document.getElementById("songCapoInput");
const songBodyInput = document.getElementById("songBodyInput");

const addToPlaylistModalEl = document.getElementById("addToPlaylistModal");
const pickSongSelectEl = document.getElementById("pickSongSelect");

document.addEventListener("DOMContentLoaded", function () {
    applyFontSize();
    applyToolbarCollapsed();
    applyNotationButton();
    setupEventListeners();
    loadSongs();

    if (window.innerWidth <= 768 && songSidebarEl) {
        songSidebarEl.classList.add("open");
    }
});

function applyFontSize() {
    document.documentElement.style.setProperty("--song-font-size", currentFontSize + "px");
    localStorage.setItem("spevnik_font_size", String(currentFontSize));
}

function applyToolbarCollapsed() {
    if (!viewerToolbarEl || !toggleToolbarBtnEl) return;
    viewerToolbarEl.classList.toggle("collapsed", isToolbarCollapsed);
    toggleToolbarBtnEl.textContent = isToolbarCollapsed ? "▼" : "▲";
    toggleToolbarBtnEl.title = isToolbarCollapsed ? "Rozbaliť hornú lištu" : "Zbaliť hornú lištu";
    localStorage.setItem("spevnik_toolbar_collapsed", String(isToolbarCollapsed));
}

function applyNotationButton() {
    if (!notationToggleBtnEl) return;
    if (chordNotation === "sk") {
        notationToggleBtnEl.textContent = "SK (Hmi)";
        notationToggleBtnEl.classList.remove("btn-primary");
        notationToggleBtnEl.classList.add("btn-secondary");
    } else {
        notationToggleBtnEl.textContent = "EN (Bm)";
        notationToggleBtnEl.classList.remove("btn-secondary");
        notationToggleBtnEl.classList.add("btn-primary");
    }
    localStorage.setItem("spevnik_notation", chordNotation);
}

function normalizePlaylist(raw) {
    return {
        id: String(raw.id),
        name: String(raw.name || "Playlist").trim(),
        songIds: Array.isArray(raw.songIds) ? raw.songIds.map(String) : []
    };
}

function saveLocalCache() {
    localStorage.setItem("spevnik_songs", JSON.stringify(songs));
    localStorage.setItem("spevnik_playlists", JSON.stringify(playlists));
}

function loadLocalCache() {
    const localSongs = localStorage.getItem("spevnik_songs");
    if (localSongs) {
        try {
            const parsedSongs = JSON.parse(localSongs);
            if (Array.isArray(parsedSongs)) {
                songs = parsedSongs.map(normalizeSong);
            }
        } catch (e) {
            songs = [];
        }
    }

    const localPlaylists = localStorage.getItem("spevnik_playlists");
    if (localPlaylists) {
        try {
            const parsedPlaylists = JSON.parse(localPlaylists);
            if (Array.isArray(parsedPlaylists)) {
                playlists = parsedPlaylists.map(normalizePlaylist);
            }
        } catch (e) {
            playlists = [];
        }
    }
}

function cleanDeletedSongFromPlaylistsLocal(deletedSongId) {
    playlists.forEach(function (pl) {
        pl.songIds = pl.songIds.filter(function (id) { return id !== deletedSongId; });
    });
}

function getCurrentPlaylist() {
    if (!currentPlaylistId) return null;
    return playlists.find(function (pl) { return pl.id === currentPlaylistId; }) || null;
}

function renderPlaylistSelect() {
    if (!playlistSelectEl) return;
    if (currentPlaylistId && !playlists.some(function (pl) { return pl.id === currentPlaylistId; })) {
        currentPlaylistId = playlists.length > 0 ? playlists[0].id : null;
    }

    playlistSelectEl.innerHTML = '<option value="">-- Vyber playlist --</option>';

    playlists.forEach(function (pl) {
        const opt = document.createElement("option");
        opt.value = pl.id;
        opt.textContent = pl.name + " (" + pl.songIds.length + ")";
        if (pl.id === currentPlaylistId) {
            opt.selected = true;
        }
        playlistSelectEl.appendChild(opt);
    });

    const activePl = getCurrentPlaylist();
    if (activePlaylistActionsEl) {
        activePlaylistActionsEl.style.display = activePl ? "flex" : "none";
    }
}

function updatePlaylistNavBar() {
    const activePl = getCurrentPlaylist();
    if (!playlistNavBarEl || activeSidebarTab !== "playlists" || !activePl || !currentSongId) {
        if (playlistNavBarEl) playlistNavBarEl.style.display = "none";
        return;
    }

    const idx = activePl.songIds.indexOf(currentSongId);
    if (idx === -1) {
        playlistNavBarEl.style.display = "none";
        return;
    }

    playlistNavBarEl.style.display = "flex";
    if (playlistNavTitleEl) playlistNavTitleEl.textContent = activePl.name;
    if (playlistNavCounterEl) playlistNavCounterEl.textContent = (idx + 1) + " / " + activePl.songIds.length;
    if (prevSongBtnEl) prevSongBtnEl.disabled = idx <= 0;
    if (nextSongBtnEl) nextSongBtnEl.disabled = idx >= activePl.songIds.length - 1;
}

function goToPlaylistOffset(offset) {
    const activePl = getCurrentPlaylist();
    if (!activePl || !currentSongId) return;
    const idx = activePl.songIds.indexOf(currentSongId);
    const targetIdx = idx + offset;
    if (targetIdx < 0 || targetIdx >= activePl.songIds.length) return;
    const targetSongId = activePl.songIds[targetIdx];
    openSongCleanly(targetSongId);
    if (songContentAreaEl) {
        songContentAreaEl.scrollTop = 0;
    }
}

function setSidebarTab(tabName) {
    activeSidebarTab = tabName;
    const isSongs = tabName === "songs";

    if (tabAllSongsBtnEl) tabAllSongsBtnEl.classList.toggle("active", isSongs);
    if (tabPlaylistsBtnEl) tabPlaylistsBtnEl.classList.toggle("active", !isSongs);
    if (allSongsControlsEl) allSongsControlsEl.style.display = isSongs ? "block" : "none";
    if (playlistsControlsEl) playlistsControlsEl.style.display = isSongs ? "none" : "block";

    if (!isSongs) {
        if (!currentPlaylistId && playlists.length > 0) {
            currentPlaylistId = playlists[0].id;
        }
        renderPlaylistSelect();
    }

    renderSongList();
    updatePlaylistNavBar();
}

function normalizeSong(raw) {
    return {
        id: String(raw.id),
        title: String(raw.title || "").trim(),
        author: String(raw.author || "").trim(),
        capo: Math.max(0, Math.min(12, parseInt(raw.capo, 10) || 0)),
        content: String(raw.content || "")
    };
}

function showBanner(text, type, undoAction) {
    if (!bannerMessageEl) return;
    bannerMessageEl.className = "banner-message banner-" + (type || "info");
    bannerMessageEl.style.display = "flex";
    bannerMessageEl.innerHTML = "<span>" + escapeHtml(text) + "</span>";

    if (typeof undoAction === "function") {
        const btn = document.createElement("button");
        btn.className = "btn btn-small";
        btn.textContent = "↩️ Vrátiť späť";
        btn.addEventListener("click", async function () {
            hideBanner();
            await undoAction();
        });
        bannerMessageEl.appendChild(btn);
    }
}

function hideBanner() {
    if (!bannerMessageEl) return;
    bannerMessageEl.style.display = "none";
    bannerMessageEl.innerHTML = "";
}

async function loadSongs() {
    updateStatus("Načítavam spevník a playlisty...");
    loadLocalCache();

    if (songs.length > 0 || playlists.length > 0) {
        renderPlaylistSelect();
        renderSongList();
    }

    if (CLOUD_API_URL && CLOUD_API_URL.trim() !== "") {
        try {
            const response = await fetch(CLOUD_API_URL.trim());
            if (!response.ok) {
                throw new Error("HTTP chyba " + response.status);
            }
            const payload = await response.json();

            if (Array.isArray(payload)) {
                songs = payload.map(normalizeSong);
                if (!playlists.length) {
                    playlists = DEFAULT_PLAYLISTS.map(normalizePlaylist);
                }
            } else if (payload && typeof payload === "object") {
                if (Array.isArray(payload.songs)) {
                    songs = payload.songs.map(normalizeSong);
                }
                if (Array.isArray(payload.playlists)) {
                    playlists = payload.playlists.map(normalizePlaylist);
                }
            } else {
                throw new Error("Neplatný formát dát z cloudu");
            }

            saveLocalCache();
            renderPlaylistSelect();
            renderSongList();
            updatePlaylistNavBar();

            if (currentSongId) {
                const stillExists = songs.some(function (s) { return s.id === currentSongId; });
                if (stillExists) {
                    selectSong(currentSongId);
                } else {
                    resetViewer();
                }
            }
            updateStatus("☁️ Synchronizované");
        } catch (error) {
            console.error("Chyba pri načítaní z cloudu:", error);
            if (!songs.length) {
                songs = DEFAULT_SONGS.map(normalizeSong);
            }
            if (!playlists.length) {
                playlists = DEFAULT_PLAYLISTS.map(normalizePlaylist);
            }
            saveLocalCache();
            renderPlaylistSelect();
            renderSongList();
            updatePlaylistNavBar();
            updateStatus("⚠️ Nepodarilo sa načítať z cloudu");
            showBanner("Cloud momentálne neodpovedá. Zobrazujú sa lokálne uložené údaje.", "warning");
        }
    } else {
        if (!songs.length) {
            songs = DEFAULT_SONGS.map(normalizeSong);
        }
        if (!playlists.length) {
            playlists = DEFAULT_PLAYLISTS.map(normalizePlaylist);
        }
        saveLocalCache();
        renderPlaylistSelect();
        renderSongList();
        updatePlaylistNavBar();
        updateStatus("💾 Lokálny režim");
    }
}

async function postToCloud(bodyObj) {
    saveLocalCache();
    renderPlaylistSelect();
    renderSongList();
    updatePlaylistNavBar();

    if (!CLOUD_API_URL || CLOUD_API_URL.trim() === "") {
        updateStatus("💾 Uložené v tomto prehliadači");
        return true;
    }

    updateStatus("⏳ Ukladám pre kapelu...");
    try {
        const response = await fetch(CLOUD_API_URL.trim(), {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(bodyObj)
        });

        if (!response.ok) {
            throw new Error("HTTP chyba " + response.status);
        }
        const result = await response.json();
        if (result && result.status === "error") {
            throw new Error(result.message || "Chyba skriptu");
        }

        updateStatus("☁️ Uložené pre všetkých");
        return true;
    } catch (error) {
        console.error("Chyba pri ukladaní do cloudu:", error);
        updateStatus("❌ Chyba synchronizácie");
        showBanner("Zmena sa uložila na toto zariadenie, ale nepodarilo sa ju odoslať do cloudu. Skús neskôr kliknúť na Obnoviť.", "warning");
        return false;
    }
}

function updateStatus(text) {
    if (syncStatusEl) {
        syncStatusEl.textContent = text;
    }
}

function resetViewer() {
    currentSongId = null;
    if (songActionsEl) songActionsEl.style.display = "none";
    if (hideCapoBtnEl) hideCapoBtnEl.style.display = "none";
    updatePlaylistNavBar();
    if (songContentAreaEl) {
        songContentAreaEl.innerHTML =
            '<div class="empty-state">' +
            "<h2>Vyber si pieseň zo zoznamu</h2>" +
            "<p>Klikni na pieseň v pravom paneli alebo pridaj novú pre celú kapelu.</p>" +
            "</div>";
    }
}

function normalizeText(str) {
    return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function renderSongList() {
    if (!songListEl) return;
    songListEl.innerHTML = "";

    if (activeSidebarTab === "playlists") {
        renderPlaylistItemsList();
        return;
    }

    const query = normalizeText(searchInputEl ? searchInputEl.value.trim() : "");
    const sortedSongs = songs.slice().sort(function (a, b) {
        return a.title.localeCompare(b.title, "sk");
    });

    filteredSongsCache = sortedSongs.filter(function (song) {
        if (!query) return true;
        return (
            normalizeText(song.title).includes(query) ||
            normalizeText(song.author).includes(query) ||
            normalizeText(song.content).includes(query)
        );
    });

    if (filteredSongsCache.length === 0) {
        songListEl.innerHTML = '<li style="padding: 20px; text-align: center; color: #64748b;">Žiadna pieseň sa nenašla.</li>';
        return;
    }

    filteredSongsCache.forEach(function (song) {
        const li = document.createElement("li");
        li.className = "song-item" + (song.id === currentSongId ? " active" : "");
        const metaParts = [];
        if (song.author) metaParts.push(song.author);
        if (song.capo > 0) metaParts.push("Capo " + song.capo);

        li.innerHTML =
            '<div class="song-item-main">' +
            '<div class="song-item-title">' + escapeHtml(song.title) + "</div>" +
            '<div class="song-item-author">' + escapeHtml(metaParts.join(" • ") || "Bez autora") + "</div>" +
            "</div>";

        li.addEventListener("click", function () {
            openSongCleanly(song.id);
        });
        songListEl.appendChild(li);
    });
}

function renderPlaylistItemsList() {
    const activePl = getCurrentPlaylist();
    if (!activePl) {
        songListEl.innerHTML = '<li style="padding: 20px; text-align: center; color: #64748b;">Vytvor alebo vyber playlist vyššie.</li>';
        return;
    }

    if (!activePl.songIds.length) {
        songListEl.innerHTML = '<li style="padding: 20px; text-align: center; color: #64748b;">Tento playlist je zatiaľ prázdny. Klikni na „+ Pridať pieseň“.</li>';
        return;
    }

    let draggedIndex = null;

    function clearDragClasses() {
        const items = songListEl.querySelectorAll(".song-item");
        items.forEach(function (item) {
            item.classList.remove("dragging", "drag-over-top", "drag-over-bottom");
        });
    }

    activePl.songIds.forEach(function (songId, index) {
        const song = songs.find(function (s) { return s.id === songId; });
        if (!song) return;

        const li = document.createElement("li");
        li.className = "song-item playlist-draggable" + (song.id === currentSongId ? " active" : "");
        li.draggable = true;
        li.dataset.index = String(index);

        const handleSpan = document.createElement("span");
        handleSpan.className = "drag-handle";
        handleSpan.textContent = "⋮⋮";
        handleSpan.title = "Potiahnutím zmeň poradie v playliste";

        const metaParts = [(index + 1) + "."];
        if (song.author) metaParts.push(song.author);
        if (song.capo > 0) metaParts.push("Capo " + song.capo);

        const mainDiv = document.createElement("div");
        mainDiv.className = "song-item-main";
        mainDiv.innerHTML =
            '<div class="song-item-title">' + escapeHtml(song.title) + "</div>" +
            '<div class="song-item-author">' + escapeHtml(metaParts.join(" • ")) + "</div>";
        mainDiv.addEventListener("click", function () {
            openSongCleanly(song.id);
        });

        li.addEventListener("dragstart", function (e) {
            draggedIndex = index;
            li.classList.add("dragging");
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(index));
            }
        });

        li.addEventListener("dragover", function (e) {
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = "move";
            }
            const rect = li.getBoundingClientRect();
            const isTopHalf = e.clientY < rect.top + rect.height / 2;
            li.classList.toggle("drag-over-top", isTopHalf);
            li.classList.toggle("drag-over-bottom", !isTopHalf);
        });

        li.addEventListener("dragleave", function () {
            li.classList.remove("drag-over-top", "drag-over-bottom");
        });

        li.addEventListener("drop", async function (e) {
            e.preventDefault();
            const fromRaw = e.dataTransfer ? e.dataTransfer.getData("text/plain") : "";
            const fromIndex = draggedIndex !== null ? draggedIndex : parseInt(fromRaw, 10);
            const rect = li.getBoundingClientRect();
            const insertAfter = e.clientY >= rect.top + rect.height / 2;

            clearDragClasses();
            draggedIndex = null;

            if (isNaN(fromIndex) || fromIndex < 0 || fromIndex >= activePl.songIds.length) return;

            let targetIndex = insertAfter ? index + 1 : index;
            if (fromIndex < targetIndex) {
                targetIndex -= 1;
            }
            if (targetIndex < 0) targetIndex = 0;
            if (targetIndex >= activePl.songIds.length) targetIndex = activePl.songIds.length - 1;
            if (fromIndex === targetIndex) return;

            const movedItem = activePl.songIds.splice(fromIndex, 1)[0];
            activePl.songIds.splice(targetIndex, 0, movedItem);

            await postToCloud({ action: "update_playlist", playlist: activePl });
        });

        li.addEventListener("dragend", function () {
            draggedIndex = null;
            clearDragClasses();
        });

        const controlsDiv = document.createElement("div");
        controlsDiv.className = "playlist-order-controls";

        const upBtn = document.createElement("button");
        upBtn.type = "button";
        upBtn.className = "btn-mini";
        upBtn.textContent = "↑";
        upBtn.title = "Posunúť vyššie v playliste";
        upBtn.disabled = index === 0;
        upBtn.addEventListener("click", async function (e) {
            e.stopPropagation();
            await movePlaylistSong(index, -1);
        });

        const downBtn = document.createElement("button");
        downBtn.type = "button";
        downBtn.className = "btn-mini";
        downBtn.textContent = "↓";
        downBtn.title = "Posunúť nižšie v playliste";
        downBtn.disabled = index === activePl.songIds.length - 1;
        downBtn.addEventListener("click", async function (e) {
            e.stopPropagation();
            await movePlaylistSong(index, 1);
        });

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.className = "btn-mini btn-mini-danger";
        removeBtn.textContent = "✕";
        removeBtn.title = "Odobrať z playlistu";
        removeBtn.addEventListener("click", async function (e) {
            e.stopPropagation();
            await removePlaylistSong(index);
        });

        controlsDiv.appendChild(upBtn);
        controlsDiv.appendChild(downBtn);
        controlsDiv.appendChild(removeBtn);

        li.appendChild(handleSpan);
        li.appendChild(mainDiv);
        li.appendChild(controlsDiv);
        songListEl.appendChild(li);
    });
}

async function movePlaylistSong(index, delta) {
    const activePl = getCurrentPlaylist();
    if (!activePl) return;
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= activePl.songIds.length) return;

    const temp = activePl.songIds[index];
    activePl.songIds[index] = activePl.songIds[targetIndex];
    activePl.songIds[targetIndex] = temp;

    await postToCloud({ action: "update_playlist", playlist: activePl });
}

async function removePlaylistSong(index) {
    const activePl = getCurrentPlaylist();
    if (!activePl) return;
    activePl.songIds.splice(index, 1);

    await postToCloud({ action: "update_playlist", playlist: activePl });
}

function openSongCleanly(songId) {
    transposeSteps = 0;
    hideCapo = false;
    const transposeValEl = document.getElementById("transposeValue");
    if (transposeValEl) transposeValEl.textContent = "0";
    selectSong(songId);
    if (window.innerWidth <= 768 && songSidebarEl) {
        songSidebarEl.classList.remove("open");
    }
}

function updateHideCapoButton(songCapo) {
    if (!hideCapoBtnEl) return;
    if (songCapo > 0) {
        hideCapoBtnEl.style.display = "inline-flex";
        hideCapoBtnEl.classList.toggle("active", hideCapo);
        hideCapoBtnEl.textContent = hideCapo ? "🎸 Bez kapa (+" + songCapo + ")" : "🎸 Skryť kapo";
    } else {
        hideCapoBtnEl.style.display = "none";
        hideCapoBtnEl.classList.remove("active");
    }
}

function selectSong(id) {
    const song = songs.find(function (s) { return s.id === id; });
    if (!song || !songContentAreaEl) return;

    currentSongId = id;
    renderSongList();
    updatePlaylistNavBar();
    if (songActionsEl) songActionsEl.style.display = "flex";
    updateHideCapoButton(song.capo);

    const effectiveSemitones = transposeSteps + (hideCapo ? song.capo : 0);
    const parsedHtml = parseLyricsWithChords(song.content, effectiveSemitones, chordNotation);

    let capoBadgeHtml = "";
    if (song.capo > 0 && !hideCapo) {
        capoBadgeHtml = '<span class="capo-badge">Kapodaster: ' + song.capo + ". pražec</span>";
    } else if (song.capo > 0 && hideCapo) {
        capoBadgeHtml = '<span class="capo-hidden-note">Bez kapa (posunuté o +' + song.capo + ")</span>";
    }

    const authorLine = song.author ? '<span class="song-author">' + escapeHtml(song.author) + "</span>" : "";

    songContentAreaEl.innerHTML =
        '<div class="song-header">' +
        '<h1 class="song-title">' + escapeHtml(song.title) + "</h1>" +
        '<div class="song-meta-row">' + authorLine + capoBadgeHtml + "</div>" +
        "</div>" +
        '<div class="lyrics-container" id="lyricsContainer">' + parsedHtml + "</div>";
}

function parseLyricsWithChords(text, transpose, notation) {
    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");

    return lines.map(function (line) {
        if (line.trim() === "") {
            return '<div class="lyric-line empty-line"></div>';
        }

        const parts = line.split(/(\([^)]+\))/g);
        let lineHtml = "";
        let pendingChord = "";

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;

            if (part.startsWith("(") && part.endsWith(")")) {
                if (pendingChord) {
                    lineHtml += createSegmentHtml(pendingChord, " ");
                }
                const rawChord = part.slice(1, -1).trim();
                pendingChord = formatAndTransposeChord(rawChord, transpose, notation);
            } else {
                lineHtml += createSegmentHtml(pendingChord, part);
                pendingChord = "";
            }
        }

        if (pendingChord) {
            lineHtml += createSegmentHtml(pendingChord, " ");
        }

        return '<div class="lyric-line">' + lineHtml + "</div>";
    }).join("");
}

function createSegmentHtml(chord, text) {
    return '<span class="chord-segment"><span class="chord">' + escapeHtml(chord) + '</span><span class="lyric-text">' + escapeHtml(text) + "</span></span>";
}

const SK_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "B", "H"];
const EN_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "Bb", "B"];

function noteToSemitoneIndex(noteToken, notation) {
    switch (noteToken) {
        case "C": return 0;
        case "C#":
        case "Db": return 1;
        case "D": return 2;
        case "D#":
        case "Eb": return 3;
        case "E":
        case "Fb": return 4;
        case "E#":
        case "F": return 5;
        case "F#":
        case "Gb": return 6;
        case "G": return 7;
        case "G#":
        case "Ab": return 8;
        case "A": return 9;
        case "A#":
        case "Bb":
        case "B":
            if (noteToken === "B" && notation === "en") return 11;
            return 10;
        case "H": return 11;
        default: return -1;
    }
}

function formatAndTransposeChord(chord, steps, notation) {
    if (!chord) return "";
    const scale = notation === "en" ? EN_NOTES : SK_NOTES;
    const chordRegex = new RegExp("(^|\\/)([A-HC](?:#|b)?)(?=mi|maj|dim|aug|sus|add|m|[0-9/+-]|$)", "g");

    return chord.replace(chordRegex, function (match, prefix, rootToken) {
        const baseIdx = noteToSemitoneIndex(rootToken, notation);
        if (baseIdx === -1) return match;

        let newIdx = (baseIdx + (steps || 0)) % 12;
        if (newIdx < 0) newIdx += 12;

        return prefix + scale[newIdx];
    });
}

function openEditorModal(song) {
    isSaving = false;
    if (saveSongBtnEl) {
        saveSongBtnEl.disabled = false;
        saveSongBtnEl.textContent = "💾 Uložiť pre kapelu";
    }

    if (song) {
        if (modalTitleEl) modalTitleEl.textContent = "Upraviť pieseň";
        if (songIdInput) songIdInput.value = song.id;
        if (songTitleInput) songTitleInput.value = song.title;
        if (songAuthorInput) songAuthorInput.value = song.author;
        if (songCapoInput) songCapoInput.value = song.capo || 0;
        if (songBodyInput) songBodyInput.value = song.content;
    } else {
        if (modalTitleEl) modalTitleEl.textContent = "Pridať novú pieseň";
        if (songIdInput) songIdInput.value = "";
        if (songTitleInput) songTitleInput.value = "";
        if (songAuthorInput) songAuthorInput.value = "";
        if (songCapoInput) songCapoInput.value = 0;
        if (songBodyInput) songBodyInput.value = "";
    }

    if (editorModalEl) editorModalEl.classList.add("open");
    if (songTitleInput) songTitleInput.focus();
}

function closeEditorModal() {
    if (editorModalEl) editorModalEl.classList.remove("open");
}

async function handleSaveSong(e) {
    e.preventDefault();
    if (isSaving) return;

    const id = songIdInput ? songIdInput.value : "";
    const title = songTitleInput ? songTitleInput.value.trim() : "";
    const author = songAuthorInput ? songAuthorInput.value.trim() : "";
    const capo = songCapoInput ? Math.max(0, Math.min(12, parseInt(songCapoInput.value, 10) || 0)) : 0;
    const content = songBodyInput ? songBodyInput.value : "";

    if (!title || !content.trim()) return;

    isSaving = true;
    if (saveSongBtnEl) {
        saveSongBtnEl.disabled = true;
        saveSongBtnEl.textContent = "⏳ Ukladám...";
    }

    try {
        if (id) {
            const index = songs.findIndex(function (s) { return s.id === id; });
            if (index !== -1) {
                songs[index] = { id: id, title: title, author: author, capo: capo, content: content };
                closeEditorModal();
                selectSong(id);
                const ok = await postToCloud({ action: "update_song", song: songs[index] });
                if (ok) showBanner('Pieseň "' + title + '" bola uložená pre celú kapelu.', "info");
            }
        } else {
            const newSong = {
                id: "song-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
                title: title,
                author: author,
                capo: capo,
                content: content
            };
            songs.push(newSong);
            closeEditorModal();
            selectSong(newSong.id);
            const ok = await postToCloud({ action: "create_song", song: newSong });
            if (ok) showBanner('Nová pieseň "' + title + '" bola pridaná pre celú kapelu.', "info");
        }
    } finally {
        isSaving = false;
        if (saveSongBtnEl) {
            saveSongBtnEl.disabled = false;
            saveSongBtnEl.textContent = "💾 Uložiť pre kapelu";
        }
    }
}

async function handleDeleteSong() {
    if (!currentSongId) return;
    const song = songs.find(function (s) { return s.id === currentSongId; });
    if (!song) return;

    if (confirm('Naozaj chceš zmazať pieseň "' + song.title + '" zo spevníka?')) {
        lastDeletedSong = Object.assign({}, song);
        const deletedId = currentSongId;
        songs = songs.filter(function (s) { return s.id !== deletedId; });
        cleanDeletedSongFromPlaylistsLocal(deletedId);
        resetViewer();
        await postToCloud({ action: "delete_song", song: { id: deletedId } });

        showBanner('Pieseň "' + lastDeletedSong.title + '" bola zmazaná.', "info", async function () {
            if (!lastDeletedSong) return;
            const restored = Object.assign({}, lastDeletedSong);
            lastDeletedSong = null;
            songs.push(restored);
            selectSong(restored.id);
            await postToCloud({ action: "create_song", song: restored });
            showBanner('Pieseň "' + restored.title + '" bola obnovená.', "info");
        });
    }
}

async function createNewPlaylist() {
    const name = prompt("Zadaj názov nového playlistu pre kapelu (napr. Koncert – piatok):");
    if (!name || !name.trim()) return;

    const newPl = {
        id: "pl-" + Date.now() + "-" + Math.random().toString(36).slice(2, 5),
        name: name.trim(),
        songIds: []
    };
    playlists.push(newPl);
    currentPlaylistId = newPl.id;

    const ok = await postToCloud({ action: "create_playlist", playlist: newPl });
    if (ok) showBanner('Playlist "' + newPl.name + '" bol vytvorený pre celú kapelu.', "info");
}

async function renameCurrentPlaylist() {
    const activePl = getCurrentPlaylist();
    if (!activePl) return;

    const nextName = prompt("Nový názov playlistu:", activePl.name);
    if (!nextName || !nextName.trim()) return;

    activePl.name = nextName.trim();
    const ok = await postToCloud({ action: "update_playlist", playlist: activePl });
    if (ok) showBanner('Playlist bol premenovaný na "' + activePl.name + '".', "info");
}

async function deleteCurrentPlaylist() {
    const activePl = getCurrentPlaylist();
    if (!activePl) return;

    if (!confirm('Naozaj chceš zmazať playlist "' + activePl.name + '" pre celú kapelu?')) return;

    const deletedId = activePl.id;
    const deletedName = activePl.name;
    playlists = playlists.filter(function (pl) { return pl.id !== deletedId; });
    currentPlaylistId = playlists.length > 0 ? playlists[0].id : null;

    const ok = await postToCloud({ action: "delete_playlist", playlist: { id: deletedId } });
    if (ok) showBanner('Playlist "' + deletedName + '" bol zmazaný.', "info");
}

function openAddToPlaylistModal() {
    const activePl = getCurrentPlaylist();
    if (!activePl || !pickSongSelectEl || !addToPlaylistModalEl) return;

    const sorted = songs.slice().sort(function (a, b) {
        return a.title.localeCompare(b.title, "sk");
    });

    pickSongSelectEl.innerHTML = "";
    sorted.forEach(function (song) {
        const opt = document.createElement("option");
        opt.value = song.id;
        opt.textContent = song.title + (song.author ? " – " + song.author : "");
        pickSongSelectEl.appendChild(opt);
    });

    addToPlaylistModalEl.classList.add("open");
}

function closeAddToPlaylistModal() {
    if (addToPlaylistModalEl) {
        addToPlaylistModalEl.classList.remove("open");
    }
}

async function confirmAddSongToPlaylist() {
    const activePl = getCurrentPlaylist();
    if (!activePl || !pickSongSelectEl) return;

    const selectedSongId = pickSongSelectEl.value;
    if (!selectedSongId) return;

    activePl.songIds.push(selectedSongId);
    closeAddToPlaylistModal();

    const ok = await postToCloud({ action: "update_playlist", playlist: activePl });
    if (ok) showBanner('Pieseň bola pridaná do playlistu "' + activePl.name + '".', "info");
}

function setupEventListeners() {
    if (toggleToolbarBtnEl) {
        toggleToolbarBtnEl.addEventListener("click", function () {
            isToolbarCollapsed = !isToolbarCollapsed;
            applyToolbarCollapsed();
        });
    }

    if (notationToggleBtnEl) {
        notationToggleBtnEl.addEventListener("click", function () {
            chordNotation = chordNotation === "sk" ? "en" : "sk";
            applyNotationButton();
            if (currentSongId) {
                selectSong(currentSongId);
            }
        });
    }

    if (prevSongBtnEl) {
        prevSongBtnEl.addEventListener("click", function () {
            goToPlaylistOffset(-1);
        });
    }

    if (nextSongBtnEl) {
        nextSongBtnEl.addEventListener("click", function () {
            goToPlaylistOffset(1);
        });
    }

    if (tabAllSongsBtnEl) {
        tabAllSongsBtnEl.addEventListener("click", function () {
            setSidebarTab("songs");
        });
    }

    if (tabPlaylistsBtnEl) {
        tabPlaylistsBtnEl.addEventListener("click", function () {
            setSidebarTab("playlists");
        });
    }

    if (playlistSelectEl) {
        playlistSelectEl.addEventListener("change", function () {
            currentPlaylistId = playlistSelectEl.value || null;
            renderPlaylistSelect();
            renderSongList();
            updatePlaylistNavBar();
        });
    }

    const newPlaylistBtn = document.getElementById("newPlaylistBtn");
    if (newPlaylistBtn) newPlaylistBtn.addEventListener("click", createNewPlaylist);

    const renamePlaylistBtn = document.getElementById("renamePlaylistBtn");
    if (renamePlaylistBtn) renamePlaylistBtn.addEventListener("click", renameCurrentPlaylist);

    const deletePlaylistBtn = document.getElementById("deletePlaylistBtn");
    if (deletePlaylistBtn) deletePlaylistBtn.addEventListener("click", deleteCurrentPlaylist);

    const addSongToPlaylistBtn = document.getElementById("addSongToPlaylistBtn");
    if (addSongToPlaylistBtn) addSongToPlaylistBtn.addEventListener("click", openAddToPlaylistModal);

    const closeAddToPlaylistModalBtn = document.getElementById("closeAddToPlaylistModalBtn");
    if (closeAddToPlaylistModalBtn) closeAddToPlaylistModalBtn.addEventListener("click", closeAddToPlaylistModal);

    const cancelAddToPlaylistBtn = document.getElementById("cancelAddToPlaylistBtn");
    if (cancelAddToPlaylistBtn) cancelAddToPlaylistBtn.addEventListener("click", closeAddToPlaylistModal);

    const confirmAddSongToPlaylistBtn = document.getElementById("confirmAddSongToPlaylistBtn");
    if (confirmAddSongToPlaylistBtn) confirmAddSongToPlaylistBtn.addEventListener("click", confirmAddSongToPlaylist);

    if (searchInputEl) {
        searchInputEl.addEventListener("input", renderSongList);
        searchInputEl.addEventListener("keydown", function (e) {
            if (e.key === "Enter" && activeSidebarTab === "songs" && filteredSongsCache.length === 1) {
                openSongCleanly(filteredSongsCache[0].id);
            }
        });
    }

    if (refreshCloudBtnEl) {
        refreshCloudBtnEl.addEventListener("click", function () {
            hideBanner();
            loadSongs();
        });
    }

    const fontPlusBtn = document.getElementById("fontPlusBtn");
    if (fontPlusBtn) {
        fontPlusBtn.addEventListener("click", function () {
            if (currentFontSize < 36) {
                currentFontSize += 2;
                applyFontSize();
            }
        });
    }

    const fontMinusBtn = document.getElementById("fontMinusBtn");
    if (fontMinusBtn) {
        fontMinusBtn.addEventListener("click", function () {
            if (currentFontSize > 12) {
                currentFontSize -= 2;
                applyFontSize();
            }
        });
    }

    const transposeUpBtn = document.getElementById("transposeUpBtn");
    if (transposeUpBtn) {
        transposeUpBtn.addEventListener("click", function () {
            transposeSteps++;
            const valEl = document.getElementById("transposeValue");
            if (valEl) valEl.textContent = (transposeSteps > 0 ? "+" : "") + transposeSteps;
            if (currentSongId) selectSong(currentSongId);
        });
    }

    const transposeDownBtn = document.getElementById("transposeDownBtn");
    if (transposeDownBtn) {
        transposeDownBtn.addEventListener("click", function () {
            transposeSteps--;
            const valEl = document.getElementById("transposeValue");
            if (valEl) valEl.textContent = (transposeSteps > 0 ? "+" : "") + transposeSteps;
            if (currentSongId) selectSong(currentSongId);
        });
    }

    if (hideCapoBtnEl) {
        hideCapoBtnEl.addEventListener("click", function () {
            hideCapo = !hideCapo;
            if (currentSongId) selectSong(currentSongId);
        });
    }

    const addNewSongBtn = document.getElementById("addNewSongBtn");
    if (addNewSongBtn) {
        addNewSongBtn.addEventListener("click", function () {
            openEditorModal(null);
        });
    }

    const editSongBtn = document.getElementById("editSongBtn");
    if (editSongBtn) {
        editSongBtn.addEventListener("click", function () {
            const song = songs.find(function (s) { return s.id === currentSongId; });
            if (song) openEditorModal(song);
        });
    }

    const deleteSongBtn = document.getElementById("deleteSongBtn");
    if (deleteSongBtn) {
        deleteSongBtn.addEventListener("click", handleDeleteSong);
    }

    const closeModalBtn = document.getElementById("closeModalBtn");
    if (closeModalBtn) closeModalBtn.addEventListener("click", closeEditorModal);

    const cancelModalBtn = document.getElementById("cancelModalBtn");
    if (cancelModalBtn) cancelModalBtn.addEventListener("click", closeEditorModal);

    if (songFormEl) songFormEl.addEventListener("submit", handleSaveSong);

    const insertChordHelperBtn = document.getElementById("insertChordHelperBtn");
    if (insertChordHelperBtn && songBodyInput) {
        insertChordHelperBtn.addEventListener("click", function () {
            const start = songBodyInput.selectionStart || 0;
            const end = songBodyInput.selectionEnd || 0;
            const text = songBodyInput.value;
            const selected = text.substring(start, end);
            const insertion = selected ? "(" + selected + ")" : "()";
            songBodyInput.value = text.substring(0, start) + insertion + text.substring(end);
            songBodyInput.focus();
            if (selected) {
                songBodyInput.selectionStart = start + 1;
                songBodyInput.selectionEnd = start + 1 + selected.length;
            } else {
                songBodyInput.selectionStart = songBodyInput.selectionEnd = start + 1;
            }
        });
    }

    const mobileToggleBtn = document.getElementById("mobileToggleBtn");
    if (mobileToggleBtn && songSidebarEl) {
        mobileToggleBtn.addEventListener("click", function () {
            songSidebarEl.classList.add("open");
        });
    }

    const closeSidebarBtn = document.getElementById("closeSidebarBtn");
    if (closeSidebarBtn && songSidebarEl) {
        closeSidebarBtn.addEventListener("click", function () {
            songSidebarEl.classList.remove("open");
        });
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return "";
    var ampChar = String.fromCharCode(38);
    return String(unsafe)
        .replace(new RegExp(ampChar, "g"), ampChar + "amp;")
        .replace(/</g, ampChar + "lt;")
        .replace(/>/g, ampChar + "gt;")
        .replace(/"/g, ampChar + "quot;")
        .replace(/'/g, ampChar + "#039;");
}
