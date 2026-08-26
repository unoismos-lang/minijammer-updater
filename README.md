# MiniJammer XXL — Firmware Web Updater

Herramienta web oficial basada en **ESP Web Tools** y **Web Serial API** para actualizar el firmware del MiniJammer XXL directamente desde Google Chrome, Microsoft Edge, Brave u Opera sin instalar software adicional.

---

## 📁 Archivos Incluidos

- `index.html`: Interfaz web con pestañas para flashear la Placa Maestra (ESP32-S3) y la Placa Esclava (ESP32).
- `styles.css`: Hoja de estilos moderna estilo cyberpunk con efectos de cristal (glassmorphism) y soporte responsivo.
- `app.js`: Lógica de navegación por pestañas y detección de compatibilidad de navegador.
- `manifest_maestro.json`: Archivo de configuración que apunta a `firmware_maestro.bin`.
- `manifest_esclavo.json`: Archivo de configuración que apunta a `firmware_esclavo.bin`.
- `assets/logo.svg`: Logo oficial del MiniJammer vectorizado y extraído del firmware.
- `build_and_copy_binaries.bat`: Script de 1 clic para compilar y generar el binario unificado `firmware_maestro.bin`.

---

## 🚀 Cómo Probar Localmente

Por razones de seguridad del navegador, la **Web Serial API** requiere un servidor HTTP local (`localhost`) o HTTPS. No se puede abrir directamente con doble clic como `file:///`.

Para probarla en tu computadora:

1. Abre una terminal de comandos en esta carpeta y corre:
   ```bash
   python -m http.server 8000
   ```
2. Abre tu navegador (Google Chrome o Edge) e ingresa a:
   ```
   http://localhost:8000
   ```
3. ¡Listo! Verás la interfaz lista para conectar y flashear.

---

## 🌐 Cómo Publicarla Gratis en Internet (GitHub Pages)

1. Crea un repositorio en GitHub (ej: `minijammer-updater`).
2. Sube todos los archivos de esta carpeta (`index.html`, `styles.css`, `app.js`, `manifest_*.json`, `assets/`, `firmware_*.bin`).
3. En GitHub, ve a **Settings** > **Pages** > En **Source** selecciona `main` branch (o `Deploy from a branch`) y guarda.
4. En 1 minuto tendrás tu enlace público con HTTPS (ej: `https://tu-usuario.github.io/minijammer-updater/`) para compartir con tus usuarios.
