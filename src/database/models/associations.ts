import User from "./user";
import Role from "./role";
import Company from "./company";
import Branch from "./branch";
import Plan from "./plan";
import Subscription from "./subscription";
import PlatformAuditLog from "./platformAuditLog";
import CompanyFile from "./companyFile";
import Lead from "./lead";
import LeadCall from "./leadCall";
import PlatformQuote from "./platformQuote";
import SolutionTemplate from "./solutionTemplate";
import OnboardingRequest from "./onboardingRequest";
import OnboardingNote from "./onboardingNote";
import SetupToken from "./setupToken";

export const associateModels = () => {
  User.belongsTo(Role, { foreignKey: "roleId", as: "userRole" });
  Role.hasMany(User, { foreignKey: "roleId", as: "users" });

  Company.hasMany(Branch, { foreignKey: "companyId", as: "branches" });
  Branch.belongsTo(Company, { foreignKey: "companyId", as: "company" });

  PlatformAuditLog.belongsTo(User, { foreignKey: "actor_user_id", as: "actor" });
  Company.hasMany(CompanyFile, { foreignKey: "company_id", as: "files" });
  CompanyFile.belongsTo(Company, { foreignKey: "company_id", as: "company" });

  Lead.hasMany(LeadCall, { foreignKey: "lead_id", as: "calls" });
  LeadCall.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });
  Lead.hasMany(PlatformQuote, { foreignKey: "lead_id", as: "quotes" });
  PlatformQuote.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });
  Company.hasMany(Lead, { foreignKey: "company_id", as: "leads" });
  Lead.belongsTo(Company, { foreignKey: "company_id", as: "company" });
  Company.hasMany(PlatformQuote, { foreignKey: "company_id", as: "quotes" });
  PlatformQuote.belongsTo(Company, { foreignKey: "company_id", as: "company" });

  OnboardingRequest.belongsTo(SolutionTemplate, {
    foreignKey: "template_id",
    as: "template",
  });
  SolutionTemplate.hasMany(OnboardingRequest, {
    foreignKey: "template_id",
    as: "requests",
  });
  OnboardingRequest.hasMany(OnboardingNote, {
    foreignKey: "request_id",
    as: "notes",
  });
  OnboardingNote.belongsTo(OnboardingRequest, {
    foreignKey: "request_id",
    as: "request",
  });
  OnboardingNote.belongsTo(User, {
    foreignKey: "actor_user_id",
    as: "actor",
  });
  OnboardingRequest.belongsTo(Company, {
    foreignKey: "company_id",
    as: "company",
  });
  SetupToken.belongsTo(User, { foreignKey: "user_id", as: "user" });
  SetupToken.belongsTo(OnboardingRequest, {
    foreignKey: "request_id",
    as: "request",
  });

  // Plan ↔ Subscription ↔ Company associations are declared in subscription.ts
  void Plan;
  void Subscription;
};
