const container = document.getElementById("orders-container");
const pendingCount = document.getElementById("pending-count");

// Prevent double clicks
const updatingOrders = new Set();

// Cache last server state
let lastOrders = [];

function renderOrders(orders) {
    container.innerHTML = "";

    const active = orders.filter(o => o.status !== "Served");
    pendingCount.innerText = active.length;

    if (active.length === 0) {
        container.innerHTML = `
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

        const statusColor = {
            "Received": "border-blue-500 text-blue-600 bg-blue-100",
            "Preparing": "border-orange-500 text-orange-600 bg-orange-100",
            "Ready": "border-green-500 text-green-600 bg-green-100"
        }[o.status] || "border-gray-500";

        const nextStatus =
            o.status === "Received" ? "Preparing" :
            o.status === "Preparing" ? "Ready" :
            "Served";

        const disabled = updatingOrders.has(o.id);

        container.innerHTML += `
            <div class="bg-white text-gray-900 w-80 rounded-xl shadow-xl
                        border-t-8 ${statusColor.split(" ")[0]} flex flex-col">

                <div class="p-4 border-b flex justify-between">
                    <div>
                        <h2 class="text-3xl font-black">TABLE ${o.table_no}</h2>
                        <p class="text-xs text-gray-400">ORDER #${o.id}</p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-bold ${statusColor}">
                        ${o.status}
                    </span>
                </div>

                <div class="p-4 flex-1 text-sm">
                    ${items}
                </div>

                <div class="p-4 bg-gray-50">
                    <button
                        ${disabled ? "disabled" : ""}
                        onclick="updateStatus(${o.id}, '${nextStatus}')"
                        class="w-full py-3 rounded-lg font-bold text-white transition
                            ${disabled
                                ? "bg-gray-400 cursor-not-allowed"
                                : nextStatus === "Preparing"
                                ? "bg-orange-500 hover:bg-orange-600"
                                : nextStatus === "Ready"
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-gray-700"}">
                        ${disabled ? "Updating..." : `Mark as ${nextStatus}`}
                    </button>
                </div>
            </div>
        `;
    });
}

async function updateStatus(orderId, status) {
    if (updatingOrders.has(orderId)) return;

    updatingOrders.add(orderId);
    renderOrders(lastOrders); // optimistic lock

    try {
        const res = await fetch(`/api/order/${orderId}/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status })
        });

        if (!res.ok) throw new Error("Failed");

    } catch (err) {
        alert("⚠️ Failed to update order");
        updatingOrders.delete(orderId);
        renderOrders(lastOrders);
    }
}

/* 🔴 LIVE SSE */
const source = new EventSource("/events");

source.onmessage = (event) => {
    const data = JSON.parse(event.data);

    lastOrders = data.orders;   // ✅ FIX
    updatingOrders.clear();
    renderOrders(lastOrders);
};

source.onerror = () => {
    console.warn("SSE disconnected. Retrying…");
};
