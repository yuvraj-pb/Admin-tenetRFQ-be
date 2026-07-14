import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";
import Plan from "./plan";
import Company from "./company";

class Subscription extends Model<
  InferAttributes<Subscription>,
  InferCreationAttributes<Subscription>
> {
  declare id: CreationOptional<number>;
  declare company_id: number;
  declare plan_id: number;
  declare status: CreationOptional<string>;
  declare billing_interval: CreationOptional<string>;
  declare current_period_start?: Date | null;
  declare current_period_end?: Date | null;
  declare cancel_at_period_end: CreationOptional<boolean>;
  declare auto_renew: CreationOptional<boolean>;
  declare amount: CreationOptional<number>;
  declare currency: CreationOptional<string>;
  declare payment_provider?: string | null;
  declare provider_customer_id?: string | null;
  declare provider_subscription_id?: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare plan?: Plan;
  declare company?: Company;
}

Subscription.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    plan_id: { type: DataTypes.INTEGER, allowNull: false },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "incomplete",
    },
    billing_interval: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: "monthly",
    },
    current_period_start: { type: DataTypes.DATE, allowNull: true },
    current_period_end: { type: DataTypes.DATE, allowNull: true },
    cancel_at_period_end: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    auto_renew: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: "INR" },
    payment_provider: { type: DataTypes.STRING(32), allowNull: true },
    provider_customer_id: { type: DataTypes.STRING, allowNull: true },
    provider_subscription_id: { type: DataTypes.STRING, allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "subscriptions", timestamps: true },
);

Subscription.belongsTo(Plan, { foreignKey: "plan_id", as: "plan" });
Plan.hasMany(Subscription, { foreignKey: "plan_id", as: "subscriptions" });
Subscription.belongsTo(Company, { foreignKey: "company_id", as: "company" });
Company.hasMany(Subscription, { foreignKey: "company_id", as: "subscriptions" });

export default Subscription;
