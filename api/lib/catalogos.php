<?php
declare(strict_types=1);

/* Catálogos de solo lectura. ETAPA 1: datos/usuarios.json y datos/materias.json.
   ETAPA 2: las mismas estructuras armadas desde las tablas pa.Usuario, pa.Catedra, etc. */
final class Catalogos
{
    private string $carpeta;
    private array $cache = [];

    public function __construct(array $cfg)
    {
        $this->carpeta = rtrim($cfg['datos']['carpeta'], '/\\');
    }

    public function usuarios(): array { return $this->leer('usuarios.json'); }
    public function materias(): array { return $this->leer('materias.json'); }

    /* Busca un usuario por username, email o id (sin distinguir mayúsculas). */
    public function buscarUsuario(string $entrada): ?array
    {
        $entrada = strtolower(trim($entrada));
        foreach ($this->usuarios()['usuarios'] ?? [] as $u) {
            foreach (['username', 'email', 'id'] as $campo) {
                if (isset($u[$campo]) && strtolower((string)$u[$campo]) === $entrada) return $u;
            }
        }
        return null;
    }

    private function leer(string $nombre): array
    {
        if (isset($this->cache[$nombre])) return $this->cache[$nombre];
        $ruta = "{$this->carpeta}/$nombre";
        if (!is_file($ruta)) Http::error(500, "No se encuentra el catálogo $nombre en el servidor.");
        $datos = json_decode((string)file_get_contents($ruta), true);
        if (!is_array($datos)) Http::error(500, "El catálogo $nombre no es un JSON válido.");
        return $this->cache[$nombre] = $datos;
    }
}
