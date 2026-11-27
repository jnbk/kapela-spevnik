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
        updateStatus("💾
