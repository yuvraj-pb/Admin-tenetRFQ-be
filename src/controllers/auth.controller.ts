import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { Op } from "sequelize";
import User from "../database/models/user";
import Role from "../database/models/role";
import { roleToSlug } from "../database/models/role";
import { isSuperAdminRole } from "../utils/roles";
import { errorResponse, successResponse } from "../utils/apiResponse";

function signToken(userId: number, extra: Record<string, unknown> = {}, expiresIn: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  return jwt.sign({ id: userId, ...extra }, secret, { expiresIn } as jwt.SignOptions);
}

function authPayload(user: User) {
  const roleName = user.userRole?.name || "";
  const slug = roleToSlug(roleName) || "super-admin";
  return {
    token: signToken(user.id, {}, "12h"),
    refreshToken: signToken(user.id, { type: "refresh" }, "7d"),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: slug,
      roleSlug: slug,
      permissions: [] as string[],
      mobile: user.mobile,
    },
  };
}

export async function login(req: Request, res: Response) {
  const email = String(req.body?.email || "").trim();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return errorResponse(res, "Email and password are required", 400);
  }

  const user = await User.findOne({
    where: { email: { [Op.iLike]: email } },
    include: [{ model: Role, as: "userRole" }],
  });

  if (!user || !(await user.validatePassword(password))) {
    return errorResponse(res, "Invalid email or password", 401);
  }

  if (!user.isActive) {
    return errorResponse(res, "Account is disabled", 403);
  }

  if (!isSuperAdminRole(user.userRole?.name)) {
    return errorResponse(res, "You are not authorized for the admin panel.", 403);
  }

  user.lastLogin = new Date();
  await user.save();

  return successResponse(res, "Login successful", authPayload(user));
}

/** FE Axios interceptor: body { refreshToken } → new access + refresh tokens. */
export async function refreshToken(req: Request, res: Response) {
  const raw = String(req.body?.refreshToken || "").trim();
  if (!raw) {
    return errorResponse(res, "refreshToken is required", 400);
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return errorResponse(res, "JWT_SECRET is not set", 500);
  }

  let payload: { id?: number; type?: string };
  try {
    payload = jwt.verify(raw, secret) as { id?: number; type?: string };
  } catch {
    return errorResponse(res, "Invalid or expired refresh token", 401);
  }

  if (payload.type !== "refresh" || !payload.id) {
    return errorResponse(res, "Invalid refresh token", 401);
  }

  const user = await User.findByPk(payload.id, {
    include: [{ model: Role, as: "userRole" }],
  });

  if (!user || !user.isActive) {
    return errorResponse(res, "User not found or disabled", 401);
  }

  if (!isSuperAdminRole(user.userRole?.name)) {
    return errorResponse(res, "You are not authorized for the admin panel.", 403);
  }

  return successResponse(res, "Token refreshed", authPayload(user));
}
