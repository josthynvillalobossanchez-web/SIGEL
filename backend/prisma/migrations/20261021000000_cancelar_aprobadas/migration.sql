-- Cancelar vacaciones ya aprobadas (21/10/2026): la persona o su jefatura, antes de que empiecen,
-- con motivo obligatorio. El motivo queda en la solicitud.
ALTER TABLE `solicitud` ADD COLUMN `motivoCancelacion` VARCHAR(500) NULL;
