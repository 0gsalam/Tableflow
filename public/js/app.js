import {
  getAuthErrorMessage,
  loginWithEmailAndPassword,
  logout,
  watchAuthState
} from "./auth.js?v=41";
import { prepareMobileBrowserChrome, registerServiceWorker } from "./pwa.js?v=41";
import { getTodayKey } from "./dates.js?v=41";
import {
  addRestaurantTable,
  createWaitingEntry,
  createReservationFromSelection,
  deleteReservation,
  deleteWaitingEntry,
  ensureDefaultRestaurant,
  getDataErrorMessage,
  hasFirebaseConfig,
  initializeFirebaseServices,
  loadDashboardData,
  loadReservationAvailability,
  loadReservationList,
  loadWaitingList,
  loadRestaurantTables,
  updateRestaurantTable,
  updateTablePosition
} from "./store.js?v=41";
import {
  renderDashboard,
  renderFatalError,
  renderFirebaseSetupRequired,
  renderLoginScreen,
  renderReservationListScreen,
  renderReservationsScreen,
  renderTablesScreen
} from "./ui.js?v=41";

registerServiceWorker();
prepareMobileBrowserChrome();
renderDashboardSkeleton();

let services = null;
let currentUser = null;
let currentRestaurant = { id: "main", name: "Моят ресторант" };
let currentTables = [];
let editingTableId = null;
let selectedReservationTableIds = [];
let lastReservationForm = null;
let currentAvailability = null;
let currentReservationList = [];
let currentWaitingList = [];
let showWaitingEntries = false;
let waitingFormOpen = false;
let reservationPendingDeleteId = null;
let waitingPendingDeleteId = null;
let reservationFloorView = null;

const emptyDashboard = { todayReservationsCount: 0, todayGuestsCount: 0, freeTablesCount: 0, nextReservation: null };

async function startApp() {
  if (!hasFirebaseConfig()) { renderFirebaseSetupRequired(); return; }

  try { services = await initializeFirebaseServices(); }
  catch (error) { renderFatalError(error.message || "Приложението не можа да стартира."); return; }

  watchAuthState(services.auth, async (user) => {
    if (user) { currentUser = user; await showDashboard(); return; }
    currentUser = null;
    showLogin();
  }, () => renderFatalError("Не успяхме да проверим състоянието на входа."));
}

function renderDashboardSkeleton() {
  document.querySelector("#app").innerHTML = `<section class="startup-screen"><div class="brand-mark" aria-hidden="true">T</div><h1>TableFlow</h1><p>Зареждане на приложението...</p></section>`;
}

function withTimeout(promise, milliseconds) {
  return Promise.race([promise, new Promise((_, reject) => window.setTimeout(() => reject(new Error("Firestore заявката отне твърде много време.")), milliseconds))]);
}

function getShellActions() {
  return {
    onShowDashboard: () => showDashboard(),
    onShowTables: () => showTables(),
    onShowReservations: () => resetAndShowReservations(),
    onShowReservationList: () => showReservationList(),
    onLogout: async () => logout(services.auth)
  };
}

function showLogin(errorMessage = "") { renderLoginScreen({ errorMessage, onSubmit: handleLogin }); }

async function ensureRestaurantReady() {
  currentRestaurant = await withTimeout(ensureDefaultRestaurant(services.db, currentUser), 3500);
  return currentRestaurant;
}

async function showDashboard() {
  editingTableId = null;
  renderDashboard({ user: currentUser, restaurant: currentRestaurant, dashboard: emptyDashboard, activeView: "dashboard", warningMessage: "Зареждаме данните от Firestore...", ...getShellActions(), onRefresh: showDashboard });

  try {
    const restaurant = await ensureRestaurantReady();
    const dashboard = await withTimeout(loadDashboardData(services.db, restaurant.id), 3500);
    renderDashboard({ user: currentUser, restaurant, dashboard, activeView: "dashboard", ...getShellActions(), onRefresh: showDashboard });
  } catch (error) {
    renderDashboard({ user: currentUser, restaurant: currentRestaurant, dashboard: emptyDashboard, activeView: "dashboard", warningMessage: getDataErrorMessage(error), ...getShellActions(), onRefresh: showDashboard });
  }
}

async function showTables(message = "") {
  if (typeof message !== "string") message = "";
  renderTablesScreen({ restaurant: currentRestaurant, tables: currentTables, activeView: "tables", warningMessage: message || "Зареждаме масите...", editingTableId, ...getShellActions(), onRefresh: () => showTables(), onAddTable: handleAddTable, onEditTable: startEditTable, onCancelEdit: cancelEditTable, onMoveTable: handleMoveTable });

  try {
    const restaurant = await ensureRestaurantReady();
    currentTables = await withTimeout(loadRestaurantTables(services.db, restaurant.id), 3500);
    renderTablesScreen({ restaurant, tables: currentTables, activeView: "tables", successMessage: message, editingTableId, ...getShellActions(), onRefresh: () => showTables(), onAddTable: handleAddTable, onEditTable: startEditTable, onCancelEdit: cancelEditTable, onMoveTable: handleMoveTable });
  } catch (error) {
    renderTablesScreen({ restaurant: currentRestaurant, tables: currentTables, activeView: "tables", warningMessage: getDataErrorMessage(error), editingTableId, ...getShellActions(), onRefresh: () => showTables(), onAddTable: handleAddTable, onEditTable: startEditTable, onCancelEdit: cancelEditTable, onMoveTable: handleMoveTable });
  }
}

async function showReservations(message = "") {
  if (typeof message !== "string") message = "";
  renderReservationsScreen({ restaurant: currentRestaurant, activeView: "reservations", availability: currentAvailability, selectedTableIds: selectedReservationTableIds, lastForm: lastReservationForm, successMessage: message, waitingFormOpen, ...getShellActions(), onCheckAvailability: handleCheckAvailability, onToggleTable: toggleReservationTable, onCreateReservation: handleCreateReservation, onClearSelection: clearReservationSelection, onOpenWaitingForm: openWaitingForm, onCloseWaitingForm: closeWaitingForm, onCreateWaitingEntry: handleCreateWaitingEntry, floorView: reservationFloorView, onFloorViewChange: updateReservationFloorView });
}

function resetAndShowReservations() {
  selectedReservationTableIds = [];
  lastReservationForm = null;
  currentAvailability = null;
  waitingFormOpen = false;
  reservationFloorView = null;
  showReservations();
}

async function showReservationList(message = "") {
  renderReservationListScreen({ restaurant: currentRestaurant, activeView: "reservation-list", reservations: currentReservationList, waitingEntries: currentWaitingList, showWaitingEntries, pendingDeleteId: reservationPendingDeleteId, waitingPendingDeleteId, warningMessage: message || "Зареждаме днешните резервации...", ...getShellActions(), onRefresh: showReservationList, onToggleWaitingList: toggleWaitingList, onAskDelete: askDeleteReservation, onCancelDelete: cancelDeleteReservation, onConfirmDelete: confirmDeleteReservation, onAskDeleteWaiting: askDeleteWaiting, onCancelDeleteWaiting: cancelDeleteWaiting, onConfirmDeleteWaiting: confirmDeleteWaiting });

  try {
    const restaurant = await ensureRestaurantReady();
    const today = getTodayKey();
    [currentReservationList, currentWaitingList] = await withTimeout(Promise.all([
      loadReservationList(services.db, restaurant.id, today),
      loadWaitingList(services.db, restaurant.id)
    ]), 3500);
    renderReservationListScreen({ restaurant, activeView: "reservation-list", reservations: currentReservationList, waitingEntries: currentWaitingList, showWaitingEntries, pendingDeleteId: reservationPendingDeleteId, waitingPendingDeleteId, ...getShellActions(), onRefresh: showReservationList, onToggleWaitingList: toggleWaitingList, onAskDelete: askDeleteReservation, onCancelDelete: cancelDeleteReservation, onConfirmDelete: confirmDeleteReservation, onAskDeleteWaiting: askDeleteWaiting, onCancelDeleteWaiting: cancelDeleteWaiting, onConfirmDeleteWaiting: confirmDeleteWaiting });
  } catch (error) {
    renderReservationListScreen({ restaurant: currentRestaurant, activeView: "reservation-list", reservations: currentReservationList, waitingEntries: currentWaitingList, showWaitingEntries, pendingDeleteId: reservationPendingDeleteId, waitingPendingDeleteId, warningMessage: getDataErrorMessage(error), ...getShellActions(), onRefresh: showReservationList, onToggleWaitingList: toggleWaitingList, onAskDelete: askDeleteReservation, onCancelDelete: cancelDeleteReservation, onConfirmDelete: confirmDeleteReservation, onAskDeleteWaiting: askDeleteWaiting, onCancelDeleteWaiting: cancelDeleteWaiting, onConfirmDeleteWaiting: confirmDeleteWaiting });
  }
}

function startEditTable(tableId) { editingTableId = tableId; showTables(); }
function cancelEditTable() { editingTableId = null; showTables(); }

async function handleAddTable(formData) {
  try {
    const restaurant = await ensureRestaurantReady();
    if (editingTableId) {
      await withTimeout(updateRestaurantTable(services.db, restaurant.id, editingTableId, formData), 3500);
      editingTableId = null;
      currentTables = await withTimeout(loadRestaurantTables(services.db, restaurant.id), 3500);
      await showTables("Масата е запазена успешно."); return;
    }
    await withTimeout(addRestaurantTable(services.db, restaurant.id, formData), 3500);
    currentTables = await withTimeout(loadRestaurantTables(services.db, restaurant.id), 3500);
    await showTables("Масата е добавена успешно.");
  } catch (error) { await showTables(getDataErrorMessage(error)); }
}

async function handleMoveTable(tableId, position) {
  const table = currentTables.find((item) => item.id === tableId);
  if (table) { table.positionX = position.x; table.positionY = position.y; }
  try { await updateTablePosition(services.db, currentRestaurant.id, tableId, position); }
  catch (error) { await showTables(getDataErrorMessage(error)); }
}

async function handleCheckAvailability(formData) {
  try {
    const restaurant = await ensureRestaurantReady();
    lastReservationForm = formData;
    selectedReservationTableIds = [];
    reservationFloorView = null;
    currentAvailability = await withTimeout(loadReservationAvailability(services.db, restaurant.id, formData), 3500);
    await showReservations();
  } catch (error) {
    renderReservationsScreen({ restaurant: currentRestaurant, activeView: "reservations", availability: currentAvailability, selectedTableIds: selectedReservationTableIds, lastForm: lastReservationForm, warningMessage: getDataErrorMessage(error), waitingFormOpen, ...getShellActions(), onCheckAvailability: handleCheckAvailability, onToggleTable: toggleReservationTable, onCreateReservation: handleCreateReservation, onClearSelection: clearReservationSelection, onOpenWaitingForm: openWaitingForm, onCloseWaitingForm: closeWaitingForm, onCreateWaitingEntry: handleCreateWaitingEntry, floorView: reservationFloorView, onFloorViewChange: updateReservationFloorView });
  }
}

function updateReservationFloorView(view) {
  reservationFloorView = view;
}

function toggleReservationTable(tableId) {
  if (selectedReservationTableIds.includes(tableId)) selectedReservationTableIds = selectedReservationTableIds.filter((id) => id !== tableId);
  else selectedReservationTableIds = [...selectedReservationTableIds, tableId];
  showReservations();
}

function clearReservationSelection() { selectedReservationTableIds = []; showReservations(); }

async function handleCreateReservation(formData) {
  try {
    const restaurant = await ensureRestaurantReady();
    await withTimeout(createReservationFromSelection(services.db, restaurant.id, currentUser, { ...formData, tableIds: selectedReservationTableIds }), 3500);
    selectedReservationTableIds = [];
    currentAvailability = null;
    lastReservationForm = null;
    currentReservationList = [];
    await showReservations("Резервацията е създадена успешно.");
  } catch (error) {
    renderReservationsScreen({ restaurant: currentRestaurant, activeView: "reservations", availability: currentAvailability, selectedTableIds: selectedReservationTableIds, lastForm: formData, warningMessage: getDataErrorMessage(error), waitingFormOpen, ...getShellActions(), onCheckAvailability: handleCheckAvailability, onToggleTable: toggleReservationTable, onCreateReservation: handleCreateReservation, onClearSelection: clearReservationSelection, onOpenWaitingForm: openWaitingForm, onCloseWaitingForm: closeWaitingForm, onCreateWaitingEntry: handleCreateWaitingEntry, floorView: reservationFloorView, onFloorViewChange: updateReservationFloorView });
  }
}

function openWaitingForm() {
  waitingFormOpen = true;
  showReservations();
}

function closeWaitingForm() {
  waitingFormOpen = false;
  showReservations();
}

async function handleCreateWaitingEntry(formData) {
  try {
    const restaurant = await ensureRestaurantReady();
    await withTimeout(createWaitingEntry(services.db, restaurant.id, currentUser, formData), 3500);
    waitingFormOpen = false;
    currentWaitingList = [];
    await showReservations("Клиентът е добавен в изчакващи.");
  } catch (error) {
    renderReservationsScreen({ restaurant: currentRestaurant, activeView: "reservations", availability: currentAvailability, selectedTableIds: selectedReservationTableIds, lastForm: lastReservationForm, warningMessage: getDataErrorMessage(error), waitingFormOpen, ...getShellActions(), onCheckAvailability: handleCheckAvailability, onToggleTable: toggleReservationTable, onCreateReservation: handleCreateReservation, onClearSelection: clearReservationSelection, onOpenWaitingForm: openWaitingForm, onCloseWaitingForm: closeWaitingForm, onCreateWaitingEntry: handleCreateWaitingEntry, floorView: reservationFloorView, onFloorViewChange: updateReservationFloorView });
  }
}

function toggleWaitingList() {
  showWaitingEntries = !showWaitingEntries;
  renderReservationListScreen({ restaurant: currentRestaurant, activeView: "reservation-list", reservations: currentReservationList, waitingEntries: currentWaitingList, showWaitingEntries, pendingDeleteId: reservationPendingDeleteId, waitingPendingDeleteId, ...getShellActions(), onRefresh: showReservationList, onToggleWaitingList: toggleWaitingList, onAskDelete: askDeleteReservation, onCancelDelete: cancelDeleteReservation, onConfirmDelete: confirmDeleteReservation, onAskDeleteWaiting: askDeleteWaiting, onCancelDeleteWaiting: cancelDeleteWaiting, onConfirmDeleteWaiting: confirmDeleteWaiting });
}

function askDeleteReservation(reservationId) {
  reservationPendingDeleteId = reservationId;
  renderReservationListScreen({ restaurant: currentRestaurant, activeView: "reservation-list", reservations: currentReservationList, waitingEntries: currentWaitingList, showWaitingEntries, pendingDeleteId: reservationPendingDeleteId, waitingPendingDeleteId, ...getShellActions(), onRefresh: showReservationList, onToggleWaitingList: toggleWaitingList, onAskDelete: askDeleteReservation, onCancelDelete: cancelDeleteReservation, onConfirmDelete: confirmDeleteReservation, onAskDeleteWaiting: askDeleteWaiting, onCancelDeleteWaiting: cancelDeleteWaiting, onConfirmDeleteWaiting: confirmDeleteWaiting });
}

function cancelDeleteReservation() {
  reservationPendingDeleteId = null;
  renderReservationListScreen({ restaurant: currentRestaurant, activeView: "reservation-list", reservations: currentReservationList, waitingEntries: currentWaitingList, showWaitingEntries, pendingDeleteId: reservationPendingDeleteId, waitingPendingDeleteId, ...getShellActions(), onRefresh: showReservationList, onToggleWaitingList: toggleWaitingList, onAskDelete: askDeleteReservation, onCancelDelete: cancelDeleteReservation, onConfirmDelete: confirmDeleteReservation, onAskDeleteWaiting: askDeleteWaiting, onCancelDeleteWaiting: cancelDeleteWaiting, onConfirmDeleteWaiting: confirmDeleteWaiting });
}

async function confirmDeleteReservation(reservationId) {
  try {
    const restaurant = await ensureRestaurantReady();
    await withTimeout(deleteReservation(services.db, restaurant.id, reservationId), 3500);
    reservationPendingDeleteId = null;
    currentReservationList = [];
    await showReservationList("Резервацията е изтрита успешно.");
  } catch (error) {
    reservationPendingDeleteId = null;
    renderReservationListScreen({ restaurant: currentRestaurant, activeView: "reservation-list", reservations: currentReservationList, waitingEntries: currentWaitingList, showWaitingEntries, warningMessage: getDataErrorMessage(error), waitingPendingDeleteId, ...getShellActions(), onRefresh: showReservationList, onToggleWaitingList: toggleWaitingList, onAskDelete: askDeleteReservation, onCancelDelete: cancelDeleteReservation, onConfirmDelete: confirmDeleteReservation, onAskDeleteWaiting: askDeleteWaiting, onCancelDeleteWaiting: cancelDeleteWaiting, onConfirmDeleteWaiting: confirmDeleteWaiting });
  }
}

function askDeleteWaiting(waitingId) {
  waitingPendingDeleteId = waitingId;
  renderReservationListScreen({ restaurant: currentRestaurant, activeView: "reservation-list", reservations: currentReservationList, waitingEntries: currentWaitingList, showWaitingEntries, pendingDeleteId: reservationPendingDeleteId, waitingPendingDeleteId, ...getShellActions(), onRefresh: showReservationList, onToggleWaitingList: toggleWaitingList, onAskDelete: askDeleteReservation, onCancelDelete: cancelDeleteReservation, onConfirmDelete: confirmDeleteReservation, onAskDeleteWaiting: askDeleteWaiting, onCancelDeleteWaiting: cancelDeleteWaiting, onConfirmDeleteWaiting: confirmDeleteWaiting });
}

function cancelDeleteWaiting() {
  waitingPendingDeleteId = null;
  renderReservationListScreen({ restaurant: currentRestaurant, activeView: "reservation-list", reservations: currentReservationList, waitingEntries: currentWaitingList, showWaitingEntries, pendingDeleteId: reservationPendingDeleteId, waitingPendingDeleteId, ...getShellActions(), onRefresh: showReservationList, onToggleWaitingList: toggleWaitingList, onAskDelete: askDeleteReservation, onCancelDelete: cancelDeleteReservation, onConfirmDelete: confirmDeleteReservation, onAskDeleteWaiting: askDeleteWaiting, onCancelDeleteWaiting: cancelDeleteWaiting, onConfirmDeleteWaiting: confirmDeleteWaiting });
}

async function confirmDeleteWaiting(waitingId) {
  try {
    const restaurant = await ensureRestaurantReady();
    await withTimeout(deleteWaitingEntry(services.db, restaurant.id, waitingId), 3500);
    waitingPendingDeleteId = null;
    currentWaitingList = [];
    showWaitingEntries = true;
    await showReservationList("Изчакващият клиент е изтрит успешно.");
  } catch (error) {
    waitingPendingDeleteId = null;
    renderReservationListScreen({ restaurant: currentRestaurant, activeView: "reservation-list", reservations: currentReservationList, waitingEntries: currentWaitingList, showWaitingEntries, warningMessage: getDataErrorMessage(error), pendingDeleteId: reservationPendingDeleteId, waitingPendingDeleteId, ...getShellActions(), onRefresh: showReservationList, onToggleWaitingList: toggleWaitingList, onAskDelete: askDeleteReservation, onCancelDelete: cancelDeleteReservation, onConfirmDelete: confirmDeleteReservation, onAskDeleteWaiting: askDeleteWaiting, onCancelDeleteWaiting: cancelDeleteWaiting, onConfirmDeleteWaiting: confirmDeleteWaiting });
  }
}

async function handleLogin({ email, password }) {
  renderLoginScreen({ onSubmit: handleLogin, isLoading: true });
  try { await loginWithEmailAndPassword(services.auth, email, password); }
  catch (error) { showLogin(getAuthErrorMessage(error)); }
}


startApp();







