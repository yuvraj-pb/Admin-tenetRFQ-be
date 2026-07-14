import { Response } from "express";
import { successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import { getPlatformDashboard } from "../services/dashboardService";

export const getDashboard = async (_req: AuthRequest, res: Response) => {
  const data = await getPlatformDashboard();
  return successResponse(res, "OK", data);
};
