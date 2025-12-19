const menuGrid = document.getElementById("menu-grid");
const params = new URLSearchParams(window.location.search);
const ORDER_ID = params.get("add_to_order");
const TABLE_NO = params.get("table");
/* ================= LOAD MENU ================= */
function openAddModal() {
    document.getElementById("item-modal").classList.remove("hidden");
}

function closeAddModal() {
    document.getElementById("item-modal").classList.add("hidden");
}

function loadMenu(category = null) {
    fetch("/api/menu")
        .then(res => {
            if (!res.ok) throw new Error("Failed to load menu");
            return res.json();
        })
        .then(items => {
            menuGrid.innerHTML = "";

            if (items.length === 0) {
                menuGrid.innerHTML = `
                    <p class="text-gray-500 col-span-full">
                        No menu items found
                    </p>`;
                return;
            }

            items
                .filter(item => !category || item.category === category)
                .forEach(item => {
                    const imgSrc = item.image
                        ? `/${item.image}`
                        : "/static/no-image.png";

                    menuGrid.innerHTML += `
                        <div class="bg-white rounded-xl shadow overflow-hidden">
                            <img src="${imgSrc}"
                                 class="h-40 w-full object-cover">

                            <div class="p-4">
                                <h4 class="font-bold">${item.name}</h4>
                                <p class="text-emerald-600 font-bold">₹${item.price}</p>
                                <p class="text-sm text-gray-500">${item.category}</p>

                                <div class="flex gap-2 mt-3">
    <button onclick="toggleStock(${item.id})"
        class="px-3 py-1 bg-gray-800 text-white rounded">
        ${item.available ? "Disable" : "Enable"}
    </button>

    <button onclick="openEditModal(${item.id}, '${item.name}', ${item.price}, '${item.category}')"
        class="px-3 py-1 bg-blue-600 text-white rounded">
        Edit
    </button>

    <button onclick="deleteItem(${item.id})"
        class="px-3 py-1 bg-red-600 text-white rounded">
        Delete
    </button>

        ${ORDER_ID ? `
        <button
  onclick="openAddToOrderModal(${item.id}, '${item.name}', ${item.price})"
  class="bg-emerald-600 hover:bg-emerald-700
         text-white px-4 py-2 rounded-lg
         text-sm font-semibold flex items-center gap-2">
  <i class="fas fa-plus"></i>
  Add to Table ${TABLE_NO}
</button>

    ` : ""}
</div>

                            </div>
                        </div>
                    `;
                });
        })
        .catch(err => {
            console.error(err);
            menuGrid.innerHTML = `
                <p class="text-red-500 col-span-full">
                    Failed to load menu
                </p>`;
        });
}

/* ================= ENABLE / DISABLE ================= */
function toggleStock(id) {
    fetch(`/api/menu/toggle/${id}`, { method: "POST" })
        .then(res => {
            if (!res.ok) throw new Error();
            loadMenu();
        })
        .catch(() => alert("Failed to update item status"));
}

/* ================= DELETE ITEM ================= */
function deleteItem(id) {
    if (!confirm("Are you sure you want to delete this dish?")) return;

    fetch(`/api/menu/${id}`, { method: "DELETE" })
        .then(res => {
            if (!res.ok) throw new Error();
            loadMenu();
        })
        .catch(() => alert("Failed to delete item"));
}

/* ================= ADD ITEM ================= */
document.getElementById("menu-form").onsubmit = e => {
    e.preventDefault();

    const formData = new FormData(e.target);

    fetch("/api/menu", {
        method: "POST",
        body: formData
    })
        .then(res => {
            if (!res.ok) throw new Error();
            e.target.reset();
            document.getElementById("item-modal").classList.add("hidden");
            loadMenu();
        })
        .catch(() => alert("Failed to add dish"));
};
function addToOrder(itemId) {
    const qty = prompt("Enter quantity", 1);
    if (!qty || qty <= 0) return;

    fetch(`/api/order/${ORDER_ID}/add-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            item_id: itemId,
            qty: qty
        })
    })
        .then(res => res.json())
        .then(() => {
            alert("Item added to order & sent to kitchen 🍽️");
            window.location.href = "/admin";
        });
}
/* add item to table  */
let selectedItemId = null;
let selectedItemName = "";
let selectedItemPrice = 0;

function openAddToOrderModal(id, name, price) {
    selectedItemId = id;
    selectedItemName = name;
    selectedItemPrice = price;

    document.getElementById("modal-item-name").innerText = name;
    document.getElementById("modal-qty").value = 1;
    document.getElementById("addToOrderModal").classList.remove("hidden");
}

function closeAddToOrderModal() {
    document.getElementById("addToOrderModal").classList.add("hidden");
}

function confirmAddToOrder() {
    const qty = document.getElementById("modal-qty").value;
    const params = new URLSearchParams(window.location.search);

    fetch(`/api/order/${params.get("add_to_order")}/add-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            item_id: selectedItemId,
            qty: qty
        })
    }).then(() => {
        closeAddToOrderModal();
        alert(`✅ ${selectedItemName} added to table`);
        window.location.href = "/admin"; // back to dashboard
    });
}

/* ================= IMPORT TEMPLATE ================= */
function importTemplate(type) {
    if (!confirm("Import default menu items? You can edit them later.")) return;

    fetch("/api/menu/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: type })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                alert("Menu imported successfully!");
                loadMenu();
            } else {
                alert("Failed to import menu");
            }
        });
}

/* ================= EDIT MODAL ================= */
function openEditModal(id, name, price, category) {
    document.getElementById("edit-id").value = id;
    document.getElementById("edit-name").value = name;
    document.getElementById("edit-price").value = price;
    document.getElementById("edit-category").value = category;

    document.getElementById("edit-modal").classList.remove("hidden");
}


function closeEditModal() {
    document.getElementById("edit-modal").classList.add("hidden");
}

/* ================= SAVE EDIT ================= */
document.getElementById("edit-form").onsubmit = function (e) {
    e.preventDefault();

    const id = document.getElementById("edit-id").value;
    const name = document.getElementById("edit-name").value;
    const category = document.getElementById("edit-category").value;
    const price = document.getElementById("edit-price").value;
    const image = document.getElementById("edit-image").files[0];

    const formData = new FormData();
    formData.append("name", name);
    formData.append("category", category);
    formData.append("price", price);
    if (image) formData.append("image", image);

    fetch(`/api/menu/${id}`, {
        method: "PUT",
        body: formData
    })
        .then(res => {
            if (!res.ok) throw new Error();
            closeEditModal();
            loadMenu();
        })
        .catch(() => alert("Failed to update dish"));
};


/* ================= INITIAL LOAD ================= */
loadMenu();
