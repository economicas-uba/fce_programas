/* Generado por herramientas/generar_sql_catalogos.py a partir de datos/usuarios.json
   y datos/materias.json. No editar a mano: volver a generar.
   Ejecutar después de 01_esquema.sql. Se puede re-ejecutar (MERGE). */

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

MERGE pa.Departamento AS t
USING (VALUES
    (N'ECO', N'Economía'),
    (N'ADM', N'Administración'),
    (N'CON', N'Contabilidad'),
    (N'DER', N'Derecho'),
    (N'HUM', N'Humanidades'),
    (N'MAT', N'Matemática')
) AS s (id, nombre)
ON t.id = s.id
WHEN MATCHED THEN UPDATE SET nombre = s.nombre
WHEN NOT MATCHED THEN INSERT (id, nombre) VALUES (s.id, s.nombre);
GO

MERGE pa.Carrera AS t
USING (VALUES
    (N'LIC_ECO', N'Lic. en Economía'),
    (N'ACTUARIO', N'Actuario'),
    (N'CP', N'Contador Público'),
    (N'LIC_ADM', N'Lic. en Administración'),
    (N'LIC_SIST', N'Lic. en Sistemas de Información de las Organizaciones'),
    (N'ANA_DATOS', N'Tecnicatura Universitaria en Análisis de Datos')
) AS s (id, nombre)
ON t.id = s.id
WHEN MATCHED THEN UPDATE SET nombre = s.nombre
WHEN NOT MATCHED THEN INSERT (id, nombre) VALUES (s.id, s.nombre);
GO

MERGE pa.Usuario AS t
USING (VALUES
    (N'u-1001', N'jcurcio', N'javiercurcio@gmail.com', N'Curcio', N'Javier', 1),
    (N'u-1002', N'acampo', N'ana.campo@fce.uba.ar', N'Campo', N'Ana María', 1),
    (N'u-1003', N'fmoroni', N'fermoroni@gmail.com', N'Moroni', N'Fernando', 1),
    (N'u-1004', N'gtapia', N'gustavo.tapia1@gmail.com', N'Tapia', N'Gustavo', 1),
    (N'u-1005', N'fsaravia', N'saraviapersonal@gmail.com', N'Saravia', N'Federico', 1),
    (N'u-1006', N'nbursesi', N'nestorbursesi@gmail.com', N'Bursesi', N'Néstor', 1),
    (N'u-1007', N'dmacrini', N'domingomacrini@yahoo.com.ar', N'Macrini', N'Domingo', 1),
    (N'u-1008', N'nnacuzzi', N'norberto.nacuzzi@hotmail.com', N'Nacuzzi', N'Norberto', 1),
    (N'u-1009', N'glopezdelcarril', N'gonzalo@lopezdelcarril.com.ar', N'López del Carril', N'Gonzalo', 1),
    (N'u-1010', N'gragazzi', N'guillermoeragazzi@gmail.com', N'Ragazzi', N'Guillermo', 1),
    (N'u-1011', N'pconejeroortiz', N'pconejero@rec.uba.ar', N'Conejero Ortiz', N'Patricio', 1),
    (N'u-1012', N'agoldschmit', N'arielagold@hotmail.com', N'Goldschmit', N'Ariela', 1),
    (N'u-1013', N'jgilbert', N'jorgegilbert50@gmail.com', N'Gilbert', N'Jorge Orlando', 1),
    (N'u-1014', N'dweisman', N'diego_mw@hotmail.com', N'Weisman', N'Diego Mauricio', 1),
    (N'u-1015', N'mbianco', N'mariajose.bianco@economicas.uba.ar', N'Bianco', N'María José', 1),
    (N'u-1016', N'jgarciafronti', N'javier.garciafronti@economicas.uba.ar', N'García Fronti', N'Javier', 1),
    (N'u-1017', N'etarullo', N'eatarullo@yahoo.com.ar', N'Tarullo', N'Eduardo Ángel', 1),
    (N'u-1018', N'coriolo', N'coriolo@gmail.com', N'Oriolo', N'Cecilia', 1),
    (N'u-1019', N'vveriansky', N'vveriansky@vvasoluciones.com.ar', N'Veriansky', N'Víctor Gustavo', 1),
    (N'u-1020', N'gdiez', N'gustavo@estudiodiez.com', N'Diez', N'Gustavo Eduardo', 1),
    (N'u-1021', N'acalello', N'carolinacalello@calelloconsultores.com.ar', N'Calello', N'Andrea Carolina', 1),
    (N'u-1022', N'lfernandez', N'maria.fernandez@economicas.uba.ar', N'Fernández Orellana', N'Luz', 1),
    (N'u-1023', N'apico', N'andreapico@economicas.uba.ar', N'Picó', N'Andrea', 1),
    (N'u-1024', N'cecilia', N'cecilia@economicas.uba.ar', N'Cecilia', N'Cecilia', 1),
    (N'u-1025', N'esuarezkimura', N'elsa.suarezkimura@fce.uba.ar', N'Suárez Kimura', N'Elsa Beatriz', 1),
    (N'u-1026', N'rmazza', N'romazza@economicas.uba.ar', N'Mazza', N'Roberto César', 1),
    (N'u-1027', N't-262-01', N't-262-01@economicas.uba.ar', N'Zack', N'Guido', 1),
    (N'u-1028', N't-540-01', N't-540-01@economicas.uba.ar', N'Caviezel', N'Pablo Nicolás', 1),
    (N'u-1029', N't-540-02', N't-540-02@economicas.uba.ar', N'Vitale', N'Blanca Rosa', 1),
    (N'u-1031', N't-558-01', N't-558-01@economicas.uba.ar', N'Hallak', N'Juan Carlos', 1),
    (N'u-1033', N't-247-02', N't-247-02@economicas.uba.ar', N'D''Onofrio', N'Paula Alejandra', 1),
    (N'u-1034', N't-247-03', N't-247-03@economicas.uba.ar', N'Montanini', N'Gustavo Amado', 1),
    (N'u-1035', N't-247-04', N't-247-04@economicas.uba.ar', N'Scavone', N'Graciela María', 1),
    (N'u-1036', N't-274-01', N't-274-01@economicas.uba.ar', N'Alcain', N'Marcelo Fabián', 1),
    (N'u-1037', N't-274-02', N't-274-02@economicas.uba.ar', N'Arostegui', N'Angel Oscar', 1),
    (N'u-1038', N't-274-03', N't-274-03@economicas.uba.ar', N'Chahin', N'Tomás', 1),
    (N'u-1039', N't-274-04', N't-274-04@economicas.uba.ar', N'Gilli', N'Juan José', 1),
    (N'u-1040', N't-274-05', N't-274-05@economicas.uba.ar', N'Gómez Fulao', N'Juan Carlos', 1),
    (N'u-1041', N't-274-06', N't-274-06@economicas.uba.ar', N'Moleón', N'Rubén César', 1),
    (N'u-1043', N't-467-01', N't-467-01@economicas.uba.ar', N'Huber', N'Ladislao Ludovico', 1)
) AS s (id, username, email, apellido, nombre, activo)
ON t.id = s.id
WHEN MATCHED THEN UPDATE SET username = s.username, email = s.email, apellido = s.apellido, nombre = s.nombre, activo = s.activo
WHEN NOT MATCHED THEN INSERT (id, username, email, apellido, nombre, activo) VALUES (s.id, s.username, s.email, s.apellido, s.nombre, s.activo);
GO

MERGE pa.UsuarioRol AS t
USING (VALUES
    (N'u-1001', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1002', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1002', N'TITULAR_CATEDRA'),
    (N'u-1003', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1004', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1005', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1005', N'TITULAR_CATEDRA'),
    (N'u-1006', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1007', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1008', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1009', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1010', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1011', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1012', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1013', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1014', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1015', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1015', N'TITULAR_CATEDRA'),
    (N'u-1016', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1017', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1018', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1019', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1020', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1021', N'DIRECTOR_DEPARTAMENTO'),
    (N'u-1022', N'DIRECCION_ACADEMICA'),
    (N'u-1023', N'DIRECCION_ACADEMICA'),
    (N'u-1024', N'DIRECCION_ACADEMICA'),
    (N'u-1025', N'SUBSECRETARIA_1'),
    (N'u-1025', N'TITULAR_CATEDRA'),
    (N'u-1026', N'SUBSECRETARIA_2'),
    (N'u-1026', N'TITULAR_CATEDRA'),
    (N'u-1027', N'TITULAR_CATEDRA'),
    (N'u-1028', N'TITULAR_CATEDRA'),
    (N'u-1029', N'TITULAR_CATEDRA'),
    (N'u-1031', N'TITULAR_CATEDRA'),
    (N'u-1033', N'TITULAR_CATEDRA'),
    (N'u-1034', N'TITULAR_CATEDRA'),
    (N'u-1035', N'TITULAR_CATEDRA'),
    (N'u-1036', N'TITULAR_CATEDRA'),
    (N'u-1037', N'TITULAR_CATEDRA'),
    (N'u-1038', N'TITULAR_CATEDRA'),
    (N'u-1039', N'TITULAR_CATEDRA'),
    (N'u-1040', N'TITULAR_CATEDRA'),
    (N'u-1041', N'TITULAR_CATEDRA'),
    (N'u-1043', N'TITULAR_CATEDRA')
) AS s (usuario_id, rol_id)
ON t.usuario_id = s.usuario_id AND t.rol_id = s.rol_id
WHEN NOT MATCHED THEN INSERT (usuario_id, rol_id) VALUES (s.usuario_id, s.rol_id);
GO

MERGE pa.UsuarioRolDepartamento AS t
USING (
    SELECT ur.id AS usuario_rol_id, v.departamento_id
    FROM (VALUES
    (N'u-1001', N'DIRECTOR_DEPARTAMENTO', N'ECO'),
    (N'u-1002', N'DIRECTOR_DEPARTAMENTO', N'CON'),
    (N'u-1003', N'DIRECTOR_DEPARTAMENTO', N'ADM'),
    (N'u-1004', N'DIRECTOR_DEPARTAMENTO', N'ADM'),
    (N'u-1005', N'DIRECTOR_DEPARTAMENTO', N'ADM'),
    (N'u-1006', N'DIRECTOR_DEPARTAMENTO', N'CON'),
    (N'u-1007', N'DIRECTOR_DEPARTAMENTO', N'CON'),
    (N'u-1008', N'DIRECTOR_DEPARTAMENTO', N'CON'),
    (N'u-1009', N'DIRECTOR_DEPARTAMENTO', N'DER'),
    (N'u-1010', N'DIRECTOR_DEPARTAMENTO', N'DER'),
    (N'u-1011', N'DIRECTOR_DEPARTAMENTO', N'ECO'),
    (N'u-1012', N'DIRECTOR_DEPARTAMENTO', N'ECO'),
    (N'u-1013', N'DIRECTOR_DEPARTAMENTO', N'HUM'),
    (N'u-1014', N'DIRECTOR_DEPARTAMENTO', N'HUM'),
    (N'u-1015', N'DIRECTOR_DEPARTAMENTO', N'MAT'),
    (N'u-1016', N'DIRECTOR_DEPARTAMENTO', N'MAT'),
    (N'u-1017', N'DIRECTOR_DEPARTAMENTO', N'MAT')
    ) AS v (usuario_id, rol_id, departamento_id)
    JOIN pa.UsuarioRol ur ON ur.usuario_id = v.usuario_id AND ur.rol_id = v.rol_id
) AS s
ON t.usuario_rol_id = s.usuario_rol_id AND t.departamento_id = s.departamento_id
WHEN NOT MATCHED THEN INSERT (usuario_rol_id, departamento_id) VALUES (s.usuario_rol_id, s.departamento_id);
GO

MERGE pa.Asignatura AS t
USING (VALUES
    (262, N'MACROECONOMIA I', N'ECO', N'Lic. en Economía (RCS N.º 1696/24) y Actuario (RCS N.º 1824/24)', N'La problemática macroeconómica: hechos estilizados y esquemas básicos de modelización. Fenómenos nominales y reales: ciclo y tendencia, desempleo e inflación. Cuentas nacionales, ahorro, inversión, restricción externa. Identidades contables ex-post y equilibrios ex-ante. Ajustes por precio y cantidad. Modelos de ingreso-gasto. Mercados financieros. El esquema ISLM; implicancias para políticas fiscales y monetarias. Mercado de trabajo y desempleo. Oferta y demanda agregadas. Inflación y expectativas. Macroeconomía abierta, regímenes cambiarios y trilema de la imposibilidad. Especificidades del desequilibrio macroeconómico en Argentina: crisis cambiarias, financieras y alta inflación. Políticas de estabilización.', N'No cuenta con requisitos previos, solo tener aprobado el primer tramo.'),
    (540, N'ANÁLISIS ESTADÍSTICO I', N'MAT', N'Actuario (RCS Nº 1824/24) y Lic. en Economía (RCS Nº 1696/24)', N'La estadística como disciplina para el Análisis de los Fenómenos Socioeconómicos. La aleatoriedad y la regularidad estadística. Necesidad de su modelización. Elementos de la Teoría de la Probabilidad y de las Variables Aleatorias. Modelos Elementales de Probabilidad. Tratamiento de la Información. Estadística descriptiva: Análisis Exploratorio y Descriptivo de Datos. Relaciones entre variables. Elementos de muestreo e introducción a la Inferencia Estadística. Análisis de regresión. Tratamiento Elemental de las Series de tiempo. Números índices.', N'Esta materia es común a las cinco carreras que se dictan en la Facultad de Ciencias Económicas.
La ubicación de Estadística en el Segundo Tramo del Ciclo General de la currícula, permite que los alumnos puedan comprender toda la teoría matemática que se desarrolle ya que cuentan con Análisis Matemático I aprobada, materia del Primer Tramo del Ciclo General. La utilidad de los conocimientos que Estadística proporciona se pone de manifiesto en aquellas materias donde el análisis cuantitativo sea relevante para la comprensión de la disciplina en la cual se aplica. Estadística es un requisito previo de las materias Cálculo Financiero, Estadística para Administradores y Estadística II'),
    (558, N'ECONOMÍA INTERNACIONAL', N'ECO', N'Lic. en Economía (RCS Nº 1696/24)', N'Panorama de la economía internacional: patrones de comercio mundial y regional. Teorías del comercio internacional basadas en ventajas comparativas: productividad y dotación factorial. Teorías del comercio internacional basadas en economías de escala y diferenciación de producto. Efectos dinámicos del comercio: productividad y calidad de producto. Tecnología y comercio internacional. El sistema productivo internacional: inversión extranjera directa, empresas transnacionales y cadenas globales y regionales de valor. Instrumentos de la política comercial: características y efectos. Controversias sobre los fundamentos de la política comercial. Teorías de la integración económica y principales acuerdos regionales. Instituciones y reglas del comercio internacional. Tipo de cambio, estructura productiva y competitividad internacional. Sistema monetario y financiero internacional.', N'Esta asignatura se encuentra dentro del Ciclo Profesional de la carrera. Para inscribirse, requiere haber aprobado las asignaturas “Macroeconomía I” y “Microeconomía II”'),
    (247, N'TEORÍA CONTABLE', N'CON', N'Contador Público (RCS N° 1509/18), Lic. En Administración (texto ordenado, RCS N° 3880/15), Lic en Sistemas de Información de las Organizaciones (RCS Nº 1709/18), Lic. en Economía (texto ordenado, RCS N° 5636/12) y Actuario (texto ordenado, RCS N° 6207/13)', N'El objetivo de la contabilidad, la contabilidad como ciencia, arte, técnica o tecnología. Contabilidad. Antecedentes y evolución histórica. Sistemas de información: la contabilidad como el sistema de información de las organizaciones. Características y requisitos de la información contable. La contabilidad y sus segmentos: contabilidad patrimonial o financiera, contabilidad gubernamental, contabilidad social y ambiental, contabilidad económica y contabilidad de gestión. Entes: públicos y privados; con y sin fines de lucro. Sus recursos y fuentes. Operaciones y hechos económicos. Patrimonio y contabilidad. Ejercicio económico. Variaciones patrimoniales. Incertidumbres y contingencias. Documentación respaldatoria. Terminología contable aplicable. El proceso contable y la estructura patrimonial y de resultados. Modelos contables: unidad de medida, criterios de medición (valuación) y capital a mantener. Aspectos normativos. Estados contables o financieros. Conceptos introductorios. Las cuentas. Planes y manuales de cuentas. Sistema Contable. Mecánica del proceso de registración contable. Métodos de registración. La partida doble. (1)

El objetivo de la contabilidad, la contabilidad como ciencia, arte, técnica o tecnología. Evolución histórica. Sistemas de información: la contabilidad como subsistema de información de las organizaciones. Tipos de información: patrimonial, de gestión. Características y requisitos de la información contable, de costos, valores corrientes, valores recuperables, incertidumbres y contingencias, en el sector privado y en el sector público. Informes. Terminología contable aplicable. El proceso contable y estructura patrimonial y de resultados. Capital a mantener, unidad de medida, criterios de valuación. Reconocimiento contable de variaciones patrimoniales. Medición de ganancia. Aspectos legales y profesionales de las normas contables nacionales. La normativa internacional (2)

(1) Corresponde a las Carreras de Contador Público (RCS N° 1509/18) y Licenciado en Sistemas de Información de las Organizaciones (RCS N° 1709/18)
(2) Corresponde a las Carreras de Actuario (RCS N° 5634/12), Licenciado en Economía (RCS N° 5636/12) y Licenciado en Administración (RCS N° 5637/12)', N'La asignatura se ubica en el 2do. Tramo del Ciclo General de todas las Carreras que se cursan en la Facultad, siendo requisito para su cursado la aprobación de todas las asignaturas del 1er. Tramo integrantes de aquel Ciclo.'),
    (274, N'SISTEMAS ADMINISTRATIVOS', N'ADM', N'Actuario (RCS N.º 1824/24), Contador Público (RCS N.º 1509/18 y su modif. RCS N.º 215/20), Lic. en Administración (RCS N.º 1695/24), y Lic. en Sistemas de Información de las Organizaciones (RCS N.º 1825/24)', N'Visión de la organización como sistema complejo. Elementos que constituyen el sistema. Modelo de sistemas y su relación con la naturaleza de la organización. Sistemas componentes de planeamiento y gestión comerciales, financiera, de capital humano y de producción. Los circuitos de normalización, regulación y control de las operaciones. Las áreas de las organizaciones, funciones y procesos. Niveles de autoridad y áreas de responsabilidad. Relación entre las estructuras y los procesos. Las formas básicas de articular tareas, flujos de información y decisiones. Caracterización de los sistemas administrativos. Análisis y diseño de sistemas administrativos. Tecnología de los sistemas aplicados a la gestión. Diferentes formas de diseño de la organización: metodologías y alternativas. Gestión de proyectos para la implementación de nuevos sistemas.', N'La materia forma parte del Ciclo Profesional de las Carreras de Licenciado en Administración, Contador Público, Licenciado en Sistemas de Información y Actuario en Administración. Para estar en condiciones de inscribirse a cursar la materia, es requisito haber regularizado/aprobado la asignatura Administración General (6)'),
    (467, N'GESTIÓN DEL TALENTO', N'ADM', N'Lic. en Administración (RCS N.º 1695/24)', N'El mundo del trabajo. El ser humano y el trabajo. Estrategia organizacional y de gestión de personas. El mercado laboral. […]', N'La materia pertenece al Ciclo Profesional.')
) AS s (codigo, nombre, departamento_id, carreras_texto, contenidos_minimos, ubicacion_curriculum)
ON t.codigo = s.codigo
WHEN MATCHED THEN UPDATE SET nombre = s.nombre, departamento_id = s.departamento_id, carreras_texto = s.carreras_texto, contenidos_minimos = s.contenidos_minimos, ubicacion_curriculum = s.ubicacion_curriculum
WHEN NOT MATCHED THEN INSERT (codigo, nombre, departamento_id, carreras_texto, contenidos_minimos, ubicacion_curriculum) VALUES (s.codigo, s.nombre, s.departamento_id, s.carreras_texto, s.contenidos_minimos, s.ubicacion_curriculum);
GO

MERGE pa.AsignaturaCarrera AS t
USING (VALUES
    (247, N'ACTUARIO'),
    (247, N'CP'),
    (247, N'LIC_ADM'),
    (247, N'LIC_ECO'),
    (247, N'LIC_SIST'),
    (262, N'ACTUARIO'),
    (262, N'LIC_ECO'),
    (274, N'ACTUARIO'),
    (274, N'CP'),
    (274, N'LIC_ADM'),
    (274, N'LIC_SIST'),
    (467, N'LIC_ADM'),
    (540, N'ACTUARIO'),
    (540, N'LIC_ECO'),
    (558, N'LIC_ECO')
) AS s (codigo_asignatura, carrera_id)
ON t.codigo_asignatura = s.codigo_asignatura AND t.carrera_id = s.carrera_id
WHEN NOT MATCHED THEN INSERT (codigo_asignatura, carrera_id) VALUES (s.codigo_asignatura, s.carrera_id);
GO

MERGE pa.Catedra AS t
USING (VALUES
    (N'262-01', 262, N'u-1027'),
    (N'540-01', 540, N'u-1028'),
    (N'540-02', 540, N'u-1029'),
    (N'540-03', 540, N'u-1015'),
    (N'558-01', 558, N'u-1031'),
    (N'247-01', 247, N'u-1002'),
    (N'247-02', 247, N'u-1033'),
    (N'247-03', 247, N'u-1034'),
    (N'247-04', 247, N'u-1035'),
    (N'247-05', 247, N'u-1025'),
    (N'274-01', 274, N'u-1036'),
    (N'274-02', 274, N'u-1037'),
    (N'274-03', 274, N'u-1038'),
    (N'274-04', 274, N'u-1039'),
    (N'274-05', 274, N'u-1040'),
    (N'274-06', 274, N'u-1041'),
    (N'274-07', 274, N'u-1005'),
    (N'467-01', 467, N'u-1043'),
    (N'467-02', 467, N'u-1026')
) AS s (id, codigo_asignatura, titular_id)
ON t.id = s.id
WHEN MATCHED THEN UPDATE SET codigo_asignatura = s.codigo_asignatura, titular_id = s.titular_id
WHEN NOT MATCHED THEN INSERT (id, codigo_asignatura, titular_id) VALUES (s.id, s.codigo_asignatura, s.titular_id);
GO

PRINT 'Catálogos cargados.';
GO
