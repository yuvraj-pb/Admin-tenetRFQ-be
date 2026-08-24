import express from "express";
import platformRoutes from "./platformRoutes";
import { apiCallWrapper } from "../utils/apiResponse";
import {
  validator,
  createLeadSchema,
  loginSchema,
  refreshTokenSchema,
  otpSendSchema,
  otpVerifySchema,
  publicOnboardingSchema,
  setupCompleteSchema,
} from "../validations/platformValidations";
import { postPublicLead } from "../controllers/leads.controller";
import { login, refreshToken } from "../controllers/auth.controller";
import {
  getPublicTemplates,
  postOtpSend,
  postOtpVerify,
  postPublicOnboarding,
  postSetupComplete,
} from "../controllers/onboarding.controller";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "OK",
    timestamp: new Date().toISOString(),
  });
});

router.post("/users/login", validator.body(loginSchema), apiCallWrapper(login));
router.post(
  "/users/refresh-token",
  validator.body(refreshTokenSchema),
  apiCallWrapper(refreshToken),
);

router.get("/public/templates", apiCallWrapper(getPublicTemplates));
router.post(
  "/public/otp/send",
  validator.body(otpSendSchema),
  apiCallWrapper(postOtpSend),
);
router.post(
  "/public/otp/verify",
  validator.body(otpVerifySchema),
  apiCallWrapper(postOtpVerify),
);
router.post(
  "/public/onboarding",
  validator.body(publicOnboardingSchema),
  apiCallWrapper(postPublicOnboarding),
);
router.post(
  "/public/setup/complete",
  validator.body(setupCompleteSchema),
  apiCallWrapper(postSetupComplete),
);

router.post(
  "/public/leads",
  validator.body(createLeadSchema),
  apiCallWrapper(postPublicLead),
);

platformRoutes(router);

export default router;
