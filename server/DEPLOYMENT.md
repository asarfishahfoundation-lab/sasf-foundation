# Production availability and scaling

The server now provides liveness at `/healthz` and readiness at `/readyz`. Configure the hosting platform to use those probes and restart the process after an unexpected exit. `SIGTERM` and `SIGINT` stop accepting requests and close the database cleanly.

## Recommended production target

Use Render for the first production deployment: a stateless web service with at least two instances, `/readyz` as its HTTP health check, managed PostgreSQL with high availability, Redis-compatible Key Value for sessions and rate limits, and object storage plus a CDN for uploaded and public images. Keep email delivery behind a durable queue. This separates the app from its data and lets the host replace or scale app instances without losing state.

Render documents HTTP health checks and service autoscaling, and its HA PostgreSQL uses a standby in another zone. These are paid features; HA bills for a standby matching the primary, and autoscaling requires a Pro workspace. Review the current [Render pricing](https://render.com/pricing) before creating services.

## Render edge caching

After the app is connected to a paid Render Web Service, enable Edge Caching in the service Settings and choose **All files**. The public HTML and approved public content endpoint carry short CDN cache lifetimes; /admin and /api/admin responses explicitly send no-store. Verify cache hits with Render's CF-Cache-Status response header. Edge Caching is not available on free Web Services.

## Required production settings

- Set `NODE_ENV=production`.
- Keep `SESSION_SECRET` private and use a long random value.
- Set `TRUST_PROXY_HOPS` to the exact number of trusted reverse proxies in front of the app. The default is one in production.
- Set `DATABASE_PATH` to a persistent disk path. The database and SQLite session store must remain on the same persistent volume.
- Keep automated, off-host database backups and periodically verify that a backup can be restored.
- Serve the site through an HTTPS reverse proxy or managed hosting platform. The server uses production-only static asset caching and revalidates HTML.

## Scaling boundary

The current app stores website data and login sessions in one SQLite database. Rate-limit counters are held in each Node process's memory. This setup supports a single app instance and does not provide automatic failover or shared limits across replicas. Do not run multiple replicas against separate local database files.

The server currently has synchronous SQLite calls throughout its routes. Before enabling multiple app instances, refactor those calls to an asynchronous PostgreSQL connection pool, migrate the SQLite data, move sessions and rate-limit counters to shared Redis, and move uploaded photos to object storage. Then deploy at least two app instances with health checks, automatic restart, and tested database backups. Email delivery should move to a durable queue if contact or OTP delivery must survive provider outages.

No application can promise zero downtime. Set an availability target and expected peak request rate, then load-test the selected hosting and database configuration against those targets before launch.
