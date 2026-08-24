import { Router } from "express";
import { superAdminMiddleware } from "../middlewares/superAdminAuth";
import { apiCallWrapper } from "../utils/apiResponse";
import {
  validator,
  createCompanySchema,
  updateCompanySchema,
  changePlanSchema,
  renewSchema,
  grantSchema,
  checkoutSchema,
  verifySchema,
  updateFeaturesSchema,
  notesSchema,
  createLeadSchema,
  updateLeadSchema,
  assignLeadSchema,
  leadCallSchema,
  startTrialSchema,
  convertLeadSchema,
  upsertPlanSchema,
  updatePlanSchema,
  createQuoteSchema,
  updateQuoteSchema,
  acceptQuoteSchema,
  rejectQuoteSchema,
  onboardingNoteSchema,
  onboardingRejectSchema,
  onboardingApproveSchema,
  cancelSubscriptionSchema,
} from "../validations/platformValidations";
import { getDashboard } from "../controllers/dashboard.controller";
import {
  getPlan,
  getPlans,
  getEntitlementsCatalog,
  postPlan,
  putPlan,
  postArchivePlan,
} from "../controllers/plans.controller";
import {
  activate,
  archive,
  createCompany,
  getCompanies,
  getCompany,
  getCompanyAudit,
  remove,
  resetAdminPassword,
  suspend,
  updateCompany,
  updateNotes,
} from "../controllers/companies.controller";
import {
  cancel,
  changePlan,
  getSubscriptionByCompany,
  getSubscriptions,
  grant,
  renew,
  resume,
  startTrial,
} from "../controllers/subscriptions.controller";
import { postCheckout, postVerify } from "../controllers/billing.controller";
import { updateFeatures } from "../controllers/features.controller";
import { getCompanyPayments } from "../controllers/payments.controller";
import {
  getLead,
  getLeadCalls,
  getLeads,
  patchLead,
  postAssignLead,
  postConvertLead,
  postLead,
  postLeadCall,
  postStartLeadTrial,
} from "../controllers/leads.controller";
import {
  getQuotes,
  postAcceptQuote,
  postQuote,
  postRejectQuote,
  postSendQuote,
  putQuote,
} from "../controllers/quotes.controller";
import {
  getOnboarding,
  getOnboardingQueue,
  postOnboardingApprove,
  postOnboardingInReview,
  postOnboardingNote,
  postOnboardingProvision,
  postOnboardingReject,
  postOnboardingResendSetup,
} from "../controllers/onboarding.controller";

/** Every /platform/* route requires a valid Super Admin JWT. */
const platformRoutes = (router: Router) => {
  router.use("/platform", superAdminMiddleware);

  // Dashboard
  router.get("/platform/dashboard", apiCallWrapper(getDashboard));

  // Onboarding queue (not leads)
  router.get("/platform/onboarding", apiCallWrapper(getOnboardingQueue));
  router.post(
    "/platform/onboarding/:id/notes",
    validator.body(onboardingNoteSchema),
    apiCallWrapper(postOnboardingNote),
  );
  router.post(
    "/platform/onboarding/:id/in-review",
    apiCallWrapper(postOnboardingInReview),
  );
  router.post(
    "/platform/onboarding/:id/reject",
    validator.body(onboardingRejectSchema),
    apiCallWrapper(postOnboardingReject),
  );
  router.post(
    "/platform/onboarding/:id/approve",
    validator.body(onboardingApproveSchema),
    apiCallWrapper(postOnboardingApprove),
  );
  router.post(
    "/platform/onboarding/:id/provision",
    apiCallWrapper(postOnboardingProvision),
  );
  router.post(
    "/platform/onboarding/:id/resend-setup",
    apiCallWrapper(postOnboardingResendSetup),
  );
  router.get("/platform/onboarding/:id", apiCallWrapper(getOnboarding));

  // Plans
  router.get("/platform/plans", apiCallWrapper(getPlans));
  router.post(
    "/platform/plans",
    validator.body(upsertPlanSchema),
    apiCallWrapper(postPlan),
  );
  router.get("/platform/plans/:id", apiCallWrapper(getPlan));
  router.put(
    "/platform/plans/:id",
    validator.body(updatePlanSchema),
    apiCallWrapper(putPlan),
  );
  router.post(
    "/platform/plans/:id/archive",
    apiCallWrapper(postArchivePlan),
  );
  router.get("/platform/entitlements/catalog", apiCallWrapper(getEntitlementsCatalog));

  // Leads
  router.get("/platform/leads", apiCallWrapper(getLeads));
  router.post(
    "/platform/leads",
    validator.body(createLeadSchema),
    apiCallWrapper(postLead),
  );
  router.get("/platform/leads/:id/calls", apiCallWrapper(getLeadCalls));
  router.post(
    "/platform/leads/:id/calls",
    validator.body(leadCallSchema),
    apiCallWrapper(postLeadCall),
  );
  router.post(
    "/platform/leads/:id/assign",
    validator.body(assignLeadSchema),
    apiCallWrapper(postAssignLead),
  );
  router.post(
    "/platform/leads/:id/start-trial",
    validator.body(startTrialSchema),
    apiCallWrapper(postStartLeadTrial),
  );
  router.post(
    "/platform/leads/:id/convert",
    validator.body(convertLeadSchema),
    apiCallWrapper(postConvertLead),
  );
  router.get("/platform/leads/:id", apiCallWrapper(getLead));
  router.patch(
    "/platform/leads/:id",
    validator.body(updateLeadSchema),
    apiCallWrapper(patchLead),
  );

  // Commercial quotes (not tenant procurement quotes)
  router.get("/platform/quotes", apiCallWrapper(getQuotes));
  router.post(
    "/platform/quotes",
    validator.body(createQuoteSchema),
    apiCallWrapper(postQuote),
  );
  router.put(
    "/platform/quotes/:id",
    validator.body(updateQuoteSchema),
    apiCallWrapper(putQuote),
  );
  router.post("/platform/quotes/:id/send", apiCallWrapper(postSendQuote));
  router.post(
    "/platform/quotes/:id/accept",
    validator.body(acceptQuoteSchema),
    apiCallWrapper(postAcceptQuote),
  );
  router.post(
    "/platform/quotes/:id/reject",
    validator.body(rejectQuoteSchema),
    apiCallWrapper(postRejectQuote),
  );

  // Companies
  router.get("/platform/companies", apiCallWrapper(getCompanies));
  router.post(
    "/platform/companies",
    validator.body(createCompanySchema),
    apiCallWrapper(createCompany),
  );
  router.put(
    "/platform/companies/:id/notes",
    validator.body(notesSchema),
    apiCallWrapper(updateNotes),
  );
  router.get("/platform/companies/:id/audit", apiCallWrapper(getCompanyAudit));
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
    "/platform/companies/:companyId/subscription/grant",
    validator.body(grantSchema),
    apiCallWrapper(grant),
  );
  router.post(
    "/platform/companies/:companyId/subscription/start-trial",
    validator.body(startTrialSchema),
    apiCallWrapper(startTrial),
  );
  router.post(
    "/platform/companies/:companyId/subscription/cancel",
    validator.body(cancelSubscriptionSchema),
    apiCallWrapper(cancel),
  );
  router.post(
    "/platform/companies/:companyId/subscription/resume",
    apiCallWrapper(resume),
  );
  router.put(
    "/platform/companies/:companyId/features",
    validator.body(updateFeaturesSchema),
    apiCallWrapper(updateFeatures),
  );
  router.get(
    "/platform/companies/:companyId/payments",
    apiCallWrapper(getCompanyPayments),
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
