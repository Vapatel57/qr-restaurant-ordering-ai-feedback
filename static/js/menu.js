const menuGrid = document.getElementById("menu-grid");
const modal = document.getElementById("item-modal");

/* MODAL */
function toggleModal() {
    modal.classList.toggle("hidden");
}

/* LOAD MENU */
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
                    menuGrid.innerHTML += `
                        <div class="bg-white rounded-xl shadow overflow-hidden">
                            <img src="/${item.image}" class="h-40 w-full object-cover">

                            <div class="p-4">
                                <h4 class="font-bold">${item.name}</h4>
                                <p class="text-emerald-600 font-bold">₹${item.price}</p>
                                <p class="text-sm text-gray-500">${item.category}</p>

                                <div class="flex gap-2 mt-3">
                                    <button
                                        onclick="toggleStock(${item.id})"
                                        class="px-3 py-1 bg-gray-800 text-white rounded">
                                        ${item.available ? "Disable" : "Enable"}
                                    </button>

                                    <button
                                        onclick="deleteItem(${item.id})"
                                        class="px-3 py-1 bg-red-600 text-white rounded">
                                        Delete
                                    </button>
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

/* ENABLE / DISABLE ITEM */
function toggleStock(id) {
    fetch(`/api/menu/toggle/${id}`, {
        method: "POST"
    })
    .then(res => {
        if (!res.ok) throw new Error("Toggle failed");
        loadMenu();
    })
    .catch(err => {
        alert("Failed to update item status");
        console.error(err);
    });
}

/* DELETE ITEM */
function deleteItem(id) {
    if (!confirm("Are you sure you want to delete this dish?")) return;

    fetch(`/api/menu/${id}`, {
        method: "DELETE"
    })
    .then(res => {
        if (!res.ok) throw new Error("Delete failed");
        loadMenu();
    })
    .catch(err => {
        alert("Failed to delete item");
        console.error(err);
    });
}

/* ADD ITEM */
document.getElementById("menu-form").onsubmit = e => {
    e.preventDefault();

    const formData = new FormData(e.target);

    fetch("/api/menu", {
        method: "POST",
        body: formData
    })
    .then(res => {
        if (!res.ok) throw new Error("Add failed");
        toggleModal();
        e.target.reset();
        loadMenu();
    })
    .catch(err => {
        alert("Failed to add dish");
        console.error(err);
    });
};

/* INITIAL LOAD */
loadMenu();
