/**
 * NASTAVENIE CLOUDU (GOOGLE APPS SCRIPT WEB APP URL)
 * Sem vlož URL adresu, ktorú získaš podľa návodu z Google Tabuľky.
 * Ak necháš prázdne "", aplikácia bude fungovať v lokálnom režime (localStorage).
 */
const CLOUD_API_URL = "https://script.google.com/macros/s/AKfycbx8TN0fKA75X5jFnf6czSlwcaXmbF_dNe63aaJSmAYT9mwJzrmyCC61J3ejaeOXS2U7/exec"; 

const DEFAULT_SONGS = [
    {
        id: "demo-1",
        title: "Voda čo ma drží nad vodou",
        author: "Elán",
        capo: 2,
        content: "(Am)Keby bolo (F)niečo, čo sa (C)nedá pove(G)dať,\n(Am)keby bolo (F)niečo, čo sa (C)nedá vrátiť (G)späť.\n(F)Tak by som ti (G)povedal, že (C)ľúbim ťa tak (Am)veľmi,\n(F)ako voda, (G)čo ma drží (Am)nad vodou."
    },
    {
        id: "demo-2",
        title: "Tři kříže",
        author: "Hop Trop",
        capo: 0,
        content: "(Dm)Dávám sbohem (C)břehům prokla(Am)tejm,\n(Dm)který v drápech (C)má ďábel (Dm)sám.\n(F)Bílou přídí (C)šalupa My (Am)May\n(Dm)míří k útesům, (C)který (Dm)znám.\n\nRef:\n(F)Jen tři kříže z (C)bílýho kame(Am)ní\n(Dm)někdo do písku (C)posklá(Dm)dal."
    }
];

let songs = [];
let filteredSongsCache = [];
let lastDeletedSong = null;
let currentSongId = null;
let currentFontSize = parseInt(localStorage.getItem('spevnik_font_size'), 10) || 18;
let transposeSteps = 0;
let hideCapo = false;
let isSaving = false;

const songListEl = document.getElementById('songList');
const searchInputEl = document.getElementById('searchInput');
const songContentAreaEl = document.getElementById('songContentArea');
const songActionsEl = document.getElementById('songActions');
const hideCapoBtnEl = document.getElementById('hideCapoBtn');
const syncStatusEl = document.getElementById('syncStatus');
const refreshCloudBtnEl = document.getElementById('refreshCloudBtn');
const songSidebarEl = document.getElementById('songSidebar');
const bannerMessageEl = document.getElementById('bannerMessage');

const editorModalEl = document.getElementById('editorModal');
const songFormEl = document.getElementById('songForm');
const saveSongBtnEl = document.getElementById('saveSongBtn');
const modalTitleEl = document.getElementById('modalTitle');
const songIdInput = document.getElementById('songId');
const songTitleInput = document.getElementById('songTitleInput');
const songAuthorInput = document.getElementById('songAuthorInput');
const songCapoInput = document.getElementById('songCapoInput');
const songBodyInput = document.getElementById('songBodyInput');

document.addEventListener('DOMContentLoaded', () => {
    applyFontSize();
    setupEventListeners();
    loadSongs();
    
    if (window.innerWidth <= 768) {
        songSidebarEl.classList.add('open');
    }
});

// ==========================================
// 1. NAČÍTANIE A UKLADANIE DÁT (CLOUD + LOCAL)
// ==========================================

function normalizeSong(raw) {
    return {
        id: String(raw.id),
        title: String(raw.title || "").trim(),
        author: String(raw.author || "").trim(),
        capo: Math.max(0, Math.min(12, parseInt(raw.capo, 10) || 0)),
        content: String(raw.content || "")
    };
}

function showBanner(text, type = "info", undoAction = null) {
    bannerMessageEl.className = `banner-message banner-${type}`;
    bannerMessageEl.style.display = "flex";
    bannerMessageEl.innerHTML = `<span>${escapeHtml(text)}</span>`;

    if (undoAction) {
        const btn = document.createElement("button");
        btn.className = "btn btn-small";
        btn.textContent = "↩️ Vrátiť späť";
        btn.addEventListener("click", async () => {
            hideBanner();
            await undoAction();
        });
        bannerMessageEl.appendChild(btn);
    }
}

function hideBanner() {
    bannerMessageEl.style.display = "none";
    bannerMessageEl.innerHTML = "";
}

async function loadSongs() {
    updateStatus("Načítavam piesne...");
    
    const localData = localStorage.getItem('spevnik_songs');
    if (localData) {
        try {
            songs = JSON.parse(localData).map(normalizeSong);
            renderSongList();
        } catch (e) {
            songs = DEFAULT_SONGS.map(normalizeSong);
        }
    }

    if (CLOUD_API_URL) {
        try {
            const response = await fetch(CLOUD_API_URL, { cache: "no-store" });
            if (!response.ok) throw new Error("HTTP chyba " + response.status);
            const cloudSongs = await response.json();
            
            if (Array.isArray(cloudSongs)) {
                songs = cloudSongs.map(normalizeSong);
                localStorage.setItem('spevnik_songs', JSON.stringify(songs));
                renderSongList();
                if (currentSongId) {
                    const stillExists = songs.some(s => s.id === currentSongId);
                    if (stillExists) {
                        selectSong(currentSongId);
                    } else {
                        resetViewer();
                    }
                }
                updateStatus("☁️ Synchronizované");
            }
        } catch (error) {
            console.error("Chyba pri načítaní z cloudu:", error);
            if (!songs.length) songs = DEFAULT_SONGS.map(normalizeSong);
            renderSongList();
            updateStatus("⚠️ Nepodarilo sa spojiť s cloudom");
            showBanner("Cloud momentálne neodpovedá. Zobrazujú sa lokálne uložené piesne.", "warning");
        }
    } else {
        if (!songs.length) {
            songs = DEFAULT_SONGS.map(normalizeSong);
            localStorage.setItem('spevnik_songs', JSON.stringify(songs));
        }
        renderSongList();
        updateStatus("💾 Lokálny režim");
    }
}

async function syncWithCloud(action, songData) {
    localStorage.setItem('spevnik_songs', JSON.stringify(songs));
    renderSongList();

    if (!CLOUD_API_URL) {
        updateStatus("💾 Uložené v tomto prehliadači");
        return true;
    }

    updateStatus("⏳ Ukladám pre kapelu...");
    try {
        const response = await fetch(CLOUD_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action, song: songData })
        });

        if (!response.ok) throw new Error("HTTP chyba " + response.status);
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
    syncStatusEl.textContent = text;
}

function resetViewer() {
    currentSongId = null;
    songActionsEl.style.display = 'none';
    hideCapoBtnEl.style.display = 'none';
    songContentAreaEl.innerHTML = `
        <div class="empty-state">
            <h2>Vyber si pieseň zo zoznamu</h2>
            <p>Klikni na pieseň v pravom paneli alebo pridaj novú pre celú kapelu.</p>
        </div>
    `;
}

// ==========================================
// 2. ZOBRAZENIE ZOZNAMU A VYHĽADÁVANIE
// ==========================================

function normalizeText(str) {
    return (str || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function renderSongList() {
    const query = normalizeText(searchInputEl.value.trim());
    const sortedSongs = [...songs].sort((a, b) => a.title.localeCompare(b.title, 'sk'));
    
    filteredSongsCache = sortedSongs.filter(song => {
        if (!query) return true;
        return (
            normalizeText(song.title).includes(query) ||
            normalizeText(song.author).includes(query) ||
            normalizeText(song.content).includes(query)
        );
    });

    songListEl.innerHTML = '';

    if (filteredSongsCache.length === 0) {
        songListEl.innerHTML = `<li style="padding: 20px; text-align: center; color: #64748b;">Žiadna pieseň sa nenašla.</li>`;
        return;
    }

    filteredSongsCache.forEach(song => {
        const li = document.createElement('li');
        li.className = `song-item ${song.id === currentSongId ? 'active' : ''}`;
        const metaParts = [];
        if (song.author) metaParts.push(song.author);
        if (song.capo > 0) metaParts.push(`Capo ${song.capo}`);
        li.innerHTML = `
            <div class="song-item-title">${escapeHtml(song.title)}</div>
            <div class="song-item-author">${escapeHtml(metaParts.join(" • ") || "Bez autora")}</div>
        `;
        li.addEventListener('click', () => {
            openSongCleanly(song.id);
        });
        songListEl.appendChild(li);
    });
}

function openSongCleanly(songId) {
    transposeSteps = 0;
    hideCapo = false;
    document.getElementById('transposeValue').textContent = '0';
    selectSong(songId);
    if (window.innerWidth <= 768) {
        songSidebarEl.classList.remove('open');
    }
}

// ==========================================
// 3. PARSOVANIE, KAPO A TRANSPOZÍCIA
// ==========================================

function updateHideCapoButton(songCapo) {
    if (songCapo > 0) {
        hideCapoBtnEl.style.display = 'inline-flex';
        hideCapoBtnEl.classList.toggle('active', hideCapo);
        hideCapoBtnEl.textContent = hideCapo ? `🎸 Bez kapa (+${songCapo})` : `🎸 Skryť kapo`;
    } else {
        hideCapoBtnEl.style.display = 'none';
        hideCapoBtnEl.classList.remove('active');
    }
}

function selectSong(id) {
    const song = songs.find(s => s.id === id);
    if (!song) return;

    currentSongId = id;
    renderSongList();
    songActionsEl.style.display = 'flex';
    updateHideCapoButton(song.capo);

    const effectiveSemitones = transposeSteps + (hideCapo ? song.capo : 0);
    const parsedHtml = parseLyricsWithChords(song.content, effectiveSemitones);

    let capoBadgeHtml = '';
    if (song.capo > 0 && !hideCapo) {
        capoBadgeHtml = `<span class="capo-badge">Kapodaster: ${song.capo}. pražec</span>`;
    } else if (song.capo > 0 && hideCapo) {
        capoBadgeHtml = `<span class="capo-hidden-note">Bez kapa (posunuté o +${song.capo})</span>`;
    }

    const authorLine = song.author ? `<span class="song-author">${escapeHtml(song.author)}</span>` : '';

    songContentAreaEl.innerHTML = `
        <div class="song-header">
            <h1 class="song-title">${escapeHtml(song.title)}</h1>
            <div class="song-meta-row">
                ${authorLine}
                ${capoBadgeHtml}
            </div>
        </div>
        <div class="lyrics-container" id="lyricsContainer">
            ${parsedHtml}
        </div>
    `;
}

function parseLyricsWithChords(text, transpose) {
    const lines = (text || "").replace(/\r\n/g, '\n').split('\n');
    
    return lines.map(line => {
        if (line.trim() === '') {
            return '<div class="lyric-line empty-line"></div>';
        }

        const parts = line.split(/(\([^)]+\))/g);
        let lineHtml = '';
        let pendingChord = '';

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (!part) continue;

            if (part.startsWith('(') && part.endsWith(')')) {
                if (pendingChord) {
                    lineHtml += createSegmentHtml(pendingChord, ' ');
                }
                const rawChord = part.slice(1, -1).trim();
                pendingChord = transposeChord(rawChord, transpose);
            } else {
                lineHtml += createSegmentHtml(pendingChord, part);
                pendingChord = '';
            }
        }

        if (pendingChord) {
            lineHtml += createSegmentHtml(pendingChord, ' ');
        }

        return `<div class="lyric-line">${lineHtml}</div>`;
    }).join('');
}

function createSegmentHtml(chord, text) {
    return `<span class="chord-segment"><span class="chord">${escapeHtml(chord)}</span><span class="lyric-text">${escapeHtml(text)}</span></span>`;
}

const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function transposeChord(chord, steps) {
    if (steps === 0 || !chord) return chord;
    
    return chord.replace(/(^|\/)([A-H][#b]?)/g, (match, prefix, noteRaw) => {
        let note = noteRaw;
        const isEuropeanH = (note === 'H');
        if (isEuropeanH) note = 'B';

        let index = NOTES_SHARP.indexOf(note);
        if (index === -1) index = NOTES_FLAT.indexOf(note);
        if (index === -1) return match;

        let newIndex = (index + steps) % 12;
        if (newIndex < 0) newIndex += 12;

        let transposed = NOTES_SHARP[newIndex];
        if (isEuropeanH && transposed === 'B') transposed = 'H';
        return prefix + transposed;
    });
}

// ==========================================
// 4. PRIDÁVANIE, ÚPRAVA A MAZANIE PIESNÍ
// ==========================================

function openEditorModal(song = null) {
    isSaving = false;
    saveSongBtnEl.disabled = false;
    saveSongBtnEl.textContent = "💾 Uložiť pre kapelu";

    if (song) {
        modalTitleEl.textContent = "Upraviť pieseň";
        songIdInput.value = song.id;
        songTitleInput.value = song.title;
        songAuthorInput.value = song.author;
        songCapoInput.value = song.capo || 0;
        songBodyInput.value = song.content;
    } else {
        modalTitleEl.textContent = "Pridať novú pieseň";
        songIdInput.value = "";
        songTitleInput.value = "";
        songAuthorInput.value = "";
        songCapoInput.value = 0;
        songBodyInput.value = "";
    }
    editorModalEl.classList.add('open');
    songTitleInput.focus();
}

function closeEditorModal() {
    editorModalEl.classList.remove('open');
}

async function handleSaveSong(e) {
    e.preventDefault();
    if (isSaving) return;
    
    const id = songIdInput.value;
    const title = songTitleInput.value.trim();
    const author = songAuthorInput.value.trim();
    const capo = Math.max(0, Math.min(12, parseInt(songCapoInput.value, 10) || 0));
    const content = songBodyInput.value;

    if (!title || !content.trim()) return;

    isSaving = true;
    saveSongBtnEl.disabled = true;
    saveSongBtnEl.textContent = "⏳ Ukladám...";

    try {
        if (id) {
            const index = songs.findIndex(s => s.id === id);
            if (index !== -1) {
                songs[index] = { id, title, author, capo, content };
                closeEditorModal();
                selectSong(id);
                const ok = await syncWithCloud('update', songs[index]);
                if (ok) showBanner(`Pieseň "${title}" bola uložená pre celú kapelu.`, "info");
            }
        } else {
            const newSong = {
                id: 'song-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
                title,
                author,
                capo,
                content
            };
            songs.push(newSong);
            closeEditorModal();
            selectSong(newSong.id);
            const ok = await syncWithCloud('create', newSong);
            if (ok) showBanner(`Nová pieseň "${title}" bola pridaná pre celú kapelu.`, "info");
        }
    } finally {
        isSaving = false;
        saveSongBtnEl.disabled = false;
        saveSongBtnEl.textContent = "💾 Uložiť pre kapelu";
    }
}

async function handleDeleteSong() {
    if (!currentSongId) return;
    const song = songs.find(s => s.id === currentSongId);
    if (!song) return;

    if (confirm(`Naozaj chceš zmazať pieseň "${song.title}" zo spevníka?`)) {
        lastDeletedSong = { ...song };
        const deletedId = currentSongId;
        songs = songs.filter(s => s.id !== deletedId);
        resetViewer();
        await syncWithCloud('delete', { id: deletedId });

        showBanner(`Pieseň "${lastDeletedSong.title}" bola zmazaná.`, "info", async () => {
            if (!lastDeletedSong) return;
            const restored = { ...lastDeletedSong };
            lastDeletedSong = null;
            songs.push(restored);
            selectSong(restored.id);
            await syncWithCloud('create', restored);
            showBanner(`Pieseň "${restored.title}" bola obnovená.`, "info");
        });
    }
}

// ==========================================
// 5. OVLÁDACIE PRVKY (ZOOM, TRANSPOZÍCIA, KAPO, MOBIL)
// ==========================================

function applyFontSize() {
    document.documentElement.style.setProperty('--song-font-size', `${currentFontSize}px`);
    localStorage.setItem('spevnik_font_size', currentFontSize);
}

function setupEventListeners() {
    searchInputEl.addEventListener('input', renderSongList);
    searchInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && filteredSongsCache.length === 1) {
            openSongCleanly(filteredSongsCache[0].id);
        }
    });

    refreshCloudBtnEl.addEventListener('click', () => {
        hideBanner();
        loadSongs();
    });

    document.getElementById('fontPlusBtn').addEventListener('click', () => {
        if (currentFontSize < 36) {
            currentFontSize += 2;
            applyFontSize();
        }
    });

    document.getElementById('fontMinusBtn').addEventListener('click', () => {
        if (currentFontSize > 12) {
            currentFontSize -= 2;
            applyFontSize();
        }
    });

    document.getElementById('transposeUpBtn').addEventListener('click', () => {
        transposeSteps++;
        document.getElementById('transposeValue').textContent = (transposeSteps > 0 ? '+' : '') + transposeSteps;
        if (currentSongId) selectSong(currentSongId);
    });

    document.getElementById('transposeDownBtn').addEventListener('click', () => {
        transposeSteps--;
        document.getElementById('transposeValue').textContent = (transposeSteps > 0 ? '+' : '') + transposeSteps;
        if (currentSongId) selectSong(currentSongId);
    });

    hideCapoBtnEl.addEventListener('click', () => {
        hideCapo = !hideCapo;
        if (currentSongId) selectSong(currentSongId);
    });

    document.getElementById('addNewSongBtn').addEventListener('click', () => openEditorModal(null));
    document.getElementById('editSongBtn').addEventListener('click', () => {
        const song = songs.find(s => s.id === currentSongId);
        if (song) openEditorModal(song);
    });
    document.getElementById('deleteSongBtn').addEventListener('click', handleDeleteSong);

    document.getElementById('closeModalBtn').addEventListener('click', closeEditorModal);
    document.getElementById('cancelModalBtn').addEventListener('click', closeEditorModal);
    songFormEl.addEventListener('submit', handleSaveSong);

    document.getElementById('insertChordHelperBtn').addEventListener('click', () => {
        const start = songBodyInput.selectionStart;
        const end = songBodyInput.selectionEnd;
        const text = songBodyInput.value;
        const selected = text.substring(start, end);
        const insertion = selected ? `(${selected})` : "()";
        songBodyInput.value = text.substring(0, start) + insertion + text.substring(end);
        songBodyInput.focus();
        if (selected) {
            songBodyInput.selectionStart = start + 1;
            songBodyInput.selectionEnd = start + 1 + selected.length;
        } else {
            songBodyInput.selectionStart = songBodyInput.selectionEnd = start + 1;
        }
    });

    document.getElementById('mobileToggleBtn').addEventListener('click', () => {
        songSidebarEl.classList.add('open');
    });
    document.getElementById('closeSidebarBtn').addEventListener('click', () => {
        songSidebarEl.classList.remove('open');
    });
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, """)
        .replace(/'/g, "'");
}
