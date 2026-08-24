"use strict";

/**
 * Tenant control-plane identity + ops columns.
 * Idempotent: safe on a shared tenant/platform database.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableNames = (await queryInterface.showAllTables()).map((t) =>
      String(t).toLowerCase(),
    );
    const hasTable = (name) => tableNames.includes(name.toLowerCase());

    const describe = async (table) => {
      try {
        return await queryInterface.describeTable(table);
      } catch {
        return {};
      }
    };

    const addColumnIfMissing = async (table, column, definition) => {
      const cols = await describe(table);
      if (!cols[column]) {
        await queryInterface.addColumn(table, column, definition);
      }
    };

    const addIndexSafe = async (table, fields, options) => {
      try {
        await queryInterface.addIndex(table, fields, options);
      } catch {
        /* already exists */
      }
    };

    // ── companyDetails identity ────────────────────────────
    await addColumnIfMissing("companyDetails", "slug", {
      type: Sequelize.STRING(80),
      allowNull: true,
    });
    await addColumnIfMissing("companyDetails", "region", {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: "ap-south-1",
    });
    await addColumnIfMissing("companyDetails", "timezone", {
      type: Sequelize.STRING(64),
      allowNull: false,
      defaultValue: "Asia/Kolkata",
    });
    await addColumnIfMissing("companyDetails", "last_active_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing("companyDetails", "tags", {
      type: Sequelize.ARRAY(Sequelize.STRING),
      allowNull: false,
      defaultValue: [],
    });
    await addColumnIfMissing("companyDetails", "internal_notes", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE "companyDetails"
      SET slug = NULLIF(
        trim(both '-' from regexp_replace(lower(coalesce("companyName", '')), '[^a-z0-9]+', '-', 'g')),
        ''
      )
      WHERE slug IS NULL OR slug = '';
    `);
    await queryInterface.sequelize.query(`
      UPDATE "companyDetails"
      SET slug = 'tenant-' || id
      WHERE slug IS NULL OR slug = '';
    `);
    await queryInterface.sequelize.query(`
      UPDATE "companyDetails" c
      SET slug = c.slug || '-' || c.id
      WHERE c.id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY slug ORDER BY id) AS rn
          FROM "companyDetails"
          WHERE slug IS NOT NULL
        ) d
        WHERE d.rn > 1
      );
    `);

    await addIndexSafe("companyDetails", ["slug"], {
      unique: true,
      name: "company_details_slug_unique",
    });
    await addIndexSafe("companyDetails", ["status"]);
    await addIndexSafe("companyDetails", ["last_active_at"]);

    await queryInterface.sequelize.query(`
      UPDATE "companyDetails" c
      SET last_active_at = u.last_login
      FROM (
        SELECT "companyId" AS company_id, MAX("lastLogin") AS last_login
        FROM users
        WHERE "companyId" IS NOT NULL
        GROUP BY "companyId"
      ) u
      WHERE c.id = u.company_id
        AND (c.last_active_at IS NULL OR c.last_active_at < u.last_login);
    `);

    // ── company_files (company-owned uploads only) ─────────
    if (!hasTable("company_files")) {
      await queryInterface.createTable("company_files", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        company_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "companyDetails", key: "id" },
          onDelete: "CASCADE",
        },
        url: { type: Sequelize.TEXT, allowNull: false },
        kind: { type: Sequelize.STRING(64), allowNull: true },
        byte_size: {
          type: Sequelize.BIGINT,
          allowNull: false,
          defaultValue: 0,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
        },
      });
      await addIndexSafe("company_files", ["company_id"]);
    }

    await queryInterface.sequelize.query(`
      INSERT INTO company_files (company_id, url, kind, byte_size, "createdAt", "updatedAt")
      SELECT c.id, c.logo, 'logo', 0, NOW(), NOW()
      FROM "companyDetails" c
      WHERE c.logo IS NOT NULL AND trim(c.logo) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM company_files f
          WHERE f.company_id = c.id AND f.url = c.logo
        );
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO company_files (company_id, url, kind, byte_size, "createdAt", "updatedAt")
      SELECT c.id, kv.value, kv.key, 0, NOW(), NOW()
      FROM "companyDetails" c
      CROSS JOIN LATERAL jsonb_each_text(COALESCE(c.documents, '{}'::jsonb)) AS kv
      WHERE kv.value ILIKE 'http%'
        AND NOT EXISTS (
          SELECT 1 FROM company_files f
          WHERE f.company_id = c.id AND f.url = kv.value
        );
    `);

    // ── audit log reason + ip ──────────────────────────────
    await addColumnIfMissing("platform_audit_logs", "reason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing("platform_audit_logs", "ip_address", {
      type: Sequelize.STRING(64),
      allowNull: true,
    });

    await queryInterface.sequelize.query(`
      UPDATE platform_audit_logs SET action = 'company.created' WHERE action = 'company.create';
      UPDATE platform_audit_logs SET action = 'company.updated' WHERE action = 'company.update';
      UPDATE platform_audit_logs SET action = 'company.activated' WHERE action = 'company.active';
      UPDATE platform_audit_logs SET action = 'password.reset' WHERE action = 'company.reset_admin_password';
      UPDATE platform_audit_logs SET action = 'subscription.changed' WHERE action = 'subscription.change_plan';
      UPDATE platform_audit_logs SET action = 'subscription.renewed' WHERE action IN ('subscription.renew');
      UPDATE platform_audit_logs SET action = 'subscription.cancelled' WHERE action = 'subscription.cancel';
      UPDATE platform_audit_logs SET action = 'subscription.resumed' WHERE action = 'subscription.resume';
      UPDATE platform_audit_logs SET action = 'entitlements.updated'
        WHERE action IN ('subscription.features.update', 'subscription.features.reset');
      UPDATE platform_audit_logs SET action = 'payment.verified' WHERE action = 'billing.verify';
    `);

    await queryInterface.sequelize.query(`
      UPDATE platform_audit_logs
      SET reason = meta->>'reason'
      WHERE reason IS NULL AND meta IS NOT NULL AND meta->>'reason' IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    const removeColumn = async (table, column) => {
      try {
        await queryInterface.removeColumn(table, column);
      } catch {
        /* ignore */
      }
    };
    try {
      await queryInterface.dropTable("company_files");
    } catch {
      /* ignore */
    }
    await removeColumn("platform_audit_logs", "ip_address");
    await removeColumn("platform_audit_logs", "reason");
    for (const col of [
      "internal_notes",
      "tags",
      "last_active_at",
      "timezone",
      "region",
      "slug",
    ]) {
      await removeColumn("companyDetails", col);
    }
  },
};
