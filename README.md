# Food Букет

Telegram Mini App для продажи цветов. Сейчас — **статичное демо** для GitHub Pages (без бэкенда), чтобы показать заказчику каталог, корзину, оформление и админку.

## Демо (GitHub Pages)

1. Залейте репозиторий на GitHub.
2. Settings → Pages → Source: **GitHub Actions**.
3. После пуша в `main` откроется URL вида `https://USER.github.io/FoodBuket/`.

Локально:

```bash
cd webapp && python3 -m http.server 8080
# → http://localhost:8080
```

В демо:
- каталог букетов, корзина, промокод `FLOWERS10`;
- оформление заказа с демо-оплатой (без CryptoBot);
- админ-панель (данные в `localStorage` браузера).

Переключатель режима: `webapp/js/config.js` → `demo: true`.

## Когда одобрят — подключение сервера

1. Скопируйте `.env.example` → `.env`, вставьте `BOT_TOKEN` и остальные ключи.
2. В `webapp/js/config.js` поставьте `demo: false` и при необходимости `apiBase`.
3. Запуск бэкенда:

```bash
python3 server.py
# → http://localhost:8877
```

4. Публичный HTTPS (туннель / VPS) + `python3 scripts/setup_bot.py https://ваш-url`.

Бэкенд (`server.py`) пока от магазина наклеек — его нужно будет адаптировать под цветы и ваш хостинг. Фронт уже готов под Food Букет.
