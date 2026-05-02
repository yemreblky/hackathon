// ==========================================
// --- DOM ELEMENTLERİ (Arayüz Bileşenleri) ---
// ==========================================
const newsContainer = document.getElementById('newsContainer');
const refreshBtn = document.getElementById('refreshBtn');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const typeFilter = document.getElementById('typeFilter');
const scoreFilter = document.getElementById('scoreFilter');
const dateFilter = document.getElementById('dateFilter');
const sortFilter = document.getElementById('sortFilter'); 
const lastUpdateSpan = document.getElementById('lastUpdate');

// Tek Buton ve Tek Input
const linkInput = document.getElementById('rssUrlInput');
const addBtn = document.getElementById('addRssBtn');
const rssList = document.getElementById('rssList');

// Modal (Açılır Pencere) Elementleri
const modalOverlay = document.getElementById('newsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalBody = document.getElementById('modalBody');

// ==========================================
// --- API YAPILANDIRMASI VE STATE (Durum) ---
// ==========================================
// DİKKAT: Aynı ağda (Wi-Fi) çalışırken bu IP adresi Yunus'un bilgisayarının IPv4 adresi olmalıdır!
const API_BASE_URL = 'http://10.176.238.59:5000/api';

let allNews = []; 
let savedRssLinks = []; 

// ==========================================
// --- 1. BACKEND'DEN VERİ ÇEKME İŞLEMLERİ ---
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
        if(response.ok) {
            allNews = await response.json();
            applyFilters();
        }
    } catch (error) {
        console.error("Haberler çekilirken hata:", error);
        newsContainer.innerHTML = '<p style="color:red; text-align:center; padding: 20px;">Sunucuya bağlanılamadı. Backend (Yunus) aktif mi?</p>';
    }
}

// ==========================================
// --- 2. AKILLI VERİ EKLEME VE SİLME İŞLEMLERİ ---
// ==========================================

// A) AKILLI LİNK EKLEME (RSS veya Tekil Haber Otomatik Algılanır)
addBtn.addEventListener('click', async () => {
    const url = linkInput.value.trim();
    if (!url) {
        alert("Lütfen bir link girin.");
        return;
    }

    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error();
    } catch {
        alert("Geçersiz URL formatı.");
        return;
    }

    const isDuplicate = savedRssLinks.some(rss => rss.url.toLowerCase() === url.toLowerCase());
    if (isDuplicate) {
        alert("Bilgi: Bu kaynak zaten sol menüde ekli.");
        return;
    }

    addBtn.innerText = "İnceleniyor...";
    try {
        // Yunus'un 'add-link' (Dedektif) rotasına gönderiyoruz
        const response = await fetch(`${API_BASE_URL}/add-link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });

        if(response.ok) {
            const data = await response.json();
            
            if (data.type === 'rss') {
                await fetchRssList(); // RSS ise sol menüyü güncelle
            } else {
                // Tekil haber ise uyarı ver
                alert("📰 Tekil haber başarıyla kaydedildi! Yapay zekanın okuması için üstteki 'Yenile' butonuna basın.");
            }
            
            linkInput.value = ''; // Kutuyu temizle
        } else if (response.status === 409) {
            alert("Bu link zaten sistemde kayıtlı.");
        } else {
            alert("Hata: Link okunamadı. Sitenin güvenliği izin vermiyor olabilir.");
        }
    } catch (error) {
        alert("Sunucu hatası: Backend (Yunus) ile bağlantı kurulamadı.");
    } finally {
        addBtn.innerText = "Ekle";
    }
});

// B) RSS Kaynağı Silme (Sol Panelden Kökten Temizlik)
window.deleteRss = async (id) => {
    if(!confirm("Bu kaynağı ve içindeki tüm haberleri silmek istediğinize emin misiniz?")) return;
    try {
        const response = await fetch(`${API_BASE_URL}/rss/${id}`, { method: 'DELETE' });
        if (response.ok) {
            await fetchRssList(); // Menüyü temizle
            await fetchNews();    // Ekrandaki haberleri temizle
        } else {
            alert("Sunucudan silinirken bir hata oluştu.");
        }
    } catch (error) {
        alert("Silinemedi. Sunucu bağlantısını kontrol edin.");
    }
};

// C) Tekil Haber Silme (Kart Üzerindeki Çöp Kutusu)
window.deleteArticle = async (event, id) => {
    event.stopPropagation(); // Modalin (detay penceresinin) açılmasını engeller
    if(!confirm("Bu haberi tamamen silmek istediğinize emin misiniz?")) return;
    try {
        const response = await fetch(`${API_BASE_URL}/news/${id}`, { method: 'DELETE' });
        if(response.ok) {
            await fetchNews(); // Haberi ekrandan anında yok et
        } else {
            alert("Haber silinirken sunucuda bir hata oluştu.");
        }
    } catch(e) {
        alert("Sunucu bağlantısı kurulamadı.");
    }
};

// ==========================================
// --- 3. YENİLEME VE YAPAY ZEKA TETİKLEME ---
// ==========================================

refreshBtn.addEventListener('click', async () => {
    refreshBtn.innerText = "Sistem Çalışıyor...";
    showSkeleton();
    try {
        const response = await fetch(`${API_BASE_URL}/refresh`, { method: 'POST' });
        if(response.ok) {
            await fetchRssList(); 
            await fetchNews();    
            updateTimestamp();
        } else {
            alert("Yenileme sırasında sunucu hatası. (Adem'in Ollama modeli açık mı?)");
            await fetchNews();
        }
    } catch (error) {
        alert("Sunucuya ulaşılamadı. Yunus'un Python ekranını kontrol edin.");
        await fetchNews();
    } finally {
        refreshBtn.innerText = "Yenile";
    }
});

// ==========================================
// --- 4. RENDER (Çizim) VE FİLTRELEME İŞLEMLERİ ---
// ==========================================

function renderRssList() {
    rssList.innerHTML = '';
    if (savedRssLinks.length === 0) {
        rssList.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; border: 1px dashed #475569;">Henüz RSS eklemediniz.</div>`;
        return;
    }

    savedRssLinks.forEach((rss) => {
        const li = document.createElement('li');
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
        
        const companyName = news.company || news.company_name || 'Bilinmiyor';
        const summary = news.summary_tr || news.text_summary_tr || 'Özet bilgisi bulunamadı.';
        const dateStr = news.date || news.published_at_utc || '-';
        const score = news.score || 0;

        let formattedDate = dateStr;
        if(dateStr !== '-' && dateStr.length >= 10) {
            formattedDate = dateStr.substring(0, 10);
        }

        // Kart Şablonu
        card.innerHTML = `
            <div class="card-header">
                <span class="event-badge tag-${news.event_type || 'other'}">${getEventLabel(news.event_type)}</span>
                <span class="score-badge ${getScoreClass(score)}">Skor: ${score}</span>
            </div>
            <h3 class="news-title">${news.title}</h3>
            <p class="news-summary">${summary}</p>
            <div class="card-footer" style="display: flex; justify-content: space-between; align-items: flex-end;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span>🏢 ${companyName}</span>
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
    const term = searchInput.value.toLowerCase();
    const type = typeFilter.value;
    const minScore = parseInt(scoreFilter.value);
    const selectedDate = dateFilter.value;
    const sortBy = sortFilter.value;

    let filtered = allNews.filter(n => {
        const cName = n.company || n.company_name || "";
        const matchesSearch = n.title.toLowerCase().includes(term) || cName.toLowerCase().includes(term);
        const matchesType = type === 'all' || n.event_type === type;
        const matchesScore = (n.score || 0) >= minScore;
        const dStr = n.date || n.published_at_utc || "";
        const matchesDate = !selectedDate || dStr.startsWith(selectedDate);
        
        return matchesSearch && matchesType && matchesScore && matchesDate;
    });

    if (sortBy === 'scoreDesc') {
        filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    } else if (sortBy === 'scoreAsc') {
        filtered.sort((a, b) => (a.score || 0) - (b.score || 0));
    } else if (sortBy === 'dateDesc') {
        filtered.sort((a, b) => new Date(b.date || b.published_at_utc || 0) - new Date(a.date || a.published_at_utc || 0));
    }

    renderNews(filtered);
}

// ==========================================
// --- 5. YARDIMCI FONKSİYONLAR ---
// ==========================================

function showSkeleton() {
    newsContainer.innerHTML = '';
    for (let i = 0; i < 6; i++) {
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

// Slayt 7.3'teki Etiket Sütununa Birebir Uyumlu (Kartlardaki rozetler için)
function getEventLabel(type) {
    const types = { 
        relocation: 'relocation', 
        closure: 'closure', 
        expansion: 'expansion', 
        new_plant: 'new_plant', 
        tender: 'tender', 
        other: 'other' 
    };
    return types[type] || 'other';
}

function updateTimestamp() {
    const now = new Date();
    lastUpdateSpan.innerText = `Son kontrol: ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

function openModal(news) {
    modalOverlay.style.display = 'flex';
    
    const companyName = news.company || news.company_name || '-';
    const summary = news.summary_tr || news.text_summary_tr || 'Özet bilgisi bulunamadı.';
    const score = news.score || 0;

    modalBody.innerHTML = `
        <div class="card-header" style="margin-bottom:15px; padding-right:35px;">
            <span class="event-badge tag-${news.event_type || 'other'}">${getEventLabel(news.event_type)}</span>
            <span class="score-badge ${getScoreClass(score)}">Skor: ${score}</span>
        </div>
        <h2>${news.title}</h2>
        <p class="modal-summary" style="margin: 15px 0; font-size: 1.1rem; line-height: 1.6; color: #334155;">${summary}</p>
        
        <div class="modal-details-grid">
            <div class="detail-item"><span class="detail-label">Şirket</span><span class="detail-value">${companyName}</span></div>
            <div class="detail-item"><span class="detail-label">Sektör</span><span class="detail-value">${news.sector || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Nereden</span><span class="detail-value">${news.from_location || '-'}</span></div>
            <div class="detail-item"><span class="detail-label">Nereye</span><span class="detail-value">${news.to_location || '-'}</span></div>
        </div>
        
        <div style="margin-top: 20px; text-align: right;">
            <a href="${news.original_link || '#'}" class="source-link" target="_blank">Orijinal Habere Git ➔</a>
        </div>
    `;
}

// Olay Dinleyicileri
closeModalBtn.addEventListener('click', () => modalOverlay.style.display = 'none');
modalOverlay.addEventListener('click', (e) => { 
    if(e.target === modalOverlay) modalOverlay.style.display = 'none'; 
});
searchInput.addEventListener('input', applyFilters);
typeFilter.addEventListener('change', applyFilters);
scoreFilter.addEventListener('change', applyFilters);
dateFilter.addEventListener('change', applyFilters);
sortFilter.addEventListener('change', applyFilters);

// Başlangıç
fetchRssList();
fetchNews();