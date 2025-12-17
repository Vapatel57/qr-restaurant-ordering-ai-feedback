from flask import (
    Flask, render_template, request, redirect,
    session, Response, send_file, jsonify
)
from db import get_db, init_db, close_db
from auth import login_required

import os, json, time, sqlite3, qrcode
from zipfile import ZipFile
from reportlab.pdfgen import canvas
from flask_dance.contrib.google import make_google_blueprint

# --------------------------------------------------
# CONFIG
# --------------------------------------------------

os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = Flask(__name__)
app.secret_key = "saas_qr_restaurant_secret"

init_db()
app.teardown_appcontext(close_db)

UPLOAD_FOLDER = "static/uploads"
QR_FOLDER = "static/qr"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(QR_FOLDER, exist_ok=True)

# --------------------------------------------------
# GOOGLE AUTH (optional)
# --------------------------------------------------

google_bp = make_google_blueprint(
    client_id="YOUR_GOOGLE_CLIENT_ID",
    client_secret="YOUR_GOOGLE_CLIENT_SECRET",
    scope=["profile", "email"]
)
app.register_blueprint(google_bp, url_prefix="/login")

# --------------------------------------------------
# AUTH
# --------------------------------------------------

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        user = get_db().execute(
            "SELECT * FROM users WHERE username=? AND password=?",
            (request.form["username"], request.form["password"])
        ).fetchone()

        if not user:
            return render_template(
                "login.html",
                error="Account not found or invalid password"
            )

        session["user"] = user["username"]
        session["role"] = user["role"]
        session["restaurant_id"] = user["restaurant_id"]

        if user["role"] == "superadmin":
            return redirect("/platform/restaurants")
        elif user["role"] == "admin":
            return redirect("/admin")
        else:
            return redirect("/kitchen")

    return render_template("login.html")
@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    message = None
    error = None

    if request.method == "POST":
        email = request.form["email"]

        user = get_db().execute(
            "SELECT id FROM users WHERE username=?",
            (email,)
        ).fetchone()

        if user:
            message = "Password reset instructions sent (demo mode)"
        else:
            error = "No account found with this email"

    return render_template(
        "forgot_password.html",
        message=message,
        error=error
    )


@app.route("/signup", methods=["GET", "POST"])
def signup():
    db = get_db()

    if request.method == "POST":
        email = request.form["email"]
        subdomain = request.form["subdomain"]

        # 🔴 CHECK EMAIL
        if db.execute(
            "SELECT id FROM users WHERE username=?",
            (email,)
        ).fetchone():
            return render_template(
                "signup.html",
                error="This email is already registered. Please login."
            )

        # 🔴 CHECK SUBDOMAIN
        if db.execute(
            "SELECT id FROM restaurants WHERE subdomain=?",
            (subdomain,)
        ).fetchone():
            return render_template(
                "signup.html",
                error="This subdomain is already taken."
            )

        # ✅ CREATE RESTAURANT
        db.execute("""
            INSERT INTO restaurants (name, subdomain, gstin, phone, address)
            VALUES (?,?,?,?,?)
        """, (
            request.form["restaurant_name"],
            subdomain,
            request.form.get("gstin"),
            request.form.get("phone"),
            request.form.get("address")
        ))

        restaurant_id = db.execute(
            "SELECT id FROM restaurants WHERE subdomain=?",
            (subdomain,)
        ).fetchone()["id"]

        # ✅ CREATE ADMIN USER
        db.execute("""
            INSERT INTO users (restaurant_id, username, password, role)
            VALUES (?,?,?,?)
        """, (
            restaurant_id,
            email,
            request.form["password"],
            "admin"
        ))

        db.commit()

        session["user"] = email
        session["role"] = "admin"
        session["restaurant_id"] = restaurant_id

        return redirect("/admin")

    # GET request
    return render_template("signup.html")





@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")

# --------------------------------------------------
# PLATFORM (SUPERADMIN)
# --------------------------------------------------

@app.route("/platform/restaurants")
@login_required("superadmin")
def platform_restaurants():
    rows = get_db().execute("""
        SELECT r.id, r.name, r.subdomain,
               COUNT(o.id) AS total_orders,
               IFNULL(SUM(o.total),0) AS total_revenue
        FROM restaurants r
        LEFT JOIN orders o ON r.id=o.restaurant_id
        GROUP BY r.id
        ORDER BY r.id DESC
    """).fetchall()

    return render_template(
        "platform_restaurants.html",
        restaurants=[dict(r) for r in rows]
    )

# --------------------------------------------------
# CUSTOMER
# --------------------------------------------------

@app.route("/customer/<restaurant>")
def customer(restaurant):
    db = get_db()
    r = db.execute(
        "SELECT * FROM restaurants WHERE subdomain=?",
        (restaurant,)
    ).fetchone()

    if not r:
        return "Restaurant not found", 404

    menu = db.execute(
        "SELECT * FROM menu WHERE restaurant_id=? AND available=1",
        (r["id"],)
    ).fetchall()

    return render_template(
        "customer.html",
        menu=[dict(m) for m in menu],
        restaurant_name=r["name"],
        restaurant_id=r["id"],
        table=request.args.get("table")
    )


@app.route("/order", methods=["POST"])
def place_order():
    data = request.get_json()
    items = data["items"]

    total = sum(i["price"] * i["qty"] for i in items)

    get_db().execute("""
        INSERT INTO orders
        (restaurant_id, table_no, items, total, status, created_at)
        VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)
    """, (
        data["restaurant_id"],
        data["table"],
        json.dumps(items),
        total,
        "Received"
    ))

    get_db().commit()
    return jsonify({"success": True})

# --------------------------------------------------
# ADMIN & KITCHEN
# --------------------------------------------------

@app.route("/admin")
@login_required(["admin", "superadmin"])
def admin():
    return render_template("admin.html")



@app.route("/kitchen")
@login_required("kitchen")
def kitchen():
    return render_template("kitchen.html")

# ====== ADMIN PROFILE ========#
@app.route("/admin/profile", methods=["GET", "POST"])
@login_required("admin")
def admin_profile():
    db = get_db()
    rid = session["restaurant_id"]

    if request.method == "POST":
        db.execute("""
            UPDATE restaurants
            SET name = ?, gstin = ?
            WHERE id = ?
        """, (
            request.form["name"],
            request.form["gstin"],
            rid
        ))
        db.commit()

        return redirect("/admin/profile")

    restaurant = db.execute(
        "SELECT name, gstin FROM restaurants WHERE id=?",
        (rid,)
    ).fetchone()

    return render_template(
        "admin_profile.html",
        restaurant=restaurant,
        email=session["user"]
    )

# ============ KITCHEN USERS =========== #

# ================= KITCHEN USERS (ADMIN) =================

@app.route("/admin/kitchen-users")
@login_required("admin")
def kitchen_users():
    db = get_db()
    users = db.execute("""
        SELECT id, username
        FROM users
        WHERE restaurant_id=? AND role='kitchen'
        ORDER BY id DESC
    """, (session["restaurant_id"],)).fetchall()

    return render_template(
        "kitchen_users.html",
        users=[dict(u) for u in users]
    )


@app.route("/api/kitchen-users", methods=["POST"])
@login_required("admin")
def create_kitchen_user():
    data = request.get_json()
    print("KITCHEN USER PAYLOAD:", data)  # 🔥 DEBUG LINE

    if not data:
        return jsonify({"error": "No JSON received"}), 400

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email/password required"}), 400

    db = get_db()
    db.execute("""
        INSERT INTO users (restaurant_id, username, password, role)
        VALUES (?, ?, ?, 'kitchen')
    """, (session["restaurant_id"], email, password))
    db.commit()

    return jsonify({"success": True})


@app.route("/api/kitchen-users/<int:user_id>", methods=["DELETE"])
@login_required("admin")
def delete_kitchen_user(user_id):
    db = get_db()
    db.execute("""
        DELETE FROM users
        WHERE id=? AND role='kitchen' AND restaurant_id=?
    """, (user_id, session["restaurant_id"]))
    db.commit()

    return jsonify({"success": True})


# --------------------------------------------------
# MENU MANAGEMENT
# --------------------------------------------------

@app.route("/menu")
@login_required("admin")
def menu_page():
    return render_template("menu.html")


@app.route("/api/menu")
@login_required("admin")
def api_get_menu():
    rows = get_db().execute("""
        SELECT * FROM menu
        WHERE restaurant_id=?
        ORDER BY id DESC
    """, (session["restaurant_id"],)).fetchall()

    return jsonify([dict(r) for r in rows])


@app.route("/api/menu", methods=["POST"])
@login_required("admin")
def api_add_menu():
    image = request.files.get("image")
    if not image:
        return jsonify({"error": "Image required"}), 400

    filename = f"{int(time.time())}_{image.filename}"
    path = os.path.join(UPLOAD_FOLDER, filename)
    image.save(path)

    get_db().execute("""
        INSERT INTO menu
        (restaurant_id, name, price, category, image, available)
        VALUES (?,?,?,?,?,1)
    """, (
        session["restaurant_id"],
        request.form["name"],
        request.form["price"],
        request.form["category"],
        path
    ))

    get_db().commit()
    return jsonify({"success": True})


@app.route("/api/menu/toggle/<int:item_id>", methods=["POST"])
@login_required("admin")
def toggle_menu(item_id):
    get_db().execute("""
        UPDATE menu
        SET available = CASE available WHEN 1 THEN 0 ELSE 1 END
        WHERE id=? AND restaurant_id=?
    """, (item_id, session["restaurant_id"]))
    get_db().commit()
    return jsonify({"success": True})


@app.route("/api/menu/<int:item_id>", methods=["DELETE"])
@login_required("admin")
def delete_menu(item_id):
    get_db().execute(
        "DELETE FROM menu WHERE id=? AND restaurant_id=?",
        (item_id, session["restaurant_id"])
    )
    get_db().commit()
    return jsonify({"success": True})

# --------------------------------------------------
# ORDER STATUS
# --------------------------------------------------

@app.route("/api/order/<int:order_id>/status", methods=["POST"])
@login_required(["admin", "kitchen"])
def update_order_status(order_id):
    status = request.json.get("status")

    if status not in ["Preparing", "Ready", "Served"]:
        return jsonify({"error": "Invalid status"}), 400

    get_db().execute("""
        UPDATE orders SET status=?
        WHERE id=? AND restaurant_id=?
    """, (status, order_id, session["restaurant_id"]))

    get_db().commit()
    return jsonify({"success": True})

# --------------------------------------------------
# QR GENERATION
# --------------------------------------------------

@app.route("/admin/qr")
@login_required(["admin", "superadmin"])
def admin_qr():
    return render_template("qr_auto.html")


@app.route("/generate_qr/<int:table_no>")
@login_required("admin")
def generate_single_qr(table_no):
    r = get_db().execute(
        "SELECT subdomain FROM restaurants WHERE id=?",
        (session["restaurant_id"],)
    ).fetchone()

    qr_dir = f"{QR_FOLDER}/{r['subdomain']}"
    os.makedirs(qr_dir, exist_ok=True)

    qr_path = f"{qr_dir}/table_{table_no}.png"
    url = f"http://127.0.0.1:5000/customer/{r['subdomain']}?table={table_no}"

    qrcode.make(url).save(qr_path)

    return jsonify({"success": True, "qr": f"/{qr_path}"})


@app.route("/admin/qr/auto", methods=["POST"])
@login_required("admin")
def auto_generate_qr():
    count = int(request.form["table_count"])

    r = get_db().execute(
        "SELECT subdomain FROM restaurants WHERE id=?",
        (session["restaurant_id"],)
    ).fetchone()

    qr_dir = f"{QR_FOLDER}/{r['subdomain']}"
    os.makedirs(qr_dir, exist_ok=True)

    zip_path = f"{qr_dir}/table_qrs.zip"

    with ZipFile(zip_path, "w") as zipf:
        for t in range(1, count + 1):
            url = f"http://127.0.0.1:5000/customer/{r['subdomain']}?table={t}"
            img = f"{qr_dir}/table_{t}.png"
            qrcode.make(url).save(img)
            zipf.write(img, os.path.basename(img))

    return jsonify({"success": True, "zip": f"/{zip_path}"})

# --------------------------------------------------
# BILLING
# --------------------------------------------------

@app.route("/bill/<int:order_id>")
@login_required("admin")
def bill(order_id):
    db = get_db()

    order = db.execute("""
        SELECT o.*, r.name AS restaurant_name
        FROM orders o
        JOIN restaurants r ON o.restaurant_id = r.id
        WHERE o.id=? AND o.restaurant_id=?
    """, (order_id, session["restaurant_id"])).fetchone()

    if not order:
        return "Order not found", 404

    items = json.loads(order["items"])
    subtotal = sum(i["price"] * i["qty"] for i in items)
    gst = round(subtotal * 0.05, 2)
    total = round(subtotal + gst, 2)

    # PDF download
    if request.args.get("pdf"):
        filename = f"bill_{order_id}.pdf"
        c = canvas.Canvas(filename)
        c.drawString(100, 780, order["restaurant_name"])
        c.drawString(100, 760, f"Table: {order['table_no']}")

        y = 720
        for i in items:
            c.drawString(
                100, y,
                f"{i['name']} x {i['qty']} = ₹{i['price'] * i['qty']}"
            )
            y -= 20

        c.drawString(100, y - 20, f"Total: ₹{total}")
        c.save()

        return send_file(filename, as_attachment=True)

    return render_template(
        "bill.html",
        order=order,
        items=items,
        subtotal=subtotal,
        gst=gst,
        total=total,
        restaurant_name=order["restaurant_name"]
    )


# --------------------------------------------------
# SSE (ORDERS + REVENUE)
# --------------------------------------------------

@app.route("/events")
@login_required(["admin", "kitchen"])
def events():
    rid = session["restaurant_id"]

    def stream():
        while True:
            conn = sqlite3.connect("restaurant.db")
            conn.row_factory = sqlite3.Row

            orders = conn.execute(
                "SELECT * FROM orders WHERE restaurant_id=? ORDER BY id DESC",
                (rid,)
            ).fetchall()

            revenue = conn.execute("""
                SELECT IFNULL(SUM(total),0) AS revenue
                FROM orders
                WHERE restaurant_id=?
                AND status='Served'
                AND created_at >= datetime('now','start of day','localtime')
            """, (rid,)).fetchone()["revenue"]

            conn.close()

            payload = {
                "orders": [dict(o) for o in orders],
                "today_revenue": revenue
            }

            yield f"data:{json.dumps(payload)}\n\n"
            time.sleep(2)

    return Response(stream(), mimetype="text/event-stream")

# --------------------------------------------------
# ROOT
# --------------------------------------------------

@app.route("/")
def home():
    return redirect("/login")

# --------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)

