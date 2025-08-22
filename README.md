# Job Finder - Автоматизована система пошуку роботи

## 🚨 ВАЖЛИВО! Правильний запуск з GitHub

### Проблема: "Module not found: Error: Can't resolve './App'"
**Рішення:** Потрібно правильно клонувати та запустити проект.

```bash
# 1. Створіть нову папку для проекту
mkdir ~/Job_finder
cd ~/Job_finder

# 2. Клонуйте проект з GitHub
git clone https://github.com/SCMARS/Job_finder.git .

# 3. Встановіть залежності
npm install
cd client && npm install && cd ..

# 4. Запустіть проект
npm run dev
```

## 🚀 Швидкий запуск

### 1. Клонування проекту
```bash
# Створіть папку та клонуйте
mkdir ~/Job_finder
cd ~/Job_finder
git clone https://github.com/SCMARS/Job_finder.git .
```

### 2. Встановлення залежностей
```bash
# Встановлення залежностей для бекенду
npm install

# Встановлення залежностей для фронтенду
cd client
npm install
cd ..
```

### 3. Налаштування середовища
```bash
# Копіювання файлу змінних середовища
cp env.example .env

# Редагування .env файлу
nano .env
```

**Обов'язкові змінні в .env:**
```env
# API ключі
CAPTCHA_API_KEY=your_2captcha_api_key
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/service-account.json
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id

# Налаштування серверу
PORT=3002
NODE_ENV=development
```

### 4. Налаштування Google Sheets
1. Створіть Google Cloud проект
2. Увімкніть Google Sheets API
3. Створіть Service Account
4. Завантажте JSON ключ в папку `credentials/`
5. Поділіться таблицею з email з Service Account

### 5. Запуск проекту
```bash
# Запуск бекенду та фронтенду одночасно
npm run dev

# Або окремо:
npm run server    # Бекенд на порту 3002
npm run client    # Фронтенд на порту 3000
```

## 📁 Структура проекту

```
Job_finder/
├── server/                 # Бекенд (Node.js + Express)
│   ├── config/            # Конфігурація
│   ├── routes/            # API маршрути
│   ├── services/          # Бізнес-логіка
│   └── utils/             # Утиліти
├── client/                 # Фронтенд (React + TypeScript)
│   ├── public/            # Статичні файли
│   ├── src/               # React компоненти
│   └── package.json       # Залежності фронтенду
├── credentials/            # API ключі та сертифікати
├── logs/                  # Логи системи
└── package.json           # Залежності бекенду
```

## 🔧 API Endpoints

### Пошук роботи
```http
GET /api/jobs/search
Query params:
- keywords: пошукові слова
- location: місце пошуку
- radius: радіус пошуку (км)
- size: кількість результатів
- since: дата початку пошуку
```

### Збереження в Google Sheets
```http
POST /api/sheets/save
Body: масив робочих місць
```

### Статистика
```http
GET /api/statistics
```

## 🚨 Рішення проблем

### Порт вже використовується
```bash
# Знайти процес на порту 3002
lsof -ti:3002

# Зупинити процес
kill -9 <PID>

# Або змінити порт в .env
PORT=3003
```

### react-scripts не знайдено
```bash
cd client
npm install
npm start
```

### Модуль не знайдено (./App, ./reportWebVitals)
**Це означає, що файли не склонувалися правильно!**

```bash
# Перевірте наявність файлів
ls -la client/src/
ls -la client/public/

# Якщо файлів немає - переклонуйте проект
cd ..
rm -rf Job_finder
git clone https://github.com/SCMARS/Job_finder.git Job_finder
cd Job_finder
npm install
cd client && npm install && cd ..
```

### Could not find a required file: index.html
```bash
# Перевірте наявність файлів
ls -la client/public/

# Має бути: index.html, manifest.json, favicon.ico
# Якщо немає - переклонуйте проект
```

### Проблеми з Google Sheets
1. Перевірте правильність `GOOGLE_SHEETS_CREDENTIALS_PATH`
2. Переконайтеся, що таблиця доступна для Service Account
3. Перевірте права доступу до Google Cloud проекту

## 🔧 Правильне відкриття в WebStorm

**ВАЖЛИВО!** Відкрийте клоновану папку:

1. **File -> Open**
2. **Виберіть папку:** `~/Job_finder` (куди ви клонували проект)
3. **Натисніть Open**
4. WebStorm автоматично розпізнає це як Node.js проект

## 📊 Функціональність

- 🔍 Пошук роботи на Bundesagentur für Arbeit
- 🤖 Автоматичне рішення CAPTCHA
- 📧 Обогащення контактної інформації
- 📊 Збереження результатів в Google Sheets
- 🚫 Фільтрація по чорному списку компаній
- ⚡ Багатопотоковий пошук
- 📱 Адаптивний React інтерфейс

## 🛠 Технології

**Бекенд:**
- Node.js 18+
- Express.js
- Puppeteer (веб-скрапінг)
- Google Sheets API
- 2Captcha API

**Фронтенд:**
- React 18
- TypeScript
- CSS3

## 📝 Логування

Логи зберігаються в папці `logs/`:
- `app.log` - загальні логи
- `error.log` - помилки
- `access.log` - HTTP запити

## 🔒 Безпека

- API ключі зберігаються в `.env` файлі
- Credentials в окремій папці
- `.gitignore` налаштований правильно
- HTTPS для production

## 🚀 Production

```bash
# Білд фронтенду
cd client
npm run build

# Запуск production серверу
NODE_ENV=production npm start
```

## 📞 Підтримка

При проблемах:
1. Перевірте логи в `logs/`
2. Переконайтеся, що всі залежності встановлені
3. Перевірте налаштування в `.env`
4. **Якщо файлів немає - переклонуйте проект з GitHub**
5. Створіть issue на GitHub

## 📄 Ліцензія

MIT License

