import { Request, Response } from "express";
import { paginatedResponse, successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import { clientIp } from "../utils/clientIp";
import { sendOtp, verifyOtp } from "../services/otpService";
import { listPublicTemplates } from "../services/templateService";
import {
  addOnboardingNote,
  approveOnboarding,
  completeSetup,
  getOnboardingById,
  listOnboarding,
  markInReview,
  provisionOnboarding,
  rejectOnboarding,
  resendSetup,
  submitPublicOnboarding,
} from "../services/onboardingService";

const ctx = (req: AuthRequest) => ({
  actorUserId: req.user?.id,
  ip: clientIp(req),
});

export const postOtpSend = async (req: Request, res: Response) => {
  const data = await sendOtp(req.body?.mobile);
  return successResponse(res, "OTP sent", data);
};

export const postOtpVerify = async (req: Request, res: Response) => {
  const data = verifyOtp(req.body?.mobile, req.body?.code);
  return successResponse(res, "Mobile verified", data);
};

export const getPublicTemplates = async (_req: Request, res: Response) => {
  const data = await listPublicTemplates();
  return successResponse(res, "OK", data);
};

export const postPublicOnboarding = async (req: Request, res: Response) => {
  if (String(req.body?.website || "").trim()) {
    return successResponse(res, "ok", { refNo: "RFQ-ONB-00000" });
  }
  const data = await submitPublicOnboarding(req.body ?? {});
  return successResponse(
    res,
    "Application received",
    { id: data.id, refNo: data.refNo },
    201,
  );
};

export const postSetupComplete = async (req: Request, res: Response) => {
  const data = await completeSetup(req.body?.token, req.body?.password);
  return successResponse(res, "Setup complete", data);
};

export const getOnboardingQueue = async (req: AuthRequest, res: Response) => {
  const { data, page, limit, total } = await listOnboarding(req.query ?? {});
  return paginatedResponse(res, "OK", data, { page, limit, total });
};

export const getOnboarding = async (req: AuthRequest, res: Response) => {
  const data = await getOnboardingById(Number(req.params.id));
  return successResponse(res, "OK", data);
};

export const postOnboardingNote = async (req: AuthRequest, res: Response) => {
  const data = await addOnboardingNote(
    Number(req.params.id),
    req.body?.body,
    ctx(req),
  );
  return successResponse(res, "Note added", data, 201);
};

export const postOnboardingInReview = async (req: AuthRequest, res: Response) => {
  const data = await markInReview(Number(req.params.id), ctx(req));
  return successResponse(res, "Moved to in review", data);
};

export const postOnboardingReject = async (req: AuthRequest, res: Response) => {
  const data = await rejectOnboarding(
    Number(req.params.id),
    req.body?.reason,
    ctx(req),
  );
  return successResponse(res, "Application rejected", data);
};

export const postOnboardingApprove = async (req: AuthRequest, res: Response) => {
  const data = await approveOnboarding(
    Number(req.params.id),
    req.body ?? {},
    ctx(req),
  );
  return successResponse(res, "Application approved", data);
};

export const postOnboardingProvision = async (
  req: AuthRequest,
  res: Response,
) => {
  const data = await provisionOnboarding(Number(req.params.id), ctx(req));
  return successResponse(
    res,
    data.alreadyProvisioned ? "Already provisioned" : "Workspace provisioned",
    {
      companyId: data.companyId,
      refNo: data.refNo,
      setupUrl: data.setupUrl,
      whatsappMessage: data.whatsappMessage,
    },
  );
};

export const postOnboardingResendSetup = async (
  req: AuthRequest,
  res: Response,
) => {
  const data = await resendSetup(Number(req.params.id), ctx(req));
  return successResponse(res, "Setup link resent", data);
};
