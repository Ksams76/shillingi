import os
import sqlite3
from flask import Flask, jsonify, request, send_from_directory, abort

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, 'ledger.db')

app = Flask(__name__, static_folder=None)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Creates the database and tables if they do not exist."""
    conn = get_db_connection()
    conn.execute(
        '''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            date TEXT NOT NULL,
            notes TEXT,
            timestamp TEXT NOT NULL
        )
        '''
    )
    conn.commit()
    conn.close()

# 🔥 FIX: This ensures the database is initialized immediately when Flask starts
with app.app_context():
    init_db()


@app.route('/api/ping', methods=['GET'])
def ping():
    return jsonify({'status': 'ok'})


@app.route('/api/transactions', methods=['GET', 'POST', 'DELETE'])
def transactions():
    if request.method == 'GET':
        conn = get_db_connection()
        rows = conn.execute('SELECT * FROM transactions ORDER BY date DESC, id DESC').fetchall()

        #rows = conn.execute('SELECT * VALUES FROM transactions ORDER BY date DESC, id DESC').fetchall()
        conn.close()
        return jsonify([dict(row) for row in rows])

    if request.method == 'POST':
        data = request.get_json(force=True)
        if not data:
            abort(400, 'Missing transaction data')

        required_fields = ['type', 'description', 'amount', 'category', 'date']
        for field in required_fields:
            if field not in data:
                abort(400, f'Missing field: {field}')

        conn = get_db_connection()
        cursor = conn.execute(
            'INSERT INTO transactions (type, description, amount, category, date, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (
                data['type'],
                data['description'],
                float(data['amount']),
                data['category'],
                data['date'],
                data.get('notes', ''),
                data.get('timestamp') or request.headers.get('Date') or '',
            )
        )
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': new_id}), 201

    if request.method == 'DELETE':
        conn = get_db_connection()
        conn.execute('DELETE FROM transactions')
        conn.commit()
        conn.close()
        return jsonify({'status': 'cleared'})


@app.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
def delete_transaction(transaction_id):
    conn = get_db_connection()
    conn.execute('DELETE FROM transactions WHERE id = ?', (transaction_id,))
    conn.commit()
    conn.close()
    return jsonify({'status': 'deleted'})


@app.route('/', methods=['GET'])
def index():
    # Make sure index.html exists in your main project folder
    if not os.path.exists(os.path.join(BASE_DIR, 'index.html')):
        return "Missing index.html file in project root folder", 404
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/<path:path>', methods=['GET'])
def serve_file(path):
    # Security check to prevent exposure of system/database files
    if path.startswith('api/') or path.endswith('.py') or path.endswith('.db') or '.venv' in path:
        abort(404)
    return send_from_directory(BASE_DIR, path)


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)













# import os
# import sqlite3
# from flask import Flask, jsonify, request, send_from_directory, abort

# BASE_DIR = os.path.abspath(os.path.dirname(__file__))
# DB_PATH = os.path.join(BASE_DIR, 'ledger.db')

# app = Flask(__name__, static_folder=None)


# def get_db_connection():
#     conn = sqlite3.connect(DB_PATH)
#     conn.row_factory = sqlite3.Row
#     return conn


# def init_db():
#     conn = get_db_connection()
#     conn.execute(
#         '''
#         CREATE TABLE IF NOT EXISTS transactions (
#             id INTEGER PRIMARY KEY AUTOINCREMENT,
#             type TEXT NOT NULL,
#             description TEXT NOT NULL,
#             amount REAL NOT NULL,
#             category TEXT NOT NULL,
#             date TEXT NOT NULL,
#             notes TEXT,
#             timestamp TEXT NOT NULL
#         )
#         '''
#     )
#     conn.commit()
#     conn.close()


# @app.route('/api/ping', methods=['GET'])
# def ping():
#     return jsonify({'status': 'ok'})


# @app.route('/api/transactions', methods=['GET', 'POST', 'DELETE'])
# def transactions():
#     if request.method == 'GET':
#         conn = get_db_connection()
#         rows = conn.execute('SELECT * FROM transactions ORDER BY date DESC, id DESC').fetchall()
#         conn.close()
#         return jsonify([dict(row) for row in rows])

#     if request.method == 'POST':
#         data = request.get_json(force=True)
#         if not data:
#             abort(400, 'Missing transaction data')

#         required_fields = ['type', 'description', 'amount', 'category', 'date']
#         for field in required_fields:
#             if field not in data:
#                 abort(400, f'Missing field: {field}')

#         conn = get_db_connection()
#         cursor = conn.execute(
#             'INSERT INTO transactions (type, description, amount, category, date, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
#             (
#                 data['type'],
#                 data['description'],
#                 float(data['amount']),
#                 data['category'],
#                 data['date'],
#                 data.get('notes', ''),
#                 data.get('timestamp') or request.headers.get('Date') or '',
#             )
#         )
#         conn.commit()
#         new_id = cursor.lastrowid
#         conn.close()
#         return jsonify({'id': new_id}), 201

#     if request.method == 'DELETE':
#         conn = get_db_connection()
#         conn.execute('DELETE FROM transactions')
#         conn.commit()
#         conn.close()
#         return jsonify({'status': 'cleared'})


# @app.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
# def delete_transaction(transaction_id):
#     conn = get_db_connection()
#     conn.execute('DELETE FROM transactions WHERE id = ?', (transaction_id,))
#     conn.commit()
#     conn.close()
#     return jsonify({'status': 'deleted'})


# @app.route('/', methods=['GET'])
# def index():
#     return send_from_directory(BASE_DIR, 'index.html')


# @app.route('/<path:path>', methods=['GET'])
# def serve_file(path):
#     if path.startswith('api/') or path.endswith('.py') or path.endswith('.db'):
#         abort(404)
#     return send_from_directory(BASE_DIR, path)


# if __name__ == '__main__':
#     init_db()
#     app.run(host='127.0.0.1', port=5000, debug=True)
