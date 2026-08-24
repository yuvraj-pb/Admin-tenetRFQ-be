import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";

class LeadCall extends Model<
  InferAttributes<LeadCall>,
  InferCreationAttributes<LeadCall>
> {
  declare id: CreationOptional<number>;
  declare lead_id: number;
  declare company_id?: number | null;
  declare outcome: string;
  declare notes?: string | null;
  declare next_follow_up_at?: Date | null;
  declare created_by_id?: number | null;
  declare created_by_name?: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

LeadCall.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    lead_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: true },
    outcome: { type: DataTypes.STRING(32), allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    next_follow_up_at: { type: DataTypes.DATE, allowNull: true },
    created_by_id: { type: DataTypes.INTEGER, allowNull: true },
    created_by_name: { type: DataTypes.STRING(255), allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "lead_calls", timestamps: true },
);

export default LeadCall;
