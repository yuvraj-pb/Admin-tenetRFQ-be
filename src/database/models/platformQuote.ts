import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";
import { PlanFeatures } from "./plan";

class PlatformQuote extends Model<
  InferAttributes<PlatformQuote>,
  InferCreationAttributes<PlatformQuote>
> {
  declare id: CreationOptional<number>;
  declare lead_id?: number | null;
  declare company_id?: number | null;
  declare name: string;
  declare status: CreationOptional<string>;
  declare billing_interval: CreationOptional<string>;
  declare amount: CreationOptional<number>;
  declare currency: CreationOptional<string>;
  declare features: CreationOptional<PlanFeatures>;
  declare max_users?: number | null;
  declare max_branches?: number | null;
  declare max_storage_bytes?: number | null;
  declare notes?: string | null;
  declare valid_until?: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

PlatformQuote.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    lead_id: { type: DataTypes.INTEGER, allowNull: true },
    company_id: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "draft",
    },
    billing_interval: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "monthly",
    },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: "INR" },
    features: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    max_users: { type: DataTypes.INTEGER, allowNull: true },
    max_branches: { type: DataTypes.INTEGER, allowNull: true },
    max_storage_bytes: { type: DataTypes.BIGINT, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    valid_until: { type: DataTypes.DATE, allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "platform_quotes", timestamps: true },
);

export default PlatformQuote;
