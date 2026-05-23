#!/usr/bin/env bash
# Custom entrypoint for flux-php.
#
# Always rebuild the Symfony compiled container in dev so freshly added
# #[AsMessageHandler] / #[AsDoctrineListener] / #[AsEventSubscriber]
# classes get picked up. Without this, OPCache loads the new .php files
# but the cached DI container in var/cache/dev/Container*/ keeps its
# stale tagging — handlers stay silently unregistered (no log, no
# error). See feedback_php_container_cache_after_handler_add.md.
#
# Skipped in non-dev environments (prod ships a pre-built cache).
set -e

if [ "${APP_ENV:-dev}" = "dev" ] && [ -f /var/www/html/bin/console ] && [ -d /var/www/html/vendor ]; then
    cd /var/www/html
    php bin/console cache:clear --env=dev --no-warmup --quiet || true
fi

exec docker-php-entrypoint "$@"
