/**
 * Seeds subscription plans + ensures the required roles and a Super Admin user.
 *
 * Run: npm run seed
 *
 * Default Super Admin (created only if missing):
 *   email:    superadmin@potatobazaar.com   (override with SUPER_ADMIN_EMAIL)
 *   password: SuperAdmin@123                 (override with SUPER_ADMIN_PASSWORD)
 */
import dotenv from "dotenv";
import bcrypt from "bcrypt";

dotenv.config();

import sequelize from "../database/models";
import { associateModels } from "../database/models/associations";
import Role, { USER_ROLES } from "../database/models/role";
import User from "../database/models/user";
import { seedPlans } from "../services/planService";
import { seedSolutionTemplates } from "../services/templateService";

associateModels();

const SUPER_EMAIL =
  process.env.SUPER_ADMIN_EMAIL || "superadmin@potatobazaar.com";
const SUPER_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@123";

const ensureRole = async (name: string) => {
  const [role] = await Role.findOrCreate({
    where: { name },
    defaults: { name, isActive: true } as any,
  });
  return role;
};

const run = async () => {
  await sequelize.authenticate();

  await seedPlans();
  console.log("✓ Plans seeded (trial / basic / professional / enterprise)");
  await seedSolutionTemplates();
  console.log("✓ Solution templates seeded (5 RFQ Cloud suites)");

  const systemAdminRole = await ensureRole(USER_ROLES.SYSTEM_ADMIN);
  await ensureRole(USER_ROLES.COMPANY_ADMIN);
  console.log('✓ Roles ensured ("System Admin", "Company Admin")');

  let user = await User.findOne({ where: { email: SUPER_EMAIL } });
  if (!user) {
    const password_hash = await bcrypt.hash(SUPER_PASSWORD, 10);
    user = await User.create({
      name: "Super Admin",
      email: SUPER_EMAIL,
      password_hash,
      mobile: "9999999999",
      roleId: systemAdminRole.id,
      companyId: null,
      isActive: true,
      otpVerified: true,
    } as any);
    console.log(`✓ Created Super Admin: ${SUPER_EMAIL} / ${SUPER_PASSWORD}`);
  } else {
    if (user.roleId !== systemAdminRole.id || user.companyId != null) {
      await user.update({
        roleId: systemAdminRole.id,
        companyId: null,
        isActive: true,
      });
    }
    console.log(`✓ Super Admin already exists: ${SUPER_EMAIL}`);
  }

  console.log("Done.");
};

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
