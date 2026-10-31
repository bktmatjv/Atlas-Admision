#!/usr/bin/env bash
# Prepara una VM Ubuntu para CALIBRA. Idempotente. Ejecutar como root:
#   sudo bash deploy/preparar-vm.sh "<clave pública SSH de despliegue>"
# La clave privada de despliegue NUNCA pasa por aquí: solo la pública.
set -euo pipefail

PUBKEY="${1:-}"
REPO_URL="${REPO_URL:-https://github.com/bktmatjv/Atlas-Admision.git}"
APP_DIR=/opt/calibra
DEPLOY_USER=deploy

[ "$(id -u)" -eq 0 ] || { echo "Ejecutar con sudo." >&2; exit 1; }
case "$PUBKEY" in ssh-ed25519\ *|ssh-rsa\ *) ;; *) echo "Pasa la clave pública de despliegue como argumento." >&2; exit 1;; esac

# 1. Docker Engine + plugin Compose desde el repositorio oficial
if ! docker compose version >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl git ufw
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

# 2. Usuario de despliegue (pertenecer al grupo docker equivale a root: por eso la clave es dedicada)
id "$DEPLOY_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
AUTH="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$AUTH"; chmod 600 "$AUTH"; chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH"
grep -qxF "$PUBKEY" "$AUTH" || echo "$PUBKEY" >> "$AUTH"

# 3. Código (el repositorio es público)
mkdir -p "$APP_DIR"; chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$DEPLOY_USER" git clone "$REPO_URL" "$APP_DIR"
fi
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR/backend"

# 4. Firewall del sistema, coherente con el NSG: 22, 80, 443
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

cat <<MSG
Listo. Falta crear, como usuario $DEPLOY_USER y con permisos 600:
  $APP_DIR/.env          -> POSTGRES_PASSWORD=...  CALIBRA_DOMAIN=<etiqueta>.<región>.cloudapp.azure.com
  $APP_DIR/backend/.env  -> NODE_ENV/IA/claves/FRONTEND_ORIGIN (ver backend/.env.example)
MSG
