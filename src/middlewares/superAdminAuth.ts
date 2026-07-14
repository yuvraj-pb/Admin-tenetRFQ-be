import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import User from "../database/models/user";
import Role from "../database/models/role";
import { errorResponse } from "../utils/apiResponse";
import { isSuperAdminRole } from "../utils/roles";

export interface AuthRequest extends Request {
  user?: User;
}

/**
 * Verifies `Authorization: Bearer <jwt>` using the shared JWT_SECRET, loads the
 * user + role, and allows ONLY platform Super Admins. Applied to every
 * /platform/* route.
 */
export const superAdminMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return errorResponse(res, "Access Denied: No Token Provided", 401);
  }

  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET as string) as {
      id: number;
    };

    const user = await User.findByPk(id, {
      include: [{ model: Role, as: "userRole" }],
    });

    if (!user) return errorResponse(res, "User not found", 404);

    if (!isSuperAdminRole(user.userRole?.name)) {
      return errorResponse(res, "Access Denied: Super Admin only", 403);
    }

    // Hard rule: platform APIs never operate under a tenant company context.
    req.user = user;
    next();
  } catch {
    return errorResponse(res, "Invalid or Expired Token", 401);
  }
};

export { isSuperAdminRole };
