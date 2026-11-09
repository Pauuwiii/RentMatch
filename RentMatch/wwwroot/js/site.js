(() => {
	const cards = [...document.querySelectorAll(".listing-card")];
	if (!cards.length) return;

	const grid = document.querySelector("#listing-grid");
	const searchInput = document.querySelector("#location-search");
	const guestSelect = document.querySelector("#guest-count");
	const priceInput = document.querySelector("#max-price");
	const bedroomSelect = document.querySelector("#bedroom-count");
	const filterPopover = document.querySelector("#filter-popover");
	const emptyState = document.querySelector("#empty-state");
	const savedCards = new Set();
	let activeCategory = "all";
	let filtersApplied = false;
	let toastTimer;

	const updateListings = () => {
		const query = searchInput.value.trim().toLowerCase();
		const guests = Number(guestSelect.value);
		const maxPrice = filtersApplied ? Number(priceInput.value) : Infinity;
		const bedrooms = filtersApplied ? Number(bedroomSelect.value) : 0;
		let visibleCount = 0;

		cards.forEach((card) => {
			const matchesCategory = activeCategory === "all" ||
				(activeCategory === "saved" ? savedCards.has(card) : card.dataset.category.split(" ").includes(activeCategory));
			const matchesQuery = !query || `${card.dataset.location} ${card.querySelector("h2").textContent}`.toLowerCase().includes(query);
			const visible = matchesCategory && matchesQuery && Number(card.dataset.price) <= maxPrice &&
				Number(card.dataset.bedrooms) >= bedrooms && Number(card.dataset.guests) >= guests;
			card.hidden = !visible;
			if (visible) visibleCount++;
		});

		document.querySelector("#result-count").textContent = visibleCount;
		document.querySelector("#result-location").textContent = query ? `Matching stays near “${searchInput.value.trim()}”` : "Handpicked for your next escape";
		emptyState.hidden = visibleCount > 0;
		grid.hidden = visibleCount === 0;
	};

	document.querySelectorAll(".category").forEach((button) => {
		button.addEventListener("click", () => {
			activeCategory = button.dataset.category;
			document.querySelectorAll(".category").forEach((item) => {
				const active = item === button;
				item.classList.toggle("active", active);
				item.setAttribute("aria-pressed", String(active));
			});
			updateListings();
		});
	});

	document.querySelectorAll(".save-button").forEach((button) => {
		button.addEventListener("click", () => {
			const card = button.closest(".listing-card");
			const saved = button.getAttribute("aria-pressed") !== "true";
			button.setAttribute("aria-pressed", String(saved));
			if (saved) savedCards.add(card);
			else savedCards.delete(card);
			updateListings();
		});
	});

	const toggleFilters = (open) => {
		filterPopover.hidden = !open;
		document.querySelector("#filter-toggle").setAttribute("aria-expanded", String(open));
	};

	document.querySelector("#filter-toggle").addEventListener("click", () => toggleFilters(filterPopover.hidden));
	document.querySelector("#filter-close").addEventListener("click", () => toggleFilters(false));
	priceInput.addEventListener("input", () => {
		document.querySelector("#price-value").textContent = `$${priceInput.value}`;
	});
	document.querySelector("#apply-filters").addEventListener("click", () => {
		filtersApplied = true;
		const count = Number(priceInput.value) < 700 || Number(bedroomSelect.value) > 0 ? 1 : 0;
		const filterCount = document.querySelector("#filter-count");
		filterCount.hidden = count === 0;
		filterCount.textContent = count;
		toggleFilters(false);
		updateListings();
	});

	const runSearch = () => updateListings();
	document.querySelector("#search-button").addEventListener("click", runSearch);
	searchInput.addEventListener("keydown", (event) => {
		if (event.key === "Enter") runSearch();
	});
	guestSelect.addEventListener("change", runSearch);
	document.querySelector("#clear-search").addEventListener("click", () => {
		searchInput.value = "";
		guestSelect.value = "1";
		priceInput.value = "700";
		bedroomSelect.value = "0";
		document.querySelector("#price-value").textContent = "$700";
		document.querySelector("#filter-count").hidden = true;
		filtersApplied = false;
		activeCategory = "all";
		document.querySelectorAll(".category").forEach((button) => {
			const active = button.dataset.category === "all";
			button.classList.toggle("active", active);
			button.setAttribute("aria-pressed", String(active));
		});
		updateListings();
	});

	document.querySelectorAll("[data-toast]").forEach((button) => {
		button.addEventListener("click", () => {
			const toast = document.querySelector("#toast-message");
			toast.textContent = button.dataset.toast;
			toast.classList.add("visible");
			window.clearTimeout(toastTimer);
			toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2400);
		});
	});
})();
