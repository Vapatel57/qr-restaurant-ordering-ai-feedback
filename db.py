import sqlite3
import os
from flask import g

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "restaurant.db")

# ---------------- DB CONNECTION ----------------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(
            DB_PATH,
            timeout=10,
            check_same_thread=False
        )
        g.db.row_factory = sqlite3.Row

        # WAL mode for concurrency
        g.db.execute("PRAGMA journal_mode=WAL;")
        g.db.execute("PRAGMA synchronous=NORMAL;")

    return g.db


# ---------------- CLOSE CONNECTION ----------------
def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


# ---------------- INIT DB ----------------
def init_db():
    db = sqlite3.connect(DB_PATH)
    c = db.cursor()

    # ================= RESTAURANTS =================
    c.execute("""
    CREATE TABLE IF NOT EXISTS restaurants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subdomain TEXT UNIQUE NOT NULL,
        gstin TEXT,
        address TEXT,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # ================= USERS =================
    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    )
    """)

    # ================= MENU =================
    c.execute("""
    CREATE TABLE IF NOT EXISTS menu (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT,
        image TEXT,
        available INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    )
    """)

    # ================= ORDERS =================
    c.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id INTEGER NOT NULL,
        table_no INTEGER,
        items TEXT,
        total REAL,
        status TEXT DEFAULT 'Received',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    )
    """)

    # ================= ORDER ADDITIONS (🔥 REQUIRED) =================
    c.execute("""
    CREATE TABLE IF NOT EXISTS order_additions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        restaurant_id INTEGER NOT NULL,
        table_no INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        qty INTEGER NOT NULL,
        price REAL NOT NULL,
        status TEXT DEFAULT 'New',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
    )
    """)

    # ================= INDEXES (PERFORMANCE) =================
    c.execute("CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_additions_restaurant ON order_additions(restaurant_id)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_additions_status ON order_additions(status)")

    db.commit()
    db.close()
