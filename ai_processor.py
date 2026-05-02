import sqlite3
import json
import requests

OLLAMA_URL = "http://192.168.2.88:11434/api/chat"
MODEL_NAME = "euro-radar" 

# --- ADEM'İN HARİKA BIOS-FIT HESAPLAMA ALGORİTMASI ---
def calculate_bios_fit_score(ai_json, source_url):
    # E: Olay Tipi (Ağırlık: %30)
    E = 0.10
    event_type = str(ai_json.get("event_type", "")).lower() if ai_json.get("event_type") else ""
    if event_type == "relocation": E = 1.00
    elif event_type == "new_plant": E = 0.90
    elif event_type == "expansion": E = 0.75
    elif event_type == "tender": E = 0.55
    elif event_type == "closure": E = 0.45

    # A: Aktör Netliği (Ağırlık: %25)
    A = 0.0
    if ai_json.get("company") and str(ai_json.get("company")).lower() != "null": A += 0.40
    if ai_json.get("from_location") and str(ai_json.get("from_location")).lower() != "null": A += 0.25
    if ai_json.get("to_location") and str(ai_json.get("to_location")).lower() != "null": A += 0.25
    if ai_json.get("sector") and str(ai_json.get("sector")).lower() != "null": A += 0.10

    # G: Coğrafya (Ağırlık: %20)
    G = 0.30
    locations = f"{ai_json.get('from_location', '')} {ai_json.get('to_location', '')}".lower()
    avrupa_kelimeleri = ["türkiye", "almanya", "fransa", "avrupa", "ingiltere", "italya", "ispanya", "polonya", "romanya"]
    
    if any(ulke in locations for ulke in avrupa_kelimeleri):
        G = 1.00
    elif len(locations) > 5 and "null" not in locations:
        G = 0.10

    # T: Zaman Penceresi & C: Kaynak Güveni
    T = 0.30
    C = 0.55
    url = str(source_url).lower()
    if any(domain in url for domain in ["reuters", "bloomberg", "ft.com"]): C = 0.85
    elif any(domain in url for domain in ["industryweek", "manufacturing"]): C = 0.70

    # FİNAL SKORU HESAPLAMA
    raw_score = 100 * (0.30 * E + 0.25 * A + 0.20 * G + 0.15 * T + 0.10 * C)

    # Güven (Confidence) Puanı
    filled_fields = 0
    for key in ["company", "from_location", "to_location", "sector", "event_type"]:
        if ai_json.get(key) and str(ai_json.get(key)).lower() != "null":
            filled_fields += 1

    confidence = filled_fields / 5.0
    if confidence < 0.40:
        raw_score *= 0.5 # Veri çok eksikse puanı yarıya düşür

    # Puanları ana sözlüğe ekle ve geri dön
    ai_json["score"] = round(raw_score)
    ai_json["confidence"] = round(confidence, 2)
    ai_json["source_url"] = source_url

    return ai_json
# ---------------------------------------------------

def process_news_with_adem():
    conn = sqlite3.connect('hackathon.db')
    cursor = conn.cursor()
    
    # DİKKAT: Artık veritabanından 'original_link' verisini de çekiyoruz çünkü Adem'in formülü URL'ye bakarak puan veriyor!
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
        
        # Adem'in modelinden sadece ham varlıkları (entity) istiyoruz
        payload = {
            "model": MODEL_NAME,
            "messages": [
                {"role": "user", "content": f"Haberi analiz et ve SADECE JSON formatında event_type, company, sector, from_location, to_location, summary_tr alanlarını doldurarak çıktı ver. Haber: {title}"}
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
            
            # İŞTE SİHİR BURADA: Yapay zekanın çıkardığı ham veriyi Adem'in formülüne sokuyoruz!
            final_data = calculate_bios_fit_score(ai_data, original_link)
            
            # 1. Articles tablosunu güncelle
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
            
            # 2. Scores tablosunu Adem'in formülünden dönen kesin puanla güncelle
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