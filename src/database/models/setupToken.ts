import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";

class SetupToken extends Model<
  InferAttributes<SetupToken>,
  InferCreationAttributes<SetupToken>
> {
  declare id: CreationOptional<number>;
  declare user_id: number;
  declare token_hash: string;
  declare expires_at: Date;
  declare used_at?: Date | null;
  declare request_id?: number | null;
  declare createdAt: CreationOptional<Date>;
}

SetupToken.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    token_hash: { type: DataTypes.TEXT, allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used_at: { type: DataTypes.DATE, allowNull: true },
    request_id: { type: DataTypes.INTEGER, allowNull: true },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    sequelize,
    tableName: "setup_tokens",
    timestamps: true,
    updatedAt: false,
  },
);

export default SetupToken;
