-- Tope de vacaciones configurable (pedido de Joseph, 13/10/2026).
-- Por omision el saldo puede pasar el tope de periodos: se avisa a la persona,
-- a su jefatura y a RRHH, pero no se pierde nada. RRHH puede cambiar a
-- "vencer" (lo que pase del tope se pierde) en Reglas de vacaciones.
ALTER TABLE `regimenVacaciones`
    ADD COLUMN `alSuperarElTope` ENUM('avisar', 'vencer') NOT NULL DEFAULT 'avisar',
    MODIFY `diasAvisoAntesDeVencer` SMALLINT NOT NULL DEFAULT 30;

-- El aviso pasa de 60 a 30 dias (un mes antes), salvo que RRHH ya lo hubiera cambiado.
UPDATE `regimenVacaciones` SET `diasAvisoAntesDeVencer` = 30 WHERE `diasAvisoAntesDeVencer` = 60;
