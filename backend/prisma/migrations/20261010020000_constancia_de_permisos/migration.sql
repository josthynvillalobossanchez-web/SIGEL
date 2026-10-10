-- 10/10/2026 (HU 33 CA06): al terminar un permiso (aprobado) o una licencia
-- (registrada), SINERGIA genera su constancia en PDF y la deja en el
-- expediente, igual que la de vacaciones.
INSERT INTO `tipoDocumento` (`id`, `nombre`, `descripcion`, `generadoPorSistema`, `activo`, `formatosPermitidos`)
SELECT UUID(), 'Constancia de permiso o licencia', 'La genera SINERGIA al aprobarse un permiso o al registrarse una licencia', true, true, 'pdf'
WHERE NOT EXISTS (SELECT 1 FROM `tipoDocumento` WHERE `nombre` = 'Constancia de permiso o licencia');

UPDATE `tipoSolicitud`
SET `tipoDocumentoGeneradoId` = (SELECT `id` FROM `tipoDocumento` WHERE `nombre` = 'Constancia de permiso o licencia')
WHERE `clave` IN ('permisoConGoce', 'permisoSinGoce', 'licencia') AND `tipoDocumentoGeneradoId` IS NULL;
