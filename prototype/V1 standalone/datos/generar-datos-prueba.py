# Regenera datos-prueba.js a partir de usuarios.json y materias.json.
# Hace falta cuando se abre el HTML con doble clic (file://): el navegador no deja leer los .json
# locales y la aplicación usa esta copia. Uso:   python generar-datos-prueba.py
import io, json, os

aqui = os.path.dirname(os.path.abspath(__file__))

def leer(nombre):
    with io.open(os.path.join(aqui, nombre), encoding="utf-8") as f:
        return json.load(f)

datos = {"usuarios": leer("usuarios.json"), "materias": leer("materias.json")}
with io.open(os.path.join(aqui, "datos-prueba.js"), "w", encoding="utf-8", newline="\n") as f:
    f.write("/* Generado por generar-datos-prueba.py a partir de usuarios.json y materias.json. No editar a mano. */\n")
    f.write("window.DATOS_PRUEBA=" + json.dumps(datos, ensure_ascii=False) + ";\n")
print("datos-prueba.js generado")
