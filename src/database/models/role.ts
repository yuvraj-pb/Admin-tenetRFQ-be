import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";

/** Role names mirror the tenant backend so slug mapping stays consistent. */
export enum USER_ROLES {
  SYSTEM_ADMIN = "System Admin",
  SUPPLIER = "Supplier",
  COMPANY_ADMIN = "Company Admin",
  PROCUREMENT_MANAGER = "Procurement Manager",
  BRANCH_ADMIN = "Branch Admin",
  BUYER_MAKER = "Maker",
  BUYER_CHECKER = "Checker",
  BUYER_APPROVER = "Approver",
  /** @deprecated */
  BUYER = "Buyer/Maker",
  /** @deprecated */
  APPROVER = "Approver/Checker",
}

const ROLE_SLUGS: Record<string, string> = {
  [USER_ROLES.SYSTEM_ADMIN]: "super-admin",
  [USER_ROLES.COMPANY_ADMIN]: "company-admin",
  [USER_ROLES.BRANCH_ADMIN]: "branch-admin",
  [USER_ROLES.PROCUREMENT_MANAGER]: "procurement-manager",
  [USER_ROLES.BUYER_MAKER]: "buyer_maker",
  [USER_ROLES.BUYER_CHECKER]: "buyer_checker",
  [USER_ROLES.BUYER_APPROVER]: "buyer_approver",
  [USER_ROLES.BUYER]: "buyer_maker",
  [USER_ROLES.APPROVER]: "buyer_checker",
  [USER_ROLES.SUPPLIER]: "supplier",
};

export const roleToSlug = (roleName: string): string =>
  ROLE_SLUGS[roleName] ?? roleName.toLowerCase().replace(/[\s/]+/g, "_");

class Role extends Model<InferAttributes<Role>, InferCreationAttributes<Role>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare description?: string;
  declare helpText?: string;
  declare isCustom: CreationOptional<boolean>;
  declare isActive: CreationOptional<boolean>;
  declare createdBy?: number;
  declare companyId?: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Role.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, unique: true },
    description: { type: DataTypes.TEXT },
    helpText: { type: DataTypes.TEXT },
    isCustom: { type: DataTypes.BOOLEAN, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdBy: {
      type: DataTypes.INTEGER,
      references: { model: "users", key: "id" },
    },
    companyId: {
      type: DataTypes.INTEGER,
      references: { model: "companyDetails", key: "id" },
    },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "roles", modelName: "Role", timestamps: true },
);

export default Role;
