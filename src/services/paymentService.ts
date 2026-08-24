import PlatformPayment from "../database/models/platformPayment";
import { serializePayment } from "../utils/serializers";

export const listCompanyPayments = async (companyId: number) => {
  const rows = await PlatformPayment.findAll({
    where: { company_id: companyId },
    order: [["id", "DESC"]],
    limit: 50,
  });
  return rows.map(serializePayment);
};
