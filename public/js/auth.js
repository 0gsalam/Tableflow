import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

export function watchAuthState(auth, onChange, onError) {
  return onAuthStateChanged(auth, onChange, onError);
}

export async function loginWithEmailAndPassword(auth, email, password) {
  const normalizedEmail = email.trim();
  return signInWithEmailAndPassword(auth, normalizedEmail, password);
}


export function logout(auth) {
  return signOut(auth);
}

export function getAuthErrorMessage(error) {
  const code = error?.code ?? "";
  const messages = {
    "auth/email-already-in-use": "Вече има профил с този имейл.",
    "auth/invalid-email": "Въведете валиден имейл адрес.",
    "auth/operation-not-allowed": "Регистрацията с имейл и парола не е включена във Firebase.",
    "auth/weak-password": "Паролата трябва да бъде поне 6 символа.",
    "auth/user-disabled": "Този профил е деактивиран.",
    "auth/user-not-found": "Няма профил с този имейл.",
    "auth/wrong-password": "Паролата е неправилна.",
    "auth/invalid-credential": "Невалидни данни за вход.",
    "auth/missing-password": "Въведете парола.",
    "auth/too-many-requests": "Има твърде много опити. Опитайте отново по-късно.",
    "auth/network-request-failed": "Няма връзка с мрежата. Проверете интернет връзката."
  };
  return messages[code] ?? "Заявката не беше успешна. Опитайте отново.";
}


