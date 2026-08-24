import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";

export type OnboardingStatus =
  | "pending"
  | "in_review"
  | "approved"
  | "rejected"
  | "provisioned";

export type OnboardingAllocation = {
  planCode: "starter" | "growth" | "enterprise";
  billingCycle: "monthly" | "yearly";
  priceOverride: number | null;
  trialDays: number;
  modules: string[];
  maxUsers: number | null;
  maxBranches: number | null;
  maxStorageBytes: number | null;
  startDate: string;
};

class OnboardingRequest extends Model<
  InferAttributes<OnboardingRequest>,
  InferCreationAttributes<OnboardingRequest>
> {
  declare id: CreationOptional<number>;
  declare ref_no: string;
  declare template_id: string;
  declare business_name: string;
  declare business_type: string;
  declare year_established?: number | null;
  declare gstin?: string | null;
  declare address?: string | null;
  declare state: string;
  declare district: string;
  declare pincode: string;
  declare contact_name: string;
  declare mobile: string;
  declare email: string;
  declare whatsapp?: string | null;
  declare language: CreationOptional<string>;
  declare scale_data: Record<string, unknown>;
  declare requested_plan: string;
  declare billing_cycle: string;
  declare status: CreationOptional<string>;
  declare reject_reason?: string | null;
  declare company_id?: number | null;
  declare allocation?: OnboardingAllocation | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

OnboardingRequest.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    ref_no: { type: DataTypes.TEXT, allowNull: false, unique: true },
    template_id: { type: DataTypes.TEXT, allowNull: false },
    business_name: { type: DataTypes.TEXT, allowNull: false },
    business_type: { type: DataTypes.TEXT, allowNull: false },
    year_established: { type: DataTypes.INTEGER, allowNull: true },
    gstin: { type: DataTypes.TEXT, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    state: { type: DataTypes.TEXT, allowNull: false },
    district: { type: DataTypes.TEXT, allowNull: false },
    pincode: { type: DataTypes.TEXT, allowNull: false },
    contact_name: { type: DataTypes.TEXT, allowNull: false },
    mobile: { type: DataTypes.TEXT, allowNull: false },
    email: { type: DataTypes.TEXT, allowNull: false },
    whatsapp: { type: DataTypes.TEXT, allowNull: true },
    language: { type: DataTypes.TEXT, allowNull: false, defaultValue: "en" },
    scale_data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    requested_plan: { type: DataTypes.TEXT, allowNull: false },
    billing_cycle: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "pending",
    },
    reject_reason: { type: DataTypes.TEXT, allowNull: true },
    company_id: { type: DataTypes.INTEGER, allowNull: true, unique: true },
    allocation: { type: DataTypes.JSONB, allowNull: true },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "created_at",
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "updated_at",
    },
  },
  {
    sequelize,
    tableName: "onboarding_requests",
    timestamps: true,
  },
);

export default OnboardingRequest;
