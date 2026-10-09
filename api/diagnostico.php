<?php
/*
 * Diagnóstico de la instalación de la API (PHP + drivers de SQL Server + base).
 * Abrir en el navegador:  https://miecon.uba.ar/<subcarpeta>/api/diagnostico.php
 * Se habilita con 'diagnostico_habilitado' => true en config.php. Deshabilitarlo después.
 */
header('Content-Type: text/html; charset=utf-8');

$cfgArchivo = __DIR__ . '/config.php';
$cfg = is_file($cfgArchivo) ? require $cfgArchivo : null;
$cfgEfectiva = $cfg ?? require __DIR__ . '/config.ejemplo.php';
if ($cfg !== null && empty($cfg['diagnostico_habilitado'])) {
    http_response_code(404);
    exit('No disponible.');
}

$filas = [];
function fila(&$filas, $ok, $item, $detalle) { $filas[] = [$ok, $item, $detalle]; }

// 1. PHP
fila($filas, version_compare(PHP_VERSION, '8.0.0', '>='), 'Versión de PHP', PHP_VERSION . ' (' . PHP_OS . ', ' . (PHP_INT_SIZE * 8) . ' bits, ' . (ZEND_THREAD_SAFE ? 'TS' : 'NTS') . ')');
fila($filas, true, 'php.ini cargado', php_ini_loaded_file() ?: '(ninguno)');
fila($filas, true, 'Servidor web', $_SERVER['SERVER_SOFTWARE'] ?? 'desconocido');

// 2. Extensiones
foreach (['pdo', 'pdo_sqlsrv', 'sqlsrv', 'json', 'mbstring', 'openssl', 'ldap'] as $ext) {
    $cargada = extension_loaded($ext);
    $nota = $cargada ? (phpversion($ext) ?: 'cargada') : 'NO cargada';
    if (!$cargada && $ext === 'ldap')   $nota .= ' (recién hará falta al pasar a LDAP)';
    if (!$cargada && $ext === 'sqlsrv') $nota .= ' (opcional: la API usa pdo_sqlsrv)';
    fila($filas, $cargada || in_array($ext, ['ldap', 'sqlsrv'], true), "Extensión $ext", $nota);
}
fila($filas, in_array('sqlsrv', PDO::getAvailableDrivers(), true), 'Drivers PDO disponibles', implode(', ', PDO::getAvailableDrivers()) ?: '(ninguno)');

// 3. ETAPA 1: catálogos JSON y carpeta del almacén
$dirDatos = $cfgEfectiva['datos']['carpeta'] ?? dirname(__DIR__) . '/datos';
foreach (['usuarios.json', 'materias.json'] as $cat) {
    $ok = is_file("$dirDatos/$cat") && is_array(json_decode((string)file_get_contents("$dirDatos/$cat"), true));
    fila($filas, $ok, "Etapa 1 — $cat", $ok ? 'OK (' . realpath("$dirDatos/$cat") . ')' : "No se encuentra o no es JSON válido en $dirDatos");
}
$dirAlmacen = $cfgEfectiva['almacen']['carpeta'] ?? __DIR__ . '/almacen';
if (!is_dir($dirAlmacen)) @mkdir($dirAlmacen, 0775, true);
$prueba = rtrim($dirAlmacen, '/\\') . '/.prueba_escritura';
$escribe = @file_put_contents($prueba, 'ok') !== false;
if ($escribe) @unlink($prueba);
fila($filas, $escribe, 'Etapa 1 — carpeta del almacén', $escribe
    ? 'Se puede escribir en ' . realpath($dirAlmacen)
    : "No se puede escribir en $dirAlmacen → dar permiso de Modificar a la cuenta del pool de IIS (ej. IIS AppPool\\NombreDelPool)");
fila($filas, true, 'Etapa 1 — autenticación', $cfgEfectiva['auth']['modo'] ?? 'fake');
fila($filas, true, 'Etapa 2 (SQL Server)', 'Los ítems siguientes solo son necesarios para la etapa 2.');

// 4. ETAPA 2: configuración y conexión a SQL Server
if ($cfg === null) {
    fila($filas, false, 'config.php', 'No existe. Copiar config.ejemplo.php como config.php y completar los datos de la base.');
} elseif (!in_array('sqlsrv', PDO::getAvailableDrivers(), true)) {
    fila($filas, false, 'Conexión a SQL Server', 'No se puede probar: falta la extensión pdo_sqlsrv.');
} else {
    $db = $cfg['db'];
    $dsn = 'sqlsrv:Server=' . $db['servidor'] . ';Database=' . $db['base']
         . (!empty($db['confiar_certificado']) ? ';TrustServerCertificate=1' : '');
    try {
        $t0 = microtime(true);
        $pdo = new PDO($dsn, $db['usuario'] ?: null, $db['clave'] ?: null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        $ms = round((microtime(true) - $t0) * 1000);
        $ver = $pdo->query("SELECT CAST(SERVERPROPERTY('ProductVersion') AS varchar(50)) + ' ' + CAST(SERVERPROPERTY('Edition') AS varchar(100))")->fetchColumn();
        fila($filas, true, 'Conexión a SQL Server', "OK en {$ms} ms — SQL Server $ver");
        fila($filas, true, 'Driver ODBC usado', $pdo->getAttribute(PDO::ATTR_CLIENT_VERSION)['DriverName'] ?? '?');

        $tablas = $pdo->query("SELECT t.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id WHERE s.name = 'pa' ORDER BY t.name")->fetchAll(PDO::FETCH_COLUMN);
        $esperadas = ['Asignatura','AsignaturaCarrera','Carrera','Catedra','Departamento','Notificacion','NotificacionDestinatario',
                      'Programa','ProgramaDocumento','ProgramaHistorial','ProgramaRevision','ProgramaSeccion','ProgramaUnidad',
                      'Rol','Seccion','TareaToma','Usuario','UsuarioRol','UsuarioRolDepartamento','UsuarioVisto'];
        $faltan = array_diff($esperadas, $tablas);
        fila($filas, !$faltan, 'Esquema pa', $faltan ? 'Faltan tablas: ' . implode(', ', $faltan) . ' — ejecutar sql/01_esquema.sql' : count($tablas) . ' tablas OK');

        if (!$faltan) {
            $c = $pdo->query("SELECT (SELECT COUNT(*) FROM pa.Usuario) u, (SELECT COUNT(*) FROM pa.Catedra) c, (SELECT COUNT(*) FROM pa.Programa) p")->fetch(PDO::FETCH_ASSOC);
            fila($filas, $c['u'] > 0 && $c['c'] > 0, 'Catálogos', "{$c['u']} usuarios, {$c['c']} cátedras, {$c['p']} programas" . ($c['u'] == 0 ? ' — ejecutar sql/02_catalogos.sql' : ''));
        }
    } catch (PDOException $e) {
        $msg = $e->getMessage();
        $pista = '';
        if (stripos($msg, 'ODBC Driver') !== false || stripos($msg, 'IM002') !== false)
            $pista = ' → Falta instalar "Microsoft ODBC Driver 18 (o 17) for SQL Server" en el servidor web.';
        elseif (stripos($msg, 'certificate') !== false)
            $pista = ' → Poner confiar_certificado = true en config.php.';
        elseif (stripos($msg, 'Login failed') !== false)
            $pista = ' → Usuario/clave incorrectos, o la cuenta de IIS no tiene acceso a la base.';
        fila($filas, false, 'Conexión a SQL Server', htmlspecialchars($msg) . $pista);
    }
}
?>
<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Diagnóstico API — Programas Académicos</title>
<style>
 body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:24px;color:#222}
 table{border-collapse:collapse;width:100%;max-width:1000px}
 td,th{border:1px solid #ccc;padding:6px 10px;text-align:left;vertical-align:top}
 .ok{color:#137333;font-weight:bold}.no{color:#c5221f;font-weight:bold}
</style></head><body>
<h1>Diagnóstico de la API</h1>
<table><tr><th></th><th>Ítem</th><th>Detalle</th></tr>
<?php foreach ($filas as [$ok, $item, $det]): ?>
<tr><td class="<?= $ok ? 'ok' : 'no' ?>"><?= $ok ? '✔' : '✘' ?></td><td><?= htmlspecialchars($item) ?></td><td><?= $det ?></td></tr>
<?php endforeach; ?>
</table>
<p>Recordá poner <code>'diagnostico_habilitado' =&gt; false</code> en config.php cuando termines.</p>
</body></html>
