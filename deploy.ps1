# Konfigurasi
$SERVER_IP = "192.168.1.100"  # Ganti dengan IP server lokal Anda
$SERVER_USER = "admin"        # Ganti dengan username server Anda
$DEPLOY_PATH = "/var/www/pump-control"
$NGINX_PATH = "/etc/nginx/sites-available"

# Build aplikasi
Write-Host "Building application..."
npm run build

# Buat direktori di server jika belum ada
Write-Host "Creating directories on server..."
ssh ${SERVER_USER}@${SERVER_IP} "sudo mkdir -p $DEPLOY_PATH"
ssh ${SERVER_USER}@${SERVER_IP} "sudo chown -R ${SERVER_USER}:${SERVER_USER} $DEPLOY_PATH"

# Copy file build ke server
Write-Host "Copying build files to server..."
scp -r dist/* ${SERVER_USER}@${SERVER_IP}:${DEPLOY_PATH}/

# Copy dan aktifkan konfigurasi Nginx
Write-Host "Setting up Nginx configuration..."
scp nginx.conf ${SERVER_USER}@${SERVER_IP}:~/pump-control.conf
ssh ${SERVER_USER}@${SERVER_IP} "sudo mv ~/pump-control.conf $NGINX_PATH/pump-control"
ssh ${SERVER_USER}@${SERVER_IP} "sudo ln -sf $NGINX_PATH/pump-control /etc/nginx/sites-enabled/"
ssh ${SERVER_USER}@${SERVER_IP} "sudo nginx -t && sudo systemctl reload nginx"

Write-Host "Deployment complete! Application is now available at http://${SERVER_IP}"
