-- Epica 3, gestion documental.
-- Cada tipo de documento dice que formatos acepta (pdf, jpg, png) y cada
-- documento guarda el SHA-256 de su contenido original (el archivo va cifrado).

-- AlterTable
ALTER TABLE `tipoDocumento` ADD COLUMN `formatosPermitidos` VARCHAR(20) NOT NULL DEFAULT 'pdf,jpg,png';

-- AlterTable
ALTER TABLE `documento` ADD COLUMN `hashContenido` CHAR(64) NULL;
