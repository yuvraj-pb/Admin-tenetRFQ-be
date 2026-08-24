import { Response } from "express";
import { paginatedResponse, successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import { clientIp } from "../utils/clientIp";
import {
  assignLead,
  convertLead,
  createLead,
  getLeadById,
  listLeadCalls,
  listLeads,
  logLeadCall,
  startLeadTrial,
  updateLead,
} from "../services/leadService";

const ctx = (req: AuthRequest) => ({
  actorUserId: req.user?.id,
  ip: clientIp(req),
  actorName: req.user?.name,
});

export const getLeads = async (req: AuthRequest, res: Response) => {
  const { data, page, limit, total } = await listLeads(req.query ?? {});
  return paginatedResponse(res, "OK", data, { page, limit, total });
};

export const getLead = async (req: AuthRequest, res: Response) => {
  const data = await getLeadById(Number(req.params.id));
  return successResponse(res, "OK", data);
};

export const postLead = async (req: AuthRequest, res: Response) => {
  const data = await createLead(req.body ?? {}, {
    ...ctx(req),
    source: req.body?.source || "manual",
  });
  return successResponse(res, "Lead created", data, 201);
};

export const postPublicLead = async (req: AuthRequest, res: Response) => {
  const data = await createLead(req.body ?? {}, { source: "landing" });
  return successResponse(res, "Lead created", data, 201);
};

export const patchLead = async (req: AuthRequest, res: Response) => {
  const data = await updateLead(Number(req.params.id), req.body ?? {}, ctx(req));
  return successResponse(res, "Lead updated", data);
};

export const postAssignLead = async (req: AuthRequest, res: Response) => {
  const data = await assignLead(Number(req.params.id), req.body ?? {}, ctx(req));
  return successResponse(res, "Lead assigned", data);
};

export const getLeadCalls = async (req: AuthRequest, res: Response) => {
  const data = await listLeadCalls(Number(req.params.id));
  return successResponse(res, "OK", data);
};

export const postLeadCall = async (req: AuthRequest, res: Response) => {
  const data = await logLeadCall(
    Number(req.params.id),
    req.body ?? {},
    ctx(req),
  );
  return successResponse(res, "Call logged", data, 201);
};

export const postStartLeadTrial = async (req: AuthRequest, res: Response) => {
  const data = await startLeadTrial(
    Number(req.params.id),
    req.body ?? {},
    ctx(req),
  );
  return successResponse(res, "Trial started", data);
};

export const postConvertLead = async (req: AuthRequest, res: Response) => {
  const data = await convertLead(
    Number(req.params.id),
    req.body ?? {},
    ctx(req),
  );
  return successResponse(res, "Lead converted", data);
};
