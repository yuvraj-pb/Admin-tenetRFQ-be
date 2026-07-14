import { Router } from "express";
import { superAdminMiddleware } from "../middlewares/superAdminAuth";
import { apiCallWrapper } from "../utils/apiResponse";
import {
  validator,
  createCompanySchema,
  updateCompanySchema,
  changePlanSchema,
  renewSchema,
  checkoutSchema,
  verifySchema,
} from "../validations/platformValidations";
import { getDashboard } from "../controllers/dashboard.controller";
import { getPlan, getPlans } from "../controllers/plans.controller";
import {
  activate,
  archive,
  createCompany,
  getCompanies,
  getCompany,
  remove,
  resetAdminPassword,
  suspend,
  updateCompany,
} from "../controllers/companies.controller";
import {
  cancel,
  changePlan,
  getSubscriptionByCompany,
  getSubscriptions,
  renew,
} from "../controllers/subscriptions.controller";
import { postCheckout, postVerify } from "../controllers/billing.controller";

/** Every /platform/* route requires a valid Super Admin JWT. */
const platformRoutes = (router: Router) => {
  router.use("/platform", superAdminMiddleware);

  // Dashboard
  router.get("/platform/dashboard", apiCallWrapper(getDashboard));

  // Plans
  router.get("/platform/plans", apiCallWrapper(getPlans));
  router.get("/platform/plans/:id", apiCallWrapper(getPlan));

  // Companies
  router.get("/platform/companies", apiCallWrapper(getCompanies));
  router.post(
    "/platform/companies",
    validator.body(createCompanySchema),
    apiCallWrapper(createCompany),
  );
  router.get("/platform/companies/:id", apiCallWrapper(getCompany));
  router.put(
    "/platform/companies/:id",
    validator.body(updateCompanySchema),
    apiCallWrapper(updateCompany),
  );
  router.delete("/platform/companies/:id", apiCallWrapper(remove));
  router.post("/platform/companies/:id/suspend", apiCallWrapper(suspend));
  router.post("/platform/companies/:id/activate", apiCallWrapper(activate));
  router.post("/platform/companies/:id/archive", apiCallWrapper(archive));
  router.post(
    "/platform/companies/:id/reset-admin-password",
    apiCallWrapper(resetAdminPassword),
  );

  // Subscriptions
  router.get("/platform/subscriptions", apiCallWrapper(getSubscriptions));
  router.get(
    "/platform/companies/:companyId/subscription",
    apiCallWrapper(getSubscriptionByCompany),
  );
  router.post(
    "/platform/companies/:companyId/subscription/change-plan",
    validator.body(changePlanSchema),
    apiCallWrapper(changePlan),
  );
  router.post(
    "/platform/companies/:companyId/subscription/renew",
    validator.body(renewSchema),
    apiCallWrapper(renew),
  );
  router.post(
    "/platform/companies/:companyId/subscription/cancel",
    apiCallWrapper(cancel),
  );

  // Billing (checkout + verify are Super Admin; webhooks live in app.ts)
  router.post(
    "/platform/billing/checkout",
    validator.body(checkoutSchema),
    apiCallWrapper(postCheckout),
  );
  router.post(
    "/platform/billing/verify",
    validator.body(verifySchema),
    apiCallWrapper(postVerify),
  );
};

export default platformRoutes;
