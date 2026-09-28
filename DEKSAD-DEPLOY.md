# DekSad App

Production branch: `deksad-app`.

This branch contains:
- public DekSad website;
- `/admin` content/admin panel;
- PostgreSQL-backed projects and provider directory;
- image uploads stored in PostgreSQL;
- public organizer/decorator search;
- public "Предложить услуги" submission form with moderation.

## Timeweb App Platform

Deploy as a **Backend → Express / Node.js** application from branch `deksad-app`.

Commands:
- install: npm install
- start: npm start
- health check: /health

Required environment variables:
- DATABASE_URL
- ADMIN_PASSWORD
- ADMIN_SECRET
- NODE_ENV=production

The database schema is created automatically on first successful connection.

Keep the existing static app attached to deksad.ru until the backend technical domain has been tested.
After testing:
1. detach deksad.ru from the old static app;
2. attach deksad.ru to the new backend app;
3. Timeweb will issue/renew Let's Encrypt automatically.

Do not store uploaded site photos on the app filesystem: App Platform containers are replaced during deployments. This app stores media in PostgreSQL so admin uploads survive redeploys.
