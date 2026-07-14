import { Response } from "express";
import { successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import { getPlanById, listPlans } from "../services/planService";

export const getPlans = async (_req: AuthRequest, res: Response) => {
  const data = await listPlans();
  return successResponse(res, "OK", data);
};

export const getPlan = async (req: AuthRequest, res: Response) => {
  const data = await getPlanById(Number(req.params.id));
  return successResponse(res, "OK", data);
};
