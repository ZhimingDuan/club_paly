#!/bin/bash
set -e

echo "[1/6] backend venv and deps..."
cd /opt/club_trae/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

echo "[2/6] frontend build..."
cd /opt/club_trae/frontend
npm install
npm run build

echo "[3/6] systemd service..."
sudo cp /opt/club_trae/club_paly/deploy/club-backend.service.example /etc/systemd/system/club-backend.service
sudo systemctl daemon-reload
sudo systemctl enable club-backend

echo "[4/6] nginx config..."
sudo cp /opt/club_trae/club_paly/deploy/nginx.conf.example /etc/nginx/sites-available/club_trae
sudo ln -sf /etc/nginx/sites-available/club_trae /etc/nginx/sites-enabled/club_trae
sudo rm -f /etc/nginx/sites-enabled/default

echo "[5/6] permissions..."
sudo chown -R www-data:www-data /opt/club_trae/frontend/dist
sudo chmod -R 755 /opt/club_trae/frontend/dist

echo "[6/6] start services..."
sudo systemctl start club-backend
sudo systemctl restart nginx

echo "✅ Deployment completed!"
echo "Frontend: http://$(curl -s ifconfig.me)"
echo "Backend API: http://$(curl -s ifconfig.me)/api/"

