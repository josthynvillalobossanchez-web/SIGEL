-- Endurecimiento Sprint 1, tarea C.
-- Sesiones que se pueden revocar: el token lleva el id de su fila (jti).

-- CreateTable
CREATE TABLE `sesion` (
    `id` CHAR(36) NOT NULL,
    `usuarioId` CHAR(36) NOT NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaExpiracion` DATETIME(3) NOT NULL,
    `fechaRevocacion` DATETIME(3) NULL,

    INDEX `idxSesionUsuario`(`usuarioId`, `fechaRevocacion`),
    INDEX `idxSesionExpiracion`(`fechaExpiracion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sesion` ADD CONSTRAINT `sesion_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
