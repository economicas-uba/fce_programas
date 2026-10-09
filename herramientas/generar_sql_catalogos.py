#!/usr/bin/env python3
"""
Genera api/sql/02_catalogos.sql a partir de datos/usuarios.json y datos/materias.json.

Uso (desde la raíz del repo):
    python herramientas/generar_sql_catalogos.py

El SQL resultante usa MERGE, así que se puede ejecutar todas las veces que haga
falta: inserta lo nuevo y actualiza lo existente (no borra nada).
Antes de generar, valida las referencias cruzadas entre ambos JSON y avisa
qué datos no cierran (departamentos, titulares o carreras inexistentes).
"""
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
USUARIOS = RAIZ / "datos" / "usuarios.json"
MATERIAS = RAIZ / "datos" / "materias.json"
SALIDA = RAIZ / "api" / "sql" / "02_catalogos.sql"


def q(v):
    """Literal SQL Server (NVARCHAR / NULL / número / bit)."""
    if v is None:
        return "NULL"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, (int, float)):
        return str(v)
    return "N'" + str(v).replace("'", "''") + "'"


def values(filas):
    return ",\n    ".join("(" + ", ".join(q(c) for c in f) + ")" for f in filas)


def merge(tabla, columnas, claves, filas, actualizar=True):
    if not filas:
        return f"-- {tabla}: sin filas\n"
    cols = ", ".join(columnas)
    on = " AND ".join(f"t.{c} = s.{c}" for c in claves)
    otras = [c for c in columnas if c not in claves]
    sql = f"MERGE {tabla} AS t\nUSING (VALUES\n    {values(filas)}\n) AS s ({cols})\nON {on}\n"
    if actualizar and otras:
        sql += "WHEN MATCHED THEN UPDATE SET " + ", ".join(f"{c} = s.{c}" for c in otras) + "\n"
    sql += f"WHEN NOT MATCHED THEN INSERT ({cols}) VALUES (" + ", ".join(f"s.{c}" for c in columnas) + ");\nGO\n\n"
    return sql


def main():
    u = json.loads(USUARIOS.read_text(encoding="utf-8"))
    m = json.loads(MATERIAS.read_text(encoding="utf-8"))
    avisos, errores = [], []

    deptos = {d["id"]: d["nombre"] for d in m.get("departamentos", [])}
    carreras = {c["id"]: c["nombre"] for c in m.get("carreras", [])}
    roles = {r["id"] for r in u.get("roles", [])}
    usuarios = {x["id"]: x for x in u.get("usuarios", [])}

    # --- usuarios y roles
    filas_usuario, filas_rol, filas_rol_depto = [], [], []
    for x in u.get("usuarios", []):
        username = (x.get("username") or x.get("email") or x["id"]).strip().lower()
        filas_usuario.append([x["id"], username, x.get("email"), x.get("apellido") or "", x.get("nombre") or "", bool(x.get("activo", True))])
        for r in x.get("roles", []):
            if r["rol"] not in roles:
                errores.append(f"Usuario {x['id']}: rol inexistente {r['rol']}")
                continue
            filas_rol.append([x["id"], r["rol"]])
            for d in (r.get("alcance") or {}).get("departamentos", []):
                if d not in deptos:
                    avisos.append(f"Usuario {x['id']} ({username}), rol {r['rol']}: departamento '{d}' no está en materias.json -> se omite ese alcance")
                    continue
                filas_rol_depto.append([x["id"], r["rol"], d])

    # --- asignaturas y cátedras
    asignaturas, filas_ac, filas_catedra = {}, set(), []
    for mt in m.get("materias", []):
        cod = mt.get("codigo_materia")
        cat = mt.get("catedra_id")
        if cod is None or not cat:
            errores.append(f"Materia sin codigo_materia o catedra_id: {mt.get('nombre_materia')}")
            continue
        if mt.get("departamento_id") not in deptos:
            errores.append(f"Cátedra {cat}: departamento '{mt.get('departamento_id')}' inexistente")
            continue
        if mt.get("titular_id") not in usuarios:
            errores.append(f"Cátedra {cat}: titular_id '{mt.get('titular_id')}' no está en usuarios.json")
            continue
        fila = [cod, (mt.get("nombre_materia") or "").strip(), mt["departamento_id"], mt.get("carreras"),
                mt.get("contenidos_minimos"), mt.get("ubicacion_curriculum")]
        if cod in asignaturas and asignaturas[cod] != fila:
            avisos.append(f"Asignatura {cod}: las cátedras traen datos distintos (nombre/depto/contenidos); se usa la primera")
        else:
            asignaturas.setdefault(cod, fila)
        for c in mt.get("carrera_ids", []):
            if c not in carreras:
                avisos.append(f"Cátedra {cat}: carrera '{c}' inexistente -> se omite")
                continue
            filas_ac.add((cod, c))
        filas_catedra.append([cat, cod, mt["titular_id"]])
        titular = usuarios[mt["titular_id"]]
        if not any(r["rol"] == "TITULAR_CATEDRA" for r in titular.get("roles", [])):
            avisos.append(f"Cátedra {cat}: el titular {mt['titular_id']} no tiene el rol TITULAR_CATEDRA en usuarios.json")

    for a in avisos:
        print("AVISO:", a)
    for e in errores:
        print("ERROR:", e)
    if errores:
        print("\nNo se generó el SQL: corregí los errores en los JSON.")
        sys.exit(1)

    out = [
        "/* Generado por herramientas/generar_sql_catalogos.py a partir de datos/usuarios.json\n"
        "   y datos/materias.json. No editar a mano: volver a generar.\n"
        "   Ejecutar después de 01_esquema.sql. Se puede re-ejecutar (MERGE). */\n\n"
        "SET NOCOUNT ON;\nSET XACT_ABORT ON;\nGO\n\n",
        merge("pa.Departamento", ["id", "nombre"], ["id"], [[k, v] for k, v in deptos.items()]),
        merge("pa.Carrera", ["id", "nombre"], ["id"], [[k, v] for k, v in carreras.items()]),
        merge("pa.Usuario", ["id", "username", "email", "apellido", "nombre", "activo"], ["id"], filas_usuario),
        merge("pa.UsuarioRol", ["usuario_id", "rol_id"], ["usuario_id", "rol_id"], filas_rol, actualizar=False),
    ]
    if filas_rol_depto:
        out.append(
            "MERGE pa.UsuarioRolDepartamento AS t\nUSING (\n"
            "    SELECT ur.id AS usuario_rol_id, v.departamento_id\n"
            f"    FROM (VALUES\n    {values(filas_rol_depto)}\n    ) AS v (usuario_id, rol_id, departamento_id)\n"
            "    JOIN pa.UsuarioRol ur ON ur.usuario_id = v.usuario_id AND ur.rol_id = v.rol_id\n"
            ") AS s\nON t.usuario_rol_id = s.usuario_rol_id AND t.departamento_id = s.departamento_id\n"
            "WHEN NOT MATCHED THEN INSERT (usuario_rol_id, departamento_id) VALUES (s.usuario_rol_id, s.departamento_id);\nGO\n\n"
        )
    out += [
        merge("pa.Asignatura", ["codigo", "nombre", "departamento_id", "carreras_texto", "contenidos_minimos", "ubicacion_curriculum"],
              ["codigo"], list(asignaturas.values())),
        merge("pa.AsignaturaCarrera", ["codigo_asignatura", "carrera_id"], ["codigo_asignatura", "carrera_id"],
              sorted(filas_ac), actualizar=False),
        merge("pa.Catedra", ["id", "codigo_asignatura", "titular_id"], ["id"], filas_catedra),
        "PRINT 'Catálogos cargados.';\nGO\n",
    ]
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    # UTF-8 con BOM: SSMS y sqlcmd lo leen bien sin tocar opciones (acentos y ñ).
    SALIDA.write_text("".join(out), encoding="utf-8-sig")
    print(f"\nGenerado {SALIDA.relative_to(RAIZ)}: {len(deptos)} departamentos, {len(carreras)} carreras, "
          f"{len(filas_usuario)} usuarios, {len(filas_rol)} roles asignados, {len(asignaturas)} asignaturas, "
          f"{len(filas_catedra)} cátedras.")


if __name__ == "__main__":
    main()
