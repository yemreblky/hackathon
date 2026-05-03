import sqlite3
import json
import requests
from bs4 import BeautifulSoup  
from duckduckgo_search import DDGS # YENİ: Çapraz doğrulama kütüphanesi eklendi

OLLAMA_URL = "http://10.176.238.241:11434/api/chat"
MODEL_NAME = "euro-radar" 

# --- EKLENEN HABER KAZIYICI (SCRAPER) FONKSİYONU ---
def haberi_tamamen_kazi(url):
    """Linkin içine girip makalenin tam metnini (paragrafları) çeker"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status() # Hatalı HTTP kodlarını yakalamak için
        soup = BeautifulSoup(response.content, 'html.parser')

        paragraflar = soup.find_all('p')
        tam_metin = " ".join([p.text for p in paragraflar if len(p.text) > 40])
        
        return tam_metin[:3000] if tam_metin else None
    except Exception:
        return None
# ---------------------------------------------------

# --- ÇAPRAZ DOĞRULAMA (CROSS-VALIDATION) FONKSİYONU ---
# --- ÇAPRAZ DOĞRULAMA (CROSS-VALIDATION) FONKSİYONU (GELİŞMİŞ) ---
def verify_news_cross_reference(company, event_type, location):
    """Haberi internette aratıp başka kaynaklarca doğrulanıp doğrulanmadığını KATI ŞEKİLDE kontrol eder."""
    if not company or not location:
        return False
        
    search_query = f'"{company}" {event_type} {location} news'
    company_lower = company.lower()
    event_lower = event_type.lower()
    
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(search_query, max_results=5))
            found_sources = 0
            
            for res in results:
                url = res.get('href', '').lower()
                title = res.get('title', '').lower()
                body = res.get('body', '').lower()
                
                # 1. Kural: Kaynak o premium sitelerden biri mi?
                is_premium_source = any(domain in url for domain in ["bloomberg", "reuters", "news", "finance", "industry", "supplychain", "yahoo", "ft.com"])
                
                # 2. Kural (YENİ VE KATI): Arama sonucunun başlığında veya özetinde Şirket Adı VE Olay Tipi (veya eşanlamlısı) geçiyor mu?
                is_content_relevant = (company_lower in title or company_lower in body) and \
                                      (event_lower in title or event_lower in body or "plant" in title or "facility" in title or "factory" in title)
                
                # EĞER hem kaynak güvenilirse HEM DE içerik gerçekten bizim olayımızdan bahsediyorsa puan ver!
                if is_premium_source and is_content_relevant:
                    found_sources += 1
                    
            if found_sources >= 1:
                return True
                
    except Exception as e:
        print(f"    [UYARI] Doğrulama motoru geçici olarak cevap vermiyor: {e}")
        
    return False
# --------------------------------------------------------
# --------------------------------------------------------

# --- ADEM'İN HARİKA BIOS-FIT HESAPLAMA ALGORİTMASI ---
def calculate_bios_fit_score(ai_json, source_url):
    # PDF'TEKİ GİBİ GEÇERSİZ/BOŞ DEĞER KONTROLÜ
    def is_valid(val):
        v = str(val).lower().strip()
        return v and v not in ["null", "none", "", "belirtilmemiş"]

    # 1. E: Olay Tipi (Event Type) - Ağırlık: %30
    E = 0.10  # Varsayılan: other = 0.10
    
    event_text = str(ai_json.get("event_type", "other")).lower()

    if "relocation" in event_text: E = 1.00
    elif "new_plant" in event_text: E = 0.90
    elif "expansion" in event_text: E = 0.75
    elif "tender" in event_text: E = 0.55
    elif "closure" in event_text: E = 0.45

    # 2. A: Aktör Netliği (Actor Clarity) - Ağırlık: %25
    A = 0.0
    # 1. Şirket ve Sektör (Sabitler)
    if is_valid(ai_json.get("company")): A += 0.40
    if is_valid(ai_json.get("sector")): A += 0.10

    # 2. Lokasyon Puanlaması (Haber Tipine Göre Dinamik)
    event_type_str = str(ai_json.get("event_type", "other")).lower()
    has_from = is_valid(ai_json.get("from_location"))
    has_to = is_valid(ai_json.get("to_location"))

    if event_type_str == "relocation":
        if has_from: A += 0.25
        if has_to: A += 0.25
    elif event_type_str in ["new_plant", "expansion"]:
        if has_to: A += 0.50
    elif event_type_str == "closure":
        if has_from: A += 0.50
    else:
        if has_from or has_to: A += 0.50

    A = min(A, 1.0)

    # 3. G: Coğrafya (Geography) - Ağırlık: %20
    G = 0.30 # Varsayılan: Bilinmiyor = 0.30
    locations = f"{ai_json.get('from_location', '')} {ai_json.get('to_location', '')}".lower()
    
    avrupa_ici = [
        "türkiye", "turkey", "almanya", "germany", "fransa", "france", 
        "ingiltere", "uk", "united kingdom", "britain", "italya", "italy", 
        "ispanya", "spain", "polonya", "poland", "romanya", "romania", 
        "bulgaristan", "bulgaria", "yunanistan", "greece", "sırbistan", "serbia",
        "hollanda", "netherlands", "belçika", "belgium", "isveç", "sweden",
        "norveç", "norway", "danimarka", "denmark", "finlandiya", "finland",
        "avusturya", "austria", "i̇sviçre", "switzerland", "çekya", "czechia", "czech republic",
        "macaristan", "hungary", "irlanda", "ireland", "portekiz", "portugal",
        "hırvatistan", "croatia", "slovakya", "slovakia", "slovenya", "slovenia",
        "bosna", "bosnia", "karadağ", "montenegro", "arnavutluk", "albania",
        "makedonya", "macedonia", "kosova", "kosovo", "letonya", "latvia",
        "litvanya", "lithuania", "estonya", "estonia",
        "avrupa", "europe", "ab", "eu"
    ]
    komsular = [
        "rusya", "russia", "kuzey afrika", "north africa", "mısır", "egypt", 
        "fas", "morocco", "cezayir", "algeria", "tunus", "tunisia", 
        "ukrayna", "ukraine", "belarus", "gürcistan", "georgia", 
        "azerbaycan", "azerbaijan", "ermenistan", "armenia", "iran", 
        "ırak", "iraq", "suriye", "syria", "ortadoğu", "middle east"]
    
    if any(ulke in locations for ulke in avrupa_ici):
        G = 1.00
    elif any(ulke in locations for ulke in komsular):
        G = 0.50
    elif is_valid(ai_json.get("from_location")) or is_valid(ai_json.get("to_location")):
        G = 0.10 # Konum var ama Avrupa/Komşu değilse "Diğer"

    # 4. T: Zaman Penceresi (Timeline) - Ağırlık: %15
    T = 0.30 # Varsayılan: Belirtilmemiş = 0.30
    summary_text = str(ai_json.get("summary_tr", "")).lower()
    
    if any(word in summary_text for word in ["duyuruldu", "taşınacak", "çeyrek", "yakın zaman", "0-6 ay", "kısa süre", "hemen"]):
        T = 1.00
    elif any(word in summary_text for word in ["6-18 ay", "önümüzdeki yıl", "gelecek yıl", "planlanıyor"]):
        T = 0.70
    elif any(word in summary_text for word in ["18-36 ay", "uzun vadede"]):
        T = 0.40

    # 5. C: Kaynak Güveni (Source Trust) - Ağırlık: %10
    C = 0.55 # Varsayılan: Genel haber sitesi = 0.55
    url = str(source_url).lower()
    
    # YENİ: Genişletilmiş Güvenilir Kaynaklar ve Kalıplar
    premium_sources = [
        "reuters", "bloomberg", "ft.com", "handelsblatt", "industryweek", 
        "manufacturing", "supplychainbrain", "tradefinance", "supplychaindive", 
        "logisticsmanager", "automotivelogistics", "tipranks"
    ]
    official_patterns = [
        "ir.", "investor", "press-release", "corp.", "pr-newswire", "newsroom", "media-center"
    ]
    
    if any(domain in url for domain in premium_sources): 
        C = 1.00 # Premium veya sektörel yayın
    elif any(pattern in url for pattern in official_patterns):
        C = 1.00 # Şirketin resmi bildirimi
    elif any(domain in url for domain in ["blog", "forum", "reddit", "medium"]): 
        C = 0.25 # Blog / forum
    elif is_valid(ai_json.get("estimated_volume")):
        C = 0.85 # Site bilinmiyor ama haberde somut hacim/rakam verisi var
        
    # YENİ: Çapraz Doğrulama (Cross-Validation) Devrede!
    if C < 0.85:
        company_name = ai_json.get("company")
        event_type_str = ai_json.get("event_type", "")
        location_to_search = ai_json.get("to_location") or ai_json.get("from_location")
        
        is_verified = verify_news_cross_reference(company_name, event_type_str, location_to_search)
        
        if is_verified:
            print(f"    [DOĞRULANDI] {company_name} haberi başka güvenilir kaynaklarca onaylandı! (Güven: 1.00)")
            C = 1.00 # Haber doğrulandı, puanı kurtardık!

    raw_score = 100 * (0.30 * E + 0.25 * A + 0.20 * G + 0.15 * T + 0.10 * C)

    # --- DİNAMİK AKSİYON ATAMASI (Belgelerdeki Eşiklere Göre) ---
    if raw_score >= 80:
        recommended_action = "reach_out"
    elif raw_score >= 65:
        recommended_action = "monitor"
    elif raw_score >= 50:
        if "tender" in event_text:
            recommended_action = "tender_watch"
        else:
            recommended_action = "partner_search"
    else:
        recommended_action = "archive"

    confidence = A/2
    if confidence < 0.4:
        raw_score *= 0.5
        
    # Puanları ve aksiyonu JSON'a ekle
    ai_json["score"] = round(raw_score)
    ai_json["confidence"] = confidence
    ai_json["source_url"] = source_url
    ai_json["recommended_action"] = recommended_action

    return ai_json

#---------------------------------------------------

def process_news_with_adem():
    conn = sqlite3.connect('hackathon.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, title, original_link FROM articles WHERE event_type IS NULL")
    articles = cursor.fetchall()
    
    if not articles:
        print("İşlenecek yeni haber bulunamadı. DB güncel!")
        return

    print(f"Toplam {len(articles)} haber Adem'in modeline gönderiliyor...\n")

    for article in articles:
        article_id = article[0]
        title = article[1]
        original_link = article[2] 
        
        print(f"-> Gönderiliyor: {title}")
        
        gercek_metin = haberi_tamamen_kazi(original_link)
        kullanilacak_metin = gercek_metin if gercek_metin else title
        
        # --- PROMPT GÜNCELLENDİ (rationale_tr eklendi) ---
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "user", "content": f"Sen bir sanayi analistisin. Haberi analiz et ve SADECE JSON formatında event_type, company, sector, from_location, to_location, summary_tr ve rationale_tr alanlarını doldurarak çıktı ver. event_type alanına SADECE haberdeki en önemli ANA OLAYI temsil eden TEK BİR ETİKET yaz (closure, relocation, new_plant, expansion, tender veya other). rationale_tr alanına ise bu haberin BIOS (endüstriyel taşıma/kurulum firması) için neden önemli veya önemsiz olduğuna dair 1 cümlelik Türkçe analist yorumu yaz. Haber Metni: {kullanilacak_metin}"}
            ],
            "format": "json",
            "stream": False
        }
        
        try:
            response = requests.post(OLLAMA_URL, json=payload, timeout=60)
            response.raise_for_status()
            
            raw_content = response.json()["message"]["content"]
            cleaned_content = raw_content.replace('```json', '').replace('```', '').strip()
            ai_data = json.loads(cleaned_content)
            
            final_data = calculate_bios_fit_score(ai_data, original_link)
            
            cursor.execute("""
                UPDATE articles 
                SET event_type = ?, company_name = ?, sector = ?, from_location = ?, to_location = ?, text_summary_tr = ?
                WHERE id = ?
            """, (
                final_data.get("event_type", "other"), 
                final_data.get("company", None), 
                final_data.get("sector", None), 
                final_data.get("from_location", None), 
                final_data.get("to_location", None), 
                final_data.get("summary_tr", "Özet bulunamadı."),
                article_id
            ))
            
            # --- VERİTABANI KAYDI DİNAMİKLEŞTİRİLDİ ---
            cursor.execute("""
                INSERT INTO scores (article_id, score, score_confidence, rationale_tr, recommended_action)
                VALUES (?, ?, ?, ?, ?)
            """, (
                article_id,
                final_data.get("score", 0), 
                final_data.get("confidence", 0.0),
                final_data.get("rationale_tr", "Özel gerekçe üretilemedi."), 
                final_data.get("recommended_action", "monitor")
            ))
            
            conn.commit()
            print(f"   [BAŞARILI] Şirket: {final_data.get('company', '-')} | Skor: {final_data.get('score')} | Güven: {final_data.get('confidence')}\n")
            
        except Exception as e:
            print(f"   [HATA]: {e}\n")
            
    conn.close()
    print("İşlem tamamlandı! Veriler arayüze gitmeye hazır.")

if __name__ == '__main__':
    process_news_with_adem()