import { Response } from "express";
import { paginatedResponse, successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import { clientIp } from "../utils/clientIp";
import {
  cancelCompanySubscription,
  changeCompanyPlan,
  getCompanySubscription,
  grantCompanySubscription,
  listSubscriptions,
  renewCompanySubscription,
  resumeCompanySubscription,
} from "../services/subscriptionService";
import { startCompanyTrial } from "../services/trialService";

export const getSubscriptions = async (req: AuthRequest, res: Response) => {
  const { data, page, limit, total } = await listSubscriptions(req.query ?? {});
  return paginatedResponse(res, "OK", data, { page, limit, total });
};

export const getSubscriptionByCompany = async (
  req: AuthRequest,
  res: Response,
) => {
  const data = await getCompanySubscription(Number(req.params.companyId));
  return successResponse(res, "OK", data);
};

export const changePlan = async (req: AuthRequest, res: Response) => {
  const data = await changeCompanyPlan(
    Number(req.params.companyId),
    req.body ?? {},
    req.user?.id,
    clientIp(req),
  );
  return successResponse(res, "Checkout created", data);
};

export const renew = async (req: AuthRequest, res: Response) => {
  const data = await renewCompanySubscription(
    Number(req.params.companyId),
    req.body ?? {},
    req.user?.id,
    clientIp(req),
  );
  return successResponse(res, "Checkout created", data);
};

export const grant = async (req: AuthRequest, res: Response) => {
  const data = await grantCompanySubscription(
    Number(req.params.companyId),
    req.body ?? {},
    req.user?.id,
    clientIp(req),
  );
  return successResponse(res, "Plan covered by platform operator", data);
};

export const cancel = async (req: AuthRequest, res: Response) => {
  const data = await cancelCompanySubscription(
    Number(req.params.companyId),
    req.body.atPeriodEnd === true,
    req.user?.id,
    clientIp(req),
  );
  return successResponse(res, "Subscription cancelled", data);
};

export const resume = async (req: AuthRequest, res: Response) => {
  const data = await resumeCompanySubscription(
    Number(req.params.companyId),
    req.user?.id,
    clientIp(req),
  );
  return successResponse(res, "Subscription resumed", data);
};

export const startTrial = async (req: AuthRequest, res: Response) => {
  const data = await startCompanyTrial(
    Number(req.params.companyId || req.params.id),
    req.body ?? {},
    req.user?.id,
    clientIp(req),
  );
  return successResponse(res, "Trial started", data);
};
