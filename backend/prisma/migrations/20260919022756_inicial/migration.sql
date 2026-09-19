-- CreateTable
CREATE TABLE `usuario` (
    `id` CHAR(36) NOT NULL,
    `funcionarioId` CHAR(36) NULL,
    `correo` VARCHAR(150) NOT NULL,
    `contrasenaHash` VARCHAR(255) NOT NULL,
    `estado` ENUM('activo', 'inactivo', 'bloqueado') NOT NULL DEFAULT 'activo',
    `debeCambiarContrasena` BOOLEAN NOT NULL DEFAULT true,
    `intentosFallidos` SMALLINT NOT NULL DEFAULT 0,
    `bloqueadoHasta` DATETIME(3) NULL,
    `ultimoAcceso` DATETIME(3) NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NULL,

    UNIQUE INDEX `usuario_funcionarioId_key`(`funcionarioId`),
    UNIQUE INDEX `usuario_correo_key`(`correo`),
    INDEX `usuario_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tokenRecuperacionContrasena` (
    `id` CHAR(36) NOT NULL,
    `usuarioId` CHAR(36) NOT NULL,
    `codigoHash` VARCHAR(255) NOT NULL,
    `fechaCreacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaExpiracion` DATETIME(3) NOT NULL,
    `fechaUso` DATETIME(3) NULL,

    INDEX `idxTokenRecuperacionUsuario`(`usuarioId`, `fechaExpiracion`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rol` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(60) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `esSistema` BOOLEAN NOT NULL DEFAULT false,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `rol_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permiso` (
    `id` CHAR(36) NOT NULL,
    `clave` VARCHAR(80) NOT NULL,
    `modulo` VARCHAR(40) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `permiso_clave_key`(`clave`),
    INDEX `idxPermisoModulo`(`modulo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rolPermiso` (
    `id` CHAR(36) NOT NULL,
    `rolId` CHAR(36) NOT NULL,
    `permisoId` CHAR(36) NOT NULL,

    UNIQUE INDEX `uqRolPermiso`(`rolId`, `permisoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarioRol` (
    `id` CHAR(36) NOT NULL,
    `usuarioId` CHAR(36) NOT NULL,
    `rolId` CHAR(36) NOT NULL,
    `fechaAsignacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `asignadoPorId` CHAR(36) NULL,

    UNIQUE INDEX `uqUsuarioRol`(`usuarioId`, `rolId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarioPermiso` (
    `id` CHAR(36) NOT NULL,
    `usuarioId` CHAR(36) NOT NULL,
    `permisoId` CHAR(36) NOT NULL,
    `otorgado` BOOLEAN NOT NULL DEFAULT true,
    `fechaAsignacion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `asignadoPorId` CHAR(36) NULL,
    `observacion` VARCHAR(255) NULL,

    UNIQUE INDEX `uqUsuarioPermiso`(`usuarioId`, `permisoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `departamento` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `departamento_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `puesto` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `puesto_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profesion` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(150) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `profesion_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `regimenVacaciones` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(60) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `periodosMaximosAcumulables` SMALLINT NOT NULL DEFAULT 2,
    `diasAvisoAntesDeVencer` SMALLINT NOT NULL DEFAULT 60,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `regimenVacaciones_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `funcionario` (
    `id` CHAR(36) NOT NULL,
    `cedula` VARCHAR(20) NOT NULL,
    `nombre` VARCHAR(80) NOT NULL,
    `primerApellido` VARCHAR(80) NOT NULL,
    `segundoApellido` VARCHAR(80) NULL,
    `fechaNacimiento` DATE NULL,
    `telefonoPersonal` VARCHAR(30) NULL,
    `correoPersonal` VARCHAR(150) NOT NULL,
    `correoInstitucional` VARCHAR(150) NULL,
    `direccion` VARCHAR(255) NULL,
    `profesionId` CHAR(36) NULL,
    `fotoRuta` VARCHAR(500) NULL,
    `numeroEmpleado` VARCHAR(30) NULL,
    `puestoId` CHAR(36) NULL,
    `departamentoId` CHAR(36) NULL,
    `jefaturaId` CHAR(36) NULL,
    `tipoNombramiento` ENUM('propiedad', 'interino', 'contratacionServicios') NOT NULL DEFAULT 'propiedad',
    `regimenVacacionesId` CHAR(36) NOT NULL,
    `estado` ENUM('activo', 'inactivo') NOT NULL DEFAULT 'activo',
    `fechaIngreso` DATE NOT NULL,
    `fechaSalida` DATE NULL,
    `motivoSalida` VARCHAR(150) NULL,
    `fechaRegistro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fechaActualizacion` DATETIME(3) NULL,

    UNIQUE INDEX `funcionario_cedula_key`(`cedula`),
    UNIQUE INDEX `funcionario_correoInstitucional_key`(`correoInstitucional`),
    INDEX `idxFuncionarioCedula`(`cedula`),
    INDEX `idxFuncionarioNombre`(`primerApellido`, `nombre`),
    INDEX `idxFuncionarioCorreo`(`correoInstitucional`),
    INDEX `idxFuncionarioEstadoDepto`(`estado`, `departamentoId`),
    INDEX `idxFuncionarioJefatura`(`jefaturaId`),
    INDEX `idxFuncionarioProfesion`(`profesionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tipoDocumento` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(120) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `generadoPorSistema` BOOLEAN NOT NULL DEFAULT false,
    `activo` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `tipoDocumento_nombre_key`(`nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documento` (
    `id` CHAR(36) NOT NULL,
    `funcionarioId` CHAR(36) NOT NULL,
    `tipoDocumentoId` CHAR(36) NOT NULL,
    `titulo` VARCHAR(180) NOT NULL,
    `descripcion` VARCHAR(500) NULL,
    `nombreArchivo` VARCHAR(255) NOT NULL,
    `rutaArchivo` VARCHAR(500) NOT NULL,
    `tipoMime` VARCHAR(100) NOT NULL,
    `tamanoBytes` INTEGER NOT NULL,
    `generadoPorSistema` BOOLEAN NOT NULL DEFAULT false,
    `fechaDocumento` DATE NULL,
    `fechaRegistro` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `usuarioRegistroId` CHAR(36) NULL,
    `vigente` BOOLEAN NOT NULL DEFAULT true,
    `usuarioBajaId` CHAR(36) NULL,
    `fechaBaja` DATETIME(3) NULL,
    `motivoBaja` VARCHAR(255) NULL,

    UNIQUE INDEX `documento_rutaArchivo_key`(`rutaArchivo`),
    INDEX `idxDocumentoFuncionarioTipo`(`funcionarioId`, `tipoDocumentoId`),
    INDEX `idxDocumentoVigente`(`funcionarioId`, `vigente`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bitacoraCambio` (
    `id` CHAR(36) NOT NULL,
    `usuarioId` CHAR(36) NULL,
    `funcionarioAfectadoId` CHAR(36) NULL,
    `entidad` VARCHAR(60) NOT NULL,
    `registroAfectadoId` CHAR(36) NOT NULL,
    `accion` ENUM('crear', 'modificar', 'eliminar', 'aprobar', 'rechazar', 'cancelar', 'consultar', 'descargar', 'iniciarSesion', 'cerrarSesion') NOT NULL,
    `fechaHora` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `direccionIp` VARCHAR(45) NULL,
    `datosAnteriores` JSON NULL,
    `datosNuevos` JSON NULL,
    `descripcion` VARCHAR(1000) NULL,

    INDEX `idxBitacoraFecha`(`fechaHora`),
    INDEX `idxBitacoraUsuario`(`usuarioId`, `fechaHora`),
    INDEX `idxBitacoraRegistro`(`entidad`, `registroAfectadoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tokenRecuperacionContrasena` ADD CONSTRAINT `tokenRecuperacionContrasena_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rolPermiso` ADD CONSTRAINT `rolPermiso_rolId_fkey` FOREIGN KEY (`rolId`) REFERENCES `rol`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `rolPermiso` ADD CONSTRAINT `rolPermiso_permisoId_fkey` FOREIGN KEY (`permisoId`) REFERENCES `permiso`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarioRol` ADD CONSTRAINT `usuarioRol_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarioRol` ADD CONSTRAINT `usuarioRol_rolId_fkey` FOREIGN KEY (`rolId`) REFERENCES `rol`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarioRol` ADD CONSTRAINT `usuarioRol_asignadoPorId_fkey` FOREIGN KEY (`asignadoPorId`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarioPermiso` ADD CONSTRAINT `usuarioPermiso_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarioPermiso` ADD CONSTRAINT `usuarioPermiso_permisoId_fkey` FOREIGN KEY (`permisoId`) REFERENCES `permiso`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuarioPermiso` ADD CONSTRAINT `usuarioPermiso_asignadoPorId_fkey` FOREIGN KEY (`asignadoPorId`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funcionario` ADD CONSTRAINT `funcionario_profesionId_fkey` FOREIGN KEY (`profesionId`) REFERENCES `profesion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funcionario` ADD CONSTRAINT `funcionario_puestoId_fkey` FOREIGN KEY (`puestoId`) REFERENCES `puesto`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funcionario` ADD CONSTRAINT `funcionario_departamentoId_fkey` FOREIGN KEY (`departamentoId`) REFERENCES `departamento`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funcionario` ADD CONSTRAINT `funcionario_jefaturaId_fkey` FOREIGN KEY (`jefaturaId`) REFERENCES `funcionario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `funcionario` ADD CONSTRAINT `funcionario_regimenVacacionesId_fkey` FOREIGN KEY (`regimenVacacionesId`) REFERENCES `regimenVacaciones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documento` ADD CONSTRAINT `documento_funcionarioId_fkey` FOREIGN KEY (`funcionarioId`) REFERENCES `funcionario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documento` ADD CONSTRAINT `documento_tipoDocumentoId_fkey` FOREIGN KEY (`tipoDocumentoId`) REFERENCES `tipoDocumento`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documento` ADD CONSTRAINT `documento_usuarioRegistroId_fkey` FOREIGN KEY (`usuarioRegistroId`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documento` ADD CONSTRAINT `documento_usuarioBajaId_fkey` FOREIGN KEY (`usuarioBajaId`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bitacoraCambio` ADD CONSTRAINT `bitacoraCambio_usuarioId_fkey` FOREIGN KEY (`usuarioId`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bitacoraCambio` ADD CONSTRAINT `bitacoraCambio_funcionarioAfectadoId_fkey` FOREIGN KEY (`funcionarioAfectadoId`) REFERENCES `funcionario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
