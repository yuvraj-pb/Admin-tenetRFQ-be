export const AUDIT_ACTIONS = {
  COMPANY_CREATED: "company.created",
  COMPANY_UPDATED: "company.updated",
  COMPANY_SUSPENDED: "company.suspended",
  COMPANY_ACTIVATED: "company.activated",
  COMPANY_ARCHIVED: "company.archived",
  COMPANY_DELETED: "company.deleted",
  PASSWORD_RESET: "password.reset",
  SUBSCRIPTION_CHANGED: "subscription.changed",
  SUBSCRIPTION_RENEWED: "subscription.renewed",
  SUBSCRIPTION_CANCELLED: "subscription.cancelled",
  SUBSCRIPTION_RESUMED: "subscription.resumed",
  SUBSCRIPTION_GRANTED: "subscription.granted",
  SUBSCRIPTION_TRIAL_STARTED: "subscription.trial_started",
  ENTITLEMENTS_UPDATED: "entitlements.updated",
  PAYMENT_VERIFIED: "payment.verified",
  LEAD_CREATED: "lead.created",
  LEAD_UPDATED: "lead.updated",
  LEAD_ASSIGNED: "lead.assigned",
  LEAD_TRIAL_STARTED: "lead.trial_started",
  LEAD_CONVERTED: "lead.converted",
  QUOTE_CREATED: "quote.created",
  QUOTE_SENT: "quote.sent",
  QUOTE_ACCEPTED: "quote.accepted",
  QUOTE_REJECTED: "quote.rejected",
  ONBOARDING_SUBMIT: "onboarding.submit",
  ONBOARDING_IN_REVIEW: "onboarding.in_review",
  ONBOARDING_REJECT: "onboarding.reject",
  ONBOARDING_APPROVE: "onboarding.approve",
  ONBOARDING_PROVISION: "onboarding.provision",
  ONBOARDING_RESEND_SETUP: "onboarding.resend_setup",
  ONBOARDING_NOTE: "onboarding.note",
} as const;

export const lifecycleAuditAction = (status: string): string => {
  if (status === "suspended") return AUDIT_ACTIONS.COMPANY_SUSPENDED;
  if (status === "active") return AUDIT_ACTIONS.COMPANY_ACTIVATED;
  if (status === "archived") return AUDIT_ACTIONS.COMPANY_ARCHIVED;
  if (status === "deleted") return AUDIT_ACTIONS.COMPANY_DELETED;
  return `company.${status}`;
};
