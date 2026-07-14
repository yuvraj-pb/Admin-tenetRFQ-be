import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";

export type PlanFeatures = {
  analytics: boolean;
  advancedAnalytics: boolean;
  supplierPortal: boolean;
  approvalWorkflow: boolean;
  prioritySupport: boolean;
  dedicatedSupport: boolean;
  customIntegrations: boolean;
};

class Plan extends Model<InferAttributes<Plan>, InferCreationAttributes<Plan>> {
  declare id: CreationOptional<number>;
  declare code: string;
  declare name: string;
  declare description?: string | null;
  declare price_monthly: number;
  declare price_yearly: number;
  declare currency: CreationOptional<string>;
  declare max_branches: number | null;
  declare max_users: number | null;
  declare max_storage_bytes: number | null;
  declare features: PlanFeatures;
  declare is_active: CreationOptional<boolean>;
  declare sort_order: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Plan.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(128), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    price_monthly: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    price_yearly: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: "INR" },
    max_branches: { type: DataTypes.INTEGER, allowNull: true },
    max_users: { type: DataTypes.INTEGER, allowNull: true },
    max_storage_bytes: { type: DataTypes.BIGINT, allowNull: true },
    features: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "plans", timestamps: true },
);

export default Plan;
