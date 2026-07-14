import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import bcrypt from "bcrypt";
import sequelize from "./index";
import Company from "./company";
import Role from "./role";

/**
 * Maps the EXISTING `users` table. The platform service reads users and does a
 * limited amount of writes (create company admin, reset admin password).
 * The bcrypt hook mirrors the tenant backend so passwords remain compatible.
 */
class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare email: string;
  declare password?: string;
  declare password_hash: string;
  declare mobile: string | null;
  declare otpVerified: CreationOptional<boolean>;
  declare lastLogin: CreationOptional<Date>;
  declare passwordUpdatedAt: CreationOptional<Date>;
  declare isActive: CreationOptional<boolean>;
  declare roleId: number | null;
  declare companyId: number | null;
  declare branchId: number | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare userRole?: Role;
  declare company?: Company;

  async validatePassword(password: string): Promise<boolean> {
    return bcrypt.compare(password, this.password_hash);
  }
}

User.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: DataTypes.STRING,
    email: { type: DataTypes.STRING, unique: true },
    password: DataTypes.VIRTUAL,
    password_hash: DataTypes.STRING,
    mobile: { type: DataTypes.STRING, allowNull: true },
    otpVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    lastLogin: { type: DataTypes.DATE, allowNull: true },
    passwordUpdatedAt: { type: DataTypes.DATE, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    roleId: { type: DataTypes.INTEGER, allowNull: true },
    companyId: { type: DataTypes.INTEGER, allowNull: true },
    branchId: { type: DataTypes.INTEGER, allowNull: true },
    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "users",
    timestamps: true,
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          user.password_hash = await bcrypt.hash(user.password, 10);
          user.passwordUpdatedAt = new Date();
        }
      },
      beforeUpdate: async (user: User) => {
        if (user.changed("password")) {
          user.password_hash = await bcrypt.hash(user.password!, 10);
          user.passwordUpdatedAt = new Date();
        }
      },
    },
  },
);

User.belongsTo(Company, { foreignKey: "companyId" });

export default User;
