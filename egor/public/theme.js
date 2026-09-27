(() => {
  "use strict";

  const current = document.currentScript;
  const endpoint = current?.src ? new URL("./", current.src) : null;
  const onlyTestResource = [...document.querySelectorAll("link[href],script[src]")]
    .some(el => /\/themes\/onlytest\//i.test(el.href || el.src || ""));
  const forcedOnlyTest = new URLSearchParams(location.search).get("set_force_theme") === "onlytest";
  if (!endpoint || (!onlyTestResource && !forcedOnlyTest) || document.getElementById("onlyflora-modern-home")) return;

  const assetUrl = path => new URL(path, endpoint).href;
  const productPlaceholder = assetUrl("assets/product-card-placeholder.png");
  const missingImagePattern = /(?:dummy|no[-_ ]?image|no[-_ ]?photo|nophoto|placeholder|default[-_ ]?(?:product|image))/i;
  const productContextSelector = [
    ".product-card",
    ".product",
    ".product-item",
    ".product-list-item",
    ".products li",
    ".product-list li",
    "[data-product-id]",
    "[class*='product'][class*='item']",
    "[class*='product'][class*='card']"
  ].join(",");

  function isProductImage(image) {
    return image instanceof HTMLImageElement && Boolean(image.closest(productContextSelector));
  }

  function useProductPlaceholder(image) {
    if (!isProductImage(image) || image.dataset.ofFallbackApplied === "1") return;
    image.dataset.ofFallbackApplied = "1";
    image.removeAttribute("data-src");
    image.removeAttribute("data-srcset");
    image.removeAttribute("srcset");
    image.removeAttribute("sizes");
    image.src = productPlaceholder;
    image.alt ||= "Изображение товара";
    image.classList.add("of-product-image-fallback");
  }

  function applyProductFallbacks(root = document) {
    const images = root instanceof HTMLImageElement
      ? [root]
      : [...(root.querySelectorAll?.("img") || [])];
    for (const image of images) {
      const source = ["src", "data-src", "srcset", "data-srcset"]
        .map(attribute => image.getAttribute(attribute) || "")
        .join(" ");
      const transparentLoader = /^data:image\/gif;base64,R0lGODlhAQABA/i.test(image.getAttribute("src") || "");
      if (isProductImage(image) && (!source.trim() || transparentLoader || missingImagePattern.test(source))) {
        useProductPlaceholder(image);
      }
    }
  }

  document.addEventListener("error", event => {
    if (event.target instanceof HTMLImageElement) useProductPlaceholder(event.target);
  }, true);

  applyProductFallbacks();
  new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) applyProductFallbacks(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  if (!document.getElementById("onlyflora-modern-theme-style")) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = assetUrl("theme.css");
    stylesheet.id = "onlyflora-modern-theme-style";
    document.head.append(stylesheet);
  }

  const path = location.pathname.replace(/\/+$/, "") || "/";
  const homePaths = new Set(["/", "/site"]);
  if (!homePaths.has(path)) return;

  const normalize = value => String(value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("ru");
  const oldBody = document.body;

  function findLink(labels, fallback = "/") {
    const wanted = labels.map(normalize);
    const candidates = [...document.querySelectorAll("a[href]")];
    const exact = candidates.find(a => wanted.includes(normalize(a.textContent)));
    const partial = candidates.find(a => wanted.some(label => normalize(a.textContent).includes(label)));
    return (exact || partial)?.href || fallback;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, symbol => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[symbol]);
  }

  function findImageForLink(link) {
    const direct = link?.querySelector("img");
    if (direct?.currentSrc || direct?.src) return direct.currentSrc || direct.src;
    const parentImage = link?.parentElement?.querySelector("img");
    return parentImage?.currentSrc || parentImage?.src || "";
  }

  function findCategory(label, image) {
    const href = findLink([label], "/");
    return { label, href, image: assetUrl(image) };
  }

  function heroImage() {
    const preferred = [...document.images].filter(img => {
      const src = img.currentSrc || img.src || "";
      const width = img.naturalWidth || img.width;
      return width >= 700 && !/logo|icon|dummy/i.test(src);
    }).sort((a, b) => (b.naturalWidth * b.naturalHeight) - (a.naturalWidth * a.naturalHeight))[0];
    if (preferred) return preferred.currentSrc || preferred.src;
    const backgrounds = [...document.querySelectorAll("[style*='background']")].map(el => getComputedStyle(el).backgroundImage).filter(value => value && value !== "none");
    return backgrounds[0]?.match(/url\(["']?(.*?)["']?\)/)?.[1] || "";
  }

  function getProducts(limit = 5) {
    const seen = new Set();
    const result = [];
    for (const img of [...document.images]) {
      if (result.length >= limit) break;
      const src = img.currentSrc || img.src || "";
      const missingImage = !src || missingImagePattern.test(src);
      if ((!missingImage && /logo|icon|banner|slider/i.test(src)) || (!missingImage && img.naturalWidth && img.naturalWidth < 130)) continue;
      const anchor = img.closest("a[href]");
      if (!anchor || seen.has(anchor.href)) continue;
      const card = anchor.closest("li, article, [class*='product'], [class*='item']") || anchor.parentElement;
      const raw = card?.textContent?.replace(/\s+/g, " ").trim() || anchor.textContent.trim();
      const price = raw.match(/(?:от\s*)?[\d\s]+(?:[,.]\d+)?\s*₽/i)?.[0] || raw.match(/(?:от\s*)?[\d\s]+(?:[,.]\d+)?\s*руб/i)?.[0] || "";
      const titleCandidate = [...(card?.querySelectorAll("a[href],h2,h3,h4") || [])]
        .map(el => el.textContent.replace(/\s+/g, " ").trim())
        .find(text => text.length >= 4 && text.length <= 90 && !/купить|корзин|подробнее/i.test(text));
      const title = titleCandidate || img.alt?.trim();
      if (!title || !price) continue;
      seen.add(anchor.href);
      result.push({ href: anchor.href, image: missingImage ? productPlaceholder : src, title, price });
    }
    return result;
  }

  function logoMark() {
    return '<svg viewBox="0 0 48 48" width="38" height="38" aria-hidden="true"><rect width="48" height="48" rx="9" fill="#109749"/><path d="M8 10c12 1 20 6 24 17-8 2-16-1-21-8-2-3-3-6-3-9Z" fill="#fff"/><path d="M40 10c-12 1-20 6-24 17 8 2 16-1 21-8 2-3 3-6 3-9Z" fill="#183e31"/><path d="M24 21v18" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="33" cy="17" r="2.6" fill="#fff"/></svg>';
  }

  // Shop-Script's public search route is stable. Reading form.action from the
  // hidden Site theme returned /site/ on the preview domain and broke search.
  const searchAction = "/search/";
  const searchName = "query";

  const categories = [
    ["Лиственные деревья", "assets/categories/deciduous-trees.png"],
    ["Хвойные растения", "assets/categories/conifers.png"],
    ["Кустарники", "assets/categories/shrubs.png"],
    ["Многолетники", "assets/categories/perennials.png"],
    ["Декоративные злаки", "assets/categories/ornamental-grasses.png"]
  ].map(([label, image]) => findCategory(label, image));
  const products = getProducts();
  const hero = heroImage() || assetUrl("assets/categories/shrubs.png");
  const catalogHref = findLink(["Озеленение", "Каталог растений", "Каталог"], "/");
  const links = {
    greenery: findLink(["Озеленение", "Каталог растений"], catalogHref),
    improvement: findLink(["Благоустройство"], "/"),
    marketplace: findLink(["Торговая площадка"], "/"),
    housing: findLink(["Озеленение ЖК"], "/"),
    nurseries: findLink(["Питомники", "Магазин"], "/"),
    landscape: findLink(["Ландшафтный дизайн"], "/"),
    care: findLink(["Уход и материалы"], "/"),
    sale: findLink(["Акции", "Наши специальные предложения"], "/"),
    blog: findLink(["Блог"], "/blog/"),
    about: findLink(["О проекте", "О компании"], "/about/"),
    favorites: findLink(["Избранное"], "/"),
    cart: findLink(["Корзина"], "/cart/"),
    account: findLink(["Аккаунт", "Личный кабинет", "Войти"], "/my/")
  };
  const legal = {
    privacy: "https://onlyflora.webasyst.cloud/site/legal/personal-data-policy/",
    consent: "https://onlyflora.webasyst.cloud/site/legal/personal-data-consent/",
    cookies: "https://onlyflora.webasyst.cloud/site/legal/cookie-policy/",
    advertising: "https://onlyflora.webasyst.cloud/site/legal/advertising-consent/"
  };

  const categoryCards = categories.map(item => `
    <a class="of-category-card" href="${escapeHtml(item.href)}">
      <img class="of-card-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.label)}" loading="lazy">
      <span class="of-category-title">${escapeHtml(item.label)}</span>
    </a>`).join("");

  const productCards = products.map(item => `
    <a class="of-product-card" href="${escapeHtml(item.href)}">
      <img class="of-card-image" src="${escapeHtml(item.image)}" alt="" loading="lazy">
      <span class="of-product-heart" aria-hidden="true">♡</span>
      <span class="of-product-title">${escapeHtml(item.title)}</span>
      <span class="of-product-price">${escapeHtml(item.price)}</span>
    </a>`).join("");

  const root = document.createElement("div");
  root.id = "onlyflora-modern-home";
  root.innerHTML = `
    <div class="of-shell">
      <header class="of-topbar">
        <a class="of-brand" href="/" aria-label="OnlyFlora — главная"><span class="of-brand-mark">${logoMark()}</span><span class="of-brand-word">Only<span>Flora</span></span></a>
        <form class="of-search" action="${escapeHtml(searchAction)}" method="get"><input type="search" name="${escapeHtml(searchName)}" placeholder="Поиск растений, питомников, товаров..." aria-label="Поиск" required><button type="submit" aria-label="Найти"></button></form>
        <a class="of-location" href="#" aria-label="Регион: Москва">Москва⌄</a>
        <nav class="of-actions" aria-label="Личный раздел">
          <a class="of-action" href="${escapeHtml(links.favorites)}"><span class="of-action-icon">♡</span><span>Избранное</span></a>
          <a class="of-action" href="${escapeHtml(links.cart)}"><span class="of-action-icon">🛒</span><span>Корзина</span></a>
          <a class="of-action" href="${escapeHtml(links.account)}"><span class="of-action-icon">♙</span><span>Аккаунт</span></a>
        </nav>
      </header>
      <nav class="of-nav" aria-label="Основное меню">
        <a href="${escapeHtml(links.greenery)}">Озеленение</a>
        <a href="${escapeHtml(links.improvement)}">Благоустройство</a>
        <a href="${escapeHtml(links.marketplace)}">Торговая площадка</a>
        <a href="${escapeHtml(links.housing)}">Озеленение ЖК</a>
        <a href="${escapeHtml(links.landscape)}">Ландшафтный дизайн</a>
        <a href="${escapeHtml(links.care)}">Уход и материалы</a>
        <a href="${escapeHtml(links.nurseries)}">Питомники</a>
        <a href="${escapeHtml(links.sale)}">Акции</a>
        <a href="${escapeHtml(links.blog)}">Блог</a>
        <a href="${escapeHtml(links.about)}">О проекте</a>
        <span class="of-preview-badge">Only Test — предпросмотр</span>
      </nav>
      <section class="of-hero"${hero ? ` style="--of-hero-image:url('${escapeHtml(hero)}')"` : ""}>
        <div class="of-hero-copy"><h1>Растения<br>для красивой жизни</h1><p>Тысячи растений от проверенных питомников по всей России</p><a class="of-primary" href="${escapeHtml(catalogHref)}">Перейти в каталог</a></div>
      </section>
      <section class="of-benefits" aria-label="Преимущества OnlyFlora">
        <div class="of-benefit"><span class="of-benefit-icon">♧</span><span><strong>50+ садовых центров</strong>в одном каталоге</span></div>
        <div class="of-benefit"><span class="of-benefit-icon">▣</span><span><strong>Доставка</strong>по всей России</span></div>
        <div class="of-benefit"><span class="of-benefit-icon">♢</span><span><strong>Проверенные</strong>питомники</span></div>
        <div class="of-benefit"><span class="of-benefit-icon">♧</span><span><strong>Растения</strong>для любого проекта</span></div>
      </section>
      <section class="of-section">
        <div class="of-section-head"><h2>Категории растений</h2><a class="of-section-link" href="${escapeHtml(catalogHref)}">Смотреть все →</a></div>
        <div class="of-category-grid">${categoryCards}</div>
      </section>
      ${products.length ? `<section class="of-section"><div class="of-section-head"><h2>Популярные растения</h2><a class="of-section-link" href="${escapeHtml(catalogHref)}">В каталог →</a></div><div class="of-product-grid">${productCards}</div></section>` : ""}
      <footer class="of-footer">
        <div class="of-footer-brand">Only<span>Flora</span><small>Бедный не имеет тени</small></div>
        <nav aria-label="Юридическая информация">
          <a href="${legal.privacy}">Политика конфиденциальности</a>
          <a href="${legal.consent}">Согласие на обработку персональных данных</a>
          <a href="${legal.cookies}">Политика использования cookie</a>
          <a href="${legal.advertising}">Согласие на рекламные сообщения</a>
        </nav>
        <a class="of-footer-mail" href="mailto:agro@onlyflora.ru">agro@onlyflora.ru</a>
      </footer>
    </div>`;

  oldBody.prepend(root);
  oldBody.classList.add("of-modern-active");
  document.dispatchEvent(new CustomEvent("onlyflora:modern-ready"));
})();
