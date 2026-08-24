import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";

class PlatformAuditLog extends Model<
  InferAttributes<PlatformAuditLog>,
  InferCreationAttributes<PlatformAuditLog>
> {
  declare id: CreationOptional<number>;
  declare actor_user_id?: number | null;
  declare action: string;
  declare company_id?: number | null;
  declare reason?: string | null;
  declare ip_address?: string | null;
  declare meta?: Record<string, unknown> | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare actor?: { id: number; name: string } | null;
}

PlatformAuditLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    actor_user_id: { type: DataTypes.INTEGER, allowNull: true },
    action: { type: DataTypes.STRING(128), allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: true },
    reason: { type: DataTypes.TEXT, allowNull: true },
    ip_address: { type: DataTypes.STRING(64), allowNull: true },
    meta: { type: DataTypes.JSONB, allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: "platform_audit_logs", timestamps: true },
);

export default PlatformAuditLog;
