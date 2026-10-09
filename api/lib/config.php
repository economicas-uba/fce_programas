<?php
declare(strict_types=1);

/* Lee api/config.php (si no existe, usa los valores de config.ejemplo.php) y completa valores por defecto. */
final class Config
{
    public static function cargar(): array
    {
        $dir = dirname(__DIR__);
        $archivo = is_file("$dir/config.php") ? "$dir/config.php" : "$dir/config.ejemplo.php";
        $cfg = require $archivo;

        $cfg['auth']   = ($cfg['auth'] ?? []) + ['modo' => 'fake', 'clave_fake' => 'Prueba'];
        $cfg['datos']  = ($cfg['datos'] ?? []) + ['carpeta' => dirname($dir) . '/datos'];
        $cfg['almacen'] = ($cfg['almacen'] ?? []) + ['carpeta' => "$dir/almacen"];
        $cfg['demo']   = ($cfg['demo'] ?? []) + ['permitir_reinicio' => false];
        return $cfg;
    }
}
