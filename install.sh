#!/bin/bash
set -e

# ─────────────────────────────────────────────
#  TerraForge Installer
#  One-line install: curl -sSL https://raw.githubusercontent.com/ensarkol/grandform/main/terragrunt-ui/install.sh | bash
# ─────────────────────────────────────────────

REPO="ensarkol/grandform"
BRANCH="main"
INSTALL_DIR="/opt/terraforge"
COMPOSE_FILE="docker-compose.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[TerraForge]${NC} $1"; }
warn() { echo -e "${YELLOW}[TerraForge]${NC} $1"; }
err()  { echo -e "${RED}[TerraForge]${NC} $1" >&2; }

# ── Check root ──
if [ "$EUID" -ne 0 ]; then
  err "Please run as root: sudo bash or curl ... | sudo bash"
  exit 1
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        TerraForge Installer v1.0         ║${NC}"
echo -e "${CYAN}║   Infrastructure Management Made Easy    ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── 1. Install Docker if not present ──
if ! command -v docker &> /dev/null; then
  log "Docker not found. Installing Docker..."

  if command -v apt-get &> /dev/null; then
    # Ubuntu / Debian
    apt-get update -qq
    apt-get install -y -qq ca-certificates curl gnupg lsb-release > /dev/null

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list

    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin > /dev/null

  elif command -v yum &> /dev/null; then
    # Amazon Linux / CentOS / RHEL
    yum install -y -q docker
    systemctl start docker
    systemctl enable docker

    # Install docker compose plugin
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | sed 's/.*"v\(.*\)".*/\1/')
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -SL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

  else
    err "Unsupported OS. Please install Docker manually: https://docs.docker.com/engine/install/"
    exit 1
  fi

  systemctl start docker 2>/dev/null || true
  systemctl enable docker 2>/dev/null || true
  log "Docker installed successfully ✓"
else
  log "Docker found ✓"
fi

# ── 2. Verify Docker Compose ──
if docker compose version &> /dev/null; then
  log "Docker Compose found ✓"
elif docker-compose version &> /dev/null; then
  log "Docker Compose (standalone) found ✓"
  # Create alias
  echo '#!/bin/sh' > /usr/local/bin/docker-compose-wrapper
  echo 'docker-compose "$@"' >> /usr/local/bin/docker-compose-wrapper
  chmod +x /usr/local/bin/docker-compose-wrapper
else
  warn "Installing Docker Compose plugin..."
  apt-get install -y -qq docker-compose-plugin 2>/dev/null || \
  yum install -y -q docker-compose-plugin 2>/dev/null || {
    COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep '"tag_name"' | sed 's/.*"v\(.*\)".*/\1/')
    mkdir -p /usr/local/lib/docker/cli-plugins
    curl -SL "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-$(uname -m)" \
      -o /usr/local/lib/docker/cli-plugins/docker-compose
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
  }
  log "Docker Compose installed ✓"
fi

# ── 3. Download TerraForge ──
log "Downloading TerraForge..."

# Clean previous installation (preserve data volume)
rm -rf /tmp/terraforge-download

# Download as tarball (no git required)
mkdir -p /tmp/terraforge-download
curl -sL "https://github.com/${REPO}/archive/refs/heads/${BRANCH}.tar.gz" | \
  tar xz -C /tmp/terraforge-download --strip-components=1

# Install to /opt/terraforge
mkdir -p "${INSTALL_DIR}"

# Copy only the terragrunt-ui directory
if [ -d /tmp/terraforge-download/terragrunt-ui ]; then
  cp -r /tmp/terraforge-download/terragrunt-ui/* "${INSTALL_DIR}/"
else
  cp -r /tmp/terraforge-download/* "${INSTALL_DIR}/"
fi

rm -rf /tmp/terraforge-download
log "TerraForge downloaded to ${INSTALL_DIR} ✓"

# ── 4. Create shared directories ──
mkdir -p /tmp/grandform-run

# ── 5. Build and start ──
log "Building and starting TerraForge (this may take 3-5 minutes)..."
cd "${INSTALL_DIR}"
docker compose up -d --build

# ── 6. Wait for backend to be ready ──
log "Waiting for services to start..."
for i in $(seq 1 30); do
  if curl -s http://localhost:8080/api/auth/setup-status > /dev/null 2>&1; then
    break
  fi
  sleep 2
done

# ── 7. Create systemd service ──
cat > /etc/systemd/system/terraforge.service << 'EOF'
[Unit]
Description=TerraForge Infrastructure Management
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/terraforge
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose up -d --build

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable terraforge 2>/dev/null || true
log "Systemd service created ✓"

# ── 8. Get IP address ──
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || \
            curl -s https://ifconfig.me 2>/dev/null || \
            hostname -I | awk '{print $1}')

# ── Done! ──
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       TerraForge installed! 🎉           ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}URL:${NC}  http://${PUBLIC_IP}:3000"
echo -e "  ${CYAN}API:${NC}  http://${PUBLIC_IP}:8080"
echo ""
echo -e "  Open the URL above and create your admin account."
echo ""
echo -e "  ${YELLOW}Commands:${NC}"
echo -e "    sudo systemctl restart terraforge   # restart"
echo -e "    sudo systemctl stop terraforge       # stop"
echo -e "    sudo systemctl reload terraforge     # rebuild & restart"
echo -e "    cd /opt/terraforge && docker compose logs -f  # view logs"
echo ""
echo -e "  ${YELLOW}Update:${NC}"
echo -e "    curl -sSL https://raw.githubusercontent.com/${REPO}/${BRANCH}/terragrunt-ui/install.sh | sudo bash"
echo ""
