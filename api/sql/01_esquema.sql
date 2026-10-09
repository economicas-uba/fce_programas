/* =====================================================================
   Programas Académicos (FCE-UBA) — Esquema de base de datos
   Motor: SQL Server 2016 o superior
   ---------------------------------------------------------------------
   Uso:
     1. Crear (o elegir) la base, por ejemplo:  CREATE DATABASE ProgramasAcademicos;
     2. Ejecutar este script conectado a esa base (USE ProgramasAcademicos;).
     3. Ejecutar 02_catalogos.sql para cargar departamentos, carreras,
        roles, usuarios, asignaturas y cátedras.
   El script se puede volver a ejecutar: solo crea lo que no existe.
   Todas las tablas viven en el esquema [pa].

   Modelo (resumen):
     Catálogos ......... Departamento, Carrera, Rol, Usuario, UsuarioRol,
                         UsuarioRolDepartamento, Asignatura, AsignaturaCarrera,
                         Catedra, Seccion
     Programa .......... Programa (cabecera + estado del flujo)
                         ProgramaSeccion (una fila por sección, texto libre)
                         ProgramaUnidad  (unidades del Programa analítico)
                         ProgramaRevision (chequeos de revisión académica)
                         ProgramaHistorial
                         ProgramaDocumento (PDF final que va a GEDO)
     Operación ......... TareaToma, Notificacion, NotificacionDestinatario,
                         UsuarioVisto
   ===================================================================== */

SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;   -- necesario para el índice filtrado de ProgramaDocumento (sqlcmd lo trae en OFF)
GO

IF SCHEMA_ID('pa') IS NULL EXEC('CREATE SCHEMA pa');
GO

/* =====================================================================
   CATÁLOGOS
   ===================================================================== */

IF OBJECT_ID('pa.Departamento') IS NULL
CREATE TABLE pa.Departamento (
    id          VARCHAR(10)    NOT NULL CONSTRAINT PK_Departamento PRIMARY KEY,
    nombre      NVARCHAR(150)  NOT NULL
);
GO

IF OBJECT_ID('pa.Carrera') IS NULL
CREATE TABLE pa.Carrera (
    id          VARCHAR(20)    NOT NULL CONSTRAINT PK_Carrera PRIMARY KEY,
    nombre      NVARCHAR(200)  NOT NULL
);
GO

/* ámbito: CATEDRA (titular: sus cátedras), DEPARTAMENTO (director/a: su depto.),
   GLOBAL (subsecretarías y Dirección Académica: todos los programas). */
IF OBJECT_ID('pa.Rol') IS NULL
CREATE TABLE pa.Rol (
    id          VARCHAR(30)    NOT NULL CONSTRAINT PK_Rol PRIMARY KEY,
    nombre      NVARCHAR(100)  NOT NULL,
    ambito      VARCHAR(15)    NOT NULL
        CONSTRAINT CK_Rol_ambito CHECK (ambito IN ('CATEDRA','DEPARTAMENTO','GLOBAL'))
);
GO

/* username = usuario de miecon.uba.ar (será la clave para la autenticación LDAP). */
IF OBJECT_ID('pa.Usuario') IS NULL
CREATE TABLE pa.Usuario (
    id          VARCHAR(20)    NOT NULL CONSTRAINT PK_Usuario PRIMARY KEY,
    username    VARCHAR(100)   NOT NULL CONSTRAINT UQ_Usuario_username UNIQUE,
    email       NVARCHAR(200)  NULL,
    apellido    NVARCHAR(100)  NOT NULL,
    nombre      NVARCHAR(100)  NOT NULL,
    activo      BIT            NOT NULL CONSTRAINT DF_Usuario_activo DEFAULT (1),
    creado_en   DATETIME2(0)   NOT NULL CONSTRAINT DF_Usuario_creado DEFAULT (SYSUTCDATETIME())
);
GO

/* Un usuario puede tener varios roles. */
IF OBJECT_ID('pa.UsuarioRol') IS NULL
CREATE TABLE pa.UsuarioRol (
    id          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_UsuarioRol PRIMARY KEY,
    usuario_id  VARCHAR(20)    NOT NULL CONSTRAINT FK_UsuarioRol_Usuario REFERENCES pa.Usuario(id),
    rol_id      VARCHAR(30)    NOT NULL CONSTRAINT FK_UsuarioRol_Rol     REFERENCES pa.Rol(id),
    CONSTRAINT UQ_UsuarioRol UNIQUE (usuario_id, rol_id)
);
GO

/* Alcance de un rol de ámbito DEPARTAMENTO (qué departamentos dirige). */
IF OBJECT_ID('pa.UsuarioRolDepartamento') IS NULL
CREATE TABLE pa.UsuarioRolDepartamento (
    usuario_rol_id  INT         NOT NULL CONSTRAINT FK_URD_UsuarioRol   REFERENCES pa.UsuarioRol(id) ON DELETE CASCADE,
    departamento_id VARCHAR(10) NOT NULL CONSTRAINT FK_URD_Departamento REFERENCES pa.Departamento(id),
    CONSTRAINT PK_UsuarioRolDepartamento PRIMARY KEY (usuario_rol_id, departamento_id)
);
GO

IF OBJECT_ID('pa.Asignatura') IS NULL
CREATE TABLE pa.Asignatura (
    codigo                INT            NOT NULL CONSTRAINT PK_Asignatura PRIMARY KEY,
    nombre                NVARCHAR(200)  NOT NULL,
    departamento_id       VARCHAR(10)    NOT NULL CONSTRAINT FK_Asignatura_Departamento REFERENCES pa.Departamento(id),
    carreras_texto        NVARCHAR(500)  NULL,  -- texto para el PDF, ej. "Lic. en Economía (RCS N.º 1696/24) y ..."
    contenidos_minimos    NVARCHAR(MAX)  NULL,
    ubicacion_curriculum  NVARCHAR(MAX)  NULL
);
GO

IF OBJECT_ID('pa.AsignaturaCarrera') IS NULL
CREATE TABLE pa.AsignaturaCarrera (
    codigo_asignatura  INT         NOT NULL CONSTRAINT FK_AC_Asignatura REFERENCES pa.Asignatura(codigo),
    carrera_id         VARCHAR(20) NOT NULL CONSTRAINT FK_AC_Carrera    REFERENCES pa.Carrera(id),
    CONSTRAINT PK_AsignaturaCarrera PRIMARY KEY (codigo_asignatura, carrera_id)
);
GO

/* Cátedra = asignatura + titular (ej. '262-01'). Cada programa corresponde a una cátedra. */
IF OBJECT_ID('pa.Catedra') IS NULL
CREATE TABLE pa.Catedra (
    id                 VARCHAR(20)  NOT NULL CONSTRAINT PK_Catedra PRIMARY KEY,
    codigo_asignatura  INT          NOT NULL CONSTRAINT FK_Catedra_Asignatura REFERENCES pa.Asignatura(codigo),
    titular_id         VARCHAR(20)  NOT NULL CONSTRAINT FK_Catedra_Titular    REFERENCES pa.Usuario(id),
    activa             BIT          NOT NULL CONSTRAINT DF_Catedra_activa DEFAULT (1)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Catedra_titular')
    CREATE INDEX IX_Catedra_titular ON pa.Catedra (titular_id);
GO

/* Definición de las 13 secciones del programa (A a E). Se carga más abajo. */
IF OBJECT_ID('pa.Seccion') IS NULL
CREATE TABLE pa.Seccion (
    clave           VARCHAR(40)    NOT NULL CONSTRAINT PK_Seccion PRIMARY KEY,
    orden           TINYINT        NOT NULL,
    apartado        NVARCHAR(100)  NOT NULL,   -- ej. 'A. Encuadre'
    titulo          NVARCHAR(300)  NOT NULL,
    bloqueada       BIT            NOT NULL,   -- se precarga desde la asignatura y no se edita
    grupo_revision  VARCHAR(15)    NULL
        CONSTRAINT CK_Seccion_grupo CHECK (grupo_revision IN ('encuadre','metodos','bibliografia'))
);
GO

/* =====================================================================
   PROGRAMA
   ===================================================================== */

/* Cabecera del programa. Los datos de materia/titular/departamento se guardan
   también como "foto" (snapshot) al momento del alta, para que el PDF final no
   cambie si luego se modifica el catálogo. */
IF OBJECT_ID('pa.Programa') IS NULL
CREATE TABLE pa.Programa (
    id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Programa PRIMARY KEY,
    catedra_id          VARCHAR(20)    NOT NULL CONSTRAINT FK_Programa_Catedra      REFERENCES pa.Catedra(id),
    codigo_asignatura   INT            NOT NULL CONSTRAINT FK_Programa_Asignatura   REFERENCES pa.Asignatura(codigo),
    departamento_id     VARCHAR(10)    NOT NULL CONSTRAINT FK_Programa_Departamento REFERENCES pa.Departamento(id),
    titular_id          VARCHAR(20)    NOT NULL CONSTRAINT FK_Programa_Titular      REFERENCES pa.Usuario(id),

    -- snapshot
    nombre_materia      NVARCHAR(200)  NOT NULL,
    titular             NVARCHAR(200)  NOT NULL,
    departamento        NVARCHAR(150)  NOT NULL,
    carrera             NVARCHAR(500)  NOT NULL,
    plan_anio           VARCHAR(10)    NOT NULL,   -- "year" en el prototipo

    -- flujo
    estado              VARCHAR(25)    NOT NULL CONSTRAINT DF_Programa_estado DEFAULT ('BORRADOR')
        CONSTRAINT CK_Programa_estado CHECK (estado IN ('BORRADOR','EN_REVISION','EN_REVISION_ACADEMICA','APROBADO','FINALIZADO')),
    origen_correccion   VARCHAR(15)    NULL
        CONSTRAINT CK_Programa_origen CHECK (origen_correccion IN ('DIRECTOR','ACADEMICA')),

    -- conformidad del/de la Director/a de Departamento
    conformidad_estado      VARCHAR(15)    NULL
        CONSTRAINT CK_Programa_conformidad CHECK (conformidad_estado IN ('PENDIENTE','OK','RECHAZADO')),
    conformidad_observacion NVARCHAR(MAX)  NULL,
    conformidad_fecha       DATETIME2(0)   NULL,
    conformidad_usuario_id  VARCHAR(20)    NULL CONSTRAINT FK_Programa_ConfUsuario REFERENCES pa.Usuario(id),

    -- última corrección solicitada (vigente mientras el programa está en BORRADOR por corrección)
    correccion_usuario_id   VARCHAR(20)    NULL CONSTRAINT FK_Programa_CorrUsuario REFERENCES pa.Usuario(id),
    correccion_rol_id       VARCHAR(30)    NULL CONSTRAINT FK_Programa_CorrRol     REFERENCES pa.Rol(id),
    correccion_grupo        VARCHAR(15)    NULL,
    correccion_observacion  NVARCHAR(MAX)  NULL,
    correccion_fecha        DATETIME2(0)   NULL,

    -- elevación / expediente (al quedar APROBADO)
    nota_elevacion      VARCHAR(50)    NULL,
    expediente_gedo     VARCHAR(80)    NULL,
    expediente_fecha    DATETIME2(0)   NULL,

    -- resolución (al quedar FINALIZADO)
    resolucion          NVARCHAR(80)   NULL,
    resolucion_fecha    DATETIME2(0)   NULL,

    -- notificación del/de la Director/a de Departamento
    director_notificado_fecha      DATETIME2(0) NULL,
    director_notificado_usuario_id VARCHAR(20)  NULL CONSTRAINT FK_Programa_NotifUsuario REFERENCES pa.Usuario(id),

    -- auditoría y control de concurrencia
    creado_por          VARCHAR(20)    NOT NULL CONSTRAINT FK_Programa_CreadoPor REFERENCES pa.Usuario(id),
    creado_en           DATETIME2(0)   NOT NULL CONSTRAINT DF_Programa_creado DEFAULT (SYSUTCDATETIME()),
    actualizado_en      DATETIME2(0)   NOT NULL CONSTRAINT DF_Programa_actualizado DEFAULT (SYSUTCDATETIME()),
    version_fila        ROWVERSION     NOT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Programa_estado')
    CREATE INDEX IX_Programa_estado ON pa.Programa (estado) INCLUDE (departamento_id, titular_id, catedra_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Programa_catedra')
    CREATE INDEX IX_Programa_catedra ON pa.Programa (catedra_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Programa_departamento')
    CREATE INDEX IX_Programa_departamento ON pa.Programa (departamento_id);
GO

/* Una fila por sección y programa. El contenido es texto libre, como en el prototipo.
   (Para 'programaAnalitico' el detalle va en pa.ProgramaUnidad; aquí solo queda la marca de completada.) */
IF OBJECT_ID('pa.ProgramaSeccion') IS NULL
CREATE TABLE pa.ProgramaSeccion (
    programa_id     INT            NOT NULL CONSTRAINT FK_PS_Programa REFERENCES pa.Programa(id) ON DELETE CASCADE,
    clave           VARCHAR(40)    NOT NULL CONSTRAINT FK_PS_Seccion  REFERENCES pa.Seccion(clave),
    contenido       NVARCHAR(MAX)  NULL,
    completada      BIT            NOT NULL CONSTRAINT DF_PS_completada DEFAULT (0),
    modificado_por  VARCHAR(20)    NULL CONSTRAINT FK_PS_Usuario REFERENCES pa.Usuario(id),
    modificado_en   DATETIME2(0)   NULL,
    CONSTRAINT PK_ProgramaSeccion PRIMARY KEY (programa_id, clave)
);
GO

IF OBJECT_ID('pa.ProgramaUnidad') IS NULL
CREATE TABLE pa.ProgramaUnidad (
    id                    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProgramaUnidad PRIMARY KEY,
    programa_id           INT            NOT NULL CONSTRAINT FK_PU_Programa REFERENCES pa.Programa(id) ON DELETE CASCADE,
    orden                 SMALLINT       NOT NULL,
    unidad_tematica       NVARCHAR(MAX)  NULL,
    objetivo_aprendizaje  NVARCHAR(MAX)  NULL,
    temas_desarrollar     NVARCHAR(MAX)  NULL,
    CONSTRAINT UQ_ProgramaUnidad_orden UNIQUE (programa_id, orden)
);
GO

/* Chequeos de la revisión académica, en paralelo:
   encuadre -> Dirección Académica, metodos -> Subsecretaría 1, bibliografia -> Subsecretaría 2. */
IF OBJECT_ID('pa.ProgramaRevision') IS NULL
CREATE TABLE pa.ProgramaRevision (
    programa_id   INT            NOT NULL CONSTRAINT FK_PR_Programa REFERENCES pa.Programa(id) ON DELETE CASCADE,
    grupo         VARCHAR(15)    NOT NULL
        CONSTRAINT CK_PR_grupo CHECK (grupo IN ('encuadre','metodos','bibliografia')),
    estado        VARCHAR(20)    NOT NULL
        CONSTRAINT CK_PR_estado CHECK (estado IN ('PENDIENTE','OK','CON_OBSERVACIONES')),
    observacion   NVARCHAR(MAX)  NULL,
    fecha         DATETIME2(0)   NULL,
    usuario_id    VARCHAR(20)    NULL CONSTRAINT FK_PR_Usuario REFERENCES pa.Usuario(id),
    CONSTRAINT PK_ProgramaRevision PRIMARY KEY (programa_id, grupo)
);
GO

IF OBJECT_ID('pa.ProgramaHistorial') IS NULL
CREATE TABLE pa.ProgramaHistorial (
    id           BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProgramaHistorial PRIMARY KEY,
    programa_id  INT            NOT NULL CONSTRAINT FK_PH_Programa REFERENCES pa.Programa(id) ON DELETE CASCADE,
    fecha        DATETIME2(0)   NOT NULL CONSTRAINT DF_PH_fecha DEFAULT (SYSUTCDATETIME()),
    usuario_id   VARCHAR(20)    NULL CONSTRAINT FK_PH_Usuario REFERENCES pa.Usuario(id),  -- NULL en pasos automáticos
    rol_id       VARCHAR(30)    NULL CONSTRAINT FK_PH_Rol     REFERENCES pa.Rol(id),
    actor        NVARCHAR(250)  NOT NULL,   -- texto mostrado, ej. 'Ana María Campo (Autoridad de Departamento)'
    accion       NVARCHAR(250)  NOT NULL,
    detalle      NVARCHAR(MAX)  NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_PH_programa')
    CREATE INDEX IX_PH_programa ON pa.ProgramaHistorial (programa_id, fecha);
GO

/* PDF final del programa (el que sigue su tratamiento en GEDO).
   Se guarda en la base para simplificar backup y permisos; con el volumen
   esperado (cientos de PDF de pocos cientos de KB) no hace falta FILESTREAM. */
IF OBJECT_ID('pa.ProgramaDocumento') IS NULL
CREATE TABLE pa.ProgramaDocumento (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProgramaDocumento PRIMARY KEY,
    programa_id     INT             NOT NULL CONSTRAINT FK_PD_Programa REFERENCES pa.Programa(id) ON DELETE CASCADE,
    tipo            VARCHAR(20)     NOT NULL CONSTRAINT DF_PD_tipo DEFAULT ('PDF_FINAL')
        CONSTRAINT CK_PD_tipo CHECK (tipo IN ('PDF_FINAL','PDF_BORRADOR')),
    nombre_archivo  NVARCHAR(255)   NOT NULL,
    mime            VARCHAR(100)    NOT NULL CONSTRAINT DF_PD_mime DEFAULT ('application/pdf'),
    tamano_bytes    INT             NOT NULL,
    sha256          CHAR(64)        NOT NULL,
    contenido       VARBINARY(MAX)  NOT NULL,
    vigente         BIT             NOT NULL CONSTRAINT DF_PD_vigente DEFAULT (1),
    generado_por    VARCHAR(20)     NOT NULL CONSTRAINT FK_PD_Usuario REFERENCES pa.Usuario(id),
    generado_en     DATETIME2(0)    NOT NULL CONSTRAINT DF_PD_generado DEFAULT (SYSUTCDATETIME())
);
GO
/* Un solo PDF final vigente por programa. */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_PD_final_vigente')
    CREATE UNIQUE INDEX UX_PD_final_vigente ON pa.ProgramaDocumento (programa_id)
    WHERE tipo = 'PDF_FINAL' AND vigente = 1;
GO

/* =====================================================================
   OPERACIÓN: tareas tomadas, notificaciones, novedades vistas
   ===================================================================== */

/* Una tarea pendiente de un programa puede ser tomada por un usuario;
   los demás ven "Tomada por X". Al resolverse la tarea, la fila se borra. */
IF OBJECT_ID('pa.TareaToma') IS NULL
CREATE TABLE pa.TareaToma (
    programa_id  INT           NOT NULL CONSTRAINT FK_TT_Programa REFERENCES pa.Programa(id) ON DELETE CASCADE,
    tarea        VARCHAR(40)   NOT NULL,   -- ej. 'DAR_CONFORMIDAD', 'CHEQUEAR_BIBLIOGRAFIA'
    rol_id       VARCHAR(30)   NOT NULL CONSTRAINT FK_TT_Rol     REFERENCES pa.Rol(id),
    tomada_por   VARCHAR(20)   NOT NULL CONSTRAINT FK_TT_Usuario REFERENCES pa.Usuario(id),
    fecha        DATETIME2(0)  NOT NULL CONSTRAINT DF_TT_fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_TareaToma PRIMARY KEY (programa_id, tarea)
);
GO

IF OBJECT_ID('pa.Notificacion') IS NULL
CREATE TABLE pa.Notificacion (
    id           INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Notificacion PRIMARY KEY,
    programa_id  INT            NOT NULL CONSTRAINT FK_Notif_Programa REFERENCES pa.Programa(id) ON DELETE CASCADE,
    fecha        DATETIME2(0)   NOT NULL CONSTRAINT DF_Notif_fecha DEFAULT (SYSUTCDATETIME()),
    titulo       NVARCHAR(200)  NOT NULL,
    texto        NVARCHAR(MAX)  NOT NULL
);
GO

IF OBJECT_ID('pa.NotificacionDestinatario') IS NULL
CREATE TABLE pa.NotificacionDestinatario (
    notificacion_id  INT          NOT NULL CONSTRAINT FK_ND_Notificacion REFERENCES pa.Notificacion(id) ON DELETE CASCADE,
    usuario_id       VARCHAR(20)  NOT NULL CONSTRAINT FK_ND_Usuario      REFERENCES pa.Usuario(id),
    CONSTRAINT PK_NotificacionDestinatario PRIMARY KEY (notificacion_id, usuario_id)
);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ND_usuario')
    CREATE INDEX IX_ND_usuario ON pa.NotificacionDestinatario (usuario_id);
GO

/* Novedades ya vistas por cada usuario (enciende/apaga la campana de Notificaciones).
   clave: 't<programa>|<tarea>' para tareas, 'n<id>' para notificaciones (igual que el prototipo). */
IF OBJECT_ID('pa.UsuarioVisto') IS NULL
CREATE TABLE pa.UsuarioVisto (
    usuario_id  VARCHAR(20)   NOT NULL CONSTRAINT FK_UV_Usuario REFERENCES pa.Usuario(id),
    clave       VARCHAR(80)   NOT NULL,
    fecha       DATETIME2(0)  NOT NULL CONSTRAINT DF_UV_fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_UsuarioVisto PRIMARY KEY (usuario_id, clave)
);
GO

/* =====================================================================
   DATOS FIJOS: roles y secciones
   ===================================================================== */

MERGE pa.Rol AS t
USING (VALUES
    ('TITULAR_CATEDRA',       N'Titular de cátedra',                  'CATEDRA'),
    ('DIRECTOR_DEPARTAMENTO', N'Autoridad de Departamento',           'DEPARTAMENTO'),
    ('SUBSECRETARIA_1',       N'Subsecretaría - Rev. Pedagógica',     'GLOBAL'),
    ('SUBSECRETARIA_2',       N'Subsecretaría - Rev. Bibliográfica',  'GLOBAL'),
    ('DIRECCION_ACADEMICA',   N'Dirección Académica',                 'GLOBAL')
) AS s (id, nombre, ambito)
ON t.id = s.id
WHEN MATCHED THEN UPDATE SET nombre = s.nombre, ambito = s.ambito
WHEN NOT MATCHED THEN INSERT (id, nombre, ambito) VALUES (s.id, s.nombre, s.ambito);
GO

MERGE pa.Seccion AS t
USING (VALUES
    ('contenidosMinimos',        1, N'A. Encuadre', N'Contenidos mínimos', 1, 'encuadre'),
    ('razonesInclusion',         2, N'A. Encuadre', N'Razones que justifican la inclusión de la asignatura dentro del plan de estudios. Su importancia en la formación profesional', 0, 'encuadre'),
    ('ubicacionCurriculum',      3, N'A. Encuadre', N'Ubicación de la asignatura en el currículum', 1, 'encuadre'),
    ('objetivosAprendizaje',     4, N'A. Encuadre', N'Objetivos del aprendizaje (Misión de la asignatura)', 0, 'encuadre'),
    ('programaAnalitico',        5, N'B. Programa analítico', N'Programa analítico', 0, NULL),
    ('bibliografiaObligatoria',  6, N'C. Bibliografía', N'Bibliografía obligatoria', 0, 'bibliografia'),
    ('bibliografiaAmpliatoria',  7, N'C. Bibliografía', N'Bibliografía ampliatoria', 0, 'bibliografia'),
    ('objetivosGeneralesCursos', 8, N'D. Métodos de conducción del aprendizaje', N'Objetivos generales a cumplir en los cursos de promoción', 0, 'metodos'),
    ('metodologiaProceso',       9, N'D. Métodos de conducción del aprendizaje', N'Metodología del proceso enseñanza - aprendizaje', 0, 'metodos'),
    ('dinamicaClases',          10, N'D. Métodos de conducción del aprendizaje', N'Dinámica del dictado de las clases', 0, 'metodos'),
    ('evaluacionPresenciales',  11, N'E. Métodos de evaluación', N'Cursos presenciales y semipresenciales (cursos virtuales y a distancia)', 0, 'metodos'),
    ('evaluacionFinales',       12, N'E. Métodos de evaluación', N'Régimen de exámenes finales, intensivos, magistrales y libres', 0, 'metodos'),
    ('criterioPromedio',        13, N'E. Métodos de evaluación', N'Criterio de confección del promedio de notas finales', 0, 'metodos')
) AS s (clave, orden, apartado, titulo, bloqueada, grupo_revision)
ON t.clave = s.clave
WHEN MATCHED THEN UPDATE SET orden = s.orden, apartado = s.apartado, titulo = s.titulo,
                             bloqueada = s.bloqueada, grupo_revision = s.grupo_revision
WHEN NOT MATCHED THEN INSERT (clave, orden, apartado, titulo, bloqueada, grupo_revision)
                      VALUES (s.clave, s.orden, s.apartado, s.titulo, s.bloqueada, s.grupo_revision);
GO

PRINT 'Esquema pa creado/actualizado correctamente.';
GO
