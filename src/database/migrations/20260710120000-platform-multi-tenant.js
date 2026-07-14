"use strict";

/**
 * Platform multi-tenant schema — OWNED by the platform (Super Admin) service.
 *
 * This migration is IDEMPOTENT: every createTable / addColumn / addIndex is
 * guarded by an existence check. The tenant backend may have already created
 * these objects in a shared dev DB; re-running here is safe.
 *
 * NOTE: SequelizeMeta tracks by filename. Keep this filename unique across
 * repos and do NOT duplicate the same logical migration under a different name.
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

    const addIndexSafe = async (table, fields) => {
      try {
        await queryInterface.addIndex(table, fields);
      } catch {
        /* index already exists — ignore */
      }
    };

    // ── plans ──────────────────────────────────────────────
    if (!hasTable("plans")) {
      await queryInterface.createTable("plans", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        code: { type: Sequelize.STRING(64), allowNull: false, unique: true },
        name: { type: Sequelize.STRING(128), allowNull: false },
        description: { type: Sequelize.TEXT, allowNull: true },
        price_monthly: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        price_yearly: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        currency: { type: Sequelize.STRING(8), allowNull: false, defaultValue: "INR" },
        max_branches: { type: Sequelize.INTEGER, allowNull: true },
        max_users: { type: Sequelize.INTEGER, allowNull: true },
        max_storage_bytes: { type: Sequelize.BIGINT, allowNull: true },
        features: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      });
    }

    // ── companyDetails lifecycle columns ───────────────────
    await addColumnIfMissing("companyDetails", "status", {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: "active",
    });
    await addColumnIfMissing("companyDetails", "deleted_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing("companyDetails", "legal_name", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await addColumnIfMissing("companyDetails", "email", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await addColumnIfMissing("companyDetails", "phone", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await addColumnIfMissing("companyDetails", "country", {
      type: Sequelize.STRING(8),
      allowNull: true,
      defaultValue: "IN",
    });
    await addColumnIfMissing("companyDetails", "storage_used_bytes", {
      type: Sequelize.BIGINT,
      allowNull: false,
      defaultValue: 0,
    });
    await addColumnIfMissing("companyDetails", "suspend_reason", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    // ── subscriptions ──────────────────────────────────────
    if (!hasTable("subscriptions")) {
      await queryInterface.createTable("subscriptions", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        company_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "companyDetails", key: "id" },
          onDelete: "CASCADE",
        },
        plan_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "plans", key: "id" },
          onDelete: "RESTRICT",
        },
        status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: "incomplete" },
        billing_interval: { type: Sequelize.STRING(16), allowNull: false, defaultValue: "monthly" },
        current_period_start: { type: Sequelize.DATE, allowNull: true },
        current_period_end: { type: Sequelize.DATE, allowNull: true },
        cancel_at_period_end: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        auto_renew: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        currency: { type: Sequelize.STRING(8), allowNull: false, defaultValue: "INR" },
        payment_provider: { type: Sequelize.STRING(32), allowNull: true },
        provider_customer_id: { type: Sequelize.STRING, allowNull: true },
        provider_subscription_id: { type: Sequelize.STRING, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      });
      await addIndexSafe("subscriptions", ["company_id"]);
      await addIndexSafe("subscriptions", ["status"]);
      await addIndexSafe("subscriptions", ["current_period_end"]);
    }

    // ── platform_payments ──────────────────────────────────
    if (!hasTable("platform_payments")) {
      await queryInterface.createTable("platform_payments", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        company_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "companyDetails", key: "id" },
          onDelete: "CASCADE",
        },
        subscription_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "subscriptions", key: "id" },
          onDelete: "SET NULL",
        },
        provider: { type: Sequelize.STRING(32), allowNull: false },
        provider_payment_id: { type: Sequelize.STRING, allowNull: true },
        provider_order_id: { type: Sequelize.STRING, allowNull: true },
        amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
        currency: { type: Sequelize.STRING(8), allowNull: false, defaultValue: "INR" },
        status: { type: Sequelize.STRING(32), allowNull: false, defaultValue: "pending" },
        purpose: { type: Sequelize.STRING(32), allowNull: true },
        raw_payload: { type: Sequelize.JSONB, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      });
      await addIndexSafe("platform_payments", ["company_id"]);
      await addIndexSafe("platform_payments", ["provider_payment_id"]);
    }

    // ── platform_audit_logs ────────────────────────────────
    if (!hasTable("platform_audit_logs")) {
      await queryInterface.createTable("platform_audit_logs", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        actor_user_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "users", key: "id" },
          onDelete: "SET NULL",
        },
        action: { type: Sequelize.STRING(128), allowNull: false },
        company_id: {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: { model: "companyDetails", key: "id" },
          onDelete: "SET NULL",
        },
        meta: { type: Sequelize.JSONB, allowNull: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn("NOW") },
      });
      await addIndexSafe("platform_audit_logs", ["company_id"]);
      await addIndexSafe("platform_audit_logs", ["actor_user_id"]);
    }
  },

  async down(queryInterface) {
    const drop = async (table) => {
      try {
        await queryInterface.dropTable(table);
      } catch {
        /* ignore */
      }
    };
    const removeColumn = async (table, column) => {
      try {
        await queryInterface.removeColumn(table, column);
      } catch {
        /* ignore */
      }
    };

    await drop("platform_audit_logs");
    await drop("platform_payments");
    await drop("subscriptions");
    for (const col of [
      "suspend_reason",
      "storage_used_bytes",
      "country",
      "phone",
      "email",
      "legal_name",
      "deleted_at",
      "status",
    ]) {
      await removeColumn("companyDetails", col);
    }
    await drop("plans");
  },
};
