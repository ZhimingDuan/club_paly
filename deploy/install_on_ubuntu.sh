#!/bin/bash
set -e

echo "[1/3] update apt..."
sudo apt update
sudo apt -y upgrade

echo "[2/3] install system deps..."
sudo apt -y install python3-pip python3-venv nginx nodejs npm

echo "[3/3] check versions..."
python3 --version
pip3 --version
node --version
npm --version
nginx -v

echo "✅ System dependencies installed."

