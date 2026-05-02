const newsContainer = document.getElementById('newsContainer');
const refreshBtn = document.getElementById('refreshBtn');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const scoreFilter = document.getElementById('scoreFilter');
const dateFilter = document.getElementById('dateFilter');
const sortFilter = document.getElementById('sortFilter'); 
const lastUpdateSpan = document.getElementById('lastUpdate');

const linkInput = document.getElementById('rssUrlInput');
const addBtn = document.getElementById('addRssBtn');
const rssList = document.getElementById('rssList');

const modalOverlay = document.getElementById('newsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalBody = document.getElementById('modalBody');

const themeToggleBtn = document.getElementById('themeToggleBtn');

const savedTheme = localStorage.getItem('bios_theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
themeToggleBtn.innerText = savedTheme === 'dark' ? '☀️' : '🌙';

themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    themeToggleBtn.innerText = newTheme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('bios_theme', newTheme);
});

const API_BASE_URL = 'http://10.176.238.59:5000/api';

let allNews = []; 
let savedRssLinks = []; 

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
        newsContainer.innerHTML = '<p style="color:var(--danger); text-align:center; padding: 20px;">Sunucuya bağlanılamadı. Backend (Yunus) aktif mi?</p>';
    }
}

addBtn.addEventListener('click', async () => {
    const url = linkInput.value.trim();
    if (!url) return alert("Lütfen bir link girin.");

    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error();
    } catch { return alert("Geçersiz URL formatı."); }

    if (savedRssLinks.some(rss => rss.url.toLowerCase() === url.toLowerCase())) {
        return alert("Bilgi: Bu kaynak zaten sol menüde ekli.");
    }

    addBtn.innerText = "İnceleniyor...";
    try {
        const response = await fetch(`${API_BASE_URL}/add-link`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url })
        });

        if(response.ok) {
            const data = await response.json();
            if (data.type === 'rss') await fetchRssList(); 
            else alert("📰 Tekil haber başarıyla kaydedildi! Yenile butonuna basın.");
            linkInput.value = ''; 
        } else if (response.status === 409) { alert("Bu link zaten sistemde kayıtlı."); } 
        else { alert("Hata: Link okunamadı."); }
    } catch (error) { alert("Sunucu hatası: Backend ile bağlantı kurulamadı."); } 
    finally { addBtn.innerText = "Ekle"; }
});

window.deleteRss = async (id) => {
    if(!confirm("Kaynağı ve içindeki haberleri silmek istediğinize emin misiniz?")) return;
    try {
        const response = await fetch(`${API_BASE_URL}/rss/${id}`, { method: 'DELETE' });
        if (response.ok) { await fetchRssList(); await fetchNews(); } 
        else alert("Silinirken hata oluştu.");
    } catch (error) { alert("Sunucu bağlantısını kontrol edin."); }
};

window.deleteArticle = async (event, id) => {
    event.stopPropagation(); 
    if(!confirm("Haberi tamamen silmek istediğinize emin misiniz?")) return;
    try {
        const response = await fetch(`${API_BASE_URL}/news/${id}`, { method: 'DELETE' });
        if(response.ok) await fetchNews(); else alert("Hata oluştu.");
    } catch(e) { alert("Bağlantı kurulamadı."); }
};

refreshBtn.addEventListener('click', async () => {
    refreshBtn.innerText = "Sistem Çalışıyor..."; showSkeleton();
    try {
        const response = await fetch(`${API_BASE_URL}/refresh`, { method: 'POST' });
        if(response.ok) { await fetchRssList(); await fetchNews(); updateTimestamp(); } 
        else { alert("Yenileme sırasında sunucu hatası."); await fetchNews(); }
    } catch (error) { alert("Sunucuya ulaşılamadı."); await fetchNews(); } 
    finally { refreshBtn.innerText = "Yenile"; }
});

function renderRssList() {
    rssList.innerHTML = '';
    if (savedRssLinks.length === 0) return rssList.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); border: 1px dashed var(--border-color);">Henüz kaynak eklenmedi.</div>`;
    savedRssLinks.forEach((rss) => {
        const li = document.createElement('li');
        const isError = rss.status && (rss.status.includes("Hata") || rss.status.includes("error"));
        li.style.cssText = `display:flex; flex-direction:column; padding:10px; background:var(--bg-main); margin-bottom:8px; border-radius:6px; font-size:0.8rem; border-left: 4px solid ${isError ? 'var(--danger)' : 'var(--success)'}`;
        li.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:600; max-width:150px; overflow:hidden; text-overflow:ellipsis; color:var(--text-primary);" title="${rss.url}">${rss.url}</span>
                <button onclick="deleteRss(${rss.id})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:1.1rem;" title="Kaynağı Sil">🗑️</button>
            </div>
        `;
        rssList.appendChild(li);
    });
}

function renderNews(newsArray) {
    newsContainer.innerHTML = '';
    if (newsArray.length === 0) { emptyState.style.display = 'flex'; return; }
    emptyState.style.display = 'none';

    newsArray.forEach(news => {
        const card = document.createElement('div');
        card.className = 'news-card';
        const companyName = news.company || news.company_name || 'Bilinmiyor';
        const summary = news.summary_tr || news.text_summary_tr || 'Özet bilgisi bulunamadı.';
        const dateStr = news.date || news.published_at_utc || '-';
        const score = news.score || 0;
        let formattedDate = dateStr !== '-' && dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr;

        card.innerHTML = `
            <div class="card-header">
                <span class="event-badge tag-${news.event_type || 'other'}">${getEventLabel(news.event_type)}</span>
                <span class="score-badge ${getScoreClass(score)}">Skor: ${score}</span>
            </div>
            <h3 class="news-title">${news.title}</h3>
            <p class="news-summary">${summary}</p>
            <div class="card-footer" style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="color:var(--text-primary); font-weight:500;">🏢 ${companyName}</span>
                    <span>📅 ${formattedDate}</span>
                </div>
                <button onclick="deleteArticle(event, ${news.id})" style="background: none; border: none; cursor: pointer; font-size: 1.3rem; transition: 0.2s;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" title="Bu Haberi Sil">🗑️</button>
            </div>
        `;
        card.addEventListener('click', () => openModal(news));
        newsContainer.appendChild(card);
    });
}

function applyFilters() {
    const term = searchInput.value.toLowerCase(), type = typeFilter.value;
    const minScore = parseInt(scoreFilter.value), selectedDate = dateFilter.value, sortBy = sortFilter.value;

    let filtered = allNews.filter(n => {
        const cName = n.company || n.company_name || "";
        const matchesSearch = n.title.toLowerCase().includes(term) || cName.toLowerCase().includes(term);
        const matchesType = type === 'all' || n.event_type === type;
        const matchesScore = (n.score || 0) >= minScore;
        const dStr = n.date || n.published_at_utc || "";
        const matchesDate = !selectedDate || dStr.startsWith(selectedDate);
        return matchesSearch && matchesType && matchesScore && matchesDate;
    });

    if (sortBy === 'scoreDesc') filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    else if (sortBy === 'scoreAsc') filtered.sort((a, b) => (a.score || 0) - (b.score || 0));
    else if (sortBy === 'dateDesc') filtered.sort((a, b) => new Date(b.date || b.published_at_utc || 0) - new Date(a.date || a.published_at_utc || 0));
    renderNews(filtered);
}

function showSkeleton() {
    newsContainer.innerHTML = '';
    for (let i = 0; i < 6; i++) {
        const skel = document.createElement('div'); skel.className = 'skeleton-card';
        skel.innerHTML = `<div class="skeleton-item" style="width:30%; height:20px;"></div><div class="skeleton-item skeleton-title"></div><div class="skeleton-item skeleton-text"></div><div class="skeleton-item skeleton-footer"></div>`;
        newsContainer.appendChild(skel);
    }
}

// SLAYT TABLOSUNA GÖRE SKOR RENKLERİ GÜNCELLENDİ
function getScoreClass(score) {
    if (score >= 80) return 'score-high';     // 80-100: Yeşil
    if (score >= 65) return 'score-watch';    // 65-79: Mavi
    if (score >= 50) return 'score-medium';   // 50-64: Sarı
    return 'score-low';                       // 0-49: Gri
}

function getEventLabel(type) {
    const types = { relocation: 'relocation', closure: 'closure', expansion: 'expansion', new_plant: 'new_plant', tender: 'tender', other: 'other' };
    return types[type] || 'other';
}

// SLAYT TABLOSUNA GÖRE YAPAY ZEKA ÖNERİSİ FONKSİYONU
function getActionSuggestion(score, eventType) {
    if (score >= 80) return "Hemen iletişime geç (reach_out) / dosya talep et";
    if (score >= 65) return "Takip listesine al, haftalık raporda göster";
    if (score >= 50) return eventType === 'tender' ? "İhale takibi yap" : "Partner araması yap";
    return "Arşivle, sadece arama için tut";
}

function updateTimestamp() {
    const now = new Date(); lastUpdateSpan.innerText = `Son kontrol: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function openModal(news) {
    modalOverlay.style.display = 'flex';
    const companyName = news.company || news.company_name || '-';
    const summary = news.summary_tr || news.text_summary_tr || 'Özet bilgisi bulunamadı.';
    const score = news.score || 0;
    
    // Tablodan öneriyi al
    const suggestion = getActionSuggestion(score, news.event_type);

    modalBody.innerHTML = `
        <div class="card-header" style="margin-bottom:15px; padding-right:35px;">
            <span class="event-badge tag-${news.event_type || 'other'}">${getEventLabel(news.event_type)}</span>
            <span class="score-badge ${getScoreClass(score)}">Skor: ${score}</span>
        </div>
        <h2 style="color:var(--text-primary);">${news.title}</h2>
        <p class="modal-summary" style="margin: 15px 0; font-size: 1.1rem; line-height: 1.6; color: var(--text-muted);">${summary}</p>
        
        <div class="modal-details-grid">
            <div class="detail-item"><span class="detail-label">Şirket</span><span class="detail-value">${companyName}</span></div>
            <div class="detail-item"><span class="detail-label">Sektör</span><span class="detail-value">${news.sector || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Nereden</span><span class="detail-value">${news.from_location || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Nereye</span><span class="detail-value">${news.to_location || '-'}</span></div>
        </div>

        <!-- 💡 YAPAY ZEKA ÖNERİ KUTUSU -->
        <div class="suggestion-box">
            <div class="suggestion-icon">💡</div>
            <div class="suggestion-content">
                <strong>Akıllı Aksiyon Önerisi</strong>
                <p>${suggestion}</p>
            </div>
        </div>
        
        <div style="margin-top: 20px; text-align: right;">
            <a href="${news.original_link || '#'}" class="source-link" target="_blank">Orijinal Habere Git ➔</a>
        </div>
    `;
}

closeModalBtn.addEventListener('click', () => modalOverlay.style.display = 'none');
modalOverlay.addEventListener('click', (e) => { if(e.target === modalOverlay) modalOverlay.style.display = 'none'; });
searchInput.addEventListener('input', applyFilters); typeFilter.addEventListener('change', applyFilters);
scoreFilter.addEventListener('change', applyFilters); dateFilter.addEventListener('change', applyFilters);
sortFilter.addEventListener('change', applyFilters);

fetchRssList(); fetchNews();