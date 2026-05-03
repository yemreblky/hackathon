
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import sqlite3
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone

# --- BİZİM PYTHON MODÜLLERİMİZ ---
# collector.py dosyasından RSS çekme fonksiyonunu alıyoruz
from collector import fetch_and_save_news 
# ai_processor.py dosyasından Adem'in LLM fonksiyonunu alıyoruz
from ai_processor import process_news_with_adem 

app = Flask(__name__)
# Frontend'in localhost veya başka bir porttan istek atmasına izin ver (CORS hatasını önler)
CORS(app)

DB_PATH = 'hackathon.db'

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# 1. Tüm Haberleri Getir (Frontend İçin)
@app.route('/api/news', methods=['GET'])
def get_news():
    conn = get_db_connection()
    cursor = conn.cursor()
    # Articles ve Scores tablolarını birleştirerek veriyi çekiyoruz
    cursor.execute("""
        SELECT a.id, a.title, a.original_link, a.published_at_utc as date, 
               a.text_summary_tr as summary_tr, a.event_type, a.company_name as company, 
               a.sector, a.from_location, a.to_location, s.score
        FROM articles a
        LEFT JOIN scores s ON a.id = s.article_id
        ORDER BY a.published_at_utc DESC
    """)
    haberler = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(haberler)

# 2. Kayıtlı RSS Listesini Getir
@app.route('/api/rss', methods=['GET'])
def get_rss_list():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, url, publisher, status FROM sources")
    rss_list = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(rss_list)

# 3. Yeni RSS Ekle
@app.route('/api/rss', methods=['POST'])
def add_rss():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({"error": "URL boş olamaz"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO sources (url, status) VALUES (?, 'active')", (url,))
        conn.commit()
        return jsonify({"message": "RSS eklendi"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Bu RSS zaten kayıtlı"}), 409
    finally:
        conn.close()

# 4. RSS VE BAĞLI HABERLERİ KÖKTEN SİL (GÜNCELLENDİ)
@app.route('/api/rss/<int:rss_id>', methods=['DELETE'])
def delete_rss(rss_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Adım: Bu kaynağa ait skorları sil
    cursor.execute("DELETE FROM scores WHERE article_id IN (SELECT id FROM articles WHERE source_id = ?)", (rss_id,))
    
    # 2. Adım: Bu kaynağa ait haberleri sil
    cursor.execute("DELETE FROM articles WHERE source_id = ?", (rss_id,))
    
    # 3. Adım: En son kaynağın kendisini sil
    cursor.execute("DELETE FROM sources WHERE id = ?", (rss_id,))
    
    conn.commit()
    conn.close()
    return jsonify({"message": "RSS ve ilgili tüm haberler kalıcı olarak silindi"}), 200

# 5. YENİLE BUTONU (Scraping ve LLM'i Tetikler)
@app.route('/api/refresh', methods=['POST'])
def trigger_refresh():
    try:
        print("\n>>> SİSTEM YENİLEMESİ BAŞLATILDI <<<")
        
        # 1. Adım: Collector çalışır, yeni haberleri veritabanına ekler
        print("[1/2] RSS kaynakları taranıyor...")
        fetch_and_save_news()
        
        # 2. Adım: AI Processor çalışır, yeni haberleri Ollama'ya yollayıp skorlar
        print("[2/2] Yapay Zeka analiz ve skorlama işlemi yapılıyor...")
        process_news_with_adem()
        
        print(">>> YENİLEME BAŞARIYLA TAMAMLANDI <<<\n")
        return jsonify({"message": "Veriler başarıyla güncellendi ve analiz edildi."}), 200
    except Exception as e:
        print(f"\n[HATA OLUŞTU]: {str(e)}\n")
        return jsonify({"error": str(e)}), 500

# 6. TEKİL HABER SAYFASI EKLEME (Manuel İstihbarat)
@app.route('/api/add-article', methods=['POST'])
def add_single_article():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({"error": "URL boş olamaz"}), 400

    try:
        # İnternetten sayfayı çekiyoruz
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Sayfanın başlığını al (Bulamazsa varsayılan metin koy)
        title = soup.title.string if soup.title else "Başlıksız Özel Haber"
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Haberi DİREKT olarak articles tablosuna (Yapay zekanın önüne) atıyoruz!
        cursor.execute("""
            INSERT INTO articles (source_id, title, original_link, published_at_utc)
            VALUES (NULL, ?, ?, ?)
        """, (title.strip(), url, datetime.now(timezone.utc).isoformat()))
        conn.commit()
        conn.close()
        
        return jsonify({"message": "Tekil haber başarıyla eklendi!"}), 201
        
    except sqlite3.IntegrityError:
        return jsonify({"error": "Bu haber zaten sistemde kayıtlı."}), 409
    except Exception as e:
        return jsonify({"error": f"Haber okunamadı: {str(e)}"}), 500

# 7. TEKİL HABER SİLME (Kartların Üzerindeki Çöp Kutusu İçin)
@app.route('/api/news/<int:article_id>', methods=['DELETE'])
def delete_single_article(article_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Önce bu habere ait yapay zeka skorunu sil
    cursor.execute("DELETE FROM scores WHERE article_id = ?", (article_id,))
    
    # Sonra haberin kendisini sil
    cursor.execute("DELETE FROM articles WHERE id = ?", (article_id,))
    
    conn.commit()
    conn.close()
    return jsonify({"message": "Haber başarıyla silindi"}), 200


# YENİ VE GÜÇLENDİRİLMİŞ: AKILLI LİNK EKLEME
@app.route('/api/add-link', methods=['POST'])
def add_smart_link():
    data = request.json
    url = data.get('url')
    
    if not url:
        return jsonify({"error": "URL boş olamaz"}), 400

    try:
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(url, headers=headers, timeout=10)
        
        # text_content'in başındaki/sonundaki boşlukları strip() ile kesinlikle siliyoruz!
        text_content = response.text.strip().lower()
        content_type = response.headers.get('Content-Type', '').lower()
        
        conn = get_db_connection()
        cursor = conn.cursor()

        # DEDEKTİF V2: Çok daha kapsamlı RSS Taraması
        is_rss = False
        if 'xml' in content_type or 'rss' in content_type or 'atom' in content_type:
            is_rss = True
        elif text_content.startswith('<?xml'):
            is_rss = True
        elif '<rss' in text_content[:2000] or '<feed' in text_content[:2000] or '<rdf:rdf' in text_content[:2000]:
            is_rss = True

        if is_rss:
            # RSS Kaynağı -> Sources tablosuna ekle
            cursor.execute("INSERT INTO sources (url, status) VALUES (?, 'active')", (url,))
            conn.commit()
            conn.close()
            return jsonify({"message": "📡 RSS Kaynağı algılandı ve eklendi!", "type": "rss"}), 201
            
        else:
            # Tekil Haber HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            title = soup.title.string if soup.title else "Başlıksız Özel Haber"
            
            cursor.execute("""
                INSERT INTO articles (source_id, title, original_link, published_at_utc)
                VALUES (NULL, ?, ?, ?)
            """, (title.strip(), url, datetime.utcnow().isoformat()))
            conn.commit()
            conn.close()
            return jsonify({"message": "📰 Tekil Haber algılandı ve eklendi!", "type": "article"}), 201

    except sqlite3.IntegrityError:
        return jsonify({"error": "Bu link zaten sistemde kayıtlı."}), 409
    except Exception as e:
        return jsonify({"error": f"Link okunamadı: {str(e)}"}), 500


@app.route('/')
def serve_index():
    # Ana sayfaya girildiğinde index.html'i gösterir
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    # CSS ve JS dosyalarını (style.css, app.js vb.) sunar
    return send_from_directory('.', filename)



if __name__ == '__main__':
    # Bütün sistem 5000 portunda ayağa kalkar
    app.run(host='0.0.0.0', debug=True, port=5000)