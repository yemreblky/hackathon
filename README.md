# BIOS Pro Sicht - Endüstriyel Haber Radarı 🏭🔍

[cite_start]BIOS (Endüstriyel Haber Radarı), sanayi şirketleri ve iş geliştirme ekipleri için Avrupa genelindeki fabrika taşımaları (relocation), tesis kapanışları (closure), kapasite artışları (expansion) ve yeni yatırım (new plant) haberlerini otomatik olarak takip eden, yapay zekâ destekli bir istihbarat ve fırsat yakalama aracıdır[cite: 1].

[cite_start]Sistem; eklenen kaynaklardan (RSS veya tekil linkler) haberleri toplar, yapay zeka (LLM) ile analiz eder, doğruluk kontrolü yapar ve potansiyel iş fırsatlarını (BIOS-Fit Skoru) hesaplayarak modern bir arayüzde sunar[cite: 1, 4].

---

## 🚀 Öne Çıkan Özellikler

### 🧠 1. Yapay Zeka ve Gelişmiş Skorlama (AI & Scoring Engine)
* **LLM Destekli Veri Çıkarımı:** Haber metinleri lokal Ollama sunucusundaki (`euro-radar` modeli) yapay zeka ile analiz edilir. Haberden olay tipi, şirket, lokasyonlar, sektör ve zaman çizelgesi gibi kritik veriler çekilir.
* **BIOS-Fit Skorlama Algoritması:** Haberlerin iş geliştirme fırsatı olarak değerini belirten 0-100 arası bir skor hesaplanır. Bu skor; Olay Tipi (%30), Aktör Netliği (%25), Coğrafya (%20), Zaman Penceresi (%15) ve Kaynak Güveni (%10) ağırlıklarıyla belirlenir.
* **Dinamik Aksiyon Önerileri:** Hesaplanan skora göre satış ekibine "Hemen İletişime Geç", "İzlemeye Al" veya "Arşivle" gibi stratejik öneriler sunulur.

### 🕵️‍♂️ 2. Akıllı Kazıma ve Doğrulama (Scraping & Validation)
* **Çapraz Doğrulama (Cross-Validation):** Güvenilirliği düşük kaynaklardan gelen haberler, `DuckDuckGo Search` kütüphanesi ile internette otomatik aratılır. Haber; Bloomberg veya Reuters gibi premium sitelerce doğrulanırsa güven puanı artırılır.
* **Tam Metin Kazıma (Full-Text Scraper):** Sadece RSS özetleriyle yetinilmez; `BeautifulSoup` kullanılarak haberin orijinal linkinden 3000 karaktere kadar tam metin çekilir ve analiz edilir.
* **Bot Koruması Aşma:** Haber kaynaklarının scraping engellerine takılmamak için istekler özel `User-Agent` başlıkları (Chrome kimliği) ile atılır.
* **Dedektif V2 (Akıllı Link Algılama):** Sisteme girilen URL'nin bir RSS kaynağı mı yoksa tekil bir makale mi olduğu backend tarafından otomatik olarak algılanır.

### 💻 3. Modern Kullanıcı Deneyimi (Frontend / UI)
* **Kapsamlı Filtreleme:** Haberler olay tipine, tarihe ve BIOS-Fit skoruna göre anlık olarak filtrelenebilir.
* **Favoriler ve Lokal Hafıza:** Önemli haberler favorilere eklenebilir; bu veriler tarayıcı hafızasında (`localStorage`) saklanır.
* **Dışa Aktarma (Export):** Listelenen haberler tek tıkla **CSV** veya **Excel (.xls)** formatında rapor olarak indirilebilir.
* **Modern Arayüz Bileşenleri:** * Light / Dark tema desteği.
  * Veri yüklenirken gösterilen Skeleton Loading animasyonları.
  * Özel tasarım "Onay (Confirm)" pop-up pencereleri.

---

## 🏗️ Mimari ve Teknolojiler

* **Frontend:** HTML5, CSS3, Vanilla JavaScript (Sıfır dış kütüphane bağımlılığı).
* **Backend:** Python & Flask (REST API uçları ve CORS desteği).
* **Veritabanı:** SQLite (`hackathon.db`).
* **Veri Toplama:** `requests`, `BeautifulSoup4`, `feedparser`, `duckduckgo_search`.
* **Yapay Zeka:** Lokal Ollama sunucusu (Llama3 tabanlı özel `euro-radar` modeli).

* RSS Kaynaklarımız:
* https://news.google.com/rss/search?q=%22new+manufacturing+facility%22+OR+%22greenfield+investment%22+OR+%22fdi+manufacturing%22&hl=en-US&gl=US&ceid=US:en
* https://news.google.com/rss/search?q=%22factory+expansion%22+OR+%22plant+expansion%22+OR+%22capacity+increase%22&hl=en-US&gl=US&ceid=US:en
* https://news.google.com/rss/search?q=%22plant+closure%22+OR+%22factory+closure%22+OR+%22cease+operations%22&hl=en-US&gl=US&ceid=US:en
* https://news.google.com/rss/search?q=%22factory+relocation%22+OR+%22plant+relocation%22+OR+%22corporate+relocation%22&hl=en-US&gl=US&ceid=US:en
* https://www.manufacturingdive.com/feeds/news/

---

## ⚙️ Kurulum ve Çalıştırma

1. **Gerekli Kütüphaneleri Kurun:**
   ```bash
   pip install flask flask-cors requests beautifulsoup4 feedparser duckduckgo_search
