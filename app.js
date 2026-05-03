// ==========================================
// --- DOM ELEMENTLERİ (Arayüz Bileşenleri) ---
// ==========================================
const newsContainer = document.getElementById('newsContainer');
const refreshBtn = document.getElementById('refreshBtn');
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
const autoRefreshFilter = document.getElementById('autoRefreshFilter');
const exportCsvBtnSidebar = document.getElementById('exportCsvBtnSidebar');
const exportExcelBtnSidebar = document.getElementById('exportExcelBtnSidebar');
const showFavoritesBtn = document.getElementById('showFavoritesBtn'); 

// Özel Confirm (Onay) Elemanları
const customConfirmOverlay = document.getElementById('customConfirmOverlay');
const confirmTitle = document.getElementById('confirmTitle');
const confirmMessage = document.getElementById('confirmMessage');
const confirmButtons = document.getElementById('confirmButtons');

// ==========================================
// --- MODERN ONAY (CONFIRM) FONKSİYONU ---
// ==========================================
function showConfirm(title, message, buttons) {
    return new Promise((resolve) => {
        confirmTitle.innerText = title;
        confirmMessage.innerText = message;
        confirmButtons.innerHTML = ''; 

        buttons.forEach(btn => {
            const buttonEl = document.createElement('button');
            buttonEl.innerText = btn.text;
            buttonEl.className = `confirm-btn ${btn.style}`; 

            buttonEl.addEventListener('click', () => {
                customConfirmOverlay.style.display = 'none';
                resolve(btn.value); 
            });
            confirmButtons.appendChild(buttonEl);
        });

        customConfirmOverlay.style.display = 'flex'; 
    });
}

// ==========================================
// --- TEMA VE FAVORİ KONTROLÜ (Lokal Hafıza) ---
// ==========================================
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

let favoriteNews = JSON.parse(localStorage.getItem('bios_favorites')) || [];
let showOnlyFavorites = false;

showFavoritesBtn.addEventListener('click', () => {
    showOnlyFavorites = !showOnlyFavorites;
    if(showOnlyFavorites) {
        showFavoritesBtn.style.backgroundColor = "var(--bios-red)";
        showFavoritesBtn.style.color = "white";
    } else {
        showFavoritesBtn.style.backgroundColor = "var(--bg-surface)";
        showFavoritesBtn.style.color = "var(--text-primary)";
    }
    applyFilters();
});

// ==========================================
// --- API YAPILANDIRMASI ---
// ==========================================
const API_BASE_URL = 'http://10.176.238.59:5000/api';

let allNews = []; 
let savedRssLinks = []; 

// ==========================================
// --- 1. VERİ ÇEKME FONKSİYONLARI ---
// ==========================================

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
        let backendNews = [];
        if(response.ok) {
            backendNews = await response.json();
        }

        const backendIds = new Set(backendNews.map(n => n.id));
        favoriteNews.forEach(fav => {
            if (!backendIds.has(fav.id)) {
                backendNews.push(fav); 
            }
        });

        allNews = backendNews;
        applyFilters();

    } catch (error) {
        console.error("Haberler çekilirken hata:", error);
        allNews = [...favoriteNews];
        applyFilters();
    }
}

// ==========================================
// --- 2. RSS, FAVORİ VE SİLME İŞLEMLERİ ---
// ==========================================

addBtn.addEventListener('click', async () => {
    const url = linkInput.value.trim();
    if (!url) {
        alert("Lütfen bir link girin.");
        return;
    }

    try {
        new URL(url); 
    } catch (e) {
        alert("Geçersiz URL formatı! Lütfen 'http://' veya 'https://' ile başlayan geçerli bir RSS linki girin.");
        return;
    }

    addBtn.innerText = "İnceleniyor...";
    addBtn.disabled = true;
    addBtn.style.opacity = "0.7";

    try {
        const response = await fetch(`${API_BASE_URL}/add-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });

        if(response.ok) {
            await fetchRssList(); 
            linkInput.value = ''; 
            
            addBtn.innerText = "Eklendi! ✅";
            addBtn.style.backgroundColor = "var(--success)";
            addBtn.style.opacity = "1";
            
            setTimeout(() => {
                addBtn.innerText = "Ekle";
                addBtn.style.backgroundColor = ""; 
                addBtn.disabled = false;
            }, 2000);
            
        } else {
            alert("Link kaydedilemedi. Kaynak zaten ekli veya geçersiz olabilir.");
            addBtn.innerText = "Ekle";
            addBtn.disabled = false;
            addBtn.style.opacity = "1";
        }
    } catch (error) {
        alert("Sunucu hatası.");
        addBtn.innerText = "Ekle";
        addBtn.disabled = false;
        addBtn.style.opacity = "1";
    }
});

function renderRssList() {
    rssList.innerHTML = '';
    if (savedRssLinks.length === 0) {
        rssList.innerHTML = `<li style="text-align:center; padding:10px; color:var(--text-muted);">Henüz kaynak yok.</li>`;
        return;
    }

    savedRssLinks.forEach((rss) => {
        const li = document.createElement('li');
        li.style.cssText = `
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 10px; 
            background: var(--bg-main); 
            margin-bottom: 8px; 
            border-radius: 8px; 
            border-left: 4px solid var(--success);
            gap: 10px;
        `;

        li.innerHTML = `
            <span style="
                font-weight: 600; 
                color: var(--text-primary); 
                font-size: 0.75rem;
                line-height: 1.2;
                max-width: 220px;
                word-break: break-all;      
                display: -webkit-box;
                -webkit-line-clamp: 2;
                line-clamp: 2;      
                -webkit-box-orient: vertical;
                overflow: hidden;           
            " title="${rss.url}">${rss.url}</span>
            <button onclick="deleteRss(${rss.id})" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:1.1rem; flex-shrink:0;">🗑️</button>
        `;
        rssList.appendChild(li);
    });
}

window.deleteRss = async (id) => {
    const targetRss = savedRssLinks.find(r => r.id === id);
    
    const choice = await showConfirm(
        "RSS Kaynağını Sil",
        "Bu kaynağı silmek istediğinize emin misiniz?\n\nBu kaynağa ait daha önceden favoriye aldığınız haberlerin de silinmesini ister misiniz?",
        [
            { text: "İptal", value: "cancel", style: "secondary" },
            { text: "Sadece Kaynağı Sil", value: "source_only", style: "danger" },
            { text: "Favorilerle Birlikte Sil", value: "delete_all", style: "danger" }
        ]
    );

    if (choice === "cancel") return; 
    
    const deleteFavoritesToo = (choice === "delete_all");
    
    try {
        const response = await fetch(`${API_BASE_URL}/rss/${id}`, { method: 'DELETE' });
        if (response.ok) {
            
            if (deleteFavoritesToo && targetRss) {
                try {
                    const domain = new URL(targetRss.url).hostname.replace('www.', '');
                    favoriteNews = favoriteNews.filter(fav => {
                        if (fav.original_link) {
                            return !fav.original_link.includes(domain);
                        }
                        return true; 
                    });
                    localStorage.setItem('bios_favorites', JSON.stringify(favoriteNews));
                } catch (e) {
                    console.error("Favori ayıklama hatası:", e);
                }
            }
            
            await fetchRssList(); 
            await fetchNews();    
        }
    } catch (error) {
        alert("Silinemedi.");
    }
};

window.toggleFavorite = (event, id) => {
    event.stopPropagation(); 
    
    const newsItem = allNews.find(n => n.id === id);
    if(!newsItem) return;

    const favIndex = favoriteNews.findIndex(n => n.id === id);
    
    if (favIndex > -1) {
        favoriteNews.splice(favIndex, 1);
    } else {
        favoriteNews.push(newsItem);
    }
    
    localStorage.setItem('bios_favorites', JSON.stringify(favoriteNews));
    applyFilters(); 
};

window.deleteArticle = async (event, id) => {
    event.stopPropagation(); 
    
    const choice = await showConfirm(
        "Haberi Sil",
        "Bu haberi sistemden tamamen silmek istediğinize emin misiniz?",
        [
            { text: "İptal", value: "cancel", style: "secondary" },
            { text: "Evet, Sil", value: "delete", style: "danger" }
        ]
    );

    if (choice === "cancel") return;
    
    const favIndex = favoriteNews.findIndex(n => n.id === id);
    if(favIndex > -1) {
        favoriteNews.splice(favIndex, 1);
        localStorage.setItem('bios_favorites', JSON.stringify(favoriteNews));
    }

    try {
        await fetch(`${API_BASE_URL}/news/${id}`, { method: 'DELETE' });
    } catch(e) {
        console.log("Haber sadece lokal hafızadaydı veya sunucuya ulaşılamadı.");
    }
    
    await fetchNews(); 
};

// ==========================================
// --- 3. YENİLEME, OTOMATİK YENİLEME VE FİLTRELEME ---
// ==========================================

async function triggerRefresh() {
    refreshBtn.innerText = "Çalışıyor...";
    showSkeleton();
    try {
        const response = await fetch(`${API_BASE_URL}/refresh`, { method: 'POST' });
        if(response.ok) {
            await fetchRssList(); 
            await fetchNews();    
            updateTimestamp();
        }
    } catch (error) {
        console.error("Bağlantı hatası.", error);
        await fetchNews(); 
    } finally {
        refreshBtn.innerText = "Yenile";
    }
}

refreshBtn.addEventListener('click', triggerRefresh);

let autoRefreshInterval = null;
if(autoRefreshFilter) {
    autoRefreshFilter.addEventListener('change', (e) => {
        const minutes = parseInt(e.target.value);
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        if (minutes > 0) {
            const ms = minutes * 60 * 1000;
            autoRefreshInterval = setInterval(() => {
                console.log(`${minutes} dakikalık otomatik yenileme tetiklendi.`);
                triggerRefresh(); 
            }, ms);
        }
    });
}

function applyFilters() {
    const term = searchInput.value.toLowerCase();
    const type = typeFilter.value;
    const minScore = parseInt(scoreFilter.value);
    const selectedDate = dateFilter.value;
    const sortBy = sortFilter.value;

    let filtered = allNews.filter(n => {
        if (showOnlyFavorites) {
            const isFav = favoriteNews.some(f => f.id === n.id);
            if (!isFav) return false;
        }

        const cName = n.company || n.company_name || "";
        const matchesSearch = 
            n.title.toLowerCase().includes(term) || 
            cName.toLowerCase().includes(term) ||
            (n.original_link && n.original_link.toLowerCase().includes(term));
            
        const matchesType = type === 'all' || n.event_type === type;
        const matchesScore = (n.score || 0) >= minScore;
        const dStr = n.date || n.published_at_utc || "";
        const matchesDate = !selectedDate || dStr.startsWith(selectedDate);
        
        return matchesSearch && matchesType && matchesScore && matchesDate;
    });

    if (sortBy === 'scoreDesc') filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    else if (sortBy === 'dateDesc') filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    renderNews(filtered);
}

// ==========================================
// --- 4. YARDIMCI FONKSİYONLAR ---
// ==========================================

function getScoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 65) return 'score-watch';
    if (score >= 50) return 'score-medium';
    return 'score-low';
}

function getSuggestionText(score) {
    if (score >= 80) return "Hemen iletişime geç!! Dosya Talep Et.";
    if (score >= 65) return "Takip listesine al, haftalık raporda göster.";
    if (score >= 50) return "Tender ise ihale takibi, değilse partner araması yap.";
    return "Arşivle, sadece arama için tut.";
}

function getSingleEventLabel(type) {
    if (!type) return 'Other';
    const normalized = type.toLowerCase().trim().replace(/[- ]/g, '_');
    
    const types = { 
        relocation: 'Relocation', 
        closure: 'Closure', 
        expansion: 'Expansion', 
        new_plant: 'New Plant', 
        tender: 'Tender', 
        other: 'Other' 
    };
    return types[normalized] || 'Other';
}

function updateTimestamp() { 
    lastUpdateSpan.innerText = `Son: ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`; 
}

function parseEventTypes(rawTypeStr) {
    let rawStr = (rawTypeStr || 'other').toLowerCase().trim();
    rawStr = rawStr.replace(/new\s*[-]?\s*plant/g, 'new_plant');
    
    const parts = rawStr.split(/\s+/);
    const validKeys = ['relocation', 'closure', 'expansion', 'new_plant', 'tender'];
    let validTags = [];
    
    parts.forEach(p => {
        let cleanTag = p.replace(/[- ]/g, '_');
        if (validKeys.includes(cleanTag)) {
            validTags.push(cleanTag);
        }
    });
    
    validTags = [...new Set(validTags)];
    return validTags.length > 0 ? validTags : ['other'];
}

// ==========================================
// --- 5. RENDER VE MODAL ---
// ==========================================

function renderNews(newsArray) {
    newsContainer.innerHTML = '';
    
    // GÜNCELLENDİ: Kurumsal / Resmi Konseptte Şık Boş Durum (Empty State)
    if (newsArray.length === 0) {
        newsContainer.innerHTML = `
            <div style="grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: var(--text-muted); text-align: center; opacity: 0.8;">
                <div style="font-size: 3.5rem; margin-bottom: 15px;">📂</div>
                <h3 style="font-size: 1.4rem; color: var(--text-primary); margin-bottom: 10px;">Veri Bulunamadı</h3>
                <p style="font-size: 0.95rem; max-width: 400px; line-height: 1.5;">Gösterilecek haber veya fırsat yok. Analiz edilecek yeni bir RSS bağlantısı ekleyebilir veya arama kriterlerinizi temizleyebilirsiniz.</p>
            </div>
        `;
        return;
    }

    newsArray.forEach(news => {
        const card = document.createElement('div');
        card.className = 'news-card';
        const score = news.score || 0;
        
        const eventTypes = parseEventTypes(news.event_type);
        const badgesHtml = eventTypes.map(t => {
            const cleanTag = t.replace(/[- ]/g, '_');
            return `<span class="event-badge tag-${cleanTag}">${getSingleEventLabel(cleanTag)}</span>`;
        }).join('');

        const isFav = favoriteNews.some(f => f.id === news.id);
        const starIcon = isFav ? '⭐' : '☆';

        card.innerHTML = `
            <div class="card-header" style="display:flex; justify-content: space-between; align-items: center;">
                <div class="badge-group" style="display:flex; gap:8px; flex-wrap:wrap;">
                    ${badgesHtml}
                </div>
                <span class="score-badge ${getScoreClass(score)}">Skor: ${score}</span>
            </div>
            <h3 class="news-title">${news.title}</h3>
            <p class="news-summary">${news.summary_tr || 'Özet yok.'}</p>
            
            <div class="card-footer" style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="color:var(--text-primary); font-weight:500;">🏢 ${news.company || 'Bilinmiyor'}</span>
                    <span>📅 ${news.date ? news.date.substring(0,10) : '-'}</span>
                </div>
                
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button onclick="toggleFavorite(event, ${news.id})" 
                            style="background: none; border: none; cursor: pointer; font-size: 1.4rem; transition: transform 0.2s;" 
                            onmouseover="this.style.transform='scale(1.2)'" 
                            onmouseout="this.style.transform='scale(1)'" 
                            title="Favorilere Ekle/Çıkar">${starIcon}
                    </button>
                    <button onclick="deleteArticle(event, ${news.id})" 
                            style="background: none; border: none; color: var(--danger); cursor: pointer; font-size: 1.3rem; transition: transform 0.2s;" 
                            onmouseover="this.style.transform='scale(1.2)'" 
                            onmouseout="this.style.transform='scale(1)'" 
                            title="Bu Haberi Sil">🗑️
                    </button>
                </div>
            </div>
        `;
        card.addEventListener('click', () => openModal(news));
        newsContainer.appendChild(card);
    });
}

function openModal(news) {
    modalOverlay.style.display = 'flex';
    const score = news.score || 0;

    const eventTypes = parseEventTypes(news.event_type);
    const badgesHtml = eventTypes.map(t => {
        const cleanTag = t.replace(/[- ]/g, '_');
        return `<span class="event-badge tag-${cleanTag}">${getSingleEventLabel(cleanTag)}</span>`;
    }).join('');

    modalBody.innerHTML = `
        <div class="card-header" style="margin-bottom:15px; padding-right:35px; display:flex; justify-content: space-between; align-items: center;">
            <div class="badge-group" style="display:flex; gap:8px; flex-wrap:wrap;">
                ${badgesHtml}
            </div>
            <span class="score-badge ${getScoreClass(score)}">SKOR: ${score}</span>
        </div>
        <h2>${news.title}</h2>
        <p style="margin: 15px 0; line-height: 1.6; color: var(--text-muted);">${news.summary_tr || ''}</p>
        
        <div class="modal-details-grid">
            <div class="detail-item"><span class="detail-label">Şirket</span><span class="detail-value">${news.company || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Sektör</span><span class="detail-value">${news.sector || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Nereden</span><span class="detail-value">${news.from_location || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Nereye</span><span class="detail-value">${news.to_location || '-'}</span></div>
        </div>
        
        <div class="suggestion-box">
            <div class="suggestion-icon">💡</div>
            <div class="suggestion-content">
                <strong>Önerilen Aksiyon</strong>
                <p>${getSuggestionText(score)}</p>
            </div>
        </div>
        
        <div style="margin-top: 20px; text-align: right;">
            <a href="${news.original_link || '#'}" class="source-link" target="_blank">Orijinal Habere Git ➔</a>
        </div>
    `;
}

closeModalBtn.addEventListener('click', () => modalOverlay.style.display = 'none');
searchInput.addEventListener('input', applyFilters);
typeFilter.addEventListener('change', applyFilters);
scoreFilter.addEventListener('change', applyFilters);
dateFilter.addEventListener('change', applyFilters);
sortFilter.addEventListener('change', applyFilters);

function showSkeleton() {
    newsContainer.innerHTML = ''; 
    for (let i = 0; i < 6; i++) {
        const skel = document.createElement('div');
        skel.className = 'skeleton-card';
        skel.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <div class="skeleton-item" style="width:60px; height:20px; border-radius:20px;"></div>
                <div class="skeleton-item" style="width:80px; height:20px; border-radius:20px;"></div>
            </div>
            <div class="skeleton-item skeleton-title"></div>
            <div class="skeleton-item skeleton-text"></div>
            <div class="skeleton-item skeleton-text" style="width:90%;"></div>
            <div class="skeleton-item skeleton-footer"></div>
        `;
        newsContainer.appendChild(skel);
    }
}

// ==========================================
// --- 6. DIŞA AKTARMA (CSV & EXCEL EXPORT) ---
// ==========================================

function exportToCSV() {
    if (allNews.length === 0) {
        alert("Dışa aktarılacak haber bulunamadı.");
        return;
    }

    const headers = ["Baslik", "Sirket", "Olay Tipi", "Skor", "Tarih", "Sektor", "Nereden", "Nereye", "Ozet"];
    const dataToExport = showOnlyFavorites ? favoriteNews : allNews;

    const rows = dataToExport.map(news => [
        `"${(news.title || '').replace(/"/g, '""')}"`,
        `"${(news.company || '').replace(/"/g, '""')}"`,
        `"${(news.event_type || '').toUpperCase()}"`,
        news.score || 0,
        `"${(news.date || '').substring(0, 10)}"`,
        `"${(news.sector || '-').replace(/"/g, '""')}"`,
        `"${(news.from_location || '-').replace(/"/g, '""')}"`,
        `"${(news.to_location || '-').replace(/"/g, '""')}"`,
        `"${(news.summary_tr || '').replace(/"/g, '""').substring(0, 100)}..."` 
    ]);

    let csvContent = "\ufeff" + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const fileName = `BIOS_Haber_Raporu_${new Date().toISOString().substring(0,10)}.csv`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportToExcel() {
    if (allNews.length === 0) {
        alert("Dışa aktarılacak haber bulunamadı.");
        return;
    }

    const dataToExport = showOnlyFavorites ? favoriteNews : allNews;

    let tableHTML = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1">';
    tableHTML += '<tr style="background-color: #c8102e; color: white;"><th>Başlık</th><th>Şirket</th><th>Olay Tipi</th><th>Skor</th><th>Tarih</th><th>Sektör</th><th>Nereden</th><th>Nereye</th><th>Özet</th></tr>';
    
    dataToExport.forEach(news => {
        tableHTML += '<tr>';
        tableHTML += `<td>${news.title || ''}</td>`;
        tableHTML += `<td>${news.company || ''}</td>`;
        tableHTML += `<td>${(news.event_type || '').toUpperCase()}</td>`;
        tableHTML += `<td>${news.score || 0}</td>`;
        tableHTML += `<td>${news.date ? news.date.substring(0, 10) : ''}</td>`;
        tableHTML += `<td>${news.sector || '-'}</td>`;
        tableHTML += `<td>${news.from_location || '-'}</td>`;
        tableHTML += `<td>${news.to_location || '-'}</td>`;
        tableHTML += `<td>${news.summary_tr || ''}</td>`;
        tableHTML += '</tr>';
    });
    tableHTML += '</table></body></html>';

    const blob = new Blob([tableHTML], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    const fileName = `BIOS_Haber_Raporu_${new Date().toISOString().substring(0,10)}.xls`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

if(exportCsvBtnSidebar) {
    exportCsvBtnSidebar.addEventListener('click', (e) => {
        e.preventDefault(); 
        exportToCSV();
    });
}

if(exportExcelBtnSidebar) {
    exportExcelBtnSidebar.addEventListener('click', (e) => {
        e.preventDefault(); 
        exportToExcel();
    });
}

// Başlangıç yüklemeleri
fetchRssList();
fetchNews();