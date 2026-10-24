-- ARCA (cobro de las piscinas municipales), integrado el 23/10/2026.
-- Viene de las migraciones 0001_init y 0002_app_settings del proyecto ARCA, con estos cambios:
--   * sin las tablas app_user y refresh_token: los usuarios, el inicio de sesion y los roles son los del
--     sistema (tabla usuario y permisos cobro.*);
--   * cashier_id, requested_by y authorized_by pasan a CHAR(36) y apuntan a usuario(id);
--   * misma intercalacion que el resto de la base (utf8mb4_unicode_ci).
-- Agrega lo que Prisma no modela (columna generada open_key y restricciones CHECK): aplicar SIEMPRE con
-- "prisma migrate deploy", nunca con "migrate dev".

-- CreateTable
CREATE TABLE `pool` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `pool_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashbox` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `pool_id` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `cashbox_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cashbox_session` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cashbox_id` INTEGER NOT NULL,
    `cashier_id` CHAR(36) NOT NULL,
    `shift` ENUM('MANANA', 'TARDE', 'NOCHE') NOT NULL,
    `opened_at` DATETIME(6) NOT NULL,
    `opening_float` DECIMAL(14, 2) NOT NULL,
    `closed_at` DATETIME(6) NULL,
    `counted_cash` DECIMAL(14, 2) NULL,
    `expected_cash` DECIMAL(14, 2) NULL,
    `difference` DECIMAL(14, 2) NULL,
    `justification` VARCHAR(500) NULL,
    `closing_number` VARCHAR(40) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `cashbox_session_closing_number_key`(`closing_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cash_count` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `session_id` INTEGER NOT NULL,
    `denomination` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `id_type` ENUM('FISICA', 'JURIDICA', 'DIMEX') NOT NULL,
    `id_number` VARCHAR(9) NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `phone` VARCHAR(30) NULL,
    `email` VARCHAR(150) NULL,
    `address` VARCHAR(250) NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    INDEX `ix_client_id_number`(`id_number`),
    INDEX `ix_client_full_name`(`full_name`),
    UNIQUE INDEX `uq_client_identity`(`id_type`, `id_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `concept` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `type` ENUM('ENTRADA', 'SUSCRIPCION', 'SERVICIO') NOT NULL,
    `periodicity` ENUM('POR_USO', 'MENSUAL') NOT NULL,
    `price` DECIMAL(14, 2) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `concept_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `concept_price_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `concept_id` INTEGER NOT NULL,
    `price` DECIMAL(14, 2) NOT NULL,
    `valid_from` DATETIME(6) NOT NULL,
    `changed_by` VARCHAR(60) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipt` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` VARCHAR(40) NOT NULL,
    `session_id` INTEGER NOT NULL,
    `cashbox_id` INTEGER NOT NULL,
    `cashier_id` CHAR(36) NOT NULL,
    `client_id` INTEGER NULL,
    `pool_id` INTEGER NOT NULL,
    `shift` ENUM('MANANA', 'TARDE', 'NOCHE') NOT NULL,
    `issued_at` DATETIME(6) NOT NULL,
    `status` ENUM('PAGADO', 'ANULADO') NOT NULL DEFAULT 'PAGADO',
    `subtotal` DECIMAL(14, 2) NOT NULL,
    `discounts` DECIMAL(14, 2) NOT NULL,
    `surcharges` DECIMAL(14, 2) NOT NULL,
    `total` DECIMAL(14, 2) NOT NULL,
    `cash_due` DECIMAL(14, 2) NOT NULL,
    `cash_received` DECIMAL(14, 2) NOT NULL,
    `change_amount` DECIMAL(14, 2) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `updated_at` DATETIME(6) NOT NULL,

    UNIQUE INDEX `receipt_number_key`(`number`),
    INDEX `ix_receipt_issued_at`(`issued_at`),
    INDEX `ix_receipt_cashier_issued`(`cashier_id`, `issued_at`),
    INDEX `ix_receipt_client`(`client_id`),
    INDEX `ix_receipt_status`(`status`),
    INDEX `ix_receipt_session`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipt_line` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receipt_id` INTEGER NOT NULL,
    `concept_id` INTEGER NOT NULL,
    `concept_name` VARCHAR(150) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `unit_amount` DECIMAL(14, 2) NOT NULL,
    `discount` DECIMAL(14, 2) NOT NULL,
    `surcharge` DECIMAL(14, 2) NOT NULL,
    `line_total` DECIMAL(14, 2) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipt_payment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receipt_id` INTEGER NOT NULL,
    `method` ENUM('EFECTIVO', 'TARJETA', 'SINPE_MOVIL', 'TRANSFERENCIA') NOT NULL,
    `amount` DECIMAL(14, 2) NOT NULL,
    `reference` VARCHAR(60) NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipt_void` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `receipt_id` INTEGER NOT NULL,
    `reason` ENUM('ERROR_MONTO', 'CLIENTE_EQUIVOCADO', 'CONCEPTO_EQUIVOCADO', 'PAGO_DUPLICADO', 'OTRO') NOT NULL,
    `detail` VARCHAR(500) NOT NULL,
    `requested_by` CHAR(36) NOT NULL,
    `authorized_by` CHAR(36) NOT NULL,
    `voided_at` DATETIME(6) NOT NULL,
    `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    UNIQUE INDEX `receipt_void_receipt_id_key`(`receipt_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipt_sequence` (
    `cashbox_id` INTEGER NOT NULL,
    `seq_value` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`cashbox_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `at` DATETIME(6) NOT NULL,
    `username` VARCHAR(60) NULL,
    `action` VARCHAR(40) NOT NULL,
    `entity` VARCHAR(40) NULL,
    `entity_id` VARCHAR(40) NULL,
    `detail` VARCHAR(1000) NULL,
    `ip` VARCHAR(60) NULL,

    INDEX `ix_audit_at`(`at`),
    INDEX `ix_audit_user`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cashbox` ADD CONSTRAINT `cashbox_pool_id_fkey` FOREIGN KEY (`pool_id`) REFERENCES `pool`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cashbox_session` ADD CONSTRAINT `cashbox_session_cashbox_id_fkey` FOREIGN KEY (`cashbox_id`) REFERENCES `cashbox`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `cashbox_session` ADD CONSTRAINT `cashbox_session_cashier_id_fkey` FOREIGN KEY (`cashier_id`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cash_count` ADD CONSTRAINT `cash_count_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `cashbox_session`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `concept_price_history` ADD CONSTRAINT `concept_price_history_concept_id_fkey` FOREIGN KEY (`concept_id`) REFERENCES `concept`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `cashbox_session`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_cashbox_id_fkey` FOREIGN KEY (`cashbox_id`) REFERENCES `cashbox`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_cashier_id_fkey` FOREIGN KEY (`cashier_id`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_pool_id_fkey` FOREIGN KEY (`pool_id`) REFERENCES `pool`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_line` ADD CONSTRAINT `receipt_line_receipt_id_fkey` FOREIGN KEY (`receipt_id`) REFERENCES `receipt`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_line` ADD CONSTRAINT `receipt_line_concept_id_fkey` FOREIGN KEY (`concept_id`) REFERENCES `concept`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_payment` ADD CONSTRAINT `receipt_payment_receipt_id_fkey` FOREIGN KEY (`receipt_id`) REFERENCES `receipt`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_void` ADD CONSTRAINT `receipt_void_receipt_id_fkey` FOREIGN KEY (`receipt_id`) REFERENCES `receipt`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_void` ADD CONSTRAINT `receipt_void_requested_by_fkey` FOREIGN KEY (`requested_by`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_void` ADD CONSTRAINT `receipt_void_authorized_by_fkey` FOREIGN KEY (`authorized_by`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt_sequence` ADD CONSTRAINT `receipt_sequence_cashbox_id_fkey` FOREIGN KEY (`cashbox_id`) REFERENCES `cashbox`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;


-- Una sola sesión de caja abierta por caja: columna generada + UNIQUE (los NULL no colisionan).
ALTER TABLE `cashbox_session`
  ADD COLUMN `open_key` INTEGER GENERATED ALWAYS AS (IF(`closed_at` IS NULL, `cashbox_id`, NULL)) STORED,
  ADD UNIQUE INDEX `uq_session_open_key`(`open_key`);

-- Restricciones CHECK (MySQL >= 8.0.16)
ALTER TABLE `cashbox_session` ADD CONSTRAINT `ck_session_float` CHECK (`opening_float` >= 0);
ALTER TABLE `cash_count` ADD CONSTRAINT `ck_cash_count_qty` CHECK (`quantity` >= 0);
ALTER TABLE `client` ADD CONSTRAINT `ck_client_id_number` CHECK (`id_number` REGEXP '^[0-9]{9}$');
ALTER TABLE `concept` ADD CONSTRAINT `ck_concept_price` CHECK (`price` >= 0);
ALTER TABLE `receipt` ADD CONSTRAINT `ck_receipt_amounts` CHECK (`subtotal` >= 0 AND `discounts` >= 0 AND `surcharges` >= 0 AND `total` > 0 AND `cash_due` >= 0 AND `cash_received` >= 0 AND `change_amount` >= 0);
ALTER TABLE `receipt_line` ADD CONSTRAINT `ck_line_amounts` CHECK (`quantity` > 0 AND `unit_amount` >= 0 AND `discount` >= 0 AND `surcharge` >= 0 AND `line_total` >= 0);
ALTER TABLE `receipt_payment` ADD CONSTRAINT `ck_payment_amount` CHECK (`amount` > 0);

-- audit_log es append-only: el usuario de la aplicación solo debe tener SELECT e INSERT sobre esta tabla. La aplicacion solo inserta y consulta.

CREATE TABLE `app_setting` (
    `key` VARCHAR(60) NOT NULL,
    `value` VARCHAR(500) NOT NULL,
    `updated_at` DATETIME(6) NOT NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
