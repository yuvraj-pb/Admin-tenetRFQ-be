import User from "./user";
import Role from "./role";
import Company from "./company";
import Branch from "./branch";
import Plan from "./plan";
import Subscription from "./subscription";

export const associateModels = () => {
  User.belongsTo(Role, { foreignKey: "roleId", as: "userRole" });
  Role.hasMany(User, { foreignKey: "roleId", as: "users" });

  Company.hasMany(Branch, { foreignKey: "companyId", as: "branches" });
  Branch.belongsTo(Company, { foreignKey: "companyId", as: "company" });

  // Plan ↔ Subscription ↔ Company associations are declared in subscription.ts
  void Plan;
  void Subscription;
};
