"use strict";

/**
 * Sales control plane: leads, commercial quotes, plan kinds, trial fields.
 * Idempotent on a shared tenant/platform DB.
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

    await addColumnIfMissing("plans", "kind", {
      type: Sequelize.STRING(16),
      allowNull: false,
      defaultValue: "catalog",
    });
    await addColumnIfMissing("plans", "negotiable", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
    await addColumnIfMissing("plans", "trial_days", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await addColumnIfMissing("plans", "company_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await addIndexSafe("plans", ["kind"]);
    await addIndexSafe("plans", ["company_id"]);

    await addColumnIfMissing("subscriptions", "trial_ends_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addColumnIfMissing("subscriptions", "trial_days", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await addColumnIfMissing("subscriptions", "quote_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    if (!hasTable("leads")) {
      await queryInterface.createTable("leads", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        company_name: { type: Sequelize.STRING(255), allowNull: false },
        contact_name: { type: Sequelize.STRING(255), allowNull: false },
        email: { type: Sequelize.STRING(255), allowNull: false },
        phone: { type: Sequelize.STRING(64), allowNull: true },
        city: { type: Sequelize.STRING(128), allowNull: true },
        state: { type: Sequelize.STRING(128), allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        requested_features: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        requested_users: { type: Sequelize.INTEGER, allowNull: true },
        requested_branches: { type: Sequelize.INTEGER, allowNull: true },
        source: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: "manual",
        },
        status: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: "new",
        },
        assigned_to_id: { type: Sequelize.INTEGER, allowNull: true },
        assigned_to_name: { type: Sequelize.STRING(255), allowNull: true },
        company_id: { type: Sequelize.INTEGER, allowNull: true },
        trial_ends_at: { type: Sequelize.DATE, allowNull: true },
        last_contacted_at: { type: Sequelize.DATE, allowNull: true },
        next_follow_up_at: { type: Sequelize.DATE, allowNull: true },
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
      await addIndexSafe("leads", ["status"]);
      await addIndexSafe("leads", ["email"]);
      await addIndexSafe("leads", ["assigned_to_id"]);
      await addIndexSafe("leads", ["company_id"]);
    }

    if (!hasTable("lead_calls")) {
      await queryInterface.createTable("lead_calls", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        lead_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "leads", key: "id" },
          onDelete: "CASCADE",
        },
        company_id: { type: Sequelize.INTEGER, allowNull: true },
        outcome: { type: Sequelize.STRING(32), allowNull: false },
        notes: { type: Sequelize.TEXT, allowNull: true },
        next_follow_up_at: { type: Sequelize.DATE, allowNull: true },
        created_by_id: { type: Sequelize.INTEGER, allowNull: true },
        created_by_name: { type: Sequelize.STRING(255), allowNull: true },
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
      await addIndexSafe("lead_calls", ["lead_id"]);
    }

    if (!hasTable("platform_quotes")) {
      await queryInterface.createTable("platform_quotes", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        lead_id: { type: Sequelize.INTEGER, allowNull: true },
        company_id: { type: Sequelize.INTEGER, allowNull: true },
        name: { type: Sequelize.STRING(255), allowNull: false },
        status: {
          type: Sequelize.STRING(32),
          allowNull: false,
          defaultValue: "draft",
        },
        billing_interval: {
          type: Sequelize.STRING(16),
          allowNull: false,
          defaultValue: "monthly",
        },
        amount: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
        },
        currency: {
          type: Sequelize.STRING(8),
          allowNull: false,
          defaultValue: "INR",
        },
        features: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
        max_users: { type: Sequelize.INTEGER, allowNull: true },
        max_branches: { type: Sequelize.INTEGER, allowNull: true },
        max_storage_bytes: { type: Sequelize.BIGINT, allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        valid_until: { type: Sequelize.DATE, allowNull: true },
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
      await addIndexSafe("platform_quotes", ["status"]);
      await addIndexSafe("platform_quotes", ["lead_id"]);
      await addIndexSafe("platform_quotes", ["company_id"]);
    }

    await queryInterface.sequelize.query(`
      UPDATE plans SET kind = 'catalog' WHERE kind IS NULL OR kind = '';
    `);
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
    await drop("lead_calls");
    await drop("platform_quotes");
    await drop("leads");
    await removeColumn("subscriptions", "quote_id");
    await removeColumn("subscriptions", "trial_days");
    await removeColumn("subscriptions", "trial_ends_at");
    await removeColumn("plans", "company_id");
    await removeColumn("plans", "trial_days");
    await removeColumn("plans", "negotiable");
    await removeColumn("plans", "kind");
  },
};
