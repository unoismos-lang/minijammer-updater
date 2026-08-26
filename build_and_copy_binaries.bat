@echo off
echo =======================================================
echo   MINIJAMMER XXL - GENERADOR DE BINARIO WEB FLASHER
echo =======================================================
echo.

set PYTHON_EXE=%USERPROFILE%\.platformio\penv\Scripts\python.exe
set ESPTOOL_PY=%USERPROFILE%\.platformio\packages\tool-esptoolpy\esptool.py
set MAESTRO_DIR=..\minijammer_xxl_maestro

if not exist "%PYTHON_EXE%" (
    echo [ERROR] No se encontro Python de PlatformIO en %PYTHON_EXE%
    pause
    exit /b 1
)

echo [1/2] Compilando firmware Maestro en PlatformIO...
"%USERPROFILE%\.platformio\penv\Scripts\pio.exe" run -d "%MAESTRO_DIR%"

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Fallo la compilacion.
    pause
    exit /b 1
)

echo.
echo [2/2] Unificando binarios en un solo archivo para la Web...
"%PYTHON_EXE%" "%ESPTOOL_PY%" --chip esp32s3 merge_bin -o "%~dp0firmware_maestro.bin" --flash_mode dio --flash_size 16MB 0x0 "%MAESTRO_DIR%\.pio\build\esp32-s3-devkitc-1\bootloader.bin" 0x8000 "%MAESTRO_DIR%\.pio\build\esp32-s3-devkitc-1\partitions.bin" 0x10000 "%MAESTRO_DIR%\.pio\build\esp32-s3-devkitc-1\firmware.bin"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =======================================================
    echo   [EXITO] firmware_maestro.bin generado correctamente!
    echo   Ubicacion: %~dp0firmware_maestro.bin
    echo =======================================================
) else (
    echo [ERROR] Hubo un problema al unificar los binarios.
)

pause
