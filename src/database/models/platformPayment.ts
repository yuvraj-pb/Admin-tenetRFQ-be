import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";

class PlatformPayment extends Model<
  InferAttributes<PlatformPayment>,
  InferCreationAttributes<PlatformPayment>
> {
  declare id: CreationOptional<number>;
  declare company_id: number;
  declare subscription_id?: number | null;
  declare provider: string;
  declare provider_payment_id?: string | null;
  declare provider_order_id?: string | null;
  declare amount: CreationOptional<number>;
  declare currency: CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare purpose?: string | null;
  declare raw_payload?: Record<string, unknown> | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

PlatformPayment.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    subscription_id: { type: DataTypes.INTEGER, allowNull: true },
    provider: { type: DataTypes.STRING(32), allowNull: false },
    provider_payment_id: { type: DataTypes.STRING, allowNull: true },
    provider_order_id: { type: DataTypes.STRING, allowNull: true },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: "INR" },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "pending",
    },
    purpose: { type: DataTypes.STRING(32), allowNull: true },
    raw_payload: { type: DataTypes.JSONB, allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "platform_payments", timestamps: true },
);

export default PlatformPayment;
