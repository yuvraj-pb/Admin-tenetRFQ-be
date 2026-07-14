import { Op } from "sequelize";
import User from "../database/models/user";
import Role from "../database/models/role";

export const findUserByEmail = (email: string) =>
  User.findOne({
    where: { email },
    include: [{ model: Role, as: "userRole" }],
  });

export const findUserByEmailOrMobile = (email: string, mobile?: string | null) =>
  User.findOne({
    where: mobile ? { [Op.or]: [{ email }, { mobile }] } : { email },
  });

export const createUserForCompany = (
  data: Record<string, unknown>,
  transaction?: any,
) => User.create(data as any, { transaction });
