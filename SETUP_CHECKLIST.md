# 🚀 Чек-ліст для запуску Job Automation System

## ✅ Вже зроблено:
- ✅ Структура проекту створена
- ✅ Всі сервіси і компоненти написані  
- ✅ API ключі Instantly та Pipedrive додані
- ✅ Tailwind CSS налаштовано
- ✅ Папки credentials та logs створені

## ❗ Що ОБОВ'ЯЗКОВО потрібно зробити для запуску:

### 1. Скопіювати файл змінних середовища
```bash
cp config.env .env
```

### 2. Налаштувати Google Sheets API (КРИТИЧНО!)

**Ваші поточні налаштування:**
- GOOGLE_SHEETS_SPREADSHEET_ID=`your_google_sheets_id_here` ❌ **ПОТРІБНО ЗАМІНИТИ**
- GOOGLE_SHEETS_CREDENTIALS_PATH=`./credentials/google-sheets-credentials.json` ❌ **ПОТРІБНО ДОДАТИ ФАЙЛ**

**Кроки:**
1. Перейти до [Google Cloud Console](https://console.cloud.google.com)
2. Створити проект
3. Увімкнути Google Sheets API
4. Створити Service Account з роллю Editor
5. Завантажити JSON файл credentials
6. Зберегти як `credentials/google-sheets-credentials.json`
7. Створити Google Spreadsheet і взяти ID з URL
8. Замінити `your_google_sheets_id_here` на реальний ID

### 3. Додати Apollo API ключ (для збагачення контактів)

**Поточне налаштування:**
- APOLLO_API_KEY=`your_apollo_api_key_here` ❌ **ПОТРІБНО ЗАМІНИТИ**

**Кроки:**
1. Зареєструватися на [Apollo.io](https://www.apollo.io)
2. Отримати API ключ в Settings > API
3. Замінити `your_apollo_api_key_here` на реальний ключ

### 4. Налаштувати Pipedrive домен

**Поточне налаштування:**
- PIPEDRIVE_API_TOKEN=`f2c1d302933419a589dcbd39b987e4903112265b` ✅ **ДОДАНО**
- PIPEDRIVE_COMPANY_DOMAIN=`your_company_domain_here` ❌ **ПОТРІБНО ЗАМІНИТИ**

**Кроки:**
1. Знайти ваш Pipedrive домен (наприклад, якщо ваш URL `https://mycompany.pipedrive.com`, то домен = `mycompany`)
2. Замінити `your_company_domain_here` на ваш домен

### 5. Встановити залежності
```bash
npm run install-all
```

## 🔧 Перевірка налаштувань

Після налаштування запустіть:
```bash
npm run dev
```

1. Відкрийте http://localhost:3000
2. Перейдіть на вкладку "Configuration"
3. Натисніть "Validate All Connections"
4. Перевірте що всі сервіси мають зелені галочки ✅

## 📋 Поточний статус ваших API ключів:

| Сервіс | Статус | Примітка |
|--------|--------|----------|
| Bundesagentur | ✅ OK | Публічний API, ключ не потрібен |
| Google Sheets | ❌ ПОТРІБНО | Credentials файл + Spreadsheet ID |
| Apollo | ❌ ПОТРІБНО | API ключ |
| Instantly | ✅ OK | Ключ додано |
| Pipedrive | 🟡 ЧАСТКОВО | Ключ є, потрібен домен |

## 🚨 Критичні залежності:

### Без Google Sheets:
- ❌ Не буде збереження вакансій
- ❌ Не буде статистики
- ❌ Система не зможе відстежувати процес

### Без Apollo:
- ⚠️ Не буде збагачення контактів
- ⚠️ Будуть використовуватися тільки контакти з оголошень
- ✅ Основна функціональність працюватиме

### Без Pipedrive домену:
- ❌ Не працюватиме створення лідів
- ❌ Помилки при обробці позитивних відповідей

## 🎯 Мінімальна конфігурація для тестування:

Щоб запустити систему з базовою функціональністю:

1. **ОБОВ'ЯЗКОВО:** Google Sheets (credentials + spreadsheet ID)
2. **ОБОВ'ЯЗКОВО:** Pipedrive домен
3. **Опційно:** Apollo API ключ

## 📝 Файл .env має виглядати так:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Bundesagentur API
BUNDESAGENTUR_API_URL=https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobs

# Google Sheets API
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/google-sheets-credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=1XaZ2bY3c4D5e6F7g8H9i0J1k2L3m4N5o6P7q8R9s  # ←← ЗАМІНИТИ

# Apollo API
APOLLO_API_KEY=apollo_xxxxxxxxxxxxxxx  # ←← ДОДАТИ

# Instantly API
INSTANTLY_API_KEY=NmM5ZWI3MzYtNjM0My00NWQ4LTliMjktMTM3MDkyZGNlNjgzOllBUm12WVpiQWdrQg==

# Pipedrive API  
PIPEDRIVE_API_TOKEN=f2c1d302933419a589dcbd39b987e4903112265b
PIPEDRIVE_COMPANY_DOMAIN=mycompany  # ←← ЗАМІНИТИ

# Automation Settings
SEARCH_INTERVAL_HOURS=24
MAX_RESULTS_PER_SEARCH=100
DEFAULT_LOCATION=Germany
LOG_LEVEL=info
```

## 🔥 Швидкий старт (якщо все налаштовано):

```bash
# 1. Копіювати config.env в .env та заповнити недостаючі дані
cp config.env .env

# 2. Встановити залежності
npm run install-all

# 3. Запустити систему
npm run dev

# 4. Відкрити браузер
open http://localhost:3000
```

## ❌ Типові помилки при запуску:

1. **"Google Sheets credentials not found"**
   - Перевірте файл `credentials/google-sheets-credentials.json`

2. **"Apollo API rate limit"**
   - Apollo має ліміт, це нормально

3. **"Pipedrive invalid domain"**
   - Перевірте формат домену (без .pipedrive.com)

4. **"CORS error"**
   - Перевірте що backend запущений на порту 3001 