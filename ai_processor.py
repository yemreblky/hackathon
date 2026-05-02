import sqlite3
import json
import requests
from bs4 import BeautifulSoup  

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
        soup = BeautifulSoup(response.content, 'html.parser')

        paragraflar = soup.find_all('p')
        tam_metin = " ".join([p.text for p in paragraflar if len(p.text) > 40])
        
        return tam_metin[:3000] if tam_metin else None
    except Exception:
        return None
# ---------------------------------------------------

# --- ADEM'İN HARİKA BIOS-FIT HESAPLAMA ALGORİTMASI ---
def calculate_bios_fit_score(ai_json, source_url):
    # PDF'TEKİ GİBİ GEÇERSİZ/BOŞ DEĞER KONTROLÜ
    def is_valid(val):
        v = str(val).lower().strip()
        return v and v not in ["null", "none", "", "belirtilmemiş"]

    # 1. E: Olay Tipi (Event Type) - Ağırlık: %30
    E = 0.10  # Varsayılan: other = 0.10
    
    # LLM artık tekil etiket dönüyor.
    event_text = str(ai_json.get("event_type", "other")).lower()

    # ZEKİCE KISIM: En yüksek puandan başlayarak arıyoruz. 
    # Metin içinde birden fazla olay geçse bile, ilk (ve en yüksek) olanı bulduğunda
    # E değerini atar ve diğer elif bloklarına girmez. Böylece otomatik olarak 'max' değeri almış oluruz.
    if "relocation" in event_text: E = 1.00
    elif "new_plant" in event_text: E = 0.90
    elif "expansion" in event_text: E = 0.75
    elif "tender" in event_text: E = 0.55
    elif "closure" in event_text: E = 0.45

    # 2. A: Aktör Netliği (Actor Clarity) - Ağırlık: %25
    A = 0.0
    if is_valid(ai_json.get("company")): A += 0.40
    if is_valid(ai_json.get("from_location")): A += 0.25
    if is_valid(ai_json.get("to_location")): A += 0.25
    if is_valid(ai_json.get("sector")): A += 0.10
    A = min(A, 1.0) # Toplamın 1'i geçmemesi için güvenlik

    # 3. G: Coğrafya (Geography) - Ağırlık: %20
    G = 0.30 # Varsayılan: Bilinmiyor = 0.30
    locations = f"{ai_json.get('from_location', '')} {ai_json.get('to_location', '')}".lower()
    
    avrupa_ici = ["türkiye", "almanya", "fransa", "ingiltere", "birleşik krallık", "italya", "ispanya", "polonya", "romanya", "bulgaristan", "yunanistan", "sırbistan", "avrupa", "ab"]
    komsular = ["rusya", "kuzey afrika", "mısır", "fas", "cezayir", "tunus", "ukrayna"]
    
    if any(ulke in locations for ulke in avrupa_ici):
        G = 1.00
    elif any(ulke in locations for ulke in komsular):
        G = 0.50
    elif is_valid(ai_json.get("from_location")) or is_valid(ai_json.get("to_location")):
        G = 0.10 # Konum var ama Avrupa/Komşu değilse "Diğer"

    # 4. T: Zaman Penceresi (Timeline) - Ağırlık: %15
    T = 0.30 # Varsayılan: Belirtilmemiş = 0.30
    # LLM direkt "zaman" döndürmediği için, çıkardığı Türkçe özetin içinde kelime araması yapıyoruz
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
    
    if any(domain in url for domain in ["ir.", "investor", "press-release", "corp.", "pr-newswire"]): 
        C = 1.00 # Şirketin resmi sitesi / IR
    elif any(domain in url for domain in ["reuters", "bloomberg", "ft.com", "handelsblatt"]): 
        C = 0.85 # Saygın haber ajansı
    elif any(domain in url for domain in ["industryweek", "manufacturing", "supplychainbrain", "tradefinance"]): 
        C = 0.70 # Sektörel yayın
    elif any(domain in url for domain in ["blog", "forum", "reddit", "medium"]): 
        C = 0.25 # Blog / forum

    # PDF'TEKİ AĞIRLIKLI FİNAL SKORU HESAPLAMA (Ekstra ceza çarpanları kaldırıldı)
    raw_score = 100 * (0.30 * E + 0.25 * A + 0.20 * G + 0.15 * T + 0.10 * C)

    # Puanları sözlüğe ekle (Confidence veritabanında istendiği için formül içindeki saf netlik A'yı atıyoruz)
    ai_json["score"] = round(raw_score)
    ai_json["confidence"] = round(A, 2) # Güven skoru artık "Aktör Netliği" tablosundan geliyor
    ai_json["source_url"] = source_url

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
        
        # --- İŞTE SİHİRLİ DOKUNUŞ BURADA ---
        # 1. Önce linke gidip haberi kazıyoruz
        gercek_metin = haberi_tamamen_kazi(original_link)
        
        # 2. Site izin verdiyse devasa tam metni kullan, vermediyse B planı olarak sadece başlığı kullan
        kullanilacak_metin = gercek_metin if gercek_metin else title
        # -----------------------------------
        
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "user", "content": f"Sen bir sanayi analistisin. Haberi analiz et ve SADECE JSON formatında event_type, company, sector, from_location, to_location, summary_tr alanlarını doldurarak çıktı ver. event_type alanına SADECE haberdeki en önemli ANA OLAYI temsil eden TEK BİR ETİKET yaz (closure, relocation, new_plant, expansion, tender veya other). Asla liste veya virgüllü metin kullanma. Haber Metni: {kullanilacak_metin}"}
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
            
            cursor.execute("""
                INSERT INTO scores (article_id, score, score_confidence, rationale_tr, recommended_action)
                VALUES (?, ?, ?, ?, ?)
            """, (
                article_id,
                final_data.get("score", 0), 
                final_data.get("confidence", 0.0),
                "Algoritma ile kesin skorlandı.", 
                "monitor"
            ))
            
            conn.commit()
            print(f"   [BAŞARILI] Şirket: {final_data.get('company', '-')} | Skor: {final_data.get('score')} | Güven: {final_data.get('confidence')}\n")
            
        except Exception as e:
            print(f"   [HATA]: {e}\n")
            
    conn.close()
    print("İşlem tamamlandı! Veriler arayüze gitmeye hazır.")

if __name__ == '__main__':
    process_news_with_adem()