const tableBody = document.getElementById("order-table-body");
const orderCount = document.getElementById("order-count");
const pendingCount = document.getElementById("pending-count");
const revenueEl = document.getElementById("today-revenue");

function renderOrders(orders) {
    tableBody.innerHTML = "";
    orderCount.innerText = orders.length;

    let pending = 0;

    orders.forEach(o => {
        if (o.status !== "Served") pending++;

        const items = JSON.parse(o.items)
            .map(i => `${i.qty}x ${i.name}`)
            .join(", ");

        const statusColor = {
            "Received": "bg-blue-100 text-blue-700",
            "Preparing": "bg-orange-100 text-orange-700",
            "Ready": "bg-green-100 text-green-700",
            "Served": "bg-gray-200 text-gray-600"
        }[o.status];

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
                <td class="p-4">
                    <button
                        onclick="updateStatus(${o.id}, 'Preparing')"
                        class="text-sm bg-gray-800 text-white px-3 py-1 rounded">
                        Update
                    </button>
                </td>
                <td class="p-4">
                    <a href="/bill/${o.id}"
                    class="bg-emerald-600 text-white px-3 py-1 rounded text-sm">
                    Generate Bill
                    </a>
                </td>
            </tr>
        `;
    });

    pendingCount.innerText = pending;
}

/* STATUS UPDATE */
function updateStatus(orderId, status) {
    fetch(`/api/order/${orderId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
    });
}

/* 🔴 SINGLE SSE CONNECTION */
const source = new EventSource("/events");

source.onmessage = (event) => {
    const data = JSON.parse(event.data);

    renderOrders(data.orders);
    revenueEl.innerText = `₹${data.today_revenue}`;
};

source.onerror = () => {
    console.warn("SSE disconnected");
};
