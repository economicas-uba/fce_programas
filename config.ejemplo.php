<?php
/*
 * Configuración de la API de Programas Académicos.
 * Copiar este archivo como  config.php  (en la misma carpeta) y completar.
 * config.php NO se sube al repo (está en .gitignore): tiene credenciales.
 */
return [
    'db' => [
        // Instancia de SQL Server. Ej.: 'localhost', 'SERVIDOR\\SQLEXPRESS', 'srv-bd,1433'
        'servidor'   => 'localhost',
        'base'       => 'ProgramasAcademicos',
        // Usuario SQL. Si se deja vacío se intenta autenticación integrada de Windows
        // (la cuenta del pool de aplicación de IIS debe tener permisos en la base).
        'usuario'    => '',
        'clave'      => '',
        // En redes internas con certificado autofirmado suele hacer falta en true.
        'confiar_certificado' => true,
    ],

    // Autenticación: 'fake' (demo: usuarios de prueba, clave única) o 'ldap' (miecon.uba.ar, más adelante).
    'auth' => [
        'modo'       => 'fake',
        'clave_fake' => 'Prueba',
    ],

    // ETAPA 1 (demo): dónde se guardan los datos en JSON. La cuenta de IIS necesita permiso de escritura.
    // Conviene que esté fuera de la carpeta publicada; si queda dentro, api/web.config bloquea el acceso.
    'almacen' => [
        'carpeta' => __DIR__ . '/almacen',
    ],

    // Catálogos de la etapa 1 (usuarios.json y materias.json).
    'datos' => [
        'carpeta' => __DIR__ . '/../datos',
    ],

    'demo' => [
        // true: permite "Reiniciar datos" e "Importar datos" desde Perfil. Afecta a TODOS los usuarios de prueba.
        'permitir_reinicio' => false,
    ],

    // Habilita api/diagnostico.php. Dejarlo en false fuera de la instalación inicial.
    'diagnostico_habilitado' => true,
];
