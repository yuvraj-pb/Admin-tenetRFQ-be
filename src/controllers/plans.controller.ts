import { Response } from "express";
import { successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import {
  archivePlan,
  createPlan,
  getPlanById,
  listPlans,
  updatePlan,
} from "../services/planService";
import {
  ENTITLEMENT_GROUPS,
  FEATURE_CATALOG,
  QUOTA_CATALOG,
} from "../utils/entitlements";

export const getPlans = async (req: AuthRequest, res: Response) => {
  const data = await listPlans(req.query ?? {});
  return successResponse(res, "OK", data);
};

export const postPlan = async (req: AuthRequest, res: Response) => {
  const data = await createPlan(req.body ?? {});
  return successResponse(res, "Plan created", data, 201);
};

export const putPlan = async (req: AuthRequest, res: Response) => {
  const data = await updatePlan(Number(req.params.id), req.body ?? {});
  return successResponse(res, "Plan updated", data);
};

export const postArchivePlan = async (req: AuthRequest, res: Response) => {
  const data = await archivePlan(Number(req.params.id));
  return successResponse(res, "Plan archived", data);
};

export const getPlan = async (req: AuthRequest, res: Response) => {
  const data = await getPlanById(Number(req.params.id));
  return successResponse(res, "OK", data);
};

export const getEntitlementsCatalog = async (_req: AuthRequest, res: Response) => {
  return successResponse(res, "OK", {
    groups: ENTITLEMENT_GROUPS,
    flags: FEATURE_CATALOG,
    quotas: QUOTA_CATALOG,
  });
};
