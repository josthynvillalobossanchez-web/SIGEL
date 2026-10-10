-- Sprint 2 (09/10/2026): incapacidades (con su catalogo de tipos),
-- capacitaciones y el registro de horas extra. Ademas, los tipos de
-- documento para los adjuntos (justificante, boleta, certificado), el
-- permiso horasExtra.registrar y los tipos de incapacidad iniciales.

-- CreateTable
CREATE TABLE `tipoIncapacidad` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `tipoIncapacidad_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `incapacidad` (
    `id` CHAR(36) NOT NULL,
    `consecutivo` VARCHAR(30) NOT NULL,
    `funcionarioId` CHAR(36) NOT NULL,
    `usuarioRegistroId` CHAR(36) NOT NULL,
    `tipoIncapacidadId` CHAR(36) NOT NULL,
    `entidadEmisora` VARCHAR(120) NULL,
    `numeroBoleta` VARCHAR(50) NULL,
    `fechaInicio` DATE NOT NULL,
    `fechaFin` DATE NOT NULL,
    `cantidadDias` DECIMAL(5, 2) NOT NULL,
    `observacion` VARCHAR(500) NULL,
    `documentoId` CHAR(36) NOT NULL,
    `fechaRegistro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `vigente` BOOLEAN NOT NULL DEFAULT true,
    `motivoAnulacion` VARCHAR(255) NULL,
    `usuarioAnulacionId` CHAR(36) NULL,
    `fechaAnulacion` DATETIME(3) NULL,

    UNIQUE INDEX `incapacidad_consecutivo_key`(`consecutivo`),
    INDEX `idxIncapacidadFuncionario`(`funcionarioId`, `fechaInicio`),
    INDEX `idxIncapacidadCalendario`(`fechaInicio`, `fechaFin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `capacitacion` (
    `id` CHAR(36) NOT NULL,
    `funcionarioId` CHAR(36) NOT NULL,
    `nombre` VARCHAR(200) NOT NULL,
    `institucion` VARCHAR(180) NULL,
    `modalidad` ENUM('presencial', 'virtual', 'mixta') NULL,
    `fechaInicio` DATE NULL,
    `fechaFin` DATE NULL,
    `cantidadHoras` DECIMAL(6, 2) NULL,
    `afectaJornada` BOOLEAN NOT NULL DEFAULT false,
    `solicitudId` CHAR(36) NULL,
    `documentoId` CHAR(36) NULL,
    `usuarioRegistroId` CHAR(36) NULL,
    `observacion` VARCHAR(500) NULL,
    `fechaRegistro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `vigente` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `capacitacion_solicitudId_key`(`solicitudId`),
    INDEX `idxCapacitacionFuncionario`(`funcionarioId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `horaExtra` (
    `id` CHAR(36) NOT NULL,
    `funcionarioId` CHAR(36) NOT NULL,
    `fecha` DATE NOT NULL,
    `horaInicio` VARCHAR(5) NOT NULL,
    `horaFin` VARCHAR(5) NOT NULL,
    `cantidadHoras` DECIMAL(5, 2) NOT NULL,
    `motivo` VARCHAR(500) NULL,
    `usuarioRegistroId` CHAR(36) NOT NULL,
    `fechaRegistro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `vigente` BOOLEAN NOT NULL DEFAULT true,
    `motivoAnulacion` VARCHAR(255) NULL,
    `usuarioAnulacionId` CHAR(36) NULL,
    `fechaAnulacion` DATETIME(3) NULL,

    INDEX `idxHoraExtraFuncionario`(`funcionarioId`, `fecha`),
    INDEX `idxHoraExtraFecha`(`fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `incapacidad` ADD CONSTRAINT `incapacidad_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `incapacidad` ADD CONSTRAINT `incapacidad_usuarioRegistroId_fkey` FOREIGN KEY (`usuarioRegistroId`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `incapacidad` ADD CONSTRAINT `incapacidad_tipoIncapacidadId_fkey` FOREIGN KEY (`tipoIncapacidadId`) REFERENCES `tipoIncapacidad`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `incapacidad` ADD CONSTRAINT `incapacidad_documentoId_fkey` FOREIGN KEY (`documentoId`) REFERENCES `documento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `capacitacion` ADD CONSTRAINT `capacitacion_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `capacitacion` ADD CONSTRAINT `capacitacion_solicitudId_fkey` FOREIGN KEY (`solicitudId`) REFERENCES `solicitud`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `capacitacion` ADD CONSTRAINT `capacitacion_documentoId_fkey` FOREIGN KEY (`documentoId`) REFERENCES `documento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `capacitacion` ADD CONSTRAINT `capacitacion_usuarioRegistroId_fkey` FOREIGN KEY (`usuarioRegistroId`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `horaExtra` ADD CONSTRAINT `horaExtra_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `horaExtra` ADD CONSTRAINT `horaExtra_usuarioRegistroId_fkey` FOREIGN KEY (`usuarioRegistroId`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Datos iniciales (tambien estan en el seed; aqui para no depender de volver a correrlo).
INSERT INTO `tipoIncapacidad` (`id`, `nombre`, `descripcion`, `activo`)
SELECT UUID(), t.nombre, t.descripcion, true FROM (
  SELECT 'Enfermedad' AS nombre, 'Incapacidad por enfermedad común (CCSS o médico privado)' AS descripcion
  UNION ALL SELECT 'Maternidad', 'Licencia por maternidad (CCSS)'
  UNION ALL SELECT 'Riesgo del trabajo', 'Accidente o enfermedad laboral (INS)'
  UNION ALL SELECT 'Cuido de familiar', 'Licencia para cuidar a un familiar enfermo (CCSS)'
) t WHERE NOT EXISTS (SELECT 1 FROM `tipoIncapacidad` x WHERE x.nombre = t.nombre);

INSERT INTO `tipoDocumento` (`id`, `nombre`, `descripcion`, `generadoPorSistema`, `activo`, `formatosPermitidos`)
SELECT UUID(), t.nombre, t.descripcion, false, true, 'pdf,jpg,png' FROM (
  SELECT 'Justificante de solicitud' AS nombre, 'Respaldo de una licencia o permiso (se adjunta al pedirlo)' AS descripcion
  UNION ALL SELECT 'Boleta de incapacidad', 'Boleta o dictamen médico de una incapacidad'
  UNION ALL SELECT 'Certificado de capacitación', 'Certificado o constancia de un curso o capacitación'
) t WHERE NOT EXISTS (SELECT 1 FROM `tipoDocumento` x WHERE x.nombre = t.nombre);

INSERT INTO `permiso` (`id`, `clave`, `modulo`, `descripcion`, `activo`)
SELECT UUID(), 'horasExtra.registrar', 'horasExtra', 'Registrar, consultar y anular las horas extra del personal', true
WHERE NOT EXISTS (SELECT 1 FROM `permiso` WHERE `clave` = 'horasExtra.registrar');
INSERT INTO `rolPermiso` (`id`, `rolId`, `permisoId`)
SELECT UUID(), r.`id`, p.`id`
  FROM `rol` r JOIN `permiso` p ON p.`clave` = 'horasExtra.registrar'
 WHERE r.`nombre` IN ('Super Administrador', 'Administrador')
   AND NOT EXISTS (SELECT 1 FROM `rolPermiso` rp WHERE rp.`rolId` = r.`id` AND rp.`permisoId` = p.`id`);
