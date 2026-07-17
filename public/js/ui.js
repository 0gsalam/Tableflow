import { getTodayKey, minutesToTime } from "./dates.js";

function getAppRoot() {
  return document.querySelector("#app");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNextReservation(reservation) {
  if (!reservation) return "Няма предстояща резервация";
  const time = minutesToTime(reservation.startMinutes);
  const customer = reservation.customerName ? ` - ${reservation.customerName}` : "";
  return `${time}${customer}`;
}

function viewTitle(activeView) {
  if (activeView === "tables") return "Маси";
  if (activeView === "reservations") return "Резервации";
  if (activeView === "reservation-list") return "Списък";
  return "Табло";
}

function renderTopBar({ restaurant, activeView }) {
  const restaurantName = escapeHtml(restaurant.name ?? "Моят ресторант");
  return `
    <header class="top-bar">
      <div class="brand-row">
        <div class="brand-mark brand-mark-small" aria-hidden="true">T</div>
        <div>
          <p class="eyebrow">${restaurantName}</p>
          <h1>${viewTitle(activeView)}</h1>
        </div>
      </div>
      <div class="top-actions">
        <button class="ghost-button nav-button ${activeView === "dashboard" ? "active" : ""}" id="nav-dashboard" type="button">Табло</button>
        <button class="ghost-button nav-button ${activeView === "reservations" ? "active" : ""}" id="nav-reservations" type="button">Нова</button>
        <button class="ghost-button nav-button ${activeView === "reservation-list" ? "active" : ""}" id="nav-reservation-list" type="button">Списък</button>
        <button class="ghost-button" id="logout-button" type="button">Изход</button>
      </div>
    </header>
  `;
}

function bindTopBar({ onShowDashboard, onShowTables, onShowReservations, onShowReservationList, onLogout }) {
  document.querySelector("#nav-dashboard")?.addEventListener("click", onShowDashboard);
  document.querySelector("#nav-tables")?.addEventListener("click", onShowTables);
  document.querySelector("#nav-reservations")?.addEventListener("click", onShowReservations);
  document.querySelector("#nav-reservation-list")?.addEventListener("click", onShowReservationList);
  document.querySelector("#logout-button")?.addEventListener("click", onLogout);
}

export function renderFirebaseSetupRequired() {
  getAppRoot().innerHTML = `
    <section class="auth-page">
      <div class="auth-panel setup-panel">
        <div class="brand-row">
          <div class="brand-mark brand-mark-small" aria-hidden="true">T</div>
          <div><p class="eyebrow">TableFlow</p><h1>Нужна е Firebase настройка</h1></div>
        </div>
        <p class="panel-text">Създайте Firebase проект и копирайте настройките в <code>public/js/firebase-config.js</code>.</p>
      </div>
    </section>
  `;
}

export function renderLoginScreen({ onSubmit, errorMessage = "", isLoading = false }) {
  getAppRoot().innerHTML = `
    <section class="auth-page">
      <form class="auth-panel" id="login-form" novalidate>
        <div class="brand-row"><div class="brand-mark brand-mark-small" aria-hidden="true">T</div><div><p class="eyebrow">TableFlow</p><h1>Вход</h1></div></div>
        <p class="panel-text">Влезте, за да управлявате маси и резервации.</p>
        ${errorMessage ? `<div class="alert alert-error" role="alert">${escapeHtml(errorMessage)}</div>` : ""}
        <label class="field-label" for="email">Имейл</label>
        <input class="field-input" id="email" name="email" type="email" autocomplete="email" required placeholder="ime@restaurant.bg">
        <label class="field-label" for="password">Парола</label>
        <input class="field-input" id="password" name="password" type="password" autocomplete="current-password" required placeholder="Въведете парола">
        <button class="primary-button" type="submit" ${isLoading ? "disabled" : ""}>${isLoading ? "Влизане..." : "Вход"}</button>
      </form>
    </section>
  `;
  document.querySelector("#login-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit({ email: formData.get("email") ?? "", password: formData.get("password") ?? "" });
  });
}


export function renderDashboard({ user, restaurant, dashboard, activeView = "dashboard", warningMessage = "", onShowDashboard, onShowTables, onShowReservations, onShowReservationList, onLogout, onRefresh }) {
  const email = escapeHtml(user.email ?? "Потребител");
  const nextReservation = escapeHtml(formatNextReservation(dashboard.nextReservation));
  getAppRoot().innerHTML = `
    <section class="app-layout">
      ${renderTopBar({ restaurant, activeView })}
      <main class="dashboard-grid">
        ${warningMessage ? `<section class="summary-card wide-card warning-card"><p>${escapeHtml(warningMessage)}</p></section>` : ""}
        <section class="summary-card wide-card"><p class="eyebrow">Профил</p><h2>${email}</h2><p>Входът е активен.</p><button class="ghost-button compact-button" id="manage-tables-button" type="button">Настройки на масите</button></section>
        <section class="summary-card"><p class="metric-value">${dashboard.todayReservationsCount}</p><p class="metric-label">Резервации днес</p></section>
        <section class="summary-card"><p class="metric-value">${dashboard.todayGuestsCount}</p><p class="metric-label">Гости</p></section>
        <section class="summary-card"><p class="metric-value">${dashboard.freeTablesCount}</p><p class="metric-label">Свободни маси</p></section>
        <section class="summary-card wide-card"><p class="eyebrow">Следваща резервация</p><h2>${nextReservation}</h2><button class="primary-button compact-button" id="refresh-button" type="button">Обнови</button></section>
      </main>
    </section>
  `;
  bindTopBar({ onShowDashboard, onShowTables, onShowReservations, onShowReservationList, onLogout });
  document.querySelector("#refresh-button")?.addEventListener("click", onRefresh);
  document.querySelector("#manage-tables-button")?.addEventListener("click", onShowTables);
}

export function renderTablesScreen({ restaurant, tables, activeView = "tables", warningMessage = "", successMessage = "", editingTableId = null, onShowDashboard, onShowTables, onShowReservations, onShowReservationList, onLogout, onRefresh, onAddTable, onEditTable, onCancelEdit, onMoveTable }) {
  const editingTable = tables.find((table) => table.id === editingTableId) ?? null;
  const isEditing = Boolean(editingTable);
  const submitText = isEditing ? "Запази" : "Добави маса";
  const formTitle = isEditing ? "Редактирай маса" : "Добави маса";
  const tableRows = tables.length > 0
    ? tables.map((table) => `
        <article class="table-card ${table.id === editingTableId ? "selected-card" : ""}">
          <div><p class="eyebrow">${shapeLabel(table.shape)}</p><h2>${escapeHtml(table.name || `Маса ${table.number}`)}</h2><p>${Number(table.seats || 0)} места</p></div>
          ${table.notes ? `<p class="table-note">${escapeHtml(table.notes)}</p>` : ""}
          <div class="card-actions"><button class="ghost-button edit-table-button" type="button" data-table-id="${table.id}">Редактирай</button></div>
        </article>`).join("")
    : `<section class="summary-card wide-card"><h2>Няма добавени маси</h2><p>Добавете първата маса, за да започнем с резервациите.</p></section>`;
  const floorTables = tables.map((table, index) => {
    const x = Number.isFinite(Number(table.positionX)) ? Number(table.positionX) : 40 + index * 28;
    const y = Number.isFinite(Number(table.positionY)) ? Number(table.positionY) : 40 + index * 28;
    return `<button class="floor-table floor-table-${table.shape || "square"} ${table.id === editingTableId ? "editable" : "locked"}" type="button" data-table-id="${table.id}" style="left: ${x}px; top: ${y}px;"><span>${escapeHtml(table.name || `Маса ${table.number}`)}</span><small>${Number(table.seats || 0)} места</small></button>`;
  }).join("");
  const sidePanel = `
    <form class="summary-card table-form" id="table-form">
      <h2>${formTitle}</h2>
      <label class="field-label" for="table-number">Номер</label>
      <input class="field-input" id="table-number" name="number" type="number" min="1" required placeholder="4" value="${escapeHtml(editingTable?.number ?? "")}">
      <label class="field-label" for="table-name">Име</label>
      <input class="field-input" id="table-name" name="name" type="text" placeholder="Маса 4" value="${escapeHtml(editingTable?.name ?? "")}">
      <label class="field-label" for="table-seats">Места</label>
      <input class="field-input" id="table-seats" name="seats" type="number" min="1" required placeholder="4" value="${escapeHtml(editingTable?.seats ?? "")}">
      <label class="field-label" for="table-shape">Форма</label>
      <select class="field-input" id="table-shape" name="shape" required>
        <option value="round" ${editingTable?.shape === "round" ? "selected" : ""}>Кръгла</option>
        <option value="square" ${!editingTable || editingTable?.shape === "square" ? "selected" : ""}>Квадратна</option>
        <option value="rectangle" ${editingTable?.shape === "rectangle" ? "selected" : ""}>Правоъгълна</option>
      </select>
      <label class="field-label" for="table-notes">Бележки</label>
      <textarea class="field-input" id="table-notes" name="notes" rows="3" placeholder="До прозореца">${escapeHtml(editingTable?.notes ?? "")}</textarea>
      <button class="primary-button" type="submit">${submitText}</button>
      ${isEditing ? `<button class="ghost-button" id="cancel-edit-button" type="button">Отказ</button>` : ""}
      <button class="ghost-button" id="refresh-button" type="button">Обнови</button>
    </form>`;
  getAppRoot().innerHTML = `
    <section class="app-layout">
      ${renderTopBar({ restaurant, activeView })}
      <main class="tables-layout">
        ${warningMessage ? `<section class="summary-card wide-card warning-card"><p>${escapeHtml(warningMessage)}</p></section>` : ""}
        ${successMessage ? `<section class="summary-card wide-card success-card"><p>${escapeHtml(successMessage)}</p></section>` : ""}
        ${sidePanel}
        <section class="floor-section summary-card">
          <div class="section-heading-row"><div><p class="eyebrow">План</p><h2>Разположение на масите</h2></div><div class="floor-tools" aria-label="Инструменти за план"><button class="ghost-button floor-tool" id="zoom-out-button" type="button">-</button><button class="ghost-button floor-tool" id="zoom-reset-button" type="button">100%</button><button class="ghost-button floor-tool" id="zoom-in-button" type="button">+</button></div></div>
          <div class="floor-plan" id="floor-plan" aria-label="План на ресторанта"><div class="floor-canvas" id="floor-canvas">${floorTables || `<p class="empty-floor">Добавете маса, за да се появи в плана.</p>`}</div></div>
        </section>
        <section class="tables-list">${tableRows}</section>
      </main>
    </section>`;
  bindTopBar({ onShowDashboard, onShowTables, onShowReservations, onShowReservationList, onLogout });
  document.querySelector("#refresh-button")?.addEventListener("click", onRefresh);
  document.querySelector("#cancel-edit-button")?.addEventListener("click", onCancelEdit);
  document.querySelectorAll(".edit-table-button").forEach((button) => button.addEventListener("click", () => onEditTable(button.dataset.tableId)));
  document.querySelector("#table-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onAddTable({ number: formData.get("number"), name: formData.get("name"), seats: formData.get("seats"), shape: formData.get("shape"), notes: formData.get("notes") });
  });
  enableFloorMap(onMoveTable, editingTableId);
}

function shapeLabel(shape) {
  const labels = { round: "Кръгла", square: "Квадратна", rectangle: "Правоъгълна" };
  return labels[shape] ?? "Маса";
}

export function renderFatalError(message) {
  getAppRoot().innerHTML = `<section class="auth-page"><div class="auth-panel"><h1>Възникна грешка</h1><p class="panel-text">${escapeHtml(message)}</p></div></section>`;
}

function enableFloorMap(onMoveTable, editableTableId, options = {}) {
  const floorPlan = document.querySelector("#floor-plan");
  const canvas = document.querySelector("#floor-canvas");
  if (!floorPlan || !canvas) return;
  let scale = Number(options.initialView?.scale ?? (window.matchMedia("(max-width: 700px)").matches ? 0.75 : 1));
  let panX = Number(options.initialView?.panX ?? 0);
  let panY = Number(options.initialView?.panY ?? 0);
  let activeTable = null;
  let isPanning = false;
  let pointerOffsetX = 0;
  let pointerOffsetY = 0;
  let panStartX = 0;
  let panStartY = 0;
  let originPanX = 0;
  let originPanY = 0;
  function applyTransform() {
    canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    const resetButton = document.querySelector("#zoom-reset-button");
    if (resetButton) resetButton.textContent = `${Math.round(scale * 100)}%`;
    options.onViewChange?.({ scale, panX, panY });
  }
  function viewportToCanvas(clientX, clientY) {
    const planRect = floorPlan.getBoundingClientRect();
    return { x: (clientX - planRect.left - panX) / scale, y: (clientY - planRect.top - panY) / scale };
  }
  document.querySelector("#zoom-in-button")?.addEventListener("click", () => { scale = clamp(scale + 0.15, 0.5, 2.2); applyTransform(); });
  document.querySelector("#zoom-out-button")?.addEventListener("click", () => { scale = clamp(scale - 0.15, 0.5, 2.2); applyTransform(); });
  document.querySelector("#zoom-reset-button")?.addEventListener("click", () => { scale = window.matchMedia("(max-width: 700px)").matches ? 0.75 : 1; panX = 0; panY = 0; applyTransform(); });
  floorPlan.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".floor-table")) return;
    isPanning = true;
    panStartX = event.clientX;
    panStartY = event.clientY;
    originPanX = panX;
    originPanY = panY;
    floorPlan.setPointerCapture(event.pointerId);
    floorPlan.classList.add("panning");
  });
  floorPlan.addEventListener("pointermove", (event) => {
    if (!isPanning) return;
    panX = originPanX + event.clientX - panStartX;
    panY = originPanY + event.clientY - panStartY;
    applyTransform();
  });
  floorPlan.addEventListener("pointerup", () => { isPanning = false; floorPlan.classList.remove("panning"); });
  canvas.querySelectorAll(".floor-table").forEach((tableElement) => {
    tableElement.addEventListener("pointerdown", (event) => {
      if (tableElement.dataset.tableId !== editableTableId) return;
      activeTable = tableElement;
      const point = viewportToCanvas(event.clientX, event.clientY);
      pointerOffsetX = point.x - parseFloat(tableElement.style.left || "0");
      pointerOffsetY = point.y - parseFloat(tableElement.style.top || "0");
      tableElement.setPointerCapture(event.pointerId);
      tableElement.classList.add("dragging");
    });
    tableElement.addEventListener("pointermove", (event) => {
      if (activeTable !== tableElement) return;
      const point = viewportToCanvas(event.clientX, event.clientY);
      const nextX = point.x - pointerOffsetX;
      const nextY = point.y - pointerOffsetY;
      const maxX = canvas.clientWidth - tableElement.offsetWidth;
      const maxY = canvas.clientHeight - tableElement.offsetHeight;
      tableElement.style.left = `${clamp(nextX, 0, maxX)}px`;
      tableElement.style.top = `${clamp(nextY, 0, maxY)}px`;
    });
    tableElement.addEventListener("pointerup", () => {
      if (activeTable !== tableElement) return;
      tableElement.classList.remove("dragging");
      activeTable = null;
      onMoveTable(tableElement.dataset.tableId, { x: parseFloat(tableElement.style.left), y: parseFloat(tableElement.style.top) });
    });
  });
  applyTransform();
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(max, min));
}

function renderAvailabilityFloor(tables, selectedTableIds) {
  if (!tables.length) return "";
  const floorTables = tables.map((table, index) => {
    const x = Number.isFinite(Number(table.positionX)) ? Number(table.positionX) : 40 + index * 28;
    const y = Number.isFinite(Number(table.positionY)) ? Number(table.positionY) : 40 + index * 28;
    const isSelected = selectedTableIds.includes(table.id);
    const stateClass = table.isAvailable ? "available floor-availability-free" : "busy floor-availability-busy";
    const statusText = table.isAvailable ? (isSelected ? "Избрана" : "Свободна") : "Заета";
    return `<button class="floor-table availability-floor-table floor-table-${table.shape || "square"} locked ${stateClass} ${isSelected ? "selected-floor-table" : ""}" type="button" data-table-id="${table.id}" style="left: ${x}px; top: ${y}px;" ${table.isAvailable ? "" : "disabled"}><span>${escapeHtml(table.name || `Маса ${table.number}`)}</span><small>${Number(table.seats || 0)} места</small><small>${statusText}</small></button>`;
  }).join("");
  return `
    <section class="availability-floor-section">
      <div class="section-heading-row"><div><p class="eyebrow">Карта</p><h2>Свободни и заети маси</h2></div><div class="floor-tools" aria-label="Инструменти за карта"><button class="ghost-button floor-tool" id="zoom-out-button" type="button">-</button><button class="ghost-button floor-tool" id="zoom-reset-button" type="button">100%</button><button class="ghost-button floor-tool" id="zoom-in-button" type="button">+</button></div></div>
      <div class="floor-plan availability-floor" id="floor-plan" aria-label="Карта на свободните и заетите маси"><div class="floor-canvas" id="floor-canvas">${floorTables}</div></div>
    </section>`;
}

function renderWaitingDialog() {
  return `
    <div class="modal-backdrop" id="waiting-modal" role="dialog" aria-modal="true" aria-labelledby="waiting-title">
      <form class="summary-card waiting-dialog" id="waiting-form">
        <div class="section-heading-row">
          <div>
            <p class="eyebrow">Изчакващи</p>
            <h2 id="waiting-title">Добави изчакващи</h2>
          </div>
          <button class="ghost-button icon-close-button" id="close-waiting-button" type="button" aria-label="Затвори">x</button>
        </div>
        <label class="field-label" for="waiting-guests">За колко човека</label>
        <input class="field-input" id="waiting-guests" name="guests" type="number" min="1" required placeholder="4">
        <label class="field-label" for="waiting-name">Име</label>
        <input class="field-input" id="waiting-name" name="customerName" type="text" placeholder="Иван Петров">
        <label class="field-label" for="waiting-phone">Телефонен номер</label>
        <input class="field-input" id="waiting-phone" name="phone" type="tel" placeholder="0888 123 456">
        <div class="modal-actions">
          <button class="ghost-button" id="cancel-waiting-button" type="button">Отказ</button>
          <button class="primary-button" type="submit">Запази</button>
        </div>
      </form>
    </div>`;
}

export function renderReservationsScreen({ restaurant, activeView = "reservations", availability = null, selectedTableIds = [], lastForm = null, warningMessage = "", successMessage = "", waitingFormOpen = false, floorView = null, onFloorViewChange, onShowDashboard, onShowTables, onShowReservations, onShowReservationList, onLogout, onCheckAvailability, onToggleTable, onCreateReservation, onClearSelection, onOpenWaitingForm, onCloseWaitingForm, onCreateWaitingEntry }) {
  const selectedTime = lastForm?.time ?? "20:00";
  const [selectedHour = "20", selectedMinute = "00"] = selectedTime.split(":");
  const hourOptions = Array.from({ length: 24 }, (_, hour) => {
    const value = String(hour).padStart(2, "0");
    return `<option value="${value}" ${value === selectedHour ? "selected" : ""}>${value}</option>`;
  }).join("");
  const minuteOptions = ["00", "15", "30", "45"].map((value) => `<option value="${value}" ${value === selectedMinute ? "selected" : ""}>${value}</option>`).join("");
  const availableTables = availability?.tables ?? [];
  const selectedSeats = availableTables.filter((table) => selectedTableIds.includes(table.id)).reduce((sum, table) => sum + Number(table.seats || 0), 0);
  const requestedGuests = Number(lastForm?.guests || availability?.requestedGuests || 0);
  const canSave = selectedTableIds.length > 0 && Boolean(lastForm);
  const seatsStatus = requestedGuests ? (selectedSeats >= requestedGuests ? `Избраните места са достатъчни: ${selectedSeats}/${requestedGuests}.` : `Избрани места: ${selectedSeats}/${requestedGuests}. Можете да изберете още маси.`) : "";
  const availabilityFloor = availability ? renderAvailabilityFloor(availableTables, selectedTableIds) : "";
  const tableOptions = availableTables.length
    ? availableTables.map((table) => {
        const isSelected = selectedTableIds.includes(table.id);
        return `<button class="availability-table ${table.isAvailable ? "available" : "busy"} ${isSelected ? "selected" : ""}" type="button" data-table-id="${table.id}" ${table.isAvailable ? "" : "disabled"}><strong>${escapeHtml(table.name || `Маса ${table.number}`)}</strong><span>${Number(table.seats || 0)} места</span><small>${table.isAvailable ? (isSelected ? "Избрана" : "Свободна") : `Заета: ${escapeHtml(table.conflictLabel)}`}</small></button>`;
      }).join("")
    : `<section class="empty-state"><h2>Проверете свободните маси</h2><p>Въведете брой хора и час. Име и телефон може да добавите по-късно.</p></section>`;
  getAppRoot().innerHTML = `
    <section class="app-layout">
      ${renderTopBar({ restaurant, activeView })}
      <main class="reservation-layout">
        ${warningMessage ? `<section class="summary-card wide-card warning-card"><p>${escapeHtml(warningMessage)}</p></section>` : ""}
        ${successMessage ? `<section class="summary-card wide-card success-card"><p>${escapeHtml(successMessage)}</p></section>` : ""}
        <form class="summary-card reservation-form" id="reservation-search-form">
          <h2>Нова резервация</h2>
          <label class="field-label" for="guests">За колко човека</label>
          <input class="field-input" id="guests" name="guests" type="number" min="1" required placeholder="4" value="${escapeHtml(lastForm?.guests ?? "")}">
          <label class="field-label" for="reservation-hour">Час</label>
          <div class="time-picker" role="group" aria-label="Час на резервация">
            <select class="field-input time-select" id="reservation-hour" name="reservationHour" required>${hourOptions}</select>
            <span class="time-separator">:</span>
            <select class="field-input time-select" id="reservation-minute" name="reservationMinute" required>${minuteOptions}</select>
          </div>
          <label class="field-label" for="customer-name">Име</label>
          <input class="field-input" id="customer-name" name="customerName" type="text" placeholder="Иван Петров" value="${escapeHtml(lastForm?.customerName ?? "")}">
          <label class="field-label" for="phone">Телефонен номер</label>
          <input class="field-input" id="phone" name="phone" type="tel" placeholder="0888 123 456" value="${escapeHtml(lastForm?.phone ?? "")}">
          <label class="field-label" for="reservation-notes">Бележки</label>
          <textarea class="field-input" id="reservation-notes" name="notes" rows="3" placeholder="Повод, предпочитания, детайли">${escapeHtml(lastForm?.notes ?? "")}</textarea>
          <div class="reservation-form-actions">
            <button class="primary-button" type="submit">Покажи свободни маси</button>
            <button class="ghost-button waiting-open-button" id="open-waiting-button" type="button">Изчакващи</button>
          </div>
        </form>
        <section class="summary-card availability-panel">
          <div class="section-heading-row"><div><p class="eyebrow">Свободни маси</p><h2>${availability ? `${availability.startTime} - ${availability.endTime}` : "Час +/- 30 минути"}</h2><p>${seatsStatus}</p></div><button class="ghost-button" id="clear-selection-button" type="button">Изчисти</button></div>
          ${availabilityFloor || `<div class="availability-grid">${tableOptions}</div>`}
          <div class="reservation-actions"><button class="primary-button" id="save-reservation-button" type="button" ${canSave ? "" : "disabled"}>Запази резервация</button></div>
        </section>
      </main>
      ${waitingFormOpen ? renderWaitingDialog() : ""}
    </section>`;
  bindTopBar({ onShowDashboard, onShowTables, onShowReservations, onShowReservationList, onLogout });
  document.querySelector("#reservation-search-form").addEventListener("submit", (event) => {
    event.preventDefault();
    onCheckAvailability(readReservationForm(event.currentTarget));
  });
  document.querySelectorAll(".availability-table.available, .availability-floor-table.available").forEach((button) => button.addEventListener("click", () => onToggleTable(button.dataset.tableId)));
  enableFloorMap(() => {}, null, { initialView: floorView, onViewChange: onFloorViewChange });
  document.querySelector("#clear-selection-button")?.addEventListener("click", onClearSelection);
  document.querySelector("#open-waiting-button")?.addEventListener("click", onOpenWaitingForm);
  document.querySelector("#close-waiting-button")?.addEventListener("click", onCloseWaitingForm);
  document.querySelector("#cancel-waiting-button")?.addEventListener("click", onCloseWaitingForm);
  document.querySelector("#waiting-modal")?.addEventListener("click", (event) => {
    if (event.target.id === "waiting-modal") onCloseWaitingForm();
  });
  document.querySelector("#waiting-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    onCreateWaitingEntry(readWaitingForm(event.currentTarget));
  });
  document.querySelector("#save-reservation-button")?.addEventListener("click", () => {
    const form = document.querySelector("#reservation-search-form");
    onCreateReservation(readReservationForm(form));
  });
}

function statusLabel(status) {
  const labels = { confirmed: "Потвърдена", cancelled: "Отказана", completed: "Приключена" };
  return labels[status] ?? "Потвърдена";
}

export function renderReservationListScreen({ restaurant, activeView = "reservation-list", reservations = [], waitingEntries = [], showWaitingEntries = false, pendingDeleteId = null, waitingPendingDeleteId = null, warningMessage = "", successMessage = "", onShowDashboard, onShowTables, onShowReservations, onShowReservationList, onLogout, onRefresh, onToggleWaitingList, onAskDelete, onCancelDelete, onConfirmDelete, onAskDeleteWaiting, onCancelDeleteWaiting, onConfirmDeleteWaiting }) {
  const rows = reservations.length
    ? reservations.map((reservation) => {
        const isConfirming = reservation.id === pendingDeleteId;
        return `
          <article class="reservation-item">
            <div class="reservation-time-block">
              <strong>${escapeHtml(reservation.reservationTime || reservation.startTime || "--:--")}</strong>
              <span>${escapeHtml(statusLabel(reservation.status))}</span>
            </div>
            <div class="reservation-main-info">
              <h2>${escapeHtml(reservation.customerName || "Клиент")}</h2>
              <p>${Number(reservation.guests || 0)} гости · ${escapeHtml(reservation.tableNames || "Без маса")}</p>
              ${reservation.phone ? `<p>Телефон: ${escapeHtml(reservation.phone)}</p>` : ""}
              ${reservation.notes ? `<p>Бележки: ${escapeHtml(reservation.notes)}</p>` : ""}
              <div class="reservation-row-actions">
                ${isConfirming
                  ? `<span class="confirm-delete-text">Сигурни ли сте, че искате да изтриете?</span><button class="danger-button confirm-delete-button" type="button" data-reservation-id="${reservation.id}">Да, изтрий</button><button class="ghost-button cancel-delete-button" type="button">Отказ</button>`
                  : `<button class="ghost-button delete-reservation-button" type="button" data-reservation-id="${reservation.id}">Изтрий</button>`}
              </div>
            </div>
          </article>
        `;
      }).join("")
    : `<section class="empty-state"><h2>Няма резервации</h2><p>За днес няма записани резервации.</p></section>`;
  const waitingRows = waitingEntries.length
    ? waitingEntries.map((entry) => {
        const isConfirming = entry.id === waitingPendingDeleteId;
        return `
        <article class="reservation-item waiting-item">
          <div class="reservation-time-block">
            <strong>${Number(entry.guests || 0)}</strong>
            <span>гости</span>
          </div>
          <div class="reservation-main-info">
            <h2>${escapeHtml(entry.customerName || "Клиент")}</h2>
            ${entry.phone ? `<p>Телефон: ${escapeHtml(entry.phone)}</p>` : ""}
            <p>Статус: изчаква</p>
            <div class="reservation-row-actions">
              ${isConfirming
                ? `<span class="confirm-delete-text">Сигурни ли сте, че искате да изтриете?</span><button class="danger-button confirm-delete-waiting-button" type="button" data-waiting-id="${entry.id}">Да, изтрий</button><button class="ghost-button cancel-delete-waiting-button" type="button">Отказ</button>`
                : `<button class="ghost-button delete-waiting-button" type="button" data-waiting-id="${entry.id}">Изтрий</button>`}
            </div>
          </div>
        </article>
      `;
      }).join("")
    : `<section class="empty-state"><h2>Няма изчакващи</h2><p>В момента няма записани клиенти в изчакващи.</p></section>`;

  getAppRoot().innerHTML = `
    <section class="app-layout">
      ${renderTopBar({ restaurant, activeView })}
      <main class="reservation-list-layout">
        ${warningMessage ? `<section class="summary-card wide-card warning-card"><p>${escapeHtml(warningMessage)}</p></section>` : ""}
        ${successMessage ? `<section class="summary-card wide-card success-card"><p>${escapeHtml(successMessage)}</p></section>` : ""}
        <section class="summary-card reservation-list-toolbar">
          <div>
            <p class="eyebrow">Проследяване</p>
            <h2>Днешни резервации</h2>
          </div>
          <div class="list-toolbar-actions">
            <button class="ghost-button" id="refresh-button" type="button">Обнови</button>
            <button class="ghost-button ${showWaitingEntries ? "active-soft" : ""}" id="waiting-list-button" type="button">Изчакващи</button>
          </div>
        </section>
        <section class="reservation-list">${rows}</section>
        ${showWaitingEntries ? `<section class="reservation-list waiting-list"><div class="section-heading-row"><div><p class="eyebrow">Изчакващи</p><h2>Клиенти без резервация</h2></div></div>${waitingRows}</section>` : ""}
      </main>
    </section>
  `;

  bindTopBar({ onShowDashboard, onShowTables, onShowReservations, onShowReservationList, onLogout });
  document.querySelector("#refresh-button")?.addEventListener("click", onRefresh);
  document.querySelector("#waiting-list-button")?.addEventListener("click", onToggleWaitingList);
  document.querySelectorAll(".delete-reservation-button").forEach((button) => button.addEventListener("click", () => onAskDelete(button.dataset.reservationId)));
  document.querySelectorAll(".confirm-delete-button").forEach((button) => button.addEventListener("click", () => onConfirmDelete(button.dataset.reservationId)));
  document.querySelectorAll(".cancel-delete-button").forEach((button) => button.addEventListener("click", onCancelDelete));
  document.querySelectorAll(".delete-waiting-button").forEach((button) => button.addEventListener("click", () => onAskDeleteWaiting(button.dataset.waitingId)));
  document.querySelectorAll(".confirm-delete-waiting-button").forEach((button) => button.addEventListener("click", () => onConfirmDeleteWaiting(button.dataset.waitingId)));
  document.querySelectorAll(".cancel-delete-waiting-button").forEach((button) => button.addEventListener("click", onCancelDeleteWaiting));
}

function readWaitingForm(form) {
  const formData = new FormData(form);
  return {
    customerName: formData.get("customerName") ?? "",
    phone: formData.get("phone") ?? "",
    guests: formData.get("guests") ?? ""
  };
}

function readReservationForm(form) {
  const formData = new FormData(form);
  return {
    customerName: formData.get("customerName") ?? "",
    phone: formData.get("phone") ?? "",
    guests: formData.get("guests") ?? "",
    date: getTodayKey(),
    time: `${formData.get("reservationHour") ?? "20"}:${formData.get("reservationMinute") ?? "00"}`,
    notes: formData.get("notes") ?? ""
  };
}






