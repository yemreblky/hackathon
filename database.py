import sqlite3

def init_db():
    conn = sqlite3.connect('hackathon.db')
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            publisher TEXT,
            url TEXT UNIQUE NOT NULL,
            language TEXT,
            status TEXT DEFAULT 'active'
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id INTEGER,
            title TEXT,
            original_link TEXT UNIQUE,
            published_at_utc TEXT,
            text_summary_tr TEXT,
            event_type TEXT,
            company_name TEXT,
            sector TEXT,
            from_location TEXT,
            to_location TEXT,
            raw_hash TEXT,
            FOREIGN KEY(source_id) REFERENCES sources(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            article_id INTEGER,
            score INTEGER,
            score_confidence REAL,
            rationale_tr TEXT,
            recommended_action TEXT,
            FOREIGN KEY(article_id) REFERENCES articles(id)
        )
    ''')

    conn.commit()
    conn.close()
    print("Veritabanı hazır!")

if __name__ == '__main__':
    init_db()