import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  updateDoc,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { getTodayKey, getCurrentMinutes, minutesToTime, timeToMinutes } from "./dates.js";

export const DEFAULT_RESTAURANT_ID = "main";

export const collections = {
  restaurants: "restaurants",
  tables: "tables",
  reservations: "reservations",
  waiting: "waiting",
  staff: "staff"
};

export function hasFirebaseConfig() {
  return Object.values(firebaseConfig).every((value) =>
    typeof value === "string" && value.trim() !== "" && !value.startsWith("ПОПЪЛНИ_")
  );
}

export async function initializeFirebaseServices() {
  if (!hasFirebaseConfig()) throw new Error("Firebase настройките не са попълнени.");
  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  await setPersistence(auth, browserLocalPersistence);
  return { app, auth, db };
}

export async function ensureDefaultRestaurant(db, user) {
  const userEmail = String(user.email || "").toLocaleLowerCase("bg-BG");
  const legacyRestaurantId = userEmail === "bulgaria@restaurant.bg" ? DEFAULT_RESTAURANT_ID : `user_${user.uid}`;
  const restaurantRef = doc(db, collections.restaurants, legacyRestaurantId);
  const snapshot = await getDoc(restaurantRef);
  if (snapshot.exists()) return { id: snapshot.id, ...snapshot.data() };

  const restaurant = {
    name: "Моят ресторант",
    timezone: "Europe/Sofia",
    ownerUid: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(restaurantRef, restaurant);
  return { id: legacyRestaurantId, ...restaurant };
}

export async function loadDashboardData(db, restaurantId) {
  const today = getTodayKey();
  const currentMinutes = getCurrentMinutes();
  const tablesRef = collection(db, collections.restaurants, restaurantId, collections.tables);
  const reservationsRef = collection(db, collections.restaurants, restaurantId, collections.reservations);

  const [tablesSnapshot, reservationsSnapshot] = await Promise.all([
    getDocs(query(tablesRef, where("isActive", "==", true))),
    getDocs(query(reservationsRef, where("date", "==", today)))
  ]);

  const tables = tablesSnapshot.docs.map((tableDoc) => ({ id: tableDoc.id, ...tableDoc.data() }));
  const reservations = reservationsSnapshot.docs
    .map((reservationDoc) => ({ id: reservationDoc.id, ...reservationDoc.data() }))
    .filter((reservation) => reservation.status === "confirmed")
    .sort((a, b) => Number(a.startMinutes || 0) - Number(b.startMinutes || 0));

  const occupiedTableIds = new Set();
  reservations
    .filter((reservation) => reservation.startMinutes <= currentMinutes && reservation.endMinutes > currentMinutes)
    .forEach((reservation) => getReservationTableIds(reservation).forEach((tableId) => occupiedTableIds.add(tableId)));

  const nextReservation = reservations.find((reservation) => reservation.startMinutes >= currentMinutes) ?? null;

  return {
    today,
    tablesCount: tables.length,
    todayReservationsCount: reservations.length,
    todayGuestsCount: reservations.reduce((sum, reservation) => sum + Number(reservation.guests || 0), 0),
    freeTablesCount: Math.max(tables.length - occupiedTableIds.size, 0),
    nextReservation
  };
}

export async function loadRestaurantTables(db, restaurantId) {
  const tablesRef = collection(db, collections.restaurants, restaurantId, collections.tables);
  const snapshot = await getDocs(query(tablesRef, where("isActive", "==", true)));
  return snapshot.docs
    .map((tableDoc) => ({ id: tableDoc.id, ...tableDoc.data() }))
    .sort((a, b) => Number(a.number || 0) - Number(b.number || 0));
}

export async function addRestaurantTable(db, restaurantId, formData) {
  const tablesRef = collection(db, collections.restaurants, restaurantId, collections.tables);
  const tableNumber = Number(formData.number);
  return addDoc(tablesRef, {
    restaurantId,
    name: formData.name?.trim() || `Маса ${tableNumber}`,
    number: tableNumber,
    seats: Number(formData.seats),
    shape: formData.shape,
    positionX: 80,
    positionY: 80,
    notes: formData.notes?.trim() || "",
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateRestaurantTable(db, restaurantId, tableId, formData) {
  const tableRef = doc(db, collections.restaurants, restaurantId, collections.tables, tableId);
  const tableNumber = Number(formData.number);
  return updateDoc(tableRef, {
    name: formData.name?.trim() || `Маса ${tableNumber}`,
    number: tableNumber,
    seats: Number(formData.seats),
    shape: formData.shape,
    notes: formData.notes?.trim() || "",
    updatedAt: serverTimestamp()
  });
}

export async function updateTablePosition(db, restaurantId, tableId, position) {
  const tableRef = doc(db, collections.restaurants, restaurantId, collections.tables, tableId);
  return updateDoc(tableRef, {
    positionX: Math.round(Number(position.x || 0)),
    positionY: Math.round(Number(position.y || 0)),
    updatedAt: serverTimestamp()
  });
}

export async function loadReservationAvailability(db, restaurantId, formData) {
  const tables = await loadRestaurantTables(db, restaurantId);
  const reservationsRef = collection(db, collections.restaurants, restaurantId, collections.reservations);
  const reservationsSnapshot = await getDocs(query(reservationsRef, where("date", "==", formData.date)));

  const centerMinutes = timeToMinutes(formData.time || "20:00");
  const startMinutes = Math.max(centerMinutes - 30, 0);
  const endMinutes = Math.min(centerMinutes + 30, 1439);
  const reservations = reservationsSnapshot.docs
    .map((reservationDoc) => ({ id: reservationDoc.id, ...reservationDoc.data() }))
    .filter((reservation) => reservation.status === "confirmed");

  const availability = tables.map((table) => {
    const conflictingReservation = reservations.find((reservation) => {
      const reservationTableIds = getReservationTableIds(reservation);
      return reservationTableIds.includes(table.id) && startMinutes < Number(reservation.endMinutes) && endMinutes > Number(reservation.startMinutes);
    });

    return {
      ...table,
      isAvailable: !conflictingReservation,
      conflictLabel: conflictingReservation ? `${conflictingReservation.customerName || "Резервация"} ${conflictingReservation.reservationTime || conflictingReservation.startTime}` : ""
    };
  });

  return {
    requestedGuests: Number(formData.guests || 0),
    startMinutes,
    endMinutes,
    startTime: minutesToTime(startMinutes),
    endTime: minutesToTime(endMinutes),
    tables: availability
  };
}

export async function loadReservationList(db, restaurantId, date) {
  const [tables, reservationsSnapshot] = await Promise.all([
    loadRestaurantTables(db, restaurantId),
    getDocs(query(collection(db, collections.restaurants, restaurantId, collections.reservations), where("date", "==", date)))
  ]);
  const tableNamesById = new Map(tables.map((table) => [table.id, table.name || `Маса ${table.number}` ]));
  return reservationsSnapshot.docs
    .map((reservationDoc) => {
      const reservation = { id: reservationDoc.id, ...reservationDoc.data() };
      const tableIds = getReservationTableIds(reservation);
      return {
        ...reservation,
        tableIds,
        tableNames: tableIds.map((tableId) => tableNamesById.get(tableId) || "Маса").join(", ")
      };
    })
    .sort((a, b) => Number(a.startMinutes || 0) - Number(b.startMinutes || 0));
}

export async function loadWaitingList(db, restaurantId) {
  const waitingRef = collection(db, collections.restaurants, restaurantId, collections.waiting);
  const snapshot = await getDocs(query(waitingRef, where("status", "==", "waiting")));
  return snapshot.docs
    .map((waitingDoc) => ({ id: waitingDoc.id, ...waitingDoc.data() }))
    .sort((a, b) => Number(a.createdOrder || 0) - Number(b.createdOrder || 0));
}

export async function createReservationFromSelection(db, restaurantId, user, formData) {
  const reservationsRef = collection(db, collections.restaurants, restaurantId, collections.reservations);
  const selectedTableIds = Array.isArray(formData.tableIds) ? formData.tableIds : [];
  const centerMinutes = timeToMinutes(formData.time);
  const startMinutes = Math.max(centerMinutes - 30, 0);
  const endMinutes = Math.min(centerMinutes + 30, 1439);

  if (!Number(formData.guests) || Number(formData.guests) < 1) throw new Error("Въведете брой гости.");
  if (!selectedTableIds.length) throw new Error("Изберете поне една свободна маса.");

  const availability = await loadReservationAvailability(db, restaurantId, formData);
  const unavailableSelected = availability.tables.some((table) => selectedTableIds.includes(table.id) && !table.isAvailable);
  if (unavailableSelected) throw new Error("Една от избраните маси вече е заета за този час.");

  return addDoc(reservationsRef, {
    restaurantId,
    tableId: selectedTableIds[0],
    tableIds: selectedTableIds,
    customerName: formData.customerName?.trim() || "Клиент",
    customerNameNormalized: (formData.customerName?.trim() || "клиент").toLocaleLowerCase("bg-BG"),
    phone: formData.phone?.trim() || "",
    guests: Number(formData.guests),
    date: formData.date,
    reservationTime: formData.time,
    startTime: minutesToTime(startMinutes),
    endTime: minutesToTime(endMinutes),
    startMinutes,
    endMinutes,
    status: "confirmed",
    notes: formData.notes?.trim() || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user.uid
  });
}

export async function createWaitingEntry(db, restaurantId, user, formData) {
  const waitingRef = collection(db, collections.restaurants, restaurantId, collections.waiting);
  if (!Number(formData.guests) || Number(formData.guests) < 1) throw new Error("Въведете брой гости.");

  return addDoc(waitingRef, {
    restaurantId,
    customerName: formData.customerName?.trim() || "Клиент",
    customerNameNormalized: (formData.customerName?.trim() || "клиент").toLocaleLowerCase("bg-BG"),
    phone: formData.phone?.trim() || "",
    guests: Number(formData.guests),
    status: "waiting",
    createdOrder: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user.uid
  });
}

export async function deleteReservation(db, restaurantId, reservationId) {
  const reservationRef = doc(db, collections.restaurants, restaurantId, collections.reservations, reservationId);
  return deleteDoc(reservationRef);
}

export async function deleteWaitingEntry(db, restaurantId, waitingId) {
  const waitingRef = doc(db, collections.restaurants, restaurantId, collections.waiting, waitingId);
  return deleteDoc(waitingRef);
}

function getReservationTableIds(reservation) {
  if (Array.isArray(reservation.tableIds) && reservation.tableIds.length) return reservation.tableIds;
  return reservation.tableId ? [reservation.tableId] : [];
}

export function getDataErrorMessage(error) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (text.includes("offline") || text.includes("network") || text.includes("твърде много време")) return "Не успяхме да се свържем с Firestore. Проверете интернет връзката и дали Cloud Firestore е активиран.";
  if (text.includes("permission") || text.includes("denied")) return "Firestore отказа достъп. Проверете правилата за достъп.";
  if (text.includes("index")) return "Firestore поиска индекс за тази заявка. Индексите са описани във firestore.indexes.json.";
  return error?.message || "Данните от Firestore не можаха да се заредят. Опитайте бутона Обнови.";
}


