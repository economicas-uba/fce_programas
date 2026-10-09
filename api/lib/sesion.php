<?php
declare(strict_types=1);

/* Sesión del usuario (cookie de sesión PHP).
   ETAPA 1 / demo: modo 'fake' — cualquier usuario activo de usuarios.json con la clave única de prueba.
   Más adelante: modo 'ldap' — se valida usuario y clave contra el LDAP de miecon.uba.ar
   y el usuario se busca en el catálogo por username. Solo cambia validarCredenciales(). */
final class Sesion
{
    private array $cfg;

    public function __construct(array $cfg)
    {
        $this->cfg = $cfg;
        if (session_status() !== PHP_SESSION_ACTIVE) {
            session_name('PA_SESION');
            session_set_cookie_params([
                'path'     => rtrim(dirname($_SERVER['SCRIPT_NAME'] ?? '/'), '/\\') . '/',
                'httponly' => true,
                'samesite' => 'Lax',
                'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            ]);
            session_start();
        }
    }

    public function usuario(): ?array
    {
        return $_SESSION['usuario'] ?? null;
    }

    public function ingresar(string $username, string $clave, Catalogos $catalogos): array
    {
        if ($username === '') Http::error(400, 'Falta el usuario.');
        $u = $catalogos->buscarUsuario($username);
        if (!$u || !$this->validarCredenciales($u, $clave)) Http::error(401, 'Usuario o contraseña incorrectos.');
        if (($u['activo'] ?? true) === false) Http::error(403, 'El usuario está inactivo.');
        session_regenerate_id(true);
        $_SESSION['usuario'] = [
            'id'       => $u['id'],
            'username' => $u['username'] ?? '',
            'nombre'   => trim(($u['nombre'] ?? '') . ' ' . ($u['apellido'] ?? '')),
        ];
        return $_SESSION['usuario'];
    }

    public function salir(): void
    {
        $_SESSION = [];
        session_destroy();
    }

    private function validarCredenciales(array $u, string $clave): bool
    {
        switch ($this->cfg['auth']['modo']) {
            case 'fake':
                return hash_equals((string)$this->cfg['auth']['clave_fake'], $clave);
            case 'ldap':
                // Pendiente: ldap_connect + ldap_bind con el usuario de miecon.uba.ar.
                Http::error(501, 'La autenticación LDAP todavía no está implementada.');
            default:
                Http::error(500, 'Modo de autenticación desconocido en config.php.');
        }
    }
}
