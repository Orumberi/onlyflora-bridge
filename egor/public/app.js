const $ = id => document.getElementById(id);
let accessKey = "", lastPlan = null, inputMode = "photo";
const money = value => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(value / 100);
function notice(message, error = false) { $("notice").textContent = message; $("notice").classList.toggle("error", error); }
function node(tag, text, className) { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (className) e.className = className; return e; }
async function api(path, body) {
  const response = await fetch(`./api/${path}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessKey}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  const result = await response.json();
  if (response.status === 401) { accessKey = ""; $("access").hidden = false; $("input-section").hidden = true; $("review").hidden = true; }
  if (!response.ok) throw new Error(result.error || "Не удалось выполнить запрос"); return result;
}
async function run(button, work) { button.disabled = true; try { await work(); } catch (e) { notice(e.name === "TimeoutError" ? "Подбор занял слишком много времени. Попробуйте меньше строк." : e.message, true); } finally { button.disabled = false; } }
function resetResult() { lastPlan = null; $("result").hidden = true; $("confirmed").checked = false; }
function setInputMode(mode) {
  inputMode = mode;
  for (const name of ["photo", "text"]) {
    const active = name === mode;
    $(`${name}-tab`).classList.toggle("active", active);
    $(`${name}-tab`).setAttribute("aria-selected", String(active));
    $(`${name}-pane`).hidden = !active;
  }
  resetInput();
}
function showLines(result) {
  resetResult(); $("lines").replaceChildren(); $("warnings").textContent = result.warnings.join(" ");
  result.lines.forEach(line => {
    const row = node("div", undefined, `line${line.uncertain ? " uncertain" : ""}`);
    for (const [key, caption] of [["name", "Растение / сорт"], ["quantity", "Шт."], ["height", "Высота"], ["container", "Контейнер"]]) {
      const label = node("label", caption), input = node("input"); input.dataset.field = key; input.value = line[key] ?? "";
      if (key === "quantity") { input.type = "number"; input.min = "1"; input.max = "100000"; input.step = "1"; }
      input.addEventListener("input", resetResult); label.append(input); row.append(label);
    }
    const remove = node("button", "Убрать"); remove.type = "button"; remove.addEventListener("click", () => { row.remove(); resetResult(); }); row.append(remove);
    if (line.note) row.append(node("div", line.note, "line-note")); $("lines").append(row);
  });
  $("review").hidden = false; notice(result.lines.length ? "Проверьте распознанный список ниже." : "Растения не найдены. Попробуйте другое фото или текст.", !result.lines.length);
}
$("unlock").addEventListener("click", () => { accessKey = $("key").value.trim(); if (!accessKey) return notice("Введите код тестовой версии.", true); $("key").value = ""; $("access").hidden = true; $("input-section").hidden = false; notice("Можно загрузить фото или вставить список."); });
$("extract").addEventListener("click", () => run($("extract"), async () => {
  const file = inputMode === "photo" ? $("photo").files[0] : null;
  const text = inputMode === "text" ? $("list").value.trim() : "";
  if (!file && !text) throw new Error("Загрузите фото или вставьте список растений.");
  notice(file ? "Читаю фотографию…" : "Разбираю список…"); resetResult(); $("review").hidden = true;
  let body = { text };
  if (file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Нужно фото JPEG, PNG или WebP до 5 МБ.");
    body = { image: await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Не удалось прочитать файл.")); reader.readAsDataURL(file); }) };
  }
  showLines(await api("extract", body));
}));
$("plan").addEventListener("click", () => run($("plan"), async () => {
  if (!$("confirmed").checked) throw new Error("Сначала проверьте список и поставьте галочку подтверждения.");
  const lines = [...$("lines").children].map(row => Object.fromEntries([...row.querySelectorAll("input")].map(input => [input.dataset.field, input.dataset.field === "quantity" ? Number(input.value) : input.value.trim()])));
  if (!lines.length || lines.some(l => !l.name || !Number.isInteger(l.quantity) || l.quantity <= 0)) throw new Error("Укажите название и положительное целое количество в каждой строке.");
  const submitted = JSON.stringify({ lines, strategy: $("strategy").value });
  lastPlan = null; $("result").hidden = true; notice("Проверяю предложения и остатки питомников…");
  const result = await api("plan", { lines, strategy: $("strategy").value, confirmed: true });
  const current = [...$("lines").children].map(row => Object.fromEntries([...row.querySelectorAll("input")].map(input => [input.dataset.field, input.dataset.field === "quantity" ? Number(input.value) : input.value.trim()])));
  if (submitted !== JSON.stringify({ lines: current, strategy: $("strategy").value })) throw new Error("Список изменён во время подбора. Подтвердите его и повторите поиск.");
  lastPlan = result; $("result-title").textContent = result.complete ? "Подбор готов" : "Подобрана часть списка";
  $("summary").textContent = `${money(result.totalKopecks)} · питомников: ${result.supplierCount} · без доставки`;
  $("offers").replaceChildren();
  for (const row of result.rows) {
    const card = node("article", undefined, "offer-row"); card.append(node("h3", `${row.request.name} · нужно ${row.request.quantity} шт.`));
    for (const offer of row.allocations) card.append(node("div", `${offer.name} · ${offer.nursery}\n${offer.height} · ${offer.container} · ${offer.sku}\n${offer.quantity} шт. × ${money(offer.priceKopecks)} = ${money(offer.totalKopecks)}`, "offer"));
    if (row.shortage) card.append(node("p", row.status === "needs_clarification" ? "Нужно уточнить растение или размер." : `Не подобрано: ${row.shortage} шт.`, "shortage"));
    if (row.alternatives.length) {
      const details = node("details"); details.append(node("summary", "Возможные варианты — не включены в сумму"));
      for (const offer of row.alternatives) details.append(node("p", `${offer.name} · ${offer.nursery} · ${offer.height} · ${offer.container} · ${money(offer.priceKopecks)} · ${offer.reason}`));
      details.append(node("p", "Чтобы выбрать вариант, укажите его название, размер и контейнер в списке выше и повторите подбор.")); card.append(details);
    }
    $("offers").append(card);
  }
  $("notes").textContent = `${result.notes.join(" ")} Проверено: ${new Date(result.checkedAt).toLocaleString("ru-RU")}.`;
  $("result").hidden = false; notice(result.complete ? "Все строки подобраны по каталогу." : "Проверьте недостающие позиции и предложенные варианты.");
}));
$("strategy").addEventListener("change", resetResult);
function resetInput() { resetResult(); $("review").hidden = true; }
$("photo").addEventListener("change", resetInput); $("list").addEventListener("input", resetInput);
for (const tab of document.querySelectorAll("[data-tab]")) tab.addEventListener("click", () => setInputMode(tab.dataset.tab));
$("back-to-input").addEventListener("click", () => { $("review").hidden = true; $("result").hidden = true; $("input-section").scrollIntoView({ behavior: "smooth", block: "start" }); });
const uploadDrop = $("upload-drop");
for (const eventName of ["dragenter", "dragover"]) uploadDrop.addEventListener(eventName, event => { event.preventDefault(); uploadDrop.classList.add("drag"); });
for (const eventName of ["dragleave", "drop"]) uploadDrop.addEventListener(eventName, event => { event.preventDefault(); uploadDrop.classList.remove("drag"); });
uploadDrop.addEventListener("drop", event => {
  const file = event.dataTransfer?.files?.[0];
  if (!file) return;
  const transfer = new DataTransfer(); transfer.items.add(file); $("photo").files = transfer.files;
  resetInput(); notice(`Выбран файл: ${file.name}`);
});
$("photo").addEventListener("change", () => { const file = $("photo").files[0]; if (file) notice(`Выбран файл: ${file.name}`); });
$("download").addEventListener("click", () => {
  if (!lastPlan) return;
  const rows = [["Запрошено", "Нужно шт.", "Подобрано", "Питомник", "Высота", "Контейнер", "Артикул", "Количество", "Цена ₽", "Сумма ₽", "Не подобрано шт."]];
  for (const row of lastPlan.rows) {
    for (const o of row.allocations) rows.push([row.request.name, row.request.quantity, o.name, o.nursery, o.height, o.container, o.sku, o.quantity, o.priceKopecks / 100, o.totalKopecks / 100, ""]);
    if (row.shortage) rows.push([row.request.name, row.request.quantity, "Не подобрано", "", "", "", "", "", "", "", row.shortage]);
  }
  const csv = rows.map(row => row.map(value => { let text = String(value); if (/^[=+@\-\t\r]/.test(text)) text = "'" + text; return '"' + text.replaceAll('"', '""') + '"'; }).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })); const a = node("a"); a.href = url; a.download = "onlyflora-podbor.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
fetch("./status").then(r => r.json()).then(status => {
  if (!status.ready) return notice("Помощник готовится к тестированию. Подключение к каталогу ещё не настроено.", true);
  $("access").hidden = false; $("photo").disabled = !status.photoReady;
  notice(status.photoReady ? "Тестовая версия помощника." : "Пока доступен список текстом. Распознавание фото ещё не подключено.");
}).catch(() => notice("Не удалось подключиться к помощнику. Попробуйте позже.", true));
