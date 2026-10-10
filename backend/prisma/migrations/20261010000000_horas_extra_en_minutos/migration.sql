-- 10/10/2026 (revision de Josthyn): las horas extra se guardan en MINUTOS
-- enteros. Con horas decimales, 2 h 40 min quedaba como 2,67 h y al sumar
-- varios registros los totales se corrian. Los registros que ya existan se
-- convierten (2,67 h -> 160 min).
ALTER TABLE `horaExtra` ADD COLUMN `cantidadMinutos` INTEGER NOT NULL DEFAULT 0;
UPDATE `horaExtra` SET `cantidadMinutos` = ROUND(`cantidadHoras` * 60);
ALTER TABLE `horaExtra` DROP COLUMN `cantidadHoras`;
ALTER TABLE `horaExtra` ALTER COLUMN `cantidadMinutos` DROP DEFAULT;
