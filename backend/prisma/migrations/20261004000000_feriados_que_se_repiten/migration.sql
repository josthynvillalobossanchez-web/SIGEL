-- Feriados que se administran solos (decision de Josthyn, 01/10/2026).
-- Antes cada anio habia que volver a agregar los feriados. Ahora cada feriado
-- tiene una REGLA:
--   fija          cada anio el mismo dia y mes (columnas mes y dia)
--   unica         solo esa fecha (columna fecha): asuetos o traslados de un anio
--   juevesSanto   se calcula cada anio con la Pascua
--   viernesSanto  se calcula cada anio con la Pascua
--
-- Ademas: el permiso funcionarios.verTodos (ver a todo el personal) se agrega
-- aqui a los roles de sistema que lo llevan, para que no dependa de volver a
-- correr el seed.

-- AlterTable
ALTER TABLE `diaNoLaborable` ADD COLUMN `regla` VARCHAR(20) NOT NULL DEFAULT 'fija',
    ADD COLUMN `mes` TINYINT NULL,
    ADD COLUMN `dia` TINYINT NULL,
    MODIFY `fecha` DATE NULL;

-- Datos: los recurrentes pasan a "fija" (uno solo por dia y mes); los demas a "unica".
UPDATE `diaNoLaborable` SET `regla` = IF(`recurrenteAnual`, 'fija', 'unica');
DELETE d1 FROM `diaNoLaborable` d1
  JOIN `diaNoLaborable` d2
    ON d1.`regla` = 'fija' AND d2.`regla` = 'fija'
   AND MONTH(d1.`fecha`) = MONTH(d2.`fecha`) AND DAY(d1.`fecha`) = DAY(d2.`fecha`)
   AND (d1.`activo` < d2.`activo`
        OR (d1.`activo` = d2.`activo` AND d1.`fecha` > d2.`fecha`)
        OR (d1.`activo` = d2.`activo` AND d1.`fecha` = d2.`fecha` AND d1.`id` > d2.`id`));
UPDATE `diaNoLaborable` SET `mes` = MONTH(`fecha`), `dia` = DAY(`fecha`), `fecha` = NULL WHERE `regla` = 'fija';

-- AlterTable
ALTER TABLE `diaNoLaborable` DROP COLUMN `recurrenteAnual`;

-- CreateIndex
CREATE UNIQUE INDEX `uqDiaNoLaborableMesDia` ON `diaNoLaborable`(`mes`, `dia`);

-- Permiso funcionarios.verTodos para Super Administrador, Administrador y Consulta.
INSERT INTO `permiso` (`id`, `clave`, `modulo`, `descripcion`, `activo`)
SELECT UUID(), 'funcionarios.verTodos', 'funcionarios', 'Consultar a todo el personal, no solo al que tiene a cargo', true
WHERE NOT EXISTS (SELECT 1 FROM `permiso` WHERE `clave` = 'funcionarios.verTodos');
INSERT INTO `rolPermiso` (`id`, `rolId`, `permisoId`)
SELECT UUID(), r.`id`, p.`id`
  FROM `rol` r JOIN `permiso` p ON p.`clave` = 'funcionarios.verTodos'
 WHERE r.`nombre` IN ('Super Administrador', 'Administrador', 'Consulta')
   AND NOT EXISTS (SELECT 1 FROM `rolPermiso` rp WHERE rp.`rolId` = r.`id` AND rp.`permisoId` = p.`id`);
