import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";

class Lead extends Model<InferAttributes<Lead>, InferCreationAttributes<Lead>> {
  declare id: CreationOptional<number>;
  declare company_name: string;
  declare contact_name: string;
  declare email: string;
  declare phone?: string | null;
  declare city?: string | null;
  declare state?: string | null;
  declare notes?: string | null;
  declare requested_features: CreationOptional<string[]>;
  declare requested_users?: number | null;
  declare requested_branches?: number | null;
  declare source: CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare assigned_to_id?: number | null;
  declare assigned_to_name?: string | null;
  declare company_id?: number | null;
  declare trial_ends_at?: Date | null;
  declare last_contacted_at?: Date | null;
  declare next_follow_up_at?: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Lead.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    company_name: { type: DataTypes.STRING(255), allowNull: false },
    contact_name: { type: DataTypes.STRING(255), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    phone: { type: DataTypes.STRING(64), allowNull: true },
    city: { type: DataTypes.STRING(128), allowNull: true },
    state: { type: DataTypes.STRING(128), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    requested_features: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    requested_users: { type: DataTypes.INTEGER, allowNull: true },
    requested_branches: { type: DataTypes.INTEGER, allowNull: true },
    source: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "manual",
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "new",
    },
    assigned_to_id: { type: DataTypes.INTEGER, allowNull: true },
    assigned_to_name: { type: DataTypes.STRING(255), allowNull: true },
    company_id: { type: DataTypes.INTEGER, allowNull: true },
    trial_ends_at: { type: DataTypes.DATE, allowNull: true },
    last_contacted_at: { type: DataTypes.DATE, allowNull: true },
    next_follow_up_at: { type: DataTypes.DATE, allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "leads", timestamps: true },
);

export default Lead;
