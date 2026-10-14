-- 13/10/2026 (Sprint 3, HU 38-41): Talent Pool.
-- Registro publico por cedula (sin cuenta), consulta y estados para RRHH, y
-- contratacion (crea el funcionario y copia el curriculum al expediente).

CREATE TABLE `consentimiento` (
    `id` CHAR(36) NOT NULL,
    `version` VARCHAR(20) NOT NULL,
    `titulo` VARCHAR(180) NOT NULL,
    `texto` TEXT NOT NULL,
    `huella` CHAR(64) NOT NULL,
    `vigenteDesde` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `consentimiento_version_key`(`version`),
    UNIQUE INDEX `consentimiento_huella_key`(`huella`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `candidato` (
    `id` CHAR(36) NOT NULL,
    `cedula` VARCHAR(20) NOT NULL,
    `nombre` VARCHAR(80) NOT NULL,
    `primerApellido` VARCHAR(80) NOT NULL,
    `segundoApellido` VARCHAR(80) NULL,
    `correo` VARCHAR(150) NOT NULL,
    `telefono` VARCHAR(30) NULL,
    `fechaNacimiento` DATE NULL,
    `residencia` VARCHAR(150) NULL,
    `profesionId` CHAR(36) NULL,
    `profesionTexto` VARCHAR(150) NULL,
    `descripcion` TEXT NULL,
    `mesesExperiencia` SMALLINT NOT NULL DEFAULT 0,
    `estado` ENUM('activo', 'inactivo', 'contratado', 'descartado') NOT NULL DEFAULT 'activo',
    `cvNombreArchivo` VARCHAR(255) NULL,
    `cvRutaArchivo` VARCHAR(500) NULL,
    `cvTamanoBytes` INTEGER NULL,
    `funcionarioId` CHAR(36) NULL,
    `consentimientoId` CHAR(36) NOT NULL,
    `fechaConsentimiento` DATETIME(3) NOT NULL,
    `ipConsentimiento` VARCHAR(45) NULL,
    `vecesEnviado` INTEGER NOT NULL DEFAULT 1,
    `fechaRegistro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaCambioEstado` DATETIME(3) NULL,
    `usuarioCambioEstadoId` CHAR(36) NULL,
    `notaInterna` VARCHAR(1000) NULL,

    UNIQUE INDEX `candidato_cedula_key`(`cedula`),
    UNIQUE INDEX `candidato_funcionarioId_key`(`funcionarioId`),
    INDEX `idxCandidatoNombre`(`primerApellido`, `nombre`),
    INDEX `idxCandidatoCorreo`(`correo`),
    INDEX `idxCandidatoEstado`(`estado`, `fechaActualizacion`),
    INDEX `idxCandidatoProfesion`(`profesionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `formacionCandidato` (
    `id` CHAR(36) NOT NULL,
    `candidatoId` CHAR(36) NOT NULL,
    `nivel` ENUM('primaria', 'secundaria', 'tecnico', 'universitaria', 'posgrado', 'curso') NOT NULL,
    `institucion` VARCHAR(180) NULL,
    `titulo` VARCHAR(180) NULL,
    `areaEstudio` VARCHAR(150) NULL,
    `anioFinalizacion` SMALLINT NULL,
    `concluido` BOOLEAN NOT NULL DEFAULT true,

    INDEX `idxFormacionCandidato`(`candidatoId`, `nivel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `habilidad` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `categoria` ENUM('tecnica', 'blanda', 'idioma', 'herramienta') NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `habilidad_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `candidatoHabilidad` (
    `id` CHAR(36) NOT NULL,
    `candidatoId` CHAR(36) NOT NULL,
    `habilidadId` CHAR(36) NOT NULL,
    `nivel` ENUM('basico', 'intermedio', 'avanzado') NULL,

    UNIQUE INDEX `uqCandidatoHabilidad`(`candidatoId`, `habilidadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `experienciaCandidato` (
    `id` CHAR(36) NOT NULL,
    `candidatoId` CHAR(36) NOT NULL,
    `empresa` VARCHAR(180) NOT NULL,
    `puesto` VARCHAR(150) NOT NULL,
    `fechaInicio` DATE NULL,
    `fechaFin` DATE NULL,
    `esActual` BOOLEAN NOT NULL DEFAULT false,
    `descripcion` VARCHAR(500) NULL,

    INDEX `idxExperienciaCandidato`(`candidatoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `candidato` ADD CONSTRAINT `candidato_profesionId_fkey` FOREIGN KEY (`profesionId`) REFERENCES `profesion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `candidato` ADD CONSTRAINT `candidato_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `candidato` ADD CONSTRAINT `candidato_consentimientoId_fkey` FOREIGN KEY (`consentimientoId`) REFERENCES `consentimiento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `candidato` ADD CONSTRAINT `candidato_usuarioCambioEstadoId_fkey` FOREIGN KEY (`usuarioCambioEstadoId`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `formacionCandidato` ADD CONSTRAINT `formacionCandidato_candidatoId_fkey` FOREIGN KEY (`candidatoId`) REFERENCES `candidato`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `candidatoHabilidad` ADD CONSTRAINT `candidatoHabilidad_candidatoId_fkey` FOREIGN KEY (`candidatoId`) REFERENCES `candidato`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `candidatoHabilidad` ADD CONSTRAINT `candidatoHabilidad_habilidadId_fkey` FOREIGN KEY (`habilidadId`) REFERENCES `habilidad`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `experienciaCandidato` ADD CONSTRAINT `experienciaCandidato_candidatoId_fkey` FOREIGN KEY (`candidatoId`) REFERENCES `candidato`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Permisos: consultar (solo lectura) y administrar (estados, habilidades, contratar).
INSERT INTO `permiso` (`id`, `clave`, `modulo`, `descripcion`, `activo`)
SELECT UUID(), 'talentPool.ver', 'talentPool', 'Consultar los candidatos del Talent Pool y su curriculum', true
WHERE NOT EXISTS (SELECT 1 FROM `permiso` WHERE `clave` = 'talentPool.ver');
INSERT INTO `permiso` (`id`, `clave`, `modulo`, `descripcion`, `activo`)
SELECT UUID(), 'talentPool.administrar', 'talentPool', 'Cambiar el estado de los candidatos, administrar las habilidades y contratar desde el Talent Pool', true
WHERE NOT EXISTS (SELECT 1 FROM `permiso` WHERE `clave` = 'talentPool.administrar');

INSERT INTO `rolPermiso` (`id`, `rolId`, `permisoId`)
SELECT UUID(), r.`id`, p.`id`
  FROM `rol` r JOIN `permiso` p ON p.`clave` IN ('talentPool.ver', 'talentPool.administrar')
 WHERE r.`nombre` IN ('Super Administrador', 'Administrador')
   AND NOT EXISTS (SELECT 1 FROM `rolPermiso` rp WHERE rp.`rolId` = r.`id` AND rp.`permisoId` = p.`id`);

-- Habilidades iniciales (RRHH agrega mas con el uso).
INSERT INTO `habilidad` (`id`, `nombre`, `categoria`)
SELECT UUID(), h.nombre, h.categoria FROM (
  SELECT 'Atención al público' AS nombre, 'blanda' AS categoria UNION ALL
  SELECT 'Trabajo en equipo', 'blanda' UNION ALL
  SELECT 'Liderazgo', 'blanda' UNION ALL
  SELECT 'Comunicación escrita', 'blanda' UNION ALL
  SELECT 'Resolución de problemas', 'blanda' UNION ALL
  SELECT 'Manejo de conflictos', 'blanda' UNION ALL
  SELECT 'Inglés', 'idioma' UNION ALL
  SELECT 'Lengua de señas (LESCO)', 'idioma' UNION ALL
  SELECT 'Microsoft Excel', 'herramienta' UNION ALL
  SELECT 'Microsoft Word', 'herramienta' UNION ALL
  SELECT 'Sistemas de información geográfica (SIG)', 'herramienta' UNION ALL
  SELECT 'AutoCAD', 'herramienta' UNION ALL
  SELECT 'Contabilidad', 'tecnica' UNION ALL
  SELECT 'Gestión de proyectos', 'tecnica' UNION ALL
  SELECT 'Contratación administrativa', 'tecnica' UNION ALL
  SELECT 'Topografía', 'tecnica' UNION ALL
  SELECT 'Mantenimiento de infraestructura', 'tecnica' UNION ALL
  SELECT 'Licencia de conducir B1', 'tecnica' UNION ALL
  SELECT 'Programación', 'tecnica' UNION ALL
  SELECT 'Redacción de informes', 'tecnica'
) h
WHERE NOT EXISTS (SELECT 1 FROM `habilidad` x WHERE x.`nombre` = h.nombre);
