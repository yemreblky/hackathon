import sqlite3
import feedparser
from datetime import datetime

import sqlite3
import feedparser
from datetime import datetime

def add_real_sources():
    conn = sqlite3.connect('hackathon.db')
    cursor = conn.cursor()
    
    # Jürinin görmek istediği o yüksek skorlu haberleri getirecek altın kaynaklar
    sources = [
        # 1. Kaynak: Google News'in sadece "Fabrika ve Taşınma" kelimelerini arayan özel RSS'i (En yüksek skorlar buradan gelir)
        ('Google News - Industrial', 'https://news.google.com/rss/search?q=factory+relocation+OR+new+plant+OR+manufacturing+expansion+when:7d&hl=en-US&gl=US&ceid=US:en', 'EN'),
        
        # 2. Kaynak: Gerçek üretim ve sanayi haberleri
        ('Manufacturing.net', 'https://www.manufacturing.net/rss', 'EN'),
        
        # 3. Kaynak: Otomotiv sektörü (Volkswagen, Ford gibi devlerin haberleri)
        ('Automotive News', 'https://www.autonews.com/rss/all', 'EN'),


        ("Capital", "https://www.capital.com.tr/haberler/tum-haberler/manisada-bir-yabanci-sirket-daha-yeni-fabrika-kuruyor", 'TR')
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
    print("Gerçek endüstriyel kaynaklar veritabanına eklendi!")

def fetch_and_save_news():
    conn = sqlite3.connect('hackathon.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, url, publisher FROM sources WHERE status='active'")
    sources = cursor.fetchall()
    
    toplam_yeni_haber = 0
    
    for source in sources:
        source_id, feed_url, publisher = source
        print(f"Bağlanılıyor: {publisher}...")
        
        parsed_feed = feedparser.parse(feed_url)
        yeni_haber_sayisi = 0
        
        # Çok fazla haber çekip Adem'in bilgisayarını boğmamak için her kaynaktan sadece ilk 10 haberi alıyoruz
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
                pass # Aynı haber varsa atla
                
        print(f"-> {publisher} kaynağından {yeni_haber_sayisi} taze fırsat çekildi.")
        conn.commit()
        
    conn.close()
    print(f"\nTOPLAM {toplam_yeni_haber} YENİ SANAYİ HABERİ VERİTABANINDA HAZIR!")

if __name__ == '__main__':
    add_real_sources()
    fetch_and_save_news()
def fetch_and_save_news():
    conn = sqlite3.connect('hackathon.db')
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, url, publisher FROM sources WHERE status='active'")
    sources = cursor.fetchall()
    
    for source in sources:
        source_id, feed_url, publisher = source
        print(f"Bağlanılıyor: {publisher}...")
        
        parsed_feed = feedparser.parse(feed_url)
        yeni_haber_sayisi = 0
        
        for entry in parsed_feed.entries:
            title = entry.title
            link = entry.link
            pub_date = entry.get('published', datetime.utcnow().isoformat())
            
            try:
                cursor.execute("""
                    INSERT INTO articles (source_id, title, original_link, published_at_utc)
                    VALUES (?, ?, ?, ?)
                """, (source_id, title, link, pub_date))
                yeni_haber_sayisi += 1
            except sqlite3.IntegrityError:
                pass # Aynı haber varsa atla (Dedup)
                
        conn.commit()
        print(f"DB'ye {yeni_haber_sayisi} YENİ haber kaydedildi.")
        
    conn.close()

if __name__ == '__main__':
    add_real_sources()
    fetch_and_save_news()