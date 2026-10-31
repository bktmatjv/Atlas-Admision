#!/usr/bin/env bash
# Despliegue de la API en la VM. Lo ejecuta el usuario `deploy` (a mano o desde GitHub Actions).
# Nunca usa `down -v`: los volúmenes con la base y las subidas se conservan.
set -euo pipefail

# Todo el cuerpo va en una función: `git reset --hard` reescribe este archivo mientras bash lo lee.
main() {
  APP_DIR="${APP_DIR:-/opt/calibra}"
  cd "$APP_DIR"

  [ -f .env ] || { echo "Falta $APP_DIR/.env (POSTGRES_PASSWORD y CALIBRA_DOMAIN)." >&2; return 1; }
  [ -f backend/.env ] || { echo "Falta $APP_DIR/backend/.env." >&2; return 1; }
  DOMAIN="$(sed -n 's/^CALIBRA_DOMAIN=//p' .env | tr -d '"' | head -n1)"
  [ -n "$DOMAIN" ] || { echo "CALIBRA_DOMAIN vacío en .env." >&2; return 1; }

  git fetch --prune origin main
  git reset --hard origin/main

  COMPOSE=(docker compose -f compose.yaml -f compose.prod.yaml)
  "${COMPOSE[@]}" up -d --build --wait --remove-orphans

  # Verificación a través de Caddy (HTTPS real). El certificado puede tardar unos segundos la primera vez.
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 10 "https://$DOMAIN/api/v1/salud" -o /tmp/calibra-salud.json; then
      echo "Salud OK: $(cat /tmp/calibra-salud.json)"
      docker image prune -f >/dev/null
      return 0
    fi
    sleep 5
  done
  echo "La API no respondió en https://$DOMAIN/api/v1/salud" >&2
  "${COMPOSE[@]}" ps >&2 || true
  "${COMPOSE[@]}" logs --tail=50 backend caddy >&2 || true
  return 1
}

main "$@"
exit $?
