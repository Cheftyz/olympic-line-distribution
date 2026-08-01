// ===== Catalog page =====
(function () {
  "use strict";

  var grid = document.getElementById("product-grid");
  var emptyState = document.getElementById("empty-state");
  var search = document.getElementById("search");
  var categoryFilter = document.getElementById("category-filter");
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var allProducts = [];

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatPrice(price) {
    if (price == null || price === "") return "";
    var num = Number(price);
    if (!isFinite(num)) return "";
    return "$" + num.toFixed(2);
  }

  function productCard(p) {
    var name = escapeHtml(p.name);
    var priceText = formatPrice(p.price);
    var media = p.imageUrl
      ? '<img src="' + escapeHtml(p.imageUrl) + '" alt="' + name + '" loading="lazy" />'
      : '<div class="product-noimg" aria-hidden="true">' +
        escapeHtml((p.name || "?").charAt(0).toUpperCase()) +
        "</div>";

    return (
      '<article class="product-card">' +
        '<div class="product-media">' + media + "</div>" +
        '<div class="product-body">' +
          (p.category ? '<span class="product-cat">' + escapeHtml(p.category) + "</span>" : "") +
          "<h3>" + name + "</h3>" +
          (p.description ? '<p class="product-desc">' + escapeHtml(p.description) + "</p>" : "") +
          '<div class="product-foot">' +
            (priceText ? '<span class="product-price">' + priceText + "</span>" : "<span></span>") +
            (p.sku ? '<span class="product-sku">SKU: ' + escapeHtml(p.sku) + "</span>" : "") +
          "</div>" +
        "</div>" +
      "</article>"
    );
  }

  function render() {
    var term = (search.value || "").toLowerCase().trim();
    var cat = categoryFilter.value;

    var filtered = allProducts.filter(function (p) {
      var matchesCat = !cat || p.category === cat;
      var haystack = ((p.name || "") + " " + (p.description || "") + " " + (p.sku || "")).toLowerCase();
      var matchesTerm = !term || haystack.indexOf(term) !== -1;
      return matchesCat && matchesTerm;
    });

    if (allProducts.length === 0) {
      grid.innerHTML = "";
      emptyState.textContent = "No products in the catalog yet. Check back soon.";
      emptyState.hidden = false;
      return;
    }
    if (filtered.length === 0) {
      grid.innerHTML = "";
      emptyState.textContent = "No products match your search.";
      emptyState.hidden = false;
      return;
    }
    emptyState.hidden = true;
    grid.innerHTML = filtered.map(productCard).join("");
  }

  function populateCategories() {
    var cats = {};
    allProducts.forEach(function (p) {
      if (p.category) cats[p.category] = true;
    });
    Object.keys(cats).sort().forEach(function (c) {
      var opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      categoryFilter.appendChild(opt);
    });
  }

  function load() {
    fetch("/api/products")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        allProducts = Array.isArray(data) ? data : [];
        populateCategories();
        render();
      })
      .catch(function () {
        grid.innerHTML = "";
        emptyState.textContent = "Couldn't load the catalog. Please try again later.";
        emptyState.hidden = false;
      });
  }

  search.addEventListener("input", render);
  categoryFilter.addEventListener("change", render);
  load();
})();
