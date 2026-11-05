# Выпуск OnlyFlora в магазинах

## Постоянный ключ подписи

Ключ создаётся один раз и хранится отдельно от репозитория. Потеря ключа может
лишить возможности обновлять APK в RuStore. Никогда не коммитьте `.jks` в Git.

```bash
keytool -genkeypair -v \
  -keystore onlyflora-release.jks \
  -alias onlyflora \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -dname "CN=OnlyFlora, O=ИП Костына Анатолий Романович, C=RU"
```

## Секреты GitHub Actions

В настройках репозитория откройте `Settings → Secrets and variables → Actions`
и добавьте четыре repository secrets:

| Имя | Значение |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Base64-содержимое `onlyflora-release.jks` без переносов |
| `ANDROID_KEYSTORE_PASSWORD` | Пароль хранилища |
| `ANDROID_KEY_ALIAS` | `onlyflora` |
| `ANDROID_KEY_PASSWORD` | Пароль ключа |

Получить Base64 в Linux/macOS:

```bash
base64 < onlyflora-release.jks | tr -d '\n'
```

После добавления секретов запустите workflow `Build OnlyFlora Android release`.
Готовый артефакт содержит `OnlyFlora-1.0.0.apk`, `OnlyFlora-1.0.0.aab` и
контрольные суммы. AAB загружается в Google Play, APK или AAB — в RuStore.

## Перед отправкой на модерацию

1. `https://app.onlyflora.ru/` открывается без VPN и не ведёт на `chatgpt.site`.
2. Поиск, карточки, предложения питомников и корзина проверены на реальном товаре.
3. Политика конфиденциальности доступна по публичной HTTPS-ссылке.
4. Версия установлена поверх предыдущей магазинной версии без конфликта подписи.
5. Скриншоты не содержат ошибок «нет предложений» или «некорректный ответ сервера».
