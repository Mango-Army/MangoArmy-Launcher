# 🎮 Mango Army Launcher

¡Bienvenido al **Mango Army Launcher**! Un launcher moderno, rápido y estético para Minecraft, desarrollado con **Electron** y **React**, inspirado en el universo de Halo.

![Halo Theme](https://i.imgur.com/uVzI9mH.png)

## ✨ Características Principal

- 🚀 **Alto Rendimiento:** Optimizado para ofrecer una experiencia fluida y ligera.
- 🎨 **Estética Halo:** Temas personalizados (Classic, Reclaimer, Covenant) con efectos visuales premium.
- 🔐 **Autenticación segura:** Soporte completo para cuentas de **Microsoft (XSTS)** y modo offline.
- 📦 **Multi-Motor:** Compatibilidad con **Vanilla**, **Fabric** y **Paper**.
- 🔄 **Auto-Actualizable:** Sistema integrado que detecta y descarga nuevas versiones desde GitHub automáticamente.
- 🛠️ **Gestión de Perfiles:** Crea y personaliza múltiples perfiles con diferentes versiones y motores.

## 📋 Requisitos para Jugar (IMPORTANTE)

Para que el launcher funcione correctamente en cualquier ordenador, es **OBLIGATORIO** tener instalado lo siguiente:

1.  **Java 21 (Oracle JDK)**: Necesario para arrancar el juego.
    *   📥 **Descargar aquí:** [Oracle Java 21 (Windows x64 Installer)](https://www.oracle.com/java/technologies/downloads/#java21)
    *   *Nota: Asegúrate de descargar la versión "x64 Installer" para Windows.*

2.  **Visual C++ Redistributable**: Necesario si la aplicación no abre.
    *   📥 Descargar: [Microsoft Visual C++](https://learn.microsoft.com/es-es/cpp/windows/latest-supported-vc-redist?view=msvc-170)

## 🚀 Instalación y Uso

### Requisitos Previos

- [Node.js](https://nodejs.org/) (LTS recomendado)

### Desarrollo Local

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/Zer0Dev/LauncherCustom.git
   cd LauncherCustom
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Ejecutar en modo desarrollo:
   ```bash
   npm run dev
   ```

### Compilar Ejecutable

Para crear el instalador de producción:
```bash
npm run build
```

## 🛠️ Estructura del Proyecto

- `src/`: Interfaz de usuario construida con React, Tailwind y Framer Motion.
- `electron/`: Proceso principal de Electron (gestión de ventanas, sistema de archivos, ejecución de Java).
- `sidecar/`: Binarios y scripts auxiliares para el lanzamiento del juego.

## 🛰️ Sistema de Actualizaciones

Este launcher utiliza **GitHub Actions** para el despliegue automático. Cada vez que se crea un `tag` (ej. `v1.0.0`), el sistema:
1. Compila la aplicación para Windows.
2. Genera un release en GitHub.
3. Actualiza el archivo `latest.json` que el launcher consulta para autoinstalarse la nueva versión.

## 🤝 Contribuciones

Si quieres contribuir, ¡eres bienvenido! Por favor, abre un Issue o un Pull Request con tus propuestas.

---
Compilado con ❤️ por el **Mango Army Team**.
