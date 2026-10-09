<?php
declare(strict_types=1);

/* Respuestas JSON y manejo de errores comunes a toda la API. */
final class Http
{
    public static function iniciar(): void
    {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        header('X-Content-Type-Options: nosniff');
        set_exception_handler(function (Throwable $e) {
            error_log('[API programas] ' . $e);
            self::error(500, 'Error interno del servidor: ' . $e->getMessage());
        });
        set_error_handler(function (int $nivel, string $msg, string $archivo, int $linea) {
            throw new ErrorException($msg, 0, $nivel, $archivo, $linea);
        });
    }

    /** @return never */
    public static function json($datos, int $codigo = 200): void
    {
        http_response_code($codigo);
        echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    /** @return never */
    public static function error(int $codigo, string $mensaje, array $extra = []): void
    {
        self::json(['error' => $mensaje] + $extra, $codigo);
    }

    /* Cuerpo JSON de la petición, como array asociativo. */
    public static function cuerpo(): array
    {
        $crudo = file_get_contents('php://input');
        if ($crudo === '' || $crudo === false) return [];
        $datos = json_decode($crudo, true);
        if (!is_array($datos)) self::error(400, 'El cuerpo de la petición no es JSON válido.');
        return $datos;
    }
}
