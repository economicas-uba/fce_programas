# API — Programas Académicos

Backend PHP 8 para el prototipo. Corre en un subdirectorio de miecon.uba.ar (IIS, Windows).

## Etapas

- **Etapa 1 (actual, demo y pruebas de usuarios):** la API lee los catálogos de `datos/usuarios.json` y
  `datos/materias.json` y guarda programas, tareas tomadas, notificaciones y novedades vistas en
  `api/almacen/estado.php` (JSON con una primera línea que impide verlo desde el navegador).
  Los datos son compartidos: lo que hace un usuario lo ven los demás al cambiar de solapa.
- **Etapa 2 (cuando la estructura del prototipo esté confirmada):** se reemplaza `lib/almacen_json.php` por un
  almacén sobre SQL Server con los mismos métodos (scripts en `sql/`). Las rutas de la API y el front no cambian.

## Instalación — etapa 1

1. Copiar al servidor el repo completo (`index.html`, `app.js`, `persistencia.js`, `style.css`, `datos/`, `api/`).
2. Dar permiso de **Modificar** sobre `api/almacen` a la cuenta del pool de aplicación de IIS
   (por ejemplo `IIS AppPool\NombreDelPool`).
3. Copiar `api/config.ejemplo.php` como `api/config.php`. Para la demo alcanza con los valores por defecto.
   - `demo.permitir_reinicio = true` habilita "Reiniciar datos" e "Importar datos" en Perfil (afecta a todos).
4. Abrir `api/diagnostico.php`: las filas "Etapa 1" tienen que estar en ✔ (las de SQL Server pueden fallar todavía).
   Luego poner `diagnostico_habilitado = false`.
5. Abrir la aplicación. En Perfil → "Datos de la simulación" debe decir que los datos se guardan en el servidor.

Para pasar al servidor los programas de prueba que tenías en tu navegador: en modo local usá "Exportar Datos",
después entrá al servidor (con `permitir_reinicio = true`) y usá "Importar Datos" con ese archivo.

### Prueba local sin IIS

Desde la raíz del repo: `php -S localhost:8080` y abrir `http://localhost:8080/`.

### Modo local (sin API)

Si la API no responde (GitHub Pages, archivo abierto con doble clic) el prototipo usa localStorage como antes.
Se puede forzar con `?modo=local` o `?modo=api` en la URL.

## Rutas (`api/index.php?r=...`)

| Método | Ruta | Uso |
|---|---|---|
| GET | `ping` | Estado de la API |
| GET | `catalogos/usuarios`, `catalogos/materias` | Catálogos |
| GET / POST / DELETE | `sesion` | Usuario actual / ingresar / salir |
| GET | `estado` | Programas, tomas, notificaciones y vistos |
| POST | `programas/reservar-id` | Id para un programa nuevo |
| PUT / DELETE | `programas/{id}` | Guardar / borrar un programa (control de versión `_rev`) |
| POST | `tomas` | Tomar una tarea (409 si otro ya la tomó) |
| DELETE | `tomas/{programaId}/{tarea}` | Liberar una tarea |
| POST | `notificaciones` | Alta de notificación |
| PUT | `vistos/{usuarioId}` | Novedades vistas (solo las propias) |
| POST | `estado/reiniciar`, `estado/importar` | Administración de la demo |

Si dos usuarios modifican el mismo programa a la vez, el segundo recibe un aviso y se recargan los datos
(no se pisan los cambios del primero).

## Etapa 2 — base de datos (preparado, no en uso)

1. `CREATE DATABASE ProgramasAcademicos;` y ejecutar `sql/01_esquema.sql`.
2. Ejecutar `sql/02_catalogos.sql` (se genera con `python herramientas/generar_sql_catalogos.py`).
3. Completar la sección `db` de `config.php` y verificar en `diagnostico.php`.

Requisitos: extensión **pdo_sqlsrv** y **Microsoft ODBC Driver 18 (o 17) for SQL Server** en el servidor web.
Para el login con miecon.uba.ar: extensión **ldap**.
