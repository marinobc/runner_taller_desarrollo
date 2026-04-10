# Workshop Toolkit (Herramienta Runner y Concat)

Un panel de desarrollo unificado diseñado para gestionar múltiples microservicios y proporcionar herramientas utilitarias para el análisis de código.

## Características

* **🚀 Ejecutor de servicios (Service Runner)**: Inicia, detiene y supervisa múltiples servicios backend y frontend desde una sola interfaz.
* **📊 Registros en tiempo real**: Visualiza la salida de consola en vivo para cada servicio con renderizado monoespaciado de alta fidelidad.
* **⚡ Gestión de puertos**: Detección automática de conflictos de puertos con la capacidad de finalizar procesos que los estén bloqueando.
* **📂 Herramienta Concat**: Escanea recursivamente directorios del proyecto y concatena el contenido de archivos en un formato único y legible.
* **🔍 Descubrimiento de servicios**: Identifica automáticamente los servicios dentro de la estructura de tu proyecto.

## Estructura del proyecto

```text
.
├── backend/                # Servidor Node.js con Express
│   ├── src/                # Lógica del backend (gestión de procesos, escaneo, etc.)
│   └── server.js           # Punto de entrada del servidor
├── frontend/               # Panel con Vue 3 + Vite + Tailwind CSS
│   ├── src/                # Componentes y composables del frontend
│   └── index.html          # Punto de entrada de la aplicación
├── scripts/
│   └── launcher.js         # Script unificado de arranque
└── toolkit-config.json     # Configuración local (ignorada por git)
```

## Primeros pasos

### Requisitos previos

* Node.js (se recomienda v18 o superior)
* npm

### Instalación

1. **Clonar el repositorio**:

   ```bash
   git clone <repository-url>
   cd runner_taller_desarrollo
   ```

2. **Instalar dependencias**:
   El script de arranque gestiona automáticamente la instalación de dependencias tanto del frontend como del backend si faltan. Sin embargo, se recomienda realizar la instalación inicial desde la raíz:

   ```bash
   npm install
   ```

### Ejecución de la aplicación

Para iniciar simultáneamente el backend y el frontend, ejecuta:

```bash
npm start
```

La aplicación estará disponible en:

* **Frontend**: `http://localhost:3334`
* **API Backend**: `http://localhost:3333` (la configuración se gestiona desde la interfaz y se guarda en `toolkit-config.json`)

## Desarrollo

* **Backend**: Construido con Express.js. Gestiona la creación de procesos, el escaneo del sistema de archivos y la administración de puertos.
* **Frontend**: Construido con Vue 3 (Composition API), TypeScript y Tailwind CSS.
* **Íconos**: Utiliza sprites SVG ubicados en `frontend/public/icons.svg`.
