"use strict";

/**
 * RFQ Cloud onboarding queue. Additive tables only — does not ALTER
 * companyDetails / users / subscriptions / plans / leads.
 *
 * @type {import('sequelize-cli').Migration}
 */

const TEMPLATES = [
  {
    id: "procurement",
    name: "Procurement Suite",
    pitch: "Run RFQs, collect quotes and negotiate in one workspace.",
    best_for: "Buyers who need a clean RFQ-to-quote flow.",
    module_keys: JSON.stringify([
      "rfqCore",
      "quotes",
      "negotiations",
      "users",
      "notifications",
      "analytics",
    ]),
    base_plan_code: "basic",
    price_from_monthly: 4999,
    active: true,
    i18n: null,
  },
  {
    id: "suppliers",
    name: "Supplier Hub",
    pitch: "Work with your supplier network and give them a portal.",
    best_for: "Teams that source from a regular supplier base.",
    module_keys: JSON.stringify([
      "rfqCore",
      "quotes",
      "supplierNetwork",
      "supplierPortal",
      "users",
      "notifications",
    ]),
    base_plan_code: "professional",
    price_from_monthly: 14999,
    active: true,
    i18n: null,
  },
  {
    id: "operations",
    name: "Operations Desk",
    pitch: "Orders, dispatch, deliveries and quality in one desk.",
    best_for: "Operations teams moving work after the quote is won.",
    module_keys: JSON.stringify([
      "rfqCore",
      "quotes",
      "orders",
      "dispatch",
      "deliveries",
      "quality",
      "branches",
    ]),
    base_plan_code: "professional",
    price_from_monthly: 14999,
    active: true,
    i18n: null,
  },
  {
    id: "control",
    name: "Control & Approvals",
    pitch: "Approvals, deletion checks and role-based control.",
    best_for: "Organisations that need makers, checkers and an audit trail.",
    module_keys: JSON.stringify([
      "rfqCore",
      "approvalWorkflow",
      "rfqDeletionApprovals",
      "approvalsHub",
      "roles",
      "analytics",
    ]),
    base_plan_code: "professional",
    price_from_monthly: 14999,
    active: true,
    i18n: null,
  },
  {
    id: "full-rfq",
    name: "Full RFQ Platform",
    pitch:
      "Every RFQ Cloud module — procurement, suppliers, operations and control.",
    best_for:
      "Companies standardising the full source-to-settle process.",
    module_keys: JSON.stringify([
      "rfqCore",
      "approvalWorkflow",
      "quotes",
      "negotiations",
      "rfqDeletionApprovals",
      "supplierNetwork",
      "supplierPortal",
      "orders",
      "dispatch",
      "deliveries",
      "quality",
      "slaDisputes",
      "approvalsHub",
      "users",
      "roles",
      "branches",
      "analytics",
      "advancedAnalytics",
      "analyticsExport",
      "qualityAnalytics",
      "notifications",
      "customIntegrations",
      "prioritySupport",
      "dedicatedSupport",
    ]),
    base_plan_code: "enterprise",
    price_from_monthly: 49999,
    active: true,
    i18n: null,
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableNames = (await queryInterface.showAllTables()).map((t) =>
      String(t).toLowerCase(),
    );
    const hasTable = (name) => tableNames.includes(name.toLowerCase());

    const addIndexSafe = async (table, fields, options) => {
      try {
        await queryInterface.addIndex(table, fields, options);
      } catch {
        /* already exists */
      }
    };

    if (!hasTable("solution_templates")) {
      await queryInterface.createTable("solution_templates", {
        id: { type: Sequelize.TEXT, primaryKey: true },
        name: { type: Sequelize.TEXT, allowNull: false },
        pitch: { type: Sequelize.TEXT, allowNull: true },
        best_for: { type: Sequelize.TEXT, allowNull: true },
        module_keys: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        base_plan_code: { type: Sequelize.TEXT, allowNull: false },
        price_from_monthly: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
        active: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        i18n: { type: Sequelize.JSONB, allowNull: true },
      });
    }

    for (const row of TEMPLATES) {
      await queryInterface.sequelize.query(
        `
        INSERT INTO solution_templates
          (id, name, pitch, best_for, module_keys, base_plan_code, price_from_monthly, active, i18n)
        VALUES
          (:id, :name, :pitch, :best_for, CAST(:module_keys AS jsonb), :base_plan_code, :price_from_monthly, :active, :i18n)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          pitch = EXCLUDED.pitch,
          best_for = EXCLUDED.best_for,
          module_keys = EXCLUDED.module_keys,
          base_plan_code = EXCLUDED.base_plan_code,
          price_from_monthly = EXCLUDED.price_from_monthly,
          active = EXCLUDED.active
        `,
        { replacements: row },
      );
    }

    await queryInterface.sequelize.query(
      `CREATE SEQUENCE IF NOT EXISTS onboarding_ref_seq START WITH 1 INCREMENT BY 1`,
    );

    if (!hasTable("onboarding_requests")) {
      await queryInterface.createTable("onboarding_requests", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        ref_no: { type: Sequelize.TEXT, allowNull: false, unique: true },
        template_id: {
          type: Sequelize.TEXT,
          allowNull: false,
          references: { model: "solution_templates", key: "id" },
        },
        business_name: { type: Sequelize.TEXT, allowNull: false },
        business_type: { type: Sequelize.TEXT, allowNull: false },
        year_established: { type: Sequelize.INTEGER, allowNull: true },
        gstin: { type: Sequelize.TEXT, allowNull: true },
        address: { type: Sequelize.TEXT, allowNull: true },
        state: { type: Sequelize.TEXT, allowNull: false },
        district: { type: Sequelize.TEXT, allowNull: false },
        pincode: { type: Sequelize.TEXT, allowNull: false },
        contact_name: { type: Sequelize.TEXT, allowNull: false },
        mobile: { type: Sequelize.TEXT, allowNull: false },
        email: { type: Sequelize.TEXT, allowNull: false },
        whatsapp: { type: Sequelize.TEXT, allowNull: true },
        language: {
          type: Sequelize.TEXT,
          allowNull: false,
          defaultValue: "en",
        },
        scale_data: {
          type: Sequelize.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        requested_plan: { type: Sequelize.TEXT, allowNull: false },
        billing_cycle: { type: Sequelize.TEXT, allowNull: false },
        status: {
          type: Sequelize.TEXT,
          allowNull: false,
          defaultValue: "pending",
        },
        reject_reason: { type: Sequelize.TEXT, allowNull: true },
        company_id: { type: Sequelize.INTEGER, allowNull: true, unique: true },
        allocation: { type: Sequelize.JSONB, allowNull: true },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
        },
      });
      await addIndexSafe("onboarding_requests", ["status"]);
      await addIndexSafe("onboarding_requests", ["mobile"]);
      await addIndexSafe("onboarding_requests", ["created_at"], {
        order: "DESC",
      });
    }

    if (!hasTable("onboarding_notes")) {
      await queryInterface.createTable("onboarding_notes", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        request_id: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: "onboarding_requests", key: "id" },
          onDelete: "CASCADE",
        },
        actor_user_id: { type: Sequelize.INTEGER, allowNull: true },
        body: { type: Sequelize.TEXT, allowNull: false },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
        },
      });
      await addIndexSafe("onboarding_notes", ["request_id"]);
    }

    if (!hasTable("setup_tokens")) {
      await queryInterface.createTable("setup_tokens", {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        user_id: { type: Sequelize.INTEGER, allowNull: false },
        token_hash: { type: Sequelize.TEXT, allowNull: false, unique: true },
        expires_at: { type: Sequelize.DATE, allowNull: false },
        used_at: { type: Sequelize.DATE, allowNull: true },
        request_id: { type: Sequelize.INTEGER, allowNull: true },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
        },
      });
      await addIndexSafe("setup_tokens", ["user_id"]);
      await addIndexSafe("setup_tokens", ["request_id"]);
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
    await drop("setup_tokens");
    await drop("onboarding_notes");
    await drop("onboarding_requests");
    await drop("solution_templates");
    await queryInterface.sequelize.query(
      `DROP SEQUENCE IF EXISTS onboarding_ref_seq`,
    );
  },
};
