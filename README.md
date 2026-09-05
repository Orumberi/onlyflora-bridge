# OnlyFlora Bridge

Закрытый MCP-мост между ChatGPT/Codex и каталогом OnlyFlora в Webasyst Shop-Script.

Он позволяет после входа **на стороне Webasyst**:

- читать дерево категорий и карточки товаров;
- искать товары до создания дублей;
- создавать и редактировать категории;
- создавать товары/услуги с признаком `Цена от`;
- добавлять товар в категорию и создавать SKU;
- получать утверждённую структуру раздела «Благоустройство».

Удаляющих инструментов в мосте нет. Новые товары по умолчанию создаются неопубликованными.

## Важное ограничение

Стандартный API Webasyst не предоставляет методы для чтения и записи файлов темы дизайна. Поэтому этот мост намеренно **не редактирует** `OnlyTest/product.html`. Для шаблона потребуется отдельный адаптер внутри Webasyst либо ручная установка подготовленного файла в клоне `OnlyTest`. Рабочая тема при этом не затрагивается.

## Развёртывание в Timeweb Cloud

1. Создайте Backend-приложение из этого GitHub-репозитория.
2. Среда: Express, Node.js 24.
3. Команда сборки: `npm ci`.
4. Команда запуска: `npm start`.
5. Проверка состояния: `/health`.
6. Добавьте секретные переменные из `.env.example`.
7. Для `AUTH_SECRET` используйте не менее 32 случайных символов и храните значение только в секретах Timeweb.
8. После выдачи постоянного HTTPS-домена укажите его в `APP_BASE_URL` и перезапустите приложение.

После запуска MCP endpoint будет доступен по адресу:

```text
https://ВАШ-ДОМЕН/mcp
```

При подключении ChatGPT откроет стандартный вход Webasyst. Логин и пароль вводятся только на странице `flora.webasyst.cloud`, мост их не получает и не хранит. Выданный Webasyst access token помещается в зашифрованный токен соединения и не записывается в репозиторий или журналы.

## Локальная проверка

```bash
cp .env.example .env
npm ci
npm test
npm start
```

В режиме разработки без `APP_BASE_URL` используется `http://localhost:3000`. В production необходим постоянный HTTPS URL.

## Документация

- [Webasyst API и OAuth](https://developers.webasyst.com/docs/features/apis/)
- [Webasyst Shop-Script API](https://developers.webasyst.com/api/explorer/shop/)
- [OpenAI: создание MCP-сервера](https://developers.openai.com/plugins/build/mcp-server)
- [OpenAI: OAuth для MCP](https://developers.openai.com/plugins/build/auth)
