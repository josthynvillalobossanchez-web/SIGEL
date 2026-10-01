-- Endurecimiento Sprint 1, tarea B.
-- Cuenta los codigos equivocados contra cada codigo de recuperacion.

-- AlterTable
ALTER TABLE `tokenRecuperacionContrasena` ADD COLUMN `intentosFallidos` SMALLINT NOT NULL DEFAULT 0;
