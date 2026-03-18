#!/bin/bash
set -e

# TerraForge Uninstaller

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root: sudo bash uninstall.sh${NC}"
  exit 1
fi

echo -e "${YELLOW}Uninstalling TerraForge...${NC}"

# Stop and remove containers
cd /opt/terraforge 2>/dev/null && docker compose down -v 2>/dev/null || true

# Remove systemd service
systemctl stop terraforge 2>/dev/null || true
systemctl disable terraforge 2>/dev/null || true
rm -f /etc/systemd/system/terraforge.service
systemctl daemon-reload 2>/dev/null || true

# Remove installation directory
rm -rf /opt/terraforge

# Clean temp files
rm -rf /tmp/grandform-run

echo -e "${GREEN}TerraForge uninstalled successfully.${NC}"
echo -e "${YELLOW}Note: Docker was not removed. Remove it manually if you no longer need it.${NC}"
