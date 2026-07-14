import { Response } from "express";
import { paginatedResponse, successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import {
  activateCompany,
  archiveCompany,
  createPlatformCompany,
  getPlatformCompany,
  listPlatformCompanies,
  resetCompanyAdminPassword,
  softDeleteCompany,
  suspendCompany,
  updatePlatformCompany,
} from "../services/companyService";

export const getCompanies = async (req: AuthRequest, res: Response) => {
  const { data, page, limit, total } = await listPlatformCompanies(
    req.query ?? {},
  );
  return paginatedResponse(res, "OK", data, { page, limit, total });
};

export const getCompany = async (req: AuthRequest, res: Response) => {
  const data = await getPlatformCompany(Number(req.params.id));
  return successResponse(res, "OK", data);
};

export const createCompany = async (req: AuthRequest, res: Response) => {
  const data = await createPlatformCompany(req.body ?? {}, req.user?.id);
  return successResponse(res, "Company created successfully", data, 201);
};

export const updateCompany = async (req: AuthRequest, res: Response) => {
  const data = await updatePlatformCompany(
    Number(req.params.id),
    req.body ?? {},
    req.user?.id,
  );
  return successResponse(res, "Company updated successfully", data);
};

export const suspend = async (req: AuthRequest, res: Response) => {
  const data = await suspendCompany(
    Number(req.params.id),
    req.body?.reason,
    req.user?.id,
  );
  return successResponse(res, "Company suspended", data);
};

export const activate = async (req: AuthRequest, res: Response) => {
  const data = await activateCompany(Number(req.params.id), req.user?.id);
  return successResponse(res, "Company activated", data);
};

export const archive = async (req: AuthRequest, res: Response) => {
  const data = await archiveCompany(Number(req.params.id), req.user?.id);
  return successResponse(res, "Company archived", data);
};

export const remove = async (req: AuthRequest, res: Response) => {
  await softDeleteCompany(Number(req.params.id), req.user?.id);
  return successResponse(res, "Company deleted", null);
};

export const resetAdminPassword = async (req: AuthRequest, res: Response) => {
  const data = await resetCompanyAdminPassword(
    Number(req.params.id),
    req.user?.id,
  );
  return successResponse(res, "Password reset", data);
};
