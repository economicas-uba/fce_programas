<?php
declare(strict_types=1);

/*
 * ETAPA 1 — Almacén en un archivo JSON (api/almacen/estado.php).
 *
 * El archivo se llama estado.php y empieza con una línea PHP que corta la ejecución:
 * si alguien lo pide desde el navegador no ve nada, aunque el servidor no tenga
 * configurado el bloqueo de la carpeta. El resto del archivo es JSON legible.
 *
 * Simula la base de datos para la demo. Guarda la misma estructura que el
 * prototipo tenía en localStorage: programs, tomas, notificaciones, vistos.
 * Cada escritura bloquea el archivo (flock) para que dos usuarios guardando
 * a la vez no lo corrompan, y deja una copia del estado anterior en
 * estado.anterior.json por si hubiera que recuperarlo.
 *
 * Cada programa lleva un número de versión (_rev) que asigna el servidor.
 * Si alguien intenta guardar un programa con una versión vieja (otro usuario
 * lo modificó mientras lo tenía abierto) se rechaza en lugar de pisar los cambios.
 *
 * ETAPA 2: se reemplaza por una clase con los mismos métodos públicos sobre SQL Server.
 */
final class AlmacenJson
{
    private string $archivo;
    private string $respaldo;

    public function __construct(string $carpeta)
    {
        $carpeta = rtrim($carpeta, '/\\');
        if (!is_dir($carpeta) && !@mkdir($carpeta, 0775, true)) {
            Http::error(500, "No se pudo crear la carpeta del almacén ($carpeta). Verificá los permisos de escritura de IIS.");
        }
        $this->archivo  = "$carpeta/estado.php";
        $this->respaldo = "$carpeta/estado.anterior.php";
    }

    /* ---------------- lectura ---------------- */

    public function estadoParaCliente(): array
    {
        $e = $this->leer();
        // Más nuevos primero, como los muestra el prototipo.
        usort($e['programs'], fn($a, $b) => ($b['id'] ?? 0) <=> ($a['id'] ?? 0));
        return [
            'programs'       => $e['programs'],
            'tomas'          => $e['tomas'],
            'notificaciones' => $e['notificaciones'],
            'vistos'         => (object)$e['vistos'],
        ];
    }

    /* ---------------- programas ---------------- */

    public function reservarIdPrograma(): int
    {
        return $this->modificar(function (array &$e) {
            $id = max((int)$e['nextId'], $this->maxId($e) + 1);
            $e['nextId'] = $id + 1;
            return $id;
        });
    }

    public function guardarPrograma(array $p): array
    {
        return $this->modificar(function (array &$e) use ($p) {
            $id = (int)$p['id'];
            $i  = $this->indicePrograma($e, $id);
            $revCliente = isset($p['_rev']) ? (int)$p['_rev'] : null;

            if ($i !== null) {
                $revActual = (int)($e['programs'][$i]['_rev'] ?? 0);
                if ($revCliente !== $revActual) {
                    return ['conflicto' => true, 'programa' => $e['programs'][$i]];
                }
                $p['_rev'] = $revActual + 1;
                $e['programs'][$i] = $p;
            } else {
                $p['_rev'] = 1;
                $e['programs'][] = $p;
                if ($e['nextId'] <= $id) $e['nextId'] = $id + 1;
            }
            return ['_rev' => $p['_rev']];
        });
    }

    public function borrarPrograma(int $id): void
    {
        $this->modificar(function (array &$e) use ($id) {
            $e['programs'] = array_values(array_filter($e['programs'], fn($p) => (int)$p['id'] !== $id));
            $e['tomas'] = array_values(array_filter($e['tomas'], fn($t) => (int)$t['programa_id'] !== $id));
            $e['notificaciones'] = array_values(array_filter($e['notificaciones'], fn($n) => (int)($n['programaId'] ?? 0) !== $id));
        });
    }

    /* ---------------- tomas de tareas ---------------- */

    public function tomarTarea(array $toma): array
    {
        return $this->modificar(function (array &$e) use ($toma) {
            foreach ($e['tomas'] as $t) {
                if ((int)$t['programa_id'] === $toma['programa_id'] && $t['tarea'] === $toma['tarea']) {
                    if ($t['tomada_por'] === $toma['tomada_por']) return ['toma' => $t];   // ya era suya
                    return ['conflicto' => true, 'toma' => $t];
                }
            }
            $e['tomas'][] = $toma;
            return ['toma' => $toma];
        });
    }

    public function liberarTarea(int $programaId, string $tarea): void
    {
        $this->modificar(function (array &$e) use ($programaId, $tarea) {
            $e['tomas'] = array_values(array_filter($e['tomas'],
                fn($t) => !((int)$t['programa_id'] === $programaId && $t['tarea'] === $tarea)));
        });
    }

    /* ---------------- notificaciones y vistos ---------------- */

    public function agregarNotificacion(array $n): void
    {
        $this->modificar(function (array &$e) use ($n) {
            foreach ($e['notificaciones'] as $x) if ((string)$x['id'] === (string)$n['id']) return;
            $e['notificaciones'][] = $n;
        });
    }

    public function guardarVistos(string $usuarioId, array $vistos): void
    {
        $this->modificar(function (array &$e) use ($usuarioId, $vistos) {
            $e['vistos'][$usuarioId] = $vistos;
        });
    }

    /* ---------------- administración de la demo ---------------- */

    public function reiniciar(): void
    {
        $this->modificar(function (array &$e) { $e = $this->vacio(); });
    }

    /* Acepta el objeto de datos del prototipo ({programs, tomas, ...}) o el archivo
       que genera "Exportar Datos" (todo el localStorage, con el estado como texto). */
    public function importar(array $datos): array
    {
        if (!isset($datos['programs'])) {
            foreach ($datos as $valor) {
                $dec = is_string($valor) ? json_decode($valor, true) : null;
                if (is_array($dec) && isset($dec['programs'])) { $datos = $dec; break; }
            }
        }
        if (!isset($datos['programs']) || !is_array($datos['programs'])) {
            Http::error(400, 'El archivo no contiene datos de programas reconocibles.');
        }
        $this->modificar(function (array &$e) use ($datos) {
            $e = $this->vacio();
            foreach ($datos['programs'] as $p) { $p['_rev'] = 1; $e['programs'][] = $p; }
            $e['tomas']          = array_values($datos['tomas'] ?? []);
            $e['notificaciones'] = array_values($datos['notificaciones'] ?? []);
            $e['vistos']         = (array)($datos['vistos'] ?? []);
            $e['nextId']         = max((int)($datos['nextId'] ?? 1), $this->maxId($e) + 1);
        });
        return $this->estadoParaCliente();
    }

    /* ---------------- archivo ---------------- */

    private function vacio(): array
    {
        return ['version' => 1, 'nextId' => 1, 'programs' => [], 'tomas' => [], 'notificaciones' => [], 'vistos' => []];
    }

    private const CABECERA = "<?php http_response_code(404); exit; ?>\n";

    /* Quita la línea de protección y devuelve el JSON (o '' si el archivo está vacío). */
    private function sinCabecera(string $txt): string
    {
        return str_starts_with($txt, self::CABECERA) ? substr($txt, strlen(self::CABECERA)) : $txt;
    }

    private function normalizar($e): array
    {
        $e = is_array($e) ? $e + $this->vacio() : $this->vacio();
        $e['vistos'] = (array)$e['vistos'];
        return $e;
    }

    private function leer(): array
    {
        if (!is_file($this->archivo)) return $this->vacio();
        $h = fopen($this->archivo, 'rb');
        flock($h, LOCK_SH);
        $txt = $this->sinCabecera((string)stream_get_contents($h));
        flock($h, LOCK_UN);
        fclose($h);
        return $this->normalizar($txt === '' ? null : json_decode($txt, true));
    }

    /* Lee, aplica $cambio y vuelve a escribir, con el archivo bloqueado todo el tiempo. */
    private function modificar(callable $cambio)
    {
        $h = fopen($this->archivo, 'c+b');
        if (!$h) Http::error(500, 'No se pudo abrir el almacén. Verificá los permisos de escritura de la carpeta api/almacen.');
        try {
            flock($h, LOCK_EX);
            $original = (string)stream_get_contents($h);
            $txt = $this->sinCabecera($original);
            $e = $this->normalizar($txt === '' ? null : json_decode($txt, true));
            if ($txt !== '' && json_decode($txt) === null) {
                Http::error(500, 'estado.json está dañado. Se puede recuperar desde estado.anterior.php.');
            }
            $resultado = $cambio($e);

            $nuevo = json_encode(
                ['vistos' => (object)$e['vistos']] + $e,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT | JSON_INVALID_UTF8_SUBSTITUTE
            );
            if ($original !== '') @file_put_contents($this->respaldo, $original);
            ftruncate($h, 0);
            rewind($h);
            fwrite($h, self::CABECERA . $nuevo);
            fflush($h);
            return $resultado;
        } finally {
            flock($h, LOCK_UN);
            fclose($h);
        }
    }

    private function indicePrograma(array $e, int $id): ?int
    {
        foreach ($e['programs'] as $i => $p) if ((int)($p['id'] ?? 0) === $id) return $i;
        return null;
    }

    private function maxId(array $e): int
    {
        return array_reduce($e['programs'], fn($m, $p) => max($m, (int)($p['id'] ?? 0)), 0);
    }
}
