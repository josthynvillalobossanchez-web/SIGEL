-- 17/10/2026: el candidato puede escribir habilidades que no estan en el
-- catalogo ("Otra"). Quedan solo en su perfil: no pasan al catalogo.
CREATE TABLE `habilidadPropiaCandidato` (
    `id` CHAR(36) NOT NULL,
    `candidatoId` CHAR(36) NOT NULL,
    `nombre` VARCHAR(80) NOT NULL,
    `categoria` ENUM('tecnica', 'blanda', 'idioma', 'herramienta') NOT NULL,
    `nivel` ENUM('basico', 'intermedio', 'avanzado') NULL,

    INDEX `idxHabilidadPropiaCandidato`(`candidatoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `habilidadPropiaCandidato` ADD CONSTRAINT `habilidadPropiaCandidato_candidatoId_fkey` FOREIGN KEY (`candidatoId`) REFERENCES `candidato`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
