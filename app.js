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
const rssUrlInput = document.getElementById('rssUrlInput');
const addRssBtn = document.getElementById('addRssBtn');
const rssList = document.getElementById('rssList');

// Modal Elementleri
const modalOverlay = document.getElementById('newsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalBody = document.getElementById('modalBody');

// --- API YAPILANDIRMASI ---
const API_BASE_URL = 'http://10.176.238.59:5000/api';
let allNews = []; 
let savedRssLinks = []; 

// --- 1. BACKEND'DEN VERİ ÇEKME ---

async function fetchRssList() {
    try {
        const response = await fetch(`${API_BASE_URL}/rss`);
        if(response.ok) {
            savedRssLinks = await response.json();
            renderRssList();
        }
    } catch (error) {
        console.error("RSS bağlantı hatası:", error);
    }
}

async function fetchNews() {
    showSkeleton();
    try {
        const response = await fetch(`${API_BASE_URL}/news`);
        if(response.ok) {
            allNews = await response.json();
            applyFilters();
        }
    } catch (error) {
        console.error("Haberler çekilirken hata:", error);
        newsContainer.innerHTML = '<p style="color:red; text-align:center;">Sunucuya bağlanılamadı. Backend aktif mi?</p>';
    }
}

// --- 2. RSS YÖNETİMİ ---

addRssBtn.addEventListener('click', async () => {
    const url = rssUrlInput.value.trim();
    
    // 1. Boş Alan Kontrolü
    if (!url) {
        alert("Lütfen bir RSS linki girin.");
        return;
    }

    // --- 2. GEÇERLİ URL FORMATI KONTROLÜ (DÜZELTİLDİ) ---
    try {
        const parsedUrl = new URL(url);
        // Sadece http veya https ile başlayan geçerli linkleri kabul et
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            throw new Error("Geçersiz protokol");
        }
    } catch (error) {
        alert("Hata: Geçersiz bir URL formatı girdiniz. Linkin 'http://' veya 'https://' ile başladığından emin olun.");
        return;
    }
    // --------------------------------------------------

    // 3. Frontend Tarafında Mükerrer Kontrolü
    const isDuplicate = savedRssLinks.some(rss => rss.url.toLowerCase() === url.toLowerCase());
    if (isDuplicate) {
        alert("Bilgi: Bu RSS bağlantısı zaten listenizde mevcut.");
        return;
    }

    addRssBtn.innerText = "Ekleniyor...";
    try {
        // Backend'e (SQLite'a) yazma isteği
        const response = await fetch(`${API_BASE_URL}/rss`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });

        if(response.ok) {
            rssUrlInput.value = '';
            await fetchRssList(); 
        } else if (response.status === 409) {
            alert("Backend: Bu RSS kaynağı zaten veritabanında kayıtlı.");
        } else {
            alert("Beklenmeyen bir hata oluştu. Link geçerli bir RSS kaynağı olmayabilir.");
        }
    } catch (error) {
        alert("Sunucu hatası: Backend (Flask) çalışıyor mu?");
    } finally {
        addRssBtn.innerText = "Ekle";
    }
});

window.deleteRss = async (id) => {
    try {
        await fetch(`${API_BASE_URL}/rss/${id}`, { method: 'DELETE' });
        await fetchRssList();
    } catch (error) {
        alert("Silinemedi.");
    }
};

// --- 3. YENİLEME BUTONU ---

refreshBtn.addEventListener('click', async () => {
    refreshBtn.innerText = "Yükleniyor...";
    showSkeleton();
    
    try {
        // Backend'e "Yeni haberleri çek ve LLM ile analiz et" emrini gönder
        const response = await fetch(`${API_BASE_URL}/refresh`, { method: 'POST' });
        
        if(response.ok) {
            await fetchRssList(); 
            await fetchNews();    
            updateTimestamp();
        } else {
            alert("Yenileme sırasında sunucu hatası.");
        }
    } catch (error) {
        alert("Sunucuya ulaşılamadı.");
    } finally {
        refreshBtn.innerText = "Yenile";
    }
});

// --- 4. RENDER & FİLTRELEME FONKSİYONLARI ---

function renderRssList() {
    rssList.innerHTML = '';
    if (savedRssLinks.length === 0) {
        rssList.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; border: 1px dashed #475569;">Henüz RSS eklemediniz.</div>`;
        return;
    }

    savedRssLinks.forEach((rss) => {
        const li = document.createElement('li');
        // Eğer veritabanından status 'Hata' dönerse kırmızı, 'active' dönerse yeşil yap[cite: 8, 10]
        const isError = rss.status && (rss.status.includes("Hata") || rss.status.includes("error"));
        li.style.cssText = `display:flex; flex-direction:column; padding:10px; background:#334155; margin-bottom:8px; border-radius:6px; font-size:0.8rem; border-left: 4px solid ${isError ? '#ef4444' : '#10b981'}`;

        li.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:600; max-width:150px; overflow:hidden; text-overflow:ellipsis;" title="${rss.url}">${rss.url}</span>
                <button onclick="deleteRss(${rss.id})" style="background:#ef4444; border:none; color:white; padding:2px 8px; border-radius:4px; cursor:pointer;">Sil</button>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:0.7rem; color:#94a3b8; margin-top:5px;">
                <span>${rss.status === 'active' ? '🟢 Aktif' : (rss.status || 'Bilinmiyor')}</span>
            </div>
        `;
        rssList.appendChild(li);
    });
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
        
        // Veritabanı[cite: 10] sütunlarıyla birebir eşleştirme
        const companyName = news.company_name || 'Bilinmiyor';
        const dateStr = news.published_at_utc ? news.published_at_utc.substring(0, 10) : '-';
        const summary = news.text_summary_tr || 'Özet bekleniyor...';
        const score = news.score || 0;

        card.innerHTML = `
            <div class="card-header">
                <span class="event-badge tag-${news.event_type || 'other'}">${getEventLabel(news.event_type)}</span>
                <span class="score-badge ${getScoreClass(score)}">Skor: ${score}</span>
            </div>
            <h3 class="news-title">${news.title}</h3>
            <p class="news-summary">${summary}</p>
            <div class="card-footer">
                <span>🏢 ${companyName}</span>
                <span>📅 ${dateStr}</span>
            </div>
        `;
        card.addEventListener('click', () => openModal(news));
        newsContainer.appendChild(card);
    });
}

function applyFilters() {
    const term = searchInput.value.toLowerCase();
    const type = typeFilter.value;
    const minScore = parseInt(scoreFilter.value);
    const selectedDate = dateFilter.value;
    const sortBy = sortFilter.value;

    let filtered = allNews.filter(n => {
        // Hata Buradaydı: 'n.company' yerine 'n.company_name' kullanılmalı
        const matchesSearch = n.title.toLowerCase().includes(term) || 
                              (n.company_name && n.company_name.toLowerCase().includes(term));
        
        const matchesType = type === 'all' || n.event_type === type;
        const matchesScore = (n.score || 0) >= minScore;
        
        // Hata Buradaydı: 'n.date' yerine 'n.published_at_utc' kullanılmalı
        const matchesDate = !selectedDate || 
                            (n.published_at_utc && n.published_at_utc.startsWith(selectedDate));
        
        return matchesSearch && matchesType && matchesScore && matchesDate;
    });

    if (sortBy === 'scoreDesc') {
        filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (sortBy === 'scoreAsc') {
        filtered.sort((a, b) => (a.score || 0) - (b.score || 0));
    } else if (sortBy === 'dateDesc') {
        // Hata Buradaydı: 'a.date' yerine 'a.published_at_utc' kullanılmalı
        filtered.sort((a, b) => new Date(b.published_at_utc || 0) - new Date(a.published_at_utc || 0));
    }

    renderNews(filtered);
}

// Yardımcı Fonksiyonlar
function showSkeleton() {
    newsContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const skel = document.createElement('div');
        skel.className = 'skeleton-card';
        skel.innerHTML = `<div class="skeleton-item" style="width:30%; height:20px;"></div><div class="skeleton-item skeleton-title"></div><div class="skeleton-item skeleton-text"></div><div class="skeleton-item skeleton-footer"></div>`;
        newsContainer.appendChild(skel);
    }
}

function getScoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 65) return 'score-medium';
    if (score >= 50) return 'score-low';
    return 'score-none';
}

function getEventLabel(type) {
    const types = { relocation: 'Taşıma', closure: 'Kapanış', expansion: 'Genişleme', new_plant: 'Yatırım', tender: 'İhale' };
    return types[type] || 'Diğer';
}

function updateTimestamp() {
    const now = new Date();
    lastUpdateSpan.innerText = `Son kontrol: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function openModal(news) {
    modalOverlay.style.display = 'flex';
    
    // Veritabanı[cite: 10] sütunlarıyla birebir eşleştirme
    const companyName = news.company_name || '-';
    const summary = news.text_summary_tr || 'Özet bilgisi bulunamadı.';
    const score = news.score || 0;

    modalBody.innerHTML = `
        <div class="card-header" style="margin-bottom:15px; padding-right:35px;">
            <span class="event-badge tag-${news.event_type}">${getEventLabel(news.event_type)}</span>
            <span class="score-badge ${getScoreClass(score)}">Skor: ${score}</span>
        </div>
        <h2>${news.title}</h2>
        <p class="modal-summary" style="margin: 15px 0;">${summary}</p>
        <div class="modal-details-grid">
            <div class="detail-item"><span class="detail-label">Şirket</span><span class="detail-value">${companyName}</span></div>
            <div class="detail-item"><span class="detail-label">Sektör</span><span class="detail-value">${news.sector || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Nereden</span><span class="detail-value">${news.from_location || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Nereye</span><span class="detail-value">${news.to_location || '-'}</span></div>
        </div>
        <a href="${news.original_link || '#'}" class="source-link" target="_blank">Orijinal Kaynağa Git</a>
    `;
}

// Event Listeners
closeModalBtn.addEventListener('click', () => modalOverlay.style.display = 'none');
modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) modalOverlay.style.display = 'none'; });
searchInput.addEventListener('input', applyFilters);
typeFilter.addEventListener('change', applyFilters);
scoreFilter.addEventListener('change', applyFilters);
dateFilter.addEventListener('change', applyFilters);
sortFilter.addEventListener('change', applyFilters);

// Başlangıç
fetchRssList();
fetchNews();