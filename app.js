// --- DOM ELEMENTLERİ ---
const newsContainer = document.getElementById('newsContainer');
const refreshBtn = document.getElementById('refreshBtn');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const scoreFilter = document.getElementById('scoreFilter');
const dateFilter = document.getElementById('dateFilter');
const sortFilter = document.getElementById('sortFilter'); 
const lastUpdateSpan = document.getElementById('lastUpdate');

const modalOverlay = document.getElementById('newsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalBody = document.getElementById('modalBody');

const rssUrlInput = document.getElementById('rssUrlInput');
const addRssBtn = document.getElementById('addRssBtn');
const rssList = document.getElementById('rssList');

// --- 1. VERİ YÖNETİMİ & KALICILIK (F11) ---
let savedRssLinks = JSON.parse(localStorage.getItem('rssLinks')) || [];

// --- 2. BIOS-FIT SKOR MATEMATİĞİ (F7b & Bölüm 7.4) ---
function calculateBiosFitScore(news) {
    const weights = { E: 0.30, A: 0.25, G: 0.20, T: 0.15, C: 0.10 };
    const eventScores = { 
        relocation: 1.0, new_plant: 0.9, expansion: 0.75, 
        tender: 0.55, closure: 0.45, other: 0.1 
    };
    const eScore = eventScores[news.event_type] || 0.1;

    let aScore = 0;
    if (news.company) aScore += 0.40;
    if (news.from_location) aScore += 0.25;
    if (news.to_location) aScore += 0.25;
    if (news.sector) aScore += 0.10;

    const fields = [news.company, news.from_location, news.to_location, news.sector, news.event_type];
    const confidence = fields.filter(Boolean).length / 5;

    // Formül: 100 * (0.30*E + 0.25*A + 0.20*G + 0.15*T + 0.10*C)
    let finalScore = 100 * (
        weights.E * eScore + 
        weights.A * aScore + 
        weights.G * 1.0 + 
        weights.T * 1.0 + 
        weights.C * 0.85
    );
    
    if (confidence < 0.40) finalScore = finalScore * 0.5;
    return Math.round(finalScore);
}

// --- 3. DUMMY DATA ---
const dummyNews = [
    {
        id: 1, title: "BMW, Münih'ten Macaristan'a Taşınıyor", source: "Reuters", date: "2026-05-01",
        event_type: "relocation", company: "BMW", from_location: "Münih, Almanya", to_location: "Debrecen, Macaristan", 
        sector: "Otomotiv", summary_tr: "BMW motor üretimini maliyetler nedeniyle Macaristan'a taşıma kararı aldı."
    },
    {
        id: 2, title: "Siemens Tesis Kapatıyor", source: "Bloomberg", date: "2026-05-02",
        event_type: "closure", company: "Siemens", from_location: "İspanya", to_location: null, 
        sector: "Enerji", summary_tr: "Siemens tedarik zinciri sorunları nedeniyle üretimi durduruyor."
    },
    {
        id: 3, title: "Yeni Endüstriyel İhale Duyurusu", source: "Industry Week", date: "2026-05-02",
        event_type: "tender", company: null, from_location: null, to_location: null, 
        sector: "İnşaat", summary_tr: "AB destekli yeni altyapı projeleri için ihale süreci başladı."
    }
].map(news => ({ ...news, score: calculateBiosFitScore(news) }));

// --- 4. YARDIMCI FONKSİYONLAR ---
function getScoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 65) return 'score-medium';
    if (score >= 50) return 'score-low';
    return 'score-none';
}

function getEventLabel(type) {
    const types = { relocation: 'Taşıma', closure: 'Kapanış', expansion: 'Genişleme', new_plant: 'Yatırım', tender: 'İhale', other: 'Diğer' };
    return types[type] || 'Diğer';
}

function updateTimestamp() {
    const now = new Date();
    const time = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    lastUpdateSpan.innerText = `Son kontrol: ${time}`;
}

// --- 5. RSS YÖNETİMİ ---
function renderRssList() {
    rssList.innerHTML = '';
    if (savedRssLinks.length === 0) {
        rssList.innerHTML = `<div style="min-width:250px; color:#94a3b8; font-size:0.8rem; text-align:center; padding:20px; border:1px dashed #475569; border-radius:6px;">Henüz RSS kaynağı eklemediniz.</div>`;
        return;
    }

    savedRssLinks.forEach((rss, index) => {
        const li = document.createElement('li');
        li.style.cssText = "display:flex; flex-direction:column; gap:4px; padding:10px; background:#334155; margin-bottom:8px; border-radius:6px; font-size:0.8rem; min-width: 250px;";
        
        // Dinamik Renk Belirleme: Hata varsa kırmızı, yoksa yeşil kenarlık
        const isError = rss.status.includes("Hata");
        li.style.borderLeft = isError ? "4px solid #ef4444" : "4px solid #10b981";

        li.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:150px;">${rss.url}</span>
                <button onclick="deleteRss(${index})" style="background:#ef4444; border:none; color:white; padding:2px 8px; border-radius:4px; cursor:pointer;">Sil</button>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#94a3b8;">
                <span>${rss.status}</span>
                <span>${rss.lastCheck || '-'}</span>
            </div>
        `;
        rssList.appendChild(li);
    });
}

addRssBtn.addEventListener('click', () => {
    const url = rssUrlInput.value.trim();
    
    // 1. Boş Kontrolü
    if (!url) {
        alert("Hata: URL alanı boş olamaz.");
        return;
    }

    // 2. Mükerrer Kayıt Kontrolü
    const isDuplicate = savedRssLinks.some(rss => rss.url.toLowerCase() === url.toLowerCase());
    if (isDuplicate) {
        alert("Bu RSS kaynağı zaten listenizde mevcut.");
        return;
    }

    // 3. Format Doğrulama (asd gibi girişleri engellemek için)
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    const isValid = urlPattern.test(url);

    const newRss = { 
        url: url, 
        status: isValid ? "🟢 Aktif" : "🔴 Hata: Geçersiz Format", 
        lastCheck: new Date().toLocaleTimeString() 
    };

    savedRssLinks.push(newRss);
    localStorage.setItem('rssLinks', JSON.stringify(savedRssLinks));
    rssUrlInput.value = '';
    renderRssList();
});

// --- 7. YENİLEME BUTONU (Aktiflik Senaryosu) ---
refreshBtn.addEventListener('click', () => {
    refreshBtn.innerText = "Yükleniyor...";
    showSkeleton();

    // Mevcut linklerin durumunu tekrar kontrol et (Simülasyon)
    savedRssLinks = savedRssLinks.map(rss => {
        const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
        const isValid = urlPattern.test(rss.url);
        return {
            ...rss,
            status: isValid ? "🟢 Aktif" : "🔴 Hata: Bağlantı Sorunu",
            lastCheck: new Date().toLocaleTimeString()
        };
    });
    
    localStorage.setItem('rssLinks', JSON.stringify(savedRssLinks));
    renderRssList();

    setTimeout(() => {
        renderNews(dummyNews);
        refreshBtn.innerText = "Yenile";
        updateTimestamp();
    }, 1200);
});

window.deleteRss = (index) => {
    savedRssLinks.splice(index, 1);
    localStorage.setItem('rssLinks', JSON.stringify(savedRssLinks));
    renderRssList();
};

addRssBtn.addEventListener('click', () => {
    const url = rssUrlInput.value.trim();
    if (!url) {
        alert("Hata: URL alanı boş olamaz.");
        return;
    }
    const newRss = { url, status: "🟢 Aktif", lastCheck: new Date().toLocaleTimeString() };
    savedRssLinks.push(newRss);
    localStorage.setItem('rssLinks', JSON.stringify(savedRssLinks));
    rssUrlInput.value = '';
    renderRssList();
});

// --- 6. RENDER & FİLTRELEME ---
function showSkeleton() {
    newsContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const skel = document.createElement('div');
        skel.className = 'skeleton-card';
        skel.innerHTML = `<div class="skeleton-item" style="width:30%; height:20px;"></div><div class="skeleton-item skeleton-title"></div><div class="skeleton-item skeleton-text"></div><div class="skeleton-item skeleton-footer"></div>`;
        newsContainer.appendChild(skel);
    }
}

function renderNews(newsArray) {
    newsContainer.innerHTML = '';
    if (newsArray.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }
    emptyState.style.display = 'none';

    newsArray.forEach(news => {
        const card = document.createElement('div');
        card.className = 'news-card';
        card.innerHTML = `
            <div class="card-header">
                <span class="event-badge tag-${news.event_type}">${getEventLabel(news.event_type)}</span>
                <span class="score-badge ${getScoreClass(news.score)}">Skor: ${news.score}</span>
            </div>
            <h3 class="news-title">${news.title}</h3>
            <p class="news-summary">${news.summary_tr}</p>
            <div class="card-footer">
                <span>🏢 ${news.company || 'Bilinmiyor'}</span>
                <span>📰 ${news.source} | 📅 ${news.date}</span>
            </div>
        `;
        card.addEventListener('click', () => openModal(news));
        newsContainer.appendChild(card);
    });
}

function openModal(news) {
    modalOverlay.style.display = 'flex';
    modalBody.innerHTML = `
        <div class="card-header" style="margin-bottom:15px; padding-right:35px;">
            <span class="event-badge tag-${news.event_type}">${getEventLabel(news.event_type)}</span>
            <span class="score-badge ${getScoreClass(news.score)}">Skor: ${news.score}</span>
        </div>
        <h2>${news.title}</h2>
        <p class="modal-summary" style="margin: 15px 0;">${news.summary_tr}</p>
        <div class="modal-details-grid">
            <div class="detail-item"><span class="detail-label">Şirket</span><span class="detail-value">${news.company || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Sektör</span><span class="detail-value">${news.sector || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Nereden</span><span class="detail-value">${news.from_location || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Nereye</span><span class="detail-value">${news.to_location || '-'}</span></div>
        </div>
        <a href="#" class="source-link" target="_blank">Orijinal Kaynağa Git</a>
    `;
}

function applyFilters() {
    const term = searchInput.value.toLowerCase();
    const type = typeFilter.value;
    const minScore = parseInt(scoreFilter.value);
    const selectedDate = dateFilter.value;
    const sortBy = sortFilter.value;

    let filtered = dummyNews.filter(n => {
        const matchesSearch = n.title.toLowerCase().includes(term) || (n.company && n.company.toLowerCase().includes(term));
        const matchesType = type === 'all' || n.event_type === type;
        const matchesScore = n.score >= minScore;
        const matchesDate = !selectedDate || n.date === selectedDate;
        return matchesSearch && matchesType && matchesScore && matchesDate;
    });

    if (sortBy === 'scoreDesc') filtered.sort((a, b) => b.score - a.score);
    else if (sortBy === 'scoreAsc') filtered.sort((a, b) => a.score - b.score);
    else if (sortBy === 'dateDesc') filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    else if (sortBy === 'source') filtered.sort((a, b) => a.source.localeCompare(b.source));

    renderNews(filtered);
}

// --- 7. EVENT LISTENERS ---
refreshBtn.addEventListener('click', () => {
    refreshBtn.innerText = "Yükleniyor...";
    showSkeleton();
    setTimeout(() => {
        renderNews(dummyNews);
        refreshBtn.innerText = "Yenile";
        updateTimestamp();
    }, 1200);
});

closeModalBtn.addEventListener('click', () => modalOverlay.style.display = 'none');
modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) modalOverlay.style.display = 'none'; });

searchInput.addEventListener('input', applyFilters);
typeFilter.addEventListener('change', applyFilters);
scoreFilter.addEventListener('change', applyFilters);
dateFilter.addEventListener('change', applyFilters);
sortFilter.addEventListener('change', applyFilters);

renderRssList();