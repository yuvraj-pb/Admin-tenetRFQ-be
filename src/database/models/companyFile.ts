import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";

/**
 * Company-owned upload metadata. Used ONLY to SUM byte_size for storage
 * meters — file URLs are never returned on Super Admin APIs.
 */
class CompanyFile extends Model<
  InferAttributes<CompanyFile>,
  InferCreationAttributes<CompanyFile>
> {
  declare id: CreationOptional<number>;
  declare company_id: number;
  declare url: string;
  declare kind?: string | null;
  declare byte_size: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

CompanyFile.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    url: { type: DataTypes.TEXT, allowNull: false },
    kind: { type: DataTypes.STRING(64), allowNull: true },
    byte_size: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "company_files", timestamps: true },
);

export default CompanyFile;
