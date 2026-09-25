(() => {
  const products = window.UNVELOUR_CATALOG || [];
  const categoryNames = window.UNVELOUR_GROUPS || { all: "Todo" };

  const grid = document.querySelector("#product-grid");
  const cardTemplate = document.querySelector("#product-card-template");
  const search = document.querySelector("#catalog-search");
  const categoryFilters = document.querySelector("#category-filters");
  const brandFilters = document.querySelector("#brand-filters");
  const visibleCount = document.querySelector("#visible-count");
  const clearFilters = document.querySelector("#clear-filters");
  const loadMore = document.querySelector("#load-more");
  const emptyState = document.querySelector("#empty-state");
  const dialog = document.querySelector("#product-dialog");

  const PAGE_SIZE = 32;
  // GitHub web uploads limit each file to 25 MiB, so the gzip archive is
  // stored as four smaller parts and joined in memory before decompression.
  const THUMB_PARTS = [
    "./catalog-thumbs-01.bin",
    "./catalog-thumbs-02.bin",
    "./catalog-thumbs-03.bin",
    "./catalog-thumbs-04.bin",
  ];
  const FALLBACK_IMAGE =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 720 720'%3E%3Crect width='720' height='720' fill='%23f7f6f2'/%3E%3Cpath d='M280 318h160v84H280z' fill='none' stroke='%23c4c5c1' stroke-width='4'/%3E%3Cpath d='m300 382 38-36 31 29 20-18 31 25' fill='none' stroke='%23c4c5c1' stroke-width='4'/%3E%3Ctext x='360' y='448' text-anchor='middle' font-family='Arial' font-size='20' fill='%23727675'%3EIMAGEN NO DISPONIBLE%3C/text%3E%3C/svg%3E";
  let activeCategory = "all";
  let activeBrand = "all";
  let query = "";
  let shown = PAGE_SIZE;
  let filteredProducts = [...products];
  let activeProductIndex = -1;
  const thumbnailUrls = new Map();

  const thumbnailMime = (name) => {
    if (name.endsWith(".png")) return "image/png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
    return "image/webp";
  };

  const loadThumbnailArchive = async () => {
    if (!window.DecompressionStream) throw new Error("El navegador no admite archivos comprimidos.");
    const responses = await Promise.all(
      THUMB_PARTS.map((part) => fetch(part, { cache: "force-cache" })),
    );
    if (responses.some((response) => !response.ok)) {
      throw new Error("No se pudieron cargar las partes de miniaturas.");
    }
    const parts = await Promise.all(responses.map((response) => response.arrayBuffer()));
    const decompressed = new Blob(parts).stream().pipeThrough(new DecompressionStream("gzip"));
    const bytes = new Uint8Array(await new Response(decompressed).arrayBuffer());
    const decoder = new TextDecoder();
    let offset = 0;
    while (offset + 512 <= bytes.length) {
      const name = decoder.decode(bytes.subarray(offset, offset + 100)).replace(/\0.*$/, "");
      if (!name) break;
      const sizeText = decoder.decode(bytes.subarray(offset + 124, offset + 136)).replace(/\0.*$/, "").trim();
      const size = parseInt(sizeText || "0", 8);
      const dataStart = offset + 512;
      const dataEnd = dataStart + size;
      const idMatch = name.match(/(\d+)\.[a-z0-9]+$/i);
      if (idMatch && size > 0 && dataEnd <= bytes.length) {
        const id = Number(idMatch[1]);
        thumbnailUrls.set(id, URL.createObjectURL(new Blob([bytes.slice(dataStart, dataEnd)], { type: thumbnailMime(name) })));
      }
      offset = dataStart + Math.ceil(size / 512) * 512;
    }
    return thumbnailUrls.size;
  };

  const normalize = (value) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const button = (label, value, type, pressed = false) => {
    const element = document.createElement("button");
    element.className = "filter-chip";
    element.type = "button";
    element.textContent = label;
    element.dataset.value = value;
    element.dataset.filterType = type;
    element.setAttribute("aria-pressed", String(pressed));
    return element;
  };

  const renderCategoryFilters = () => {
    categoryFilters.replaceChildren(
      ...Object.entries(categoryNames).map(([value, label]) =>
        button(label, value, "category", value === activeCategory),
      ),
    );
  };

  const availableBrands = () => {
    const pool = activeCategory === "all"
      ? products
      : products.filter((product) => product.section === activeCategory);
    return [...new Set(pool.map((product) => product.brand))].sort((a, b) =>
      a.localeCompare(b, "es"),
    );
  };

  const renderBrandFilters = () => {
    const brands = availableBrands();
    const pool = activeCategory === "all"
      ? products
      : products.filter((product) => product.section === activeCategory);
    const counts = new Map();
    pool.forEach((product) => counts.set(product.brand, (counts.get(product.brand) || 0) + 1));
    if (activeBrand !== "all" && !brands.includes(activeBrand)) activeBrand = "all";
    brandFilters.replaceChildren(
      button("Todas", "all", "brand", activeBrand === "all"),
      ...brands.map((brand) => button(`${brand} · ${counts.get(brand)}`, brand, "brand", activeBrand === brand)),
    );
  };

  const matchesSearch = (product) => {
    if (!query) return true;
    const haystack = normalize(
      `${product.brand} ${product.reference} ${product.originalTitle} ${product.type} ${product.sectionName}`,
    );
    return haystack.includes(normalize(query));
  };

  const applyFilters = () => {
    filteredProducts = products.filter((product) => {
      const categoryMatch = activeCategory === "all" || product.section === activeCategory;
      const brandMatch = activeBrand === "all" || product.brand === activeBrand;
      return categoryMatch && brandMatch && matchesSearch(product);
    });
  };

  const makeCard = (product, index) => {
    const fragment = cardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".product-card");
    const open = fragment.querySelector(".product-open");
    const image = fragment.querySelector(".product-image");
    card.dataset.section = product.section;
    card.style.setProperty("--card-index", index);
    open.dataset.productId = product.id;
    open.setAttribute("aria-label", `Ver ${product.brand}, referencia ${product.reference}`);
    image.src = thumbnailUrls.get(product.id) || FALLBACK_IMAGE;
    image.addEventListener("error", () => {
      image.onerror = null;
      image.src = FALLBACK_IMAGE;
    });
    image.alt = `${product.type} ${product.brand}, referencia ${product.reference}`;
    fragment.querySelector(".product-brand").textContent = product.brand;
    fragment.querySelector(".product-reference").textContent = product.reference;
    fragment.querySelector(".product-type").textContent = product.type;
    return fragment;
  };

  const renderProducts = () => {
    applyFilters();
    const current = filteredProducts.slice(0, shown);
    const fragment = document.createDocumentFragment();
    current.forEach((product, index) => fragment.append(makeCard(product, index)));
    grid.replaceChildren(fragment);
    visibleCount.textContent = filteredProducts.length;
    emptyState.hidden = filteredProducts.length > 0;
    loadMore.hidden = shown >= filteredProducts.length || filteredProducts.length === 0;
    if (!loadMore.hidden) {
      loadMore.firstChild.textContent = `Ver ${Math.min(PAGE_SIZE, filteredProducts.length - shown)} productos más `;
    }
    clearFilters.hidden = activeCategory === "all" && activeBrand === "all" && !query;
  };

  const updatePressed = (container, value) => {
    container.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.setAttribute("aria-pressed", String(chip.dataset.value === value));
    });
  };

  const resetPaginationAndRender = () => {
    shown = PAGE_SIZE;
    renderProducts();
  };

  const resetFilters = () => {
    activeCategory = "all";
    activeBrand = "all";
    query = "";
    search.value = "";
    renderCategoryFilters();
    renderBrandFilters();
    resetPaginationAndRender();
  };

  const openProduct = (productId, updateHash = true) => {
    const index = filteredProducts.findIndex((product) => product.id === productId);
    const fallbackIndex = products.findIndex((product) => product.id === productId);
    const product = index >= 0 ? filteredProducts[index] : products[fallbackIndex];
    if (!product) return;
    activeProductIndex = index >= 0 ? index : fallbackIndex;
    const navigationPool = index >= 0 ? filteredProducts : products;

    const dialogImage = document.querySelector("#dialog-image");
    dialogImage.src = thumbnailUrls.get(product.id) || FALLBACK_IMAGE;
    dialogImage.alt = `${product.type} ${product.brand}`;
    dialogImage.onerror = () => {
      dialogImage.onerror = null;
      dialogImage.src = FALLBACK_IMAGE;
    };
    document.querySelector("#dialog-title").textContent = product.brand;
    document.querySelector("#dialog-category").textContent = product.sectionName;
    document.querySelector("#dialog-type").textContent = `${product.type}${product.photoCount ? ` · ${product.photoCount} fotos en el álbum` : ""}`;
    document.querySelector("#dialog-reference").textContent = product.reference;
    document.querySelector("#dialog-counter").textContent = `${activeProductIndex + 1} / ${navigationPool.length}`;
    document.querySelector("#dialog-original").textContent = product.originalTitle
      ? `Título del álbum: ${product.originalTitle}`
      : "";
    document.querySelector("#previous-product").disabled = activeProductIndex <= 0;
    document.querySelector("#next-product").disabled = activeProductIndex >= navigationPool.length - 1;
    document.querySelector("#copy-reference").dataset.reference = product.reference;
    document.querySelector("#copy-reference").textContent = "Copiar referencia";
    dialog.dataset.pool = index >= 0 ? "filtered" : "all";

    if (!dialog.open) dialog.showModal();
    dialog.classList.remove("dialog-product-change");
    void dialog.offsetWidth;
    dialog.classList.add("dialog-product-change");
    if (updateHash) history.replaceState(null, "", `#${product.reference}`);
  };

  const closeDialog = () => {
    if (dialog.open) dialog.close();
    dialog.classList.remove("dialog-product-change");
    if (location.hash.startsWith("#UNV-")) history.replaceState(null, "", location.pathname + location.search);
  };

  const navigateProduct = (direction) => {
    const pool = dialog.dataset.pool === "filtered" ? filteredProducts : products;
    const nextIndex = activeProductIndex + direction;
    if (nextIndex < 0 || nextIndex >= pool.length) return;
    openProduct(pool[nextIndex].id);
  };

  categoryFilters.addEventListener("click", (event) => {
    const chip = event.target.closest(".filter-chip");
    if (!chip) return;
    activeCategory = chip.dataset.value;
    activeBrand = "all";
    updatePressed(categoryFilters, activeCategory);
    renderBrandFilters();
    resetPaginationAndRender();
  });

  brandFilters.addEventListener("click", (event) => {
    const chip = event.target.closest(".filter-chip");
    if (!chip) return;
    activeBrand = chip.dataset.value;
    updatePressed(brandFilters, activeBrand);
    resetPaginationAndRender();
  });

  grid.addEventListener("click", (event) => {
    const open = event.target.closest(".product-open");
    if (open) openProduct(Number(open.dataset.productId));
  });

  let searchTimer;
  search.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      query = search.value.trim();
      resetPaginationAndRender();
    }, 120);
  });

  document.querySelectorAll("[data-focus-search]").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      document.querySelector("#catalogo").scrollIntoView({ behavior: "smooth" });
      window.setTimeout(() => search.focus(), 380);
    });
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      document.querySelector("#catalogo").scrollIntoView({ behavior: "smooth" });
      search.focus({ preventScroll: true });
    }
    if (dialog.open && event.key === "ArrowLeft") navigateProduct(-1);
    if (dialog.open && event.key === "ArrowRight") navigateProduct(1);
  });

  loadMore.addEventListener("click", () => {
    shown += PAGE_SIZE;
    renderProducts();
  });

  clearFilters.addEventListener("click", resetFilters);
  document.querySelectorAll("[data-reset-filters]").forEach((trigger) => trigger.addEventListener("click", resetFilters));
  document.querySelector("[data-close-dialog]").addEventListener("click", closeDialog);
  document.querySelector("#previous-product").addEventListener("click", () => navigateProduct(-1));
  document.querySelector("#next-product").addEventListener("click", () => navigateProduct(1));
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) closeDialog();
  });
  dialog.addEventListener("close", () => {
    if (location.hash.startsWith("#UNV-")) history.replaceState(null, "", location.pathname + location.search);
  });

  document.querySelector("#copy-reference").addEventListener("click", async (event) => {
    const trigger = event.currentTarget;
    try {
      await navigator.clipboard.writeText(trigger.dataset.reference);
      trigger.textContent = "Referencia copiada";
    } catch {
      trigger.textContent = trigger.dataset.reference;
    }
  });

  const start = async () => {
    renderCategoryFilters();
    renderBrandFilters();
    renderProducts();
    try {
      const loaded = await loadThumbnailArchive();
      if (loaded) renderProducts();
    } catch (error) {
      console.warn("No se pudo cargar el archivo local de miniaturas.", error);
    }
    const hashMatch = location.hash.match(/^#(UNV-\d{4})$/i);
    if (hashMatch) {
      const product = products.find((item) => item.reference === hashMatch[1].toUpperCase());
      if (product) openProduct(product.id, false);
    }
  };

  start();
})();
