# Konfigurasi
$XAMPP_PATH = "C:\xampp"
$APP_NAME = "pump-control"

# Build aplikasi
Write-Host "Building application..."
npm run build

# Buat direktori di XAMPP htdocs
$TARGET_DIR = "$XAMPP_PATH\htdocs\$APP_NAME"
Write-Host "Creating directory in XAMPP htdocs..."
New-Item -ItemType Directory -Force -Path $TARGET_DIR

# Copy file build ke htdocs
Write-Host "Copying build files to XAMPP htdocs..."
Copy-Item -Path "dist\*" -Destination $TARGET_DIR -Recurse -Force

# Restart Apache
Write-Host "Restarting Apache..."
$APACHE_EXE = "$XAMPP_PATH\apache\bin\httpd.exe"
$APACHE_CONF = "$XAMPP_PATH\apache\conf\httpd.conf"

# Stop Apache if running
$apache = Get-Process -Name "httpd" -ErrorAction SilentlyContinue
if ($apache) {
    $apache | Stop-Process -Force
}

# Start Apache
Start-Process $APACHE_EXE -ArgumentList "-f", $APACHE_CONF

Write-Host "Deployment complete! Application is now available at http://localhost/$APP_NAME"
Write-Host "Make sure to:"
Write-Host "1. Enable mod_proxy and mod_proxy_wstunnel in XAMPP Control Panel"
Write-Host "2. Configure your hosts file if using custom domain"
Write-Host "3. Update ESP32 IP address in the settings if needed"
