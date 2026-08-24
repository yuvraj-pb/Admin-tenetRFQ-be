"use strict";

/**
 * Per-company feature overrides on subscriptions.
 * Super Admin can grant or revoke features independently of the plan,
 * e.g. unpaid custom access or paid-plan exceptions.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const describe = async (table) => {
      try {
        return await queryInterface.describeTable(table);
      } catch {
        return {};
      }
    };

    const cols = await describe("subscriptions");
    if (!cols.feature_overrides) {
      await queryInterface.addColumn("subscriptions", "feature_overrides", {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      });
    }
  },

  async down(queryInterface) {
    try {
      await queryInterface.removeColumn("subscriptions", "feature_overrides");
    } catch {
      /* ignore */
    }
  },
};
