import { Response } from "express";
import { paginatedResponse, successResponse } from "../utils/apiResponse";
import { AuthRequest } from "../middlewares/superAdminAuth";
import { clientIp } from "../utils/clientIp";
import {
  acceptQuoteById,
  createQuote,
  listQuotes,
  rejectQuote,
  sendQuote,
  updateQuote,
} from "../services/quoteService";

const ctx = (req: AuthRequest) => ({
  actorUserId: req.user?.id,
  ip: clientIp(req),
});

export const getQuotes = async (req: AuthRequest, res: Response) => {
  const { data, page, limit, total } = await listQuotes(req.query ?? {});
  return paginatedResponse(res, "OK", data, { page, limit, total });
};

export const postQuote = async (req: AuthRequest, res: Response) => {
  const data = await createQuote(req.body ?? {}, ctx(req));
  return successResponse(res, "Quote created", data, 201);
};

export const putQuote = async (req: AuthRequest, res: Response) => {
  const data = await updateQuote(
    Number(req.params.id),
    req.body ?? {},
    ctx(req),
  );
  return successResponse(res, "Quote updated", data);
};

export const postSendQuote = async (req: AuthRequest, res: Response) => {
  const data = await sendQuote(Number(req.params.id), ctx(req));
  return successResponse(res, "Quote sent", data);
};

export const postAcceptQuote = async (req: AuthRequest, res: Response) => {
  const data = await acceptQuoteById(
    Number(req.params.id),
    req.body ?? {},
    ctx(req),
  );
  return successResponse(res, "Quote accepted", data);
};

export const postRejectQuote = async (req: AuthRequest, res: Response) => {
  const data = await rejectQuote(
    Number(req.params.id),
    req.body ?? {},
    ctx(req),
  );
  return successResponse(res, "Quote rejected", data);
};
