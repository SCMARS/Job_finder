# Quick Start Guide

Запуск проекта за 3 минуты:

## 1. Автоматическая установка
```bash
./install.sh
```

## 2. Настройка API ключа (обязательно!)
```bash
nano .env
```
Добавьте ваш ключ 2Captcha:
```
TWOCAPTCHA_API_KEY=ваш_ключ_32_символа
```

## 3. Запуск
```bash
npm run dev
```

## 4. Открыть в браузере
- Frontend: http://localhost:3000
- Backend: http://localhost:3002

## Готово! 🎉

Система начнет поиск вакансий автоматически.

---

### Получить ключ 2Captcha:
1. Регистрация: https://2captcha.com
2. Пополнить баланс: $5-10
3. Скопировать API ключ из личного кабинета

### Проблемы?
- Проверьте логи: `tail -f logs/combined.log`  
- Перечитайте README.md
- Создайте issue на GitHub 