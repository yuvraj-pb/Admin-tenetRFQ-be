import { Response } from "express";
import { successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import { updateCompanyFeatures } from "../services/featureService";
import { clientIp } from "../utils/clientIp";

export const updateFeatures = async (req: AuthRequest, res: Response) => {
  const data = await updateCompanyFeatures(
    Number(req.params.companyId),
    req.body ?? {},
    req.user?.id,
    clientIp(req),
  );
  return successResponse(res, "Features updated", data);
};
