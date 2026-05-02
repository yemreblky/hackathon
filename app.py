from flask import Flask, jsonify
import sqlite3

app = Flask(__name__)

@app.route('/api/news', methods=['GET'])
def get_news():
    conn = sqlite3.connect('hackathon.db')
    conn.row_factory = sqlite3.Row 
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM articles")
    haberler = [dict(row) for row in cursor.fetchall()]
    
    conn.close()
    return jsonify(haberler) 

if __name__ == '__main__':
    # host='0.0.0.0' kodu aynı ağdaki cihazlara kapıyı açar
    app.run(host='0.0.0.0', debug=True, port=5000)