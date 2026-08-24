import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";

class OnboardingNote extends Model<
  InferAttributes<OnboardingNote>,
  InferCreationAttributes<OnboardingNote>
> {
  declare id: CreationOptional<number>;
  declare request_id: number;
  declare actor_user_id?: number | null;
  declare body: string;
  declare createdAt: CreationOptional<Date>;
}

OnboardingNote.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    request_id: { type: DataTypes.INTEGER, allowNull: false },
    actor_user_id: { type: DataTypes.INTEGER, allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: false },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
  },
  {
    sequelize,
    tableName: "onboarding_notes",
    timestamps: true,
    updatedAt: false,
  },
);

export default OnboardingNote;
