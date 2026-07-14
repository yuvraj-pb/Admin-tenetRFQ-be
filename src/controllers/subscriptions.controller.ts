import { Response } from "express";
import { paginatedResponse, successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import {
  cancelCompanySubscription,
  changeCompanyPlan,
  getCompanySubscription,
  listSubscriptions,
  renewCompanySubscription,
} from "../services/subscriptionService";

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
  );
  return successResponse(res, "Checkout created", data);
};

export const renew = async (req: AuthRequest, res: Response) => {
  const data = await renewCompanySubscription(
    Number(req.params.companyId),
    req.body ?? {},
    req.user?.id,
  );
  return successResponse(res, "Checkout created", data);
};

export const cancel = async (req: AuthRequest, res: Response) => {
  const data = await cancelCompanySubscription(
    Number(req.params.companyId),
    req.body?.atPeriodEnd !== false,
    req.user?.id,
  );
  return successResponse(res, "Subscription cancelled", data);
};
