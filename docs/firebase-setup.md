# Настройка на Firebase за TableFlow

## 1. Създаване на проект

1. Отворете Firebase Console.
2. Създайте нов проект, например `tableflow`.
3. Google Analytics може да бъде изключен за начална версия.

## 2. Web app

1. В Project Overview натиснете иконата за Web app.
2. Въведете име, например `TableFlow`.
3. Копирайте обекта `firebaseConfig`.
4. Поставете стойностите в:

```text
public/js/firebase-config.js
```

Файлът трябва да изглежда така:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Тези стойности не са тайна парола. Защитата идва от Firebase Authentication и Firestore rules.

## 3. Authentication

1. Отворете Authentication.
2. Натиснете Get started.
3. В Sign-in method включете Email/Password.
4. В Users създайте първи потребител за ресторанта.

## 4. Cloud Firestore

1. Отворете Firestore Database.
2. Създайте база данни.
3. Изберете production mode.
4. Изберете близка локация в Европа, ако е налична.

## 5. Правила и индекси

Файловете вече са подготвени:

```text
firestore.rules
firestore.indexes.json
```

Когато стигнем до deploy, Firebase CLI ще ги качи автоматично.

## 6. Какво трябва да се случи след настройката

След презареждане на приложението трябва да видите екран `Вход`.

След успешен вход приложението автоматично създава:

```text
restaurants/main
```

с име `Моят ресторант` и собственик текущия Firebase потребител.