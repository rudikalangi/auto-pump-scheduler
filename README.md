# PT DLJ1 Seedling Watering System

Sistem kontrol pompa air otomatis untuk pembibitan dengan fitur penjadwalan dan monitoring.

## Fitur Utama

- Kontrol sistem pompa (System ON/OFF)
- Kontrol starter motor dengan timer otomatis (2 detik)
- Penjadwalan otomatis
- Monitoring status sistem
- Pencatatan log aktivitas
- Antarmuka web yang responsif

## Persyaratan Sistem

- Node.js versi 18 atau lebih baru
- npm (Node Package Manager)
- Browser modern (Chrome, Firefox, Edge, dll)
- ESP32 controller (untuk kontrol hardware)

## Instalasi

1. Pastikan Node.js dan npm sudah terinstal. Untuk mengecek:
   ```bash
   node --version
   npm --version
   ```

2. Clone repository ini:
   ```bash
   git clone <repository-url>
   cd auto-pump-scheduler
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Jalankan aplikasi dalam mode development:
   ```bash
   npm run dev
   ```

5. Buka browser dan akses:
   ```
   http://localhost:5173
   ```

## Panduan Instalasi Auto Pump Scheduler

## Persyaratan Sistem

### Untuk Aplikasi Web
1. Node.js versi 18 atau lebih tinggi
2. npm (Node Package Manager)
3. Git
4. Browser modern (Chrome, Firefox, Edge)

### Untuk ESP32
1. Arduino IDE
2. Library yang diperlukan:
   - WebSocketsServer
   - ArduinoJson
   - WiFi
3. ESP32 DevKit
4. 2 Relay Module
5. Sensor level air (opsional)
6. Sensor aliran air (opsional)

## Langkah-langkah Instalasi

### A. Instalasi Aplikasi Web

1. Clone repository:
   ```bash
   git clone https://github.com/your-username/auto-pump-scheduler.git
   cd auto-pump-scheduler
   ```

2. Install dependensi:
   ```bash
   npm install
   ```

3. Jalankan aplikasi:
   ```bash
   npm run dev
   ```

4. Buka aplikasi di browser:
   ```
   http://localhost:5173
   ```

### B. Instalasi ESP32

1. Buka Arduino IDE

2. Install Library yang Diperlukan:
   - Buka menu Sketch > Include Library > Manage Libraries
   - Cari dan install library berikut:
     - "WebSocketsServer"
     - "ArduinoJson"
     - "ESP32" (board manager)

3. Konfigurasi ESP32:
   - Buka file `esp32/pump_controller/pump_controller.ino`
   - Ubah konfigurasi WiFi:
     ```cpp
     const char* ssid = "NamaWiFiAnda";
     const char* password = "PasswordWiFiAnda";
     ```

4. Wiring ESP32:
   - Hubungkan Relay 1 (Daya Sistem) ke GPIO 26
   - Hubungkan Relay 2 (Starter Motor) ke GPIO 27
   - Opsional:
     - Sensor level air ke GPIO 34
     - Sensor aliran air ke GPIO 35

5. Upload kode:
   - Pilih board "ESP32 Dev Module" di Arduino IDE
   - Pilih port COM yang sesuai
   - Tekan tombol Upload

### C. Menghubungkan Aplikasi Web dengan ESP32

1. Dapatkan IP Address ESP32:
   - Buka Serial Monitor di Arduino IDE
   - Catat IP address yang muncul (contoh: 192.168.1.100)

2. Konfigurasi Aplikasi Web:
   - Buka aplikasi web di browser
   - Masuk ke menu Settings
   - Masukkan IP address ESP32
   - Klik tombol Connect

## Pengujian Koneksi

1. Indikator Koneksi:
   - Status "Connected" di dashboard
   - LED built-in ESP32 akan berkedip saat terhubung

2. Test Fungsi:
   - Nyalakan System Power
   - Coba jalankan Motor
   - Monitor status di Serial Monitor

## Troubleshooting

1. Masalah Koneksi:
   - Pastikan ESP32 dan komputer dalam jaringan WiFi yang sama
   - Periksa IP address ESP32
   - Restart ESP32 jika perlu

2. Masalah Relay:
   - Periksa sambungan kabel
   - Pastikan tegangan relay sesuai (5V)
   - Cek status di Serial Monitor

3. Aplikasi Web Error:
   - Hapus cache browser
   - Periksa console browser
   - Restart aplikasi web

## Fitur Keamanan

1. Watchdog Timer:
   - Otomatis mematikan sistem jika tidak ada komunikasi selama 30 detik
   - Mencegah pompa tetap menyala jika koneksi terputus

2. State Memory:
   - Menyimpan status terakhir di EEPROM
   - Memulihkan status setelah restart

3. Emergency Stop:
   - Tombol emergency stop di aplikasi
   - Mematikan semua relay sekaligus

## Monitoring

1. Serial Monitor:
   - Baud rate: 115200
   - Menampilkan log aktivitas sistem

2. Aplikasi Web:
   - Status real-time
   - Level air (jika sensor terpasang)
   - Aliran air (jika sensor terpasang)

## Pemeliharaan

1. Backup Kode:
   - Simpan salinan kode ESP32
   - Backup konfigurasi aplikasi

2. Pemeriksaan Rutin:
   - Cek kondisi relay setiap bulan
   - Periksa sambungan kabel
   - Update firmware jika ada

## Dukungan

Untuk bantuan lebih lanjut:
1. Buka issues di GitHub repository
2. Dokumentasi teknis di folder `/docs`
3. Kontak pengembang melalui email

## Konfigurasi ESP32

1. Buka halaman Settings di aplikasi
2. Masukkan IP Address ESP32 (default: 192.168.1.100)
3. Klik Save untuk menyimpan konfigurasi
4. Status koneksi akan ditampilkan di Dashboard

## Penggunaan

1. **System Power (Relay 1)**
   - Mengaktifkan power sistem utama
   - Harus ON sebelum motor bisa distart

2. **Start Motor (Relay 2 - Starter)**
   - Aktif selama 2 detik untuk starter motor
   - Otomatis mati setelah 2 detik
   - Memerlukan System Power ON

3. **Stop All**
   - Emergency stop
   - Mematikan semua relay

4. **Penjadwalan**
   - Atur jadwal penyiraman di halaman Scheduler
   - Set waktu mulai dan selesai
   - Pilih hari-hari aktif
   - Aktifkan/nonaktifkan jadwal

5. **Monitoring**
   - Pantau status sistem di Dashboard
   - Lihat riwayat aktivitas di halaman Logs

## Troubleshooting

1. **Jika npm tidak bisa dijalankan:**
   - Buka PowerShell sebagai Administrator
   - Jalankan: `Set-ExecutionPolicy RemoteSigned`
   - Pilih "Yes" atau "A" ketika diminta

2. **Jika tidak bisa terhubung ke ESP32:**
   - Pastikan ESP32 dan komputer berada dalam jaringan yang sama
   - Verifikasi IP Address di halaman Settings
   - Periksa koneksi jaringan

## Pengembangan

Aplikasi ini dibangun menggunakan:
- React + TypeScript
- Vite
- Tailwind CSS
- shadcn/ui components
