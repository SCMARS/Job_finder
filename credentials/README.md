# Credentials Setup

Эта папка предназначена для хранения конфиденциальных API ключей и сертификатов.

## Google Sheets API

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите Google Sheets API:
   - Перейдите в "APIs & Services" > "Library"
   - Найдите "Google Sheets API" и включите его
4. Создайте Service Account:
   - Перейдите в "APIs & Services" > "Credentials"
   - Нажмите "Create Credentials" > "Service Account"
   - Заполните форму и создайте аккаунт
5. Создайте JSON ключ:
   - Нажмите на созданный Service Account
   - Перейдите во вкладку "Keys"
   - Нажмите "Add Key" > "Create new key" > "JSON"
   - Сохраните файл как `google-sheets-credentials.json` в эту папку

## Настройка доступа к таблице

1. Откройте Google Sheets таблицу, куда хотите сохранять данные
2. Нажмите "Share" (Поделиться)
3. Добавьте email адрес из Service Account JSON файла (поле "client_email")
4. Дайте права "Editor" (Редактор)
5. Скопируйте ID таблицы из URL и добавьте в .env файл

## Структура файлов

```
credentials/
├── README.md                      # Этот файл
├── google-sheets-credentials.json # Google API ключ (создать вручную)
└── .gitkeep                       # Для сохранения папки в git
```

## Безопасность

- Файлы в этой папке исключены из git через .gitignore
- Никогда не публикуйте эти файлы в открытом доступе
- Регулярно ротируйте API ключи для безопасности 