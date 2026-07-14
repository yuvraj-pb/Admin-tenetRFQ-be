import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";
import sequelize from "./index";

/**
 * Maps the EXISTING `companyDetails` table owned by the tenant backend.
 * The platform service only reads/writes company metadata + lifecycle columns —
 * never procurement content.
 */
class Company extends Model<
  InferAttributes<Company>,
  InferCreationAttributes<Company>
> {
  declare id: CreationOptional<number>;

  // Basic Info
  declare companyName: string;
  declare businessType: string;
  declare yearOfEstablishment: number;

  // Address
  declare addressLine: string;
  declare city: string;
  declare state: string;
  declare pinCode: string;
  declare digiPin: string | null;

  // Legal
  declare gstNumber: string;
  declare fssaiNumber: string | null;
  declare companyPANNumber: string;
  declare cinNumber: string | null;

  // Business
  declare primaryIndustrySegment: string;
  declare secondaryIndustries: string[];

  // Locations
  declare plantLocations: {
    city: string;
    state: string;
    purpose: string;
  }[];

  // Contacts
  declare primaryContact: {
    name: string;
    role: string;
    phone: string;
    email: string;
  };

  declare alternateContact?: {
    name: string;
    role: string;
    phone: string;
    email: string;
  };

  // Purchase Preferences
  declare monthlyPurchaseVolume?: number;
  declare annualPurchaseVolume?: number;
  declare preferredPotatoCategories?: string[];
  declare deliveryLocations?: string[];

  // Documents
  declare documents?: Record<string, string>;
  declare logo: string | null;

  // Platform / multi-tenant lifecycle
  declare status: CreationOptional<string>;
  declare deleted_at?: Date | null;
  declare legal_name?: string | null;
  declare email?: string | null;
  declare phone?: string | null;
  declare country?: string | null;
  declare storage_used_bytes: CreationOptional<number>;
  declare suspend_reason?: string | null;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Company.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    companyName: { type: DataTypes.STRING, allowNull: false },
    businessType: { type: DataTypes.STRING, allowNull: true },
    yearOfEstablishment: { type: DataTypes.INTEGER, allowNull: false },

    addressLine: { type: DataTypes.STRING, allowNull: true },
    city: { type: DataTypes.STRING, allowNull: false },
    state: { type: DataTypes.STRING, allowNull: false },
    pinCode: { type: DataTypes.STRING, allowNull: false },
    digiPin: { type: DataTypes.STRING, allowNull: true },

    gstNumber: { type: DataTypes.STRING, allowNull: false },
    fssaiNumber: { type: DataTypes.STRING, allowNull: true },
    companyPANNumber: { type: DataTypes.STRING, allowNull: false },
    cinNumber: { type: DataTypes.STRING, allowNull: true },

    primaryIndustrySegment: { type: DataTypes.STRING, allowNull: false },
    secondaryIndustries: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },

    plantLocations: { type: DataTypes.JSONB, allowNull: true },
    primaryContact: { type: DataTypes.JSONB, allowNull: true },
    alternateContact: { type: DataTypes.JSONB, allowNull: true },

    monthlyPurchaseVolume: { type: DataTypes.INTEGER },
    annualPurchaseVolume: { type: DataTypes.INTEGER },

    preferredPotatoCategories: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },
    deliveryLocations: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
    },

    documents: { type: DataTypes.JSONB, allowNull: true },
    logo: { type: DataTypes.STRING, allowNull: true },

    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "active",
    },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
    legal_name: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    country: { type: DataTypes.STRING(8), allowNull: true, defaultValue: "IN" },
    storage_used_bytes: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    suspend_reason: { type: DataTypes.TEXT, allowNull: true },

    createdAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: "companyDetails",
    timestamps: true,
  },
);

export default Company;
