const ordersContainer = document.getElementById("orders-container");
const additionsContainer = document.getElementById("additions");
const pendingCount = document.getElementById("pending-count");

let lastOrders = [];
const updatingOrders = new Set();

/* ===============================
   NORMAL ORDERS (FROM /events)
================================ */
function renderOrders(orders) {
    ordersContainer.innerHTML = "";

    const active = orders.filter(o => o.status !== "Served");
    pendingCount.innerText = active.length;

    if (active.length === 0) {
        ordersContainer.innerHTML = `
            <div class="text-gray-400 text-xl">
                No active orders 👨‍🍳
            </div>
        `;
        return;
    }

    active.forEach(o => {
        const items = JSON.parse(o.items)
            .map(i => `${i.qty} × ${i.name}`)
            .join("<br>");

        const nextStatus =
            o.status === "Received" ? "Preparing" :
            o.status === "Preparing" ? "Ready" :
            "Served";

        ordersContainer.innerHTML += `
            <div class="bg-white text-gray-900 w-80 rounded-xl shadow-xl border-t-8 border-blue-500">
                <div class="p-4 border-b">
                    <h2 class="text-3xl font-black">TABLE ${o.table_no}</h2>
                    <p class="text-xs text-gray-400">ORDER #${o.id}</p>
                </div>

                <div class="p-4 text-sm">${items}</div>

                <div class="p-4 bg-gray-50">
                    <button
                        onclick="updateStatus(${o.id}, '${nextStatus}')"
                        class="w-full py-3 rounded-lg font-bold text-white bg-emerald-600">
                        Mark as ${nextStatus}
                    </button>
                </div>
            </div>
        `;
    });
}

/* ===============================
   ORDER STATUS UPDATE
================================ */
async function updateStatus(orderId, status) {
    if (updatingOrders.has(orderId)) return;

    updatingOrders.add(orderId);

    await fetch(`/api/order/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    });

    updatingOrders.delete(orderId);
}

/* ===============================
   SSE – ONLY NORMAL ORDERS
================================ */
const source = new EventSource("/events");

source.onmessage = (event) => {
    const data = JSON.parse(event.data);
    lastOrders = data.orders;
    renderOrders(lastOrders);
};

/* ===============================
   🔥 NEW ITEM ADDITIONS (POLLING)
================================ */
function loadAdditions() {
    fetch("/api/kitchen/additions")
        .then(res => res.json())
        .then(additions => {
            additionsContainer.innerHTML = "";

            if (additions.length === 0) {
                additionsContainer.innerHTML = `
                    <p class="text-gray-400">No new additions</p>
                `;
                return;
            }

            additions.forEach(a => {
                additionsContainer.innerHTML += `
                    <div class="bg-red-600 text-white p-4 rounded-lg mb-3">
                        <h3 class="font-black text-lg">
                            TABLE ${a.table_no} – ADD ITEM
                        </h3>
                        <p class="text-sm mt-1">
                            ${a.qty} × ${a.item_name}
                        </p>

                        <button
                            onclick="markAdditionDone(${a.id})"
                            class="mt-3 bg-black px-4 py-2 rounded text-sm">
                            Mark Preparing
                        </button>
                    </div>
                `;
            });
        });
}

function markAdditionDone(id) {
    fetch(`/api/kitchen/addition/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Preparing" })
    }).then(loadAdditions);
}

/* 🔁 Poll every 3 seconds */
setInterval(loadAdditions, 3000);

/* Initial load */
loadAdditions();
