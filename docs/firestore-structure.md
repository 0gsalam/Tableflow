# Структура на базата данни

TableFlow използва Cloud Firestore. Данните са организирани по ресторант, за да може по-късно лесно да се добавят повече обекти или екипи.

## Колекции

```text
restaurants/{restaurantId}
  tables/{tableId}
  reservations/{reservationId}
  staff/{userId}
```

## restaurants/{restaurantId}

```json
{
  "name": "Ресторант",
  "timezone": "Europe/Sofia",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

## tables/{tableId}

```json
{
  "restaurantId": "restaurantId",
  "name": "Маса 4",
  "number": 4,
  "seats": 6,
  "shape": "round",
  "positionX": 350,
  "positionY": 200,
  "notes": "До прозореца",
  "isActive": true,
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp"
}
```

Позволени стойности за `shape`:

```text
round
square
rectangle
```

В интерфейса тези стойности се показват като:

```text
Кръгла
Квадратна
Правоъгълна
```

## reservations/{reservationId}

```json
{
  "restaurantId": "restaurantId",
  "tableId": "tableId",
  "customerName": "Иван Петров",
  "customerNameNormalized": "иван петров",
  "phone": "+359888123456",
  "guests": 4,
  "date": "2026-07-09",
  "startTime": "20:00",
  "endTime": "21:30",
  "startMinutes": 1200,
  "endMinutes": 1290,
  "status": "confirmed",
  "notes": "Рожден ден",
  "createdAt": "serverTimestamp",
  "updatedAt": "serverTimestamp",
  "createdBy": "firebaseUserId"
}
```

Позволени стойности за `status`:

```text
confirmed
cancelled
completed
```

В интерфейса тези стойности се показват като:

```text
Потвърдена
Отказана
Приключена
```

## Проверка за конфликт

Две резервации за една и съща маса и дата са в конфликт, ако интервалите им се застъпват:

```text
нова.startMinutes < съществуваща.endMinutes
нова.endMinutes > съществуваща.startMinutes
```

Пример:

```text
20:00 - 21:00 и 21:00 - 22:00 са позволени.
20:00 - 21:00 и 20:30 - 21:30 са конфликт.
```

## Български формати

В базата датата се пази като `YYYY-MM-DD`, за да се сортира лесно. В интерфейса винаги се показва като `09.07.2026`.

В базата часът се пази като `HH:mm`. В интерфейса винаги се показва като `20:00`.
