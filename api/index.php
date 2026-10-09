<?php
/*
 * API de Programas Académicos — punto de entrada único.
 *
 * Las rutas van en el parámetro ?r= para no depender de reglas de reescritura de IIS:
 *   api/index.php?r=ping
 *   api/index.php?r=programas/12
 *
 * ETAPA 1 (demo): los catálogos se leen de datos/*.json y el estado de los programas
 * se guarda en api/almacen/estado.php (ver lib/almacen_json.php).
 * ETAPA 2: se reemplaza el almacén por uno sobre SQL Server con la misma interfaz;
 * las rutas y el front no cambian.
 *
 * Rutas
 *   GET    ping                         Estado de la API (sin sesión)
 *   GET    catalogos/usuarios           usuarios.json (sin sesión: lo usa la pantalla de login de prueba)
 *   GET    catalogos/materias           materias.json
 *   GET    sesion                       Usuario de la sesión actual
 *   POST   sesion                       Login  {username, clave}
 *   DELETE sesion                       Logout
 *   GET    estado                       Programas, tomas, notificaciones y vistos
 *   POST   programas/reservar-id        Reserva el próximo id de programa
 *   PUT    programas/{id}               Alta/actualización de un programa completo (control por _rev)
 *   DELETE programas/{id}               Baja (solo si la demo permite reiniciar)
 *   POST   tomas                        Tomar una tarea {programa_id, tarea, rol}
 *   DELETE tomas/{programaId}/{tarea}   Liberar / descartar una toma
 *   POST   notificaciones               Alta de una notificación
 *   PUT    vistos/{usuarioId}           Novedades vistas por el usuario (solo el propio)
 *   POST   estado/reiniciar             Borra todo (solo si la demo lo permite)
 *   POST   estado/importar              Reemplaza todo con un export (solo si la demo lo permite)
 */
declare(strict_types=1);

require __DIR__ . '/lib/http.php';
require __DIR__ . '/lib/config.php';
require __DIR__ . '/lib/sesion.php';
require __DIR__ . '/lib/catalogos.php';
require __DIR__ . '/lib/almacen_json.php';

Http::iniciar();
$cfg     = Config::cargar();
$sesion  = new Sesion($cfg);
$catalog = new Catalogos($cfg);
$almacen = new AlmacenJson($cfg['almacen']['carpeta']);

$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$ruta   = trim((string)($_GET['r'] ?? ''), '/');
$partes = $ruta === '' ? [] : explode('/', $ruta);
$rec    = $partes[0] ?? '';

/* Exige sesión iniciada y devuelve el id del usuario. */
$usuario = function () use ($sesion): array {
    $u = $sesion->usuario();
    if (!$u) Http::error(401, 'La sesión no está iniciada o venció. Volvé a ingresar.');
    return $u;
};
$permiteReinicio = fn() => !empty($cfg['demo']['permitir_reinicio']);

switch (true) {

    /* ---------- utilitarios ---------- */
    case $rec === 'ping' && $metodo === 'GET':
        Http::json(['ok' => true, 'almacen' => 'json', 'auth' => $cfg['auth']['modo'],
                    'permitir_reinicio' => $permiteReinicio(), 'version' => 1]);

    /* ---------- catálogos ---------- */
    case $rec === 'catalogos' && $metodo === 'GET' && ($partes[1] ?? '') === 'usuarios':
        Http::json($catalog->usuarios());

    case $rec === 'catalogos' && $metodo === 'GET' && ($partes[1] ?? '') === 'materias':
        Http::json($catalog->materias());

    /* ---------- sesión ---------- */
    case $rec === 'sesion' && $metodo === 'GET':
        Http::json(['usuario' => $usuario()]);

    case $rec === 'sesion' && $metodo === 'POST':
        $b = Http::cuerpo();
        $u = $sesion->ingresar((string)($b['username'] ?? ''), (string)($b['clave'] ?? ''), $catalog);
        Http::json(['usuario' => $u]);

    case $rec === 'sesion' && $metodo === 'DELETE':
        $sesion->salir();
        Http::json(['ok' => true]);

    /* ---------- estado completo ---------- */
    case $rec === 'estado' && count($partes) === 1 && $metodo === 'GET':
        $usuario();
        Http::json($almacen->estadoParaCliente());

    case $rec === 'estado' && ($partes[1] ?? '') === 'reiniciar' && $metodo === 'POST':
        $usuario();
        if (!$permiteReinicio()) Http::error(403, 'El reinicio de datos está deshabilitado en este servidor.');
        $almacen->reiniciar();
        Http::json(['ok' => true]);

    case $rec === 'estado' && ($partes[1] ?? '') === 'importar' && $metodo === 'POST':
        $usuario();
        if (!$permiteReinicio()) Http::error(403, 'La importación de datos está deshabilitada en este servidor.');
        Http::json($almacen->importar(Http::cuerpo()));

    /* ---------- programas ---------- */
    case $rec === 'programas' && ($partes[1] ?? '') === 'reservar-id' && $metodo === 'POST':
        $usuario();
        Http::json(['id' => $almacen->reservarIdPrograma()]);

    case $rec === 'programas' && isset($partes[1]) && ctype_digit($partes[1]) && $metodo === 'PUT':
        $usuario();
        $p = Http::cuerpo();
        if ((int)($p['id'] ?? 0) !== (int)$partes[1]) Http::error(400, 'El id del programa no coincide con la ruta.');
        $res = $almacen->guardarPrograma($p);
        if (isset($res['conflicto'])) Http::error(409, 'El programa fue modificado por otro usuario mientras lo tenías abierto.', $res);
        Http::json($res);

    case $rec === 'programas' && isset($partes[1]) && ctype_digit($partes[1]) && $metodo === 'DELETE':
        $usuario();
        if (!$permiteReinicio()) Http::error(403, 'La baja de programas está deshabilitada en este servidor.');
        $almacen->borrarPrograma((int)$partes[1]);
        Http::json(['ok' => true]);

    /* ---------- tomas de tareas ---------- */
    case $rec === 'tomas' && count($partes) === 1 && $metodo === 'POST':
        $u = $usuario();
        $b = Http::cuerpo();
        $toma = [
            'programa_id' => (int)($b['programa_id'] ?? 0),
            'tarea'       => (string)($b['tarea'] ?? ''),
            'rol'         => (string)($b['rol'] ?? ''),
            'tomada_por'  => $u['id'],                       // siempre el usuario de la sesión
            'fecha'       => (string)($b['fecha'] ?? gmdate('c')),
        ];
        if (!$toma['programa_id'] || $toma['tarea'] === '') Http::error(400, 'Faltan programa_id o tarea.');
        $res = $almacen->tomarTarea($toma);
        if (isset($res['conflicto'])) Http::error(409, 'La tarea ya fue tomada por otro usuario.', $res);
        Http::json($res, 201);

    case $rec === 'tomas' && count($partes) === 3 && ctype_digit($partes[1]) && $metodo === 'DELETE':
        $usuario();
        $almacen->liberarTarea((int)$partes[1], $partes[2]);
        Http::json(['ok' => true]);

    /* ---------- notificaciones ---------- */
    case $rec === 'notificaciones' && count($partes) === 1 && $metodo === 'POST':
        $usuario();
        $n = Http::cuerpo();
        if (empty($n['id'])) Http::error(400, 'La notificación no tiene id.');
        $almacen->agregarNotificacion($n);
        Http::json(['ok' => true], 201);

    /* ---------- novedades vistas ---------- */
    case $rec === 'vistos' && isset($partes[1]) && $metodo === 'PUT':
        $u = $usuario();
        if ($partes[1] !== $u['id']) Http::error(403, 'Solo se pueden actualizar las novedades propias.');
        $almacen->guardarVistos($u['id'], Http::cuerpo());
        Http::json(['ok' => true]);

    default:
        Http::error(404, "Ruta no encontrada: $metodo $ruta");
}
