import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
} from "sequelize";
import sequelize from "./index";

class SolutionTemplate extends Model<
  InferAttributes<SolutionTemplate>,
  InferCreationAttributes<SolutionTemplate>
> {
  declare id: string;
  declare name: string;
  declare pitch?: string | null;
  declare best_for?: string | null;
  declare module_keys: string[];
  declare base_plan_code: string;
  declare price_from_monthly?: number | null;
  declare active: boolean;
  declare i18n?: Record<string, unknown> | null;
}

SolutionTemplate.init(
  {
    id: { type: DataTypes.TEXT, primaryKey: true },
    name: { type: DataTypes.TEXT, allowNull: false },
    pitch: { type: DataTypes.TEXT, allowNull: true },
    best_for: { type: DataTypes.TEXT, allowNull: true },
    module_keys: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    base_plan_code: { type: DataTypes.TEXT, allowNull: false },
    price_from_monthly: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    i18n: { type: DataTypes.JSONB, allowNull: true },
  },
  { sequelize, tableName: "solution_templates", timestamps: false },
);

export default SolutionTemplate;
