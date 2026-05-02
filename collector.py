import sqlite3
import feedparser
import requests # Sitelerin güvenlik duvarını aşmak için bu kütüphaneyi ekledik
from datetime import datetime

def add_real_sources():
    conn = sqlite3.connect('hackathon.db')
    cursor = conn.cursor()
    
    # DÜZELTİLMİŞ VE GARANTİLİ ÇALIŞAN RSS LİNKLERİ
    sources = [
        #('Google News - Industrial', 'https://news.google.com/rss/search?q=factory+relocation+OR+new+plant+OR+manufacturing+expansion+when:7d&hl=en-US&gl=US&ceid=US:en', 'EN'),
        # 1. CNBC Business (Bot koruması yoktur, dev yatırımları ilk onlar yazar)
        #('CNBC Business', 'https://search.cnbc.com/rs/search/combinedcms/view.xml?profile=12000000&id=10000115', 'EN'),
        
        # 2. Supply Chain Brain (Tedarik zinciri, fabrika taşınmaları ve lojistik haberleri - Açık RSS)
        #('Supply Chain Brain', 'https://www.supplychainbrain.com/rss', 'EN'),
        
        # 3. NTV Ekonomi (Türkiye'deki yerel fabrika ve ekonomi haberleri için sağlam kaynak)
        #('NTV Ekonomi', 'https://www.ntv.com.tr/ekonomi.rss', 'TR'),
        
        # 4. PR Newswire Endüstri (Şirketlerin "Yeni fabrika açıyoruz" diye resmi basın bülteni attığı yer!)
        #('PR Newswire Industrial', 'https://www.prnewswire.com/rss/industrial-metals-news.rss', 'EN')
    ]
    
    for publisher, url, lang in sources:
        try:
            cursor.execute("""
                INSERT INTO sources (publisher, url, language) 
                VALUES (?, ?, ?)
            """, (publisher, url, lang))
        except sqlite3.IntegrityError:
            pass 
            
    conn.commit()
    conn.close()

def fetch_and_save_news():
    conn = sqlite3.connect('hackathon.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, url, publisher FROM sources WHERE status='active'")
    sources = cursor.fetchall()
    
    # BOT KORUMASINI AŞMAK İÇİN KILIK DEĞİŞTİRME (Sahte Google Chrome Kimliği)
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    toplam_yeni_haber = 0
    
    for source in sources:
        source_id, feed_url, publisher = source
        print(f"Bağlanılıyor: {publisher}...")
        
        try:
            # 1. Siteye Chrome tarayıcısı gibi istek atıyoruz
            response = requests.get(feed_url, headers=headers, timeout=10)
            
            # 2. Aldığımız izni (XML metnini) feedparser'a okutuyoruz
            parsed_feed = feedparser.parse(response.content)
            yeni_haber_sayisi = 0
            
            for entry in parsed_feed.entries[:10]:
                title = entry.title
                link = entry.link
                pub_date = entry.get('published', datetime.utcnow().isoformat())
                
                try:
                    cursor.execute("""
                        INSERT INTO articles (source_id, title, original_link, published_at_utc)
                        VALUES (?, ?, ?, ?)
                    """, (source_id, title, link, pub_date))
                    yeni_haber_sayisi += 1
                    toplam_yeni_haber += 1
                except sqlite3.IntegrityError:
                    pass # Zaten DB'de varsa sessizce atla
                    
            print(f"-> {publisher}: {yeni_haber_sayisi} taze fırsat çekildi.")
            conn.commit()
            
        except Exception as e:
            print(f"-> [HATA] {publisher} kaynağından veri çekilemedi: {e}")
            
    conn.close()
    print(f"\nTOPLAM {toplam_yeni_haber} YENİ SANAYİ HABERİ VERİTABANINDA HAZIR!")

if __name__ == '__main__':
    add_real_sources()
    fetch_and_save_news()