-- Sprint 2, vacaciones: solicitudes, tipos de solicitud, feriados, tramos
-- del regimen y movimientos del saldo de vacaciones.

-- CreateTable
CREATE TABLE `tipoSolicitud` (
    `id` CHAR(36) NOT NULL,
    `clave` VARCHAR(40) NOT NULL,
    `nombre` VARCHAR(60) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `afectaDisponibilidad` BOOLEAN NOT NULL DEFAULT true,
    `descuentaVacaciones` BOOLEAN NOT NULL DEFAULT false,
    `requiereJustificante` BOOLEAN NOT NULL DEFAULT false,
    `seMideEnHoras` BOOLEAN NOT NULL DEFAULT false,
    `tipoDocumentoGeneradoId` CHAR(36) NULL,
    `colorCalendario` VARCHAR(9) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `tipoSolicitud_clave_key`(`clave`),
    UNIQUE INDEX `tipoSolicitud_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `solicitud` (
    `id` CHAR(36) NOT NULL,
    `consecutivo` VARCHAR(30) NOT NULL,
    `tipoSolicitudId` CHAR(36) NOT NULL,
    `funcionarioId` CHAR(36) NOT NULL,
    `usuarioSolicitanteId` CHAR(36) NOT NULL,
    `aprobadorId` CHAR(36) NULL,
    `estado` ENUM('borrador', 'pendiente', 'aprobada', 'rechazada', 'cancelada') NOT NULL DEFAULT 'pendiente',
    `leidaPorAprobador` BOOLEAN NOT NULL DEFAULT false,
    `fechaSolicitud` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaInicio` DATE NOT NULL,
    `fechaFin` DATE NOT NULL,
    `horaInicio` TIME(0) NULL,
    `horaFin` TIME(0) NULL,
    `cantidadDias` DECIMAL(5, 2) NULL,
    `cantidadHoras` DECIMAL(6, 2) NULL,
    `motivo` VARCHAR(500) NULL,
    `fechaResolucion` DATETIME(3) NULL,
    `usuarioResolucionId` CHAR(36) NULL,
    `motivoRechazo` VARCHAR(500) NULL,
    `justificanteDocumentoId` CHAR(36) NULL,
    `documentoGeneradoId` CHAR(36) NULL,
    `estadoDocumentoGenerado` ENUM('noAplica', 'pendiente', 'generado', 'fallido') NOT NULL DEFAULT 'noAplica',

    UNIQUE INDEX `solicitud_consecutivo_key`(`consecutivo`),
    INDEX `idxSolicitudFuncionario`(`funcionarioId`, `fechaInicio`),
    INDEX `idxSolicitudBandeja`(`aprobadorId`, `estado`),
    INDEX `idxSolicitudCalendario`(`fechaInicio`, `fechaFin`),
    INDEX `idxSolicitudDocumentoPendiente`(`estadoDocumentoGenerado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `diaNoLaborable` (
    `id` CHAR(36) NOT NULL,
    `fecha` DATE NOT NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `recurrenteAnual` BOOLEAN NOT NULL DEFAULT true,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `diaNoLaborable_fecha_key`(`fecha`),
    INDEX `idxDiaNoLaborableFecha`(`fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reglaVacaciones` (
    `id` CHAR(36) NOT NULL,
    `regimenVacacionesId` CHAR(36) NOT NULL,
    `aniosMinimos` SMALLINT NOT NULL,
    `aniosMaximos` SMALLINT NULL,
    `diasPorPeriodo` DECIMAL(5, 2) NOT NULL,
    `vigenteDesde` DATE NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `uqReglaVacaciones`(`regimenVacacionesId`, `aniosMinimos`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimientoVacaciones` (
    `id` CHAR(36) NOT NULL,
    `funcionarioId` CHAR(36) NOT NULL,
    `tipo` ENUM('saldoInicial', 'acumulacion', 'consumo', 'ajuste', 'vencimiento') NOT NULL,
    `cantidadDias` DECIMAL(6, 2) NOT NULL,
    `fechaMovimiento` DATE NOT NULL,
    `periodo` VARCHAR(20) NULL,
    `fechaVencimiento` DATE NULL,
    `solicitudId` CHAR(36) NULL,
    `usuarioRegistroId` CHAR(36) NULL,
    `observacion` VARCHAR(500) NULL,
    `fechaRegistro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idxMovimientoFuncionario`(`funcionarioId`, `fechaMovimiento`),
    INDEX `idxMovimientoVencimiento`(`funcionarioId`, `fechaVencimiento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tipoSolicitud` ADD CONSTRAINT `tipoSolicitud_tipoDocumentoGeneradoId_fkey` FOREIGN KEY (`tipoDocumentoGeneradoId`) REFERENCES `tipoDocumento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitud` ADD CONSTRAINT `solicitud_tipoSolicitudId_fkey` FOREIGN KEY (`tipoSolicitudId`) REFERENCES `tipoSolicitud`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitud` ADD CONSTRAINT `solicitud_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitud` ADD CONSTRAINT `solicitud_usuarioSolicitanteId_fkey` FOREIGN KEY (`usuarioSolicitanteId`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitud` ADD CONSTRAINT `solicitud_aprobadorId_fkey` FOREIGN KEY (`aprobadorId`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitud` ADD CONSTRAINT `solicitud_usuarioResolucionId_fkey` FOREIGN KEY (`usuarioResolucionId`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitud` ADD CONSTRAINT `solicitud_justificanteDocumentoId_fkey` FOREIGN KEY (`justificanteDocumentoId`) REFERENCES `documento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `solicitud` ADD CONSTRAINT `solicitud_documentoGeneradoId_fkey` FOREIGN KEY (`documentoGeneradoId`) REFERENCES `documento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reglaVacaciones` ADD CONSTRAINT `reglaVacaciones_regimenVacacionesId_fkey` FOREIGN KEY (`regimenVacacionesId`) REFERENCES `regimenVacaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientoVacaciones` ADD CONSTRAINT `movimientoVacaciones_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientoVacaciones` ADD CONSTRAINT `movimientoVacaciones_solicitudId_fkey` FOREIGN KEY (`solicitudId`) REFERENCES `solicitud`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimientoVacaciones` ADD CONSTRAINT `movimientoVacaciones_usuarioRegistroId_fkey` FOREIGN KEY (`usuarioRegistroId`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
