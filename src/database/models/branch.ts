import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";

/**
 * Maps the EXISTING `branches` table. Used ONLY for usage counting
 * (`COUNT(*) WHERE companyId = ?`). No branch content is ever exposed.
 */
class Branch extends Model<
  InferAttributes<Branch>,
  InferCreationAttributes<Branch>
> {
  declare id: CreationOptional<number>;
  declare companyId: number;
  declare branchName: CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Branch.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    companyId: { type: DataTypes.INTEGER, allowNull: false },
    branchName: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "branches", timestamps: true },
);

export default Branch;
