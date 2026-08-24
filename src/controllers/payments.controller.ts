import { Response } from "express";
import { successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import { listCompanyPayments } from "../services/paymentService";

export const getCompanyPayments = async (req: AuthRequest, res: Response) => {
  const data = await listCompanyPayments(Number(req.params.companyId));
  return successResponse(res, "OK", data);
};
