# Avrupa Endüstriyel Haber Tarama Ajanı (Pro Sicht - BSMT Hackathon)

## 🎯 Proje Özeti
Bu proje, sanayi şirketleri ve iş geliştirme ekipleri için Avrupa genelindeki fabrika taşımaları, tesis kapanışları ve yeni yatırım gibi endüstriyel haberleri otomatik olarak takip eden, yapay zekâ destekli bir istihbarat aracıdır[cite: 1]. Sisteme eklenen RSS kaynakları veya tekil haber linkleri taranır, yapay zeka modeli (LLM) ile analiz edilir ve önemli yatırım sinyalleri yakalanarak sade bir arayüzde skorlanmış şekilde sunulur[cite: 1, 4].

## 🏗️ Mimari ve Kullanılan Teknolojiler
Kurumsal karmaşadan uzak, hızlı, stabil ve tamamen çalışan bir MVP (Minimum Viable Product) hedeflenerek geliştirilmiştir[cite: 1].

* **Frontend:** HTML5, CSS3, Vanilla JavaScript[cite: 3, 8, 9]. (Dış kütüphane bağımlılığı olmadan, Light/Dark tema destekli, iskelet yükleme (skeleton loading) animasyonlu modern, responsive arayüz[cite: 3, 8, 9]).
* **Backend:** Python & Flask[cite: 4]. (REST API uçları, asenkron hissi veren hızlı istek yönetimi ve CORS desteği[cite: 4]).
* **Veritabanı:** SQLite (`hackathon.db`)[cite: 6]. (Hafif, taşınabilir ve kalıcı veri depolama[cite: 6]).
* **Web Kazıma (Scraping):** `requests`, `BeautifulSoup4`, `feedparser`[cite: 2, 5].
* **Yapay Zeka (LLM):** Lokal `Ollama` sunucusu üzerinde çalışan özel `euro-radar` modeli[cite: 2].

### 🚀 Öne Çıkan Özellikler (Bonus Kriterler)
* **Dedektif V2 (Akıllı Link):** Kullanıcı arayüzden bir URL girdiğinde, sistem arka planda sitenin Content-Type ve XML yapısını analiz eder[cite: 4]. Linkin bir RSS kaynağı mı yoksa tekil bir makale mi olduğunu otomatik anlar ve veritabanında doğru tabloya yerleştirir[cite: 4].
* **Bot Koruması Aşma:** Haber kaynaklarının (özellikle saygın ajansların) scraping işlemlerini engellemesini önlemek için istekler özel `User-Agent` başlıklarıyla "Google Chrome" kimliğinde atılır[cite: 5]. Eğer site makalenin tam metnine erişime izin vermezse, sistem dinamik olarak sadece "başlık" (title) verisini kullanarak çökmeden analiz yapmaya devam eder[cite: 2].
* **Tam Metin Analizi:** Yalnızca RSS özetleriyle yetinilmez; linkin içine girilerek `BeautifulSoup` ile `<p>` etiketleri tek tek toplanır ve yapay zekaya 3000 karaktere kadar temizlenmiş tam makale metni sunulur[cite: 2].

## 🧠 Yapay Zeka Entegrasyonu ve Prompt Stratejimiz
Yapay zeka modelinden stabil bir JSON çıktısı alabilmek için prompt mühendisliğine özel önem verilmiştir[cite: 2]. Haberde aynı anda birden fazla olay (örn: bir fabrikanın kapanıp diğerinin açılması) geçme ihtimaline karşı model virgülle ayırma ve liste formatına uygun şekilde talimatlandırılmıştır[cite: 2].

**Kullandığımız Sistem Promptu:**
> "Sen bir sanayi analistisin. Haberi analiz et ve SADECE JSON formatında event_type, company, sector, from_location, to_location, summary_tr alanlarını doldurarak çıktı ver. Eğer haberde birden fazla olay tipi varsa (örneğin hem kapanma hem yeni fabrika), event_type alanına virgülle ayırarak veya liste olarak hepsini yaz. Haber Metni: {kullanilacak_metin}"[cite: 2]

## 📊 Adem'in BIOS-Fit Skorlama Algoritması
Haberlerin iş geliştirme fırsatı olarak değerini belirten 0-100 arası BIOS-Fit skoru, matematiksel ağırlıklarla Python backend tarafında hesaplanmaktadır[cite: 1, 2]. 
Algoritmamız LLM'den gelen JSON verisini şu katsayılarla işler:
1. **Olay Tipi (E) - %30:** Relocation (1.00) ile other (0.10) arasında derecelendirilir[cite: 2].
2. **Aktör Netliği (A) - %25:** Şirket adı, hedef/çıkış lokasyonları ve sektörün AI tarafından bulunabilme oranına göre artar[cite: 2].
3. **Coğrafya (G) - %20:** Hedef Avrupa içi ise 1.00, komşu bölgeler ise 0.50 çarpanı alır[cite: 2].
4. **Zaman Penceresi (T) - %15:** Modelin oluşturduğu `summary_tr` (Türkçe Özet) içerisindeki tarih/çeyrek anahtar kelimeleri (örn: "in q", "yakın zaman", "0-6 ay") taranarak elde edilir[cite: 2].
5. **Kaynak Güveni (C) - %10:** Haberin geldiği domain (URL) regex/metin araması ile sınıflandırılır; resmi şirket siteleri (ir., investor) en yüksek, forumlar en düşük puanı alır[cite: 2].

*Not: Eğer güven puanı (confidence) düşükse, yanıltıcı sonuçları engellemek için sistem skora yumuşatma (ceza) uygulayarak ağırlığı düşürmektedir[cite: 10].*

## ⚙️ Kurulum ve Çalıştırma Adımları
Projeyi lokal ortamda test etmek için sırasıyla aşağıdaki adımları izleyin:

1. Gerekli Python kütüphanelerini kurun:
   `pip install flask flask-cors requests beautifulsoup4 feedparser`
2. İlk kurulumda tabloları oluşturmak için veritabanını başlatın:
   `python init_db.py`[cite: 6]
3. Sistemi ayağa kaldırın:
   `python app.py`[cite: 4]
4. Tarayıcınızda `index.html` dosyasını açarak uygulamayı kullanmaya başlayın[cite: 8].

*(Not: Yapay zeka modülü yerel ağdaki `10.176.238.241` numaralı Ollama sunucusuna bağlıdır. Eğer bu IP'ye erişiminiz yoksa, kod içerisindeki API yolunu güncelleyebilirsiniz[cite: 2]).*

## 🔗 Örnek Test RSS Kaynakları
Arayüzdeki sol panele ekleyerek sistemi test edebileceğiniz örnek haber kaynakları:
* **NTV Ekonomi (Türkçe test için):** `https://www.ntv.com.tr/ekonomi.rss`[cite: 5]
* **Supply Chain Brain (Lojistik ve taşıma):** `https://www.supplychainbrain.com/rss`[cite: 5]
* **CNBC Business (Büyük yatırımlar):** `https://search.cnbc.com/rs/search/combinedcms/view.xml?profile=12000000&id=10000115`[cite: 5]