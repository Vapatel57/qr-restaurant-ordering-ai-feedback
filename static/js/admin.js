const tableBody = document.getElementById("order-table-body");
const orderCount = document.getElementById("order-count");
const pendingCount = document.getElementById("pending-count");
const revenueEl = document.getElementById("today-revenue");

/* =========================
   GLOBAL STATE
========================= */
let currentOrderId = null;
let menuCache = [];

/* =========================
   RENDER TODAY ORDERS
========================= */
function renderOrders(orders) {
    tableBody.innerHTML = "";
    orderCount.innerText = orders.length;

    let pending = 0;

    orders.forEach(o => {
        if (o.status !== "Served") pending++;

        const items = JSON.parse(o.items)
            .map(i => `${i.qty}× ${i.name}`)
            .join(", ");

        const statusColor = {
            "Received": "bg-blue-100 text-blue-700",
            "Preparing": "bg-orange-100 text-orange-700",
            "Ready": "bg-green-100 text-green-700",
            "Served": "bg-gray-200 text-gray-600"
        }[o.status] || "bg-gray-100";

        tableBody.innerHTML += `
            <tr class="border-b hover:bg-gray-50">
                <td class="p-4 font-bold">Table ${o.table_no}</td>
                <td class="p-4">${items}</td>
                <td class="p-4 font-semibold">₹${o.total}</td>
                <td class="p-4">
                    <span class="${statusColor} px-3 py-1 rounded-full text-xs font-bold">
                        ${o.status}
                    </span>
                </td>
                <td class="p-4 flex flex-wrap gap-2">
                    <button onclick="updateStatus(${o.id}, 'Preparing')"
                        class="bg-gray-800 text-white px-3 py-1 rounded text-sm">
                        Update
                    </button>

                    <button
      onclick="location.href='/menu?add_to_order=${o.id}&table=${o.table_no}'"
      class="bg-blue-600 text-white px-3 py-1 rounded text-sm">
      + Item
    </button>

                    <a href="/bill/${o.id}"
                       class="bg-emerald-600 text-white px-3 py-1 rounded text-sm">
                        Bill
                    </a>

                    <a href="/bill/${o.id}/thermal"
                       target="_blank"
                       title="Print Thermal Bill"
                       class="inline-flex items-center justify-center
                              w-9 h-9 rounded bg-black text-white">
                        <i class="fas fa-print text-xs"></i>
                    </a>
                </td>
            </tr>
        `;
    });

    pendingCount.innerText = pending;
}

/* =========================
   UPDATE ORDER STATUS
========================= */
function updateStatus(orderId, status) {
    fetch(`/api/order/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    });
}

/* =========================
   ADD ITEM TO ORDER (ADMIN)
========================= */
function openAddItem(orderId) {
    currentOrderId = orderId;

    fetch("/api/menu")
        .then(res => res.json())
        .then(menu => {
            menuCache = menu;

            const select = document.getElementById("add-item-select");
            select.innerHTML = "";

            menu.forEach(item => {
                if (item.available) {
                    select.innerHTML += `
                        <option value="${item.id}">
                            ${item.name} – ₹${item.price}
                        </option>
                    `;
                }
            });

            document.getElementById("add-item-qty").value = 1;
            document.getElementById("add-item-modal").classList.remove("hidden");
        });
}

function closeAddItem() {
    document.getElementById("add-item-modal").classList.add("hidden");
}

function confirmAddItem() {
    const itemId = document.getElementById("add-item-select").value;
    const qty = parseInt(document.getElementById("add-item-qty").value);

    if (!itemId || qty < 1) return alert("Invalid item");

    fetch("/api/order/add-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            order_id: currentOrderId,
            item_id: itemId,
            qty: qty
        })
    }).then(() => {
        closeAddItem();
    });
}

/* =========================
   SSE – TODAY ONLY
========================= */
const source = new EventSource("/events");

source.onmessage = (event) => {
    const data = JSON.parse(event.data);
    renderOrders(data.orders);
    revenueEl.innerText = `₹${data.today_revenue}`;
};

source.onerror = () => {
    console.warn("SSE disconnected");
};

/* =========================
   PAST DAYS HISTORY
========================= */
function openHistory() {
    document.getElementById("history-modal").classList.remove("hidden");
}

function closeHistory() {
    document.getElementById("history-modal").classList.add("hidden");
}

function loadHistory() {
    const date = document.getElementById("history-date").value;
    if (!date) return alert("Select a date");

    fetch(`/admin/orders/by-date?date=${date}`)
        .then(res => res.json())
        .then(data => {
            let html = `
                <p><b>Total Orders:</b> ${data.count}</p>
                <p><b>Revenue:</b> ₹${data.revenue}</p>
                <hr class="my-2">
            `;

            data.orders.forEach(o => {
                html += `
                    <p>#${o.id} | Table ${o.table_no} | ₹${o.total} | ${o.status}</p>
                `;
            });

            document.getElementById("history-result").innerHTML = html;
        });
}
