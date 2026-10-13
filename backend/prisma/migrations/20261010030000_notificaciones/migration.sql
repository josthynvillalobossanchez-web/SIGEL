-- 10/10/2026 (Sprint 3, HU 42-44): avisos dentro de SINERGIA.
-- Solo dentro del sistema: por correo va unicamente la cuenta nueva.

CREATE TABLE `notificacion` (
    `id` CHAR(36) NOT NULL,
    `usuarioDestinoId` CHAR(36) NOT NULL,
    `clave` VARCHAR(80) NOT NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `mensaje` VARCHAR(1000) NOT NULL,
    `entidad` VARCHAR(60) NULL,
    `registroId` CHAR(36) NULL,
    `referencia` VARCHAR(60) NULL,
    `enlace` VARCHAR(300) NULL,
    `leida` BOOLEAN NOT NULL DEFAULT false,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `idxNotificacionBandeja`(`usuarioDestinoId`, `leida`, `fechaCreacion`),
    INDEX `idxNotificacionEvento`(`clave`, `registroId`, `referencia`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `notificacion` ADD CONSTRAINT `notificacion_usuarioDestinoId_fkey` FOREIGN KEY (`usuarioDestinoId`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Permisos: ver las propias (todos los roles) y recibir los avisos de Recursos Humanos.
INSERT INTO `permiso` (`id`, `clave`, `modulo`, `descripcion`, `activo`)
SELECT UUID(), 'notificaciones.ver', 'notificaciones', 'Ver y marcar como leídas sus propias notificaciones', true
WHERE NOT EXISTS (SELECT 1 FROM `permiso` WHERE `clave` = 'notificaciones.ver');
INSERT INTO `permiso` (`id`, `clave`, `modulo`, `descripcion`, `activo`)
SELECT UUID(), 'notificaciones.rrhh', 'notificaciones', 'Recibir los avisos dirigidos a Recursos Humanos (solicitudes, incapacidades, cambios en expedientes)', true
WHERE NOT EXISTS (SELECT 1 FROM `permiso` WHERE `clave` = 'notificaciones.rrhh');

INSERT INTO `rolPermiso` (`id`, `rolId`, `permisoId`)
SELECT UUID(), r.`id`, p.`id`
  FROM `rol` r JOIN `permiso` p ON p.`clave` = 'notificaciones.ver'
 WHERE r.`nombre` IN ('Super Administrador', 'Administrador', 'Aprobador', 'Solicitante', 'Consulta')
   AND NOT EXISTS (SELECT 1 FROM `rolPermiso` rp WHERE rp.`rolId` = r.`id` AND rp.`permisoId` = p.`id`);
INSERT INTO `rolPermiso` (`id`, `rolId`, `permisoId`)
SELECT UUID(), r.`id`, p.`id`
  FROM `rol` r JOIN `permiso` p ON p.`clave` = 'notificaciones.rrhh'
 WHERE r.`nombre` IN ('Super Administrador', 'Administrador')
   AND NOT EXISTS (SELECT 1 FROM `rolPermiso` rp WHERE rp.`rolId` = r.`id` AND rp.`permisoId` = p.`id`);
