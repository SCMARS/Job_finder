# Job Automation System - Автоматизированная система поиска работы

Полнофункциональная система для автоматического поиска вакансий на Bundesagentur für Arbeit с интеграцией множества сервисов.

## 🚀 Быстрый запуск

### Требования
- Node.js 18+ 
- npm или yarn
- Chrome/Chromium (для Puppeteer)

### 1. Клонирование и установка
```bash
# Клонировать проект
git clone <repository-url>
cd Job_finder-1

# Установить все зависимости одной командой
npm run install-all
```

### 2. Настройка окружения
```bash
# Скопировать пример конфигурации
cp env.example .env

# Отредактировать файл .env
nano .env
```

### 3. Запуск
```bash
# Запустить весь проект (backend + frontend)
npm run dev
```

После запуска:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3002
- Health check: http://localhost:3002/api/health

## 🔧 Конфигурация

### Обязательные настройки в .env

```env
# Сервер
PORT=3002
NODE_ENV=development

# 2Captcha (для решения капч)
TWOCAPTCHA_API_KEY=ваш_ключ_2captcha

# Google Sheets (опционально)
GOOGLE_SHEETS_CREDENTIALS_PATH=./credentials/google-sheets-credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=ваш_id_таблицы

# Apollo API (опционально)
APOLLO_API_KEY=ваш_apollo_ключ

# Instantly API (опционально)  
INSTANTLY_API_KEY=ваш_instantly_ключ

# Pipedrive API (опционально)
PIPEDRIVE_API_TOKEN=ваш_pipedrive_токен
PIPEDRIVE_COMPANY_DOMAIN=ваш_домен
```

### Получение API ключей

**2Captcha (обязательно для работы с капчами):**
1. Зарегистрируйтесь на https://2captcha.com
2. Пополните баланс ($5-10 достаточно)
3. Скопируйте API ключ из личного кабинета

**Google Sheets (для сохранения результатов):**
1. Создайте проект в Google Cloud Console
2. Включите Google Sheets API
3. Создайте Service Account
4. Скачайте JSON файл в папку `credentials/`
5. Поделитесь таблицей с email из Service Account

## 📁 Структура проекта

```
Job_finder-1/
├── server/                 # Backend (Node.js + Express)
│   ├── routes/            # API маршруты
│   ├── services/          # Бизнес-логика
│   ├── utils/             # Утилиты и логирование
│   └── index.js           # Главный файл сервера
├── client/                # Frontend (React + TypeScript)
│   ├── public/            # Статические файлы
│   ├── src/               # React компоненты
│   │   ├── components/    # UI компоненты
│   │   └── services/      # API клиенты
│   └── package.json       # Зависимости frontend
├── logs/                  # Логи системы
├── credentials/           # API ключи (создать вручную)
├── .env                   # Переменные окружения
└── package.json           # Зависимости backend
```

## 🎯 Основные функции

### Backend API
- **Поиск вакансий**: `/api/jobs/search`
- **Обогащение контактов**: автоматическое извлечение email/телефонов
- **Решение капч**: интеграция с 2Captcha
- **Сохранение данных**: Google Sheets, Apollo, Pipedrive
- **Автоматизация**: настраиваемые интервалы поиска

### Frontend
- **Dashboard**: обзор системы и статистики
- **Job Search**: интерфейс поиска вакансий
- **Automation Control**: управление автоматическим поиском
- **Statistics**: аналитика и отчеты
- **Configuration**: настройка параметров

## 🔄 Доступные команды

```bash
# Разработка
npm run dev          # Запуск backend + frontend
npm run server       # Только backend (порт 3002)
npm run client       # Только frontend (порт 3000)

# Установка
npm run install-all  # Установка всех зависимостей

# Production
npm run build        # Сборка frontend
npm start           # Запуск production сервера
```

## 🛠 Решение проблем

### "Module not found: Error: Can't resolve './App'"
```bash
# Переустановить зависимости frontend
cd client
rm -rf node_modules package-lock.json
npm install
cd ..
npm run dev
```

### Порт уже занят
```bash
# Найти процесс
lsof -ti:3002
# Завершить процесс
kill -9 <PID>
# Или изменить порт в .env
```

### Проблемы с Puppeteer
```bash
# Ubuntu/Debian
sudo apt-get install -y gconf-service libasound2 libatk1.0-0 libc6 libcairo2

# macOS
# Puppeteer должен работать из коробки
```

### Ошибки 2Captcha
- Проверьте баланс: `curl "http://2captcha.com/res.php?key=ВАШ_КЛЮЧ&action=getbalance"`
- Убедитесь, что ключ 32 символа
- Проверьте, что сервис доступен

## 📊 Мониторинг

### Логи
- `logs/combined.log` - все логи
- `logs/error.log` - только ошибки
- Логи ротируются автоматически

### Health Check
```bash
curl http://localhost:3002/api/health
```

### Статистика
- Веб-интерфейс: http://localhost:3000
- API: http://localhost:3002/api/statistics

## 🔒 Безопасность

- Все API ключи в `.env` файле
- `.env` исключен из git
- Логи не содержат чувствительных данных
- CORS настроен правильно

## 🚀 Production

### Подготовка
```bash
# Сборка frontend
cd client && npm run build && cd ..

# Установка PM2
npm install -g pm2

# Запуск
NODE_ENV=production pm2 start server/index.js --name job-automation
```

### Docker (опционально)
```dockerfile
# Dockerfile уже настроен
docker build -t job-automation .
docker run -p 3002:3002 job-automation
```

## 📈 Производительность

- **Многопоточность**: параллельная обработка вакансий
- **Кэширование**: результаты поиска кэшируются
- **Rate limiting**: соблюдение лимитов API
- **Оптимизация**: минимальное потребление ресурсов

## 🤝 Интеграции

- **Bundesagentur für Arbeit** - источник вакансий
- **2Captcha** - решение капч
- **Google Sheets** - сохранение результатов
- **Apollo** - обогащение контактов
- **Instantly** - email маркетинг
- **Pipedrive** - CRM интеграция

## 📞 Поддержка

1. Проверьте логи в папке `logs/`
2. Убедитесь, что все зависимости установлены
3. Проверьте настройки в `.env`
4. Создайте issue в репозитории

## 📄 Лицензия

MIT License - см. файл LICENSE

