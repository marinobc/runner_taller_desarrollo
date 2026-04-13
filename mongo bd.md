```bash
docker run --name TD_BD_Inmobiliaria -d -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=admin -e MONGO_INITDB_DATABASE=inmobiliaria_db -v mongo_data:/data/db mongo:7.0
```

## Ejecutar en terminal
Copia y pega este comando directamente en tu terminal (Git Bash, CMD, PowerShell o terminal de Linux/macOS).

## Explicación del comando

| Parámetro | Descripción |
|-----------|-------------|
| **`docker run`** | Comando base para crear y ejecutar un nuevo contenedor |
| **`--name TD_BD_Inmobiliaria`** | Asigna un nombre personalizado al contenedor. Facilita la referencia al contenedor en comandos futuros |
| **`-d` (detach)** | Ejecuta el contenedor en segundo plano. Libera la terminal para otros comandos |
| **`-p 27017:27017`** | **Formato:** `-p [puerto_host]:[puerto_contenedor]`<br>Mapea el puerto 27017 del host al puerto 27017 del contenedor<br>El puerto 27017 es el puerto por defecto de MongoDB |
| **`-e MONGO_INITDB_ROOT_USERNAME=admin`** | Variable de entorno que establece el nombre de usuario administrador |
| **`-e MONGO_INITDB_ROOT_PASSWORD=admin`** | Variable de entorno que establece la contraseña del administrador |
| **`-e MONGO_INITDB_DATABASE=inmobiliaria_db`** | Variable de entorno que crea una base de datos inicial con ese nombre |
| **`-v mongo_data:/data/db`** | Crea un volumen persistente llamado `mongo_data`<br>Lo monta en `/data/db` (directorio donde MongoDB guarda los datos)<br>Permite que los datos sobrevivan aunque el contenedor se elimine |
| **`mongo:7.0`** | Especifica la imagen a utilizar. Versión 7.0 de MongoDB |