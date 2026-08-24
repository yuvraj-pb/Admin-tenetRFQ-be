import { Response } from "express";
import { paginatedResponse, successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import { clientIp } from "../utils/clientIp";
import {
  activateCompany,
  archiveCompany,
  createPlatformCompany,
  getPlatformCompany,
  listPlatformCompanies,
  resetCompanyAdminPassword,
  softDeleteCompany,
  suspendCompany,
  updateCompanyNotes,
  updatePlatformCompany,
} from "../services/companyService";
import { listCompanyAudit } from "../services/auditService";

const ctx = (req: AuthRequest) => ({
  actorUserId: req.user?.id,
  ip: clientIp(req),
});

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
  const data = await createPlatformCompany(req.body ?? {}, ctx(req));
  return successResponse(res, "Company created successfully", data, 201);
};

export const updateCompany = async (req: AuthRequest, res: Response) => {
  const data = await updatePlatformCompany(
    Number(req.params.id),
    req.body ?? {},
    ctx(req),
  );
  return successResponse(res, "Company updated successfully", data);
};

export const updateNotes = async (req: AuthRequest, res: Response) => {
  const data = await updateCompanyNotes(
    Number(req.params.id),
    req.body ?? {},
    ctx(req),
  );
  return successResponse(res, "Notes updated", data);
};

export const getCompanyAudit = async (req: AuthRequest, res: Response) => {
  const { data, page, limit, total } = await listCompanyAudit(
    Number(req.params.id),
    req.query ?? {},
  );
  return paginatedResponse(res, "OK", data, { page, limit, total });
};

export const suspend = async (req: AuthRequest, res: Response) => {
  const data = await suspendCompany(
    Number(req.params.id),
    req.body?.reason,
    ctx(req),
  );
  return successResponse(res, "Company suspended", data);
};

export const activate = async (req: AuthRequest, res: Response) => {
  const data = await activateCompany(Number(req.params.id), ctx(req));
  return successResponse(res, "Company activated", data);
};

export const archive = async (req: AuthRequest, res: Response) => {
  const data = await archiveCompany(Number(req.params.id), ctx(req));
  return successResponse(res, "Company archived", data);
};

export const remove = async (req: AuthRequest, res: Response) => {
  await softDeleteCompany(Number(req.params.id), ctx(req));
  return successResponse(res, "Company deleted", null);
};

export const resetAdminPassword = async (req: AuthRequest, res: Response) => {
  const data = await resetCompanyAdminPassword(Number(req.params.id), ctx(req));
  return successResponse(res, "Password reset", data);
};
