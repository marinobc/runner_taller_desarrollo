```bash
docker run --name mailhog -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

## 📋 Ejecutar en terminal
Copia y pega este comando directamente en tu terminal (Git Bash, CMD, PowerShell o terminal de Linux/macOS).

## 📖 Explicación del comando

| Parámetro | Descripción |
|-----------|-------------|
| **`docker run`** | Comando base para crear y ejecutar un nuevo contenedor |
| **`--name mailhog`** | Asigna un nombre personalizado al contenedor. Facilita la referencia al contenedor en comandos futuros |
| **`-d` (detach)** | Ejecuta el contenedor en segundo plano. Libera la terminal para otros comandos |
| **`-p 1025:1025`** | **Formato:** `-p [puerto_host]:[puerto_contenedor]`<br>Mapea el puerto 1025 del host al puerto 1025 del contenedor<br>El puerto 1025 es el puerto SMTP donde las aplicaciones envían emails |
| **`-p 8025:8025`** | **Formato:** `-p [puerto_host]:[puerto_contenedor]`<br>Mapea el puerto 8025 del host al puerto 8025 del contenedor<br>El puerto 8025 es el puerto de la interfaz web para visualizar emails |
| **`mailhog/mailhog`** | Especifica la imagen a utilizar. MailHog es un servidor de email falso para desarrollo |

## 🎯 Puertos importantes

| Puerto | Uso | Acceso |
|--------|-----|--------|
| **1025** | SMTP Server | Las aplicaciones envían emails aquí |
| **8025** | Web UI | Abre http://localhost:8025 para ver los emails |