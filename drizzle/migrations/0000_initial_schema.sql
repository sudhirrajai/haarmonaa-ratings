-- ============================================================
-- Navratri Jewel Buzz — MySQL Schema Migration
-- Run this against your MySQL database to create all tables.
-- Then run: npm run db:seed  (to create default admin + categories)
-- ============================================================


-- ─── categories ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `categories` (
  `id`         VARCHAR(36)  NOT NULL,
  `name`       VARCHAR(80)  NOT NULL,
  `sort_order` INT          NOT NULL DEFAULT 0,
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── reviews ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `reviews` (
  `id`         VARCHAR(36)                                 NOT NULL,
  `name`       VARCHAR(100)                                NOT NULL,
  `email`      VARCHAR(255)                                NOT NULL,
  `phone`      VARCHAR(20)                                 DEFAULT NULL,
  `product`    VARCHAR(80)                                 NOT NULL,
  `rating`     INT                                         NOT NULL,
  `comment`    TEXT                                        NOT NULL,
  `image_url`  VARCHAR(500)                                DEFAULT NULL,
  `status`     ENUM('pending','approved','rejected')       NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP                                   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP                                   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `reviews_status_idx` (`status`),
  INDEX `reviews_created_at_idx` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─── admins ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `admins` (
  `id`            VARCHAR(36)  NOT NULL,
  `email`         VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `admins_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
