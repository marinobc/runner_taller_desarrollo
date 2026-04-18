# MongoDB — Multi-Database Instance

```powershell
# Start MongoDB (no MONGO_INITDB_DATABASE — databases are created on-demand)
docker run --name TD_BD_Inmobiliaria -d -p 27017:27017 `
  -v mongo_data:/data/db `
  -e MONGO_INITDB_ROOT_USERNAME=admin `
  -e MONGO_INITDB_ROOT_PASSWORD=admin `
  mongo:7.0
```

## Bases de datos gestionadas

| Base de datos        | Servicio responsable     |
|----------------------|--------------------------|
| `identity_db`        | identity-service         |
| `access_control_db`  | access-control-service   |
| `notification_db`    | notification-service     |
| `user_db`            | user-service             |
| `property_db`        | property-service         |
| `visit_calendar_db`  | visit-calendar-service   |

## Pre-crear todas las DBs (opcional, PowerShell)

```powershell
$dbs = "identity_db","access_control_db","user_db","property_db","visit_calendar_db"
$dbs | ForEach-Object {
    docker exec TD_BD_Inmobiliaria mongosh -u admin -p admin --authenticationDatabase admin `
        --eval "db.getSiblingDB('$_').createCollection('init')"
}
```

## Parámetros

| Parámetro | Descripción |
|-----------|-------------|
| `--name TD_BD_Inmobiliaria` | Nombre del contenedor |
| `-d` | Modo detached (segundo plano) |
| `-p 27017:27017` | Puerto MongoDB por defecto |
| `-e MONGO_INITDB_ROOT_USERNAME=admin` | Usuario administrador |
| `-e MONGO_INITDB_ROOT_PASSWORD=admin` | Contraseña del administrador |
| `-v mongo_data:/data/db` | Volumen persistente |
| `mongo:7.0` | Imagen oficial MongoDB 7.0 |