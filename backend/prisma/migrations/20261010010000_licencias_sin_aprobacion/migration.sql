-- 10/10/2026 (decision de Josthyn): hay tramites que son un DERECHO y nadie
-- los aprueba ni los rechaza (la licencia: matrimonio, nacimiento,
-- fallecimiento...). Quedan aprobados al registrarlos y no se cancelan; el
-- comprobante obligatorio es el control. Si alguien abusa, se maneja fuera
-- del sistema con ese comprobante.
ALTER TABLE `tipoSolicitud` ADD COLUMN `requiereAprobacion` BOOLEAN NOT NULL DEFAULT true;
UPDATE `tipoSolicitud` SET `requiereAprobacion` = false WHERE `clave` = 'licencia';
