import http from "http";
import https from "https";
import CompanyFile from "../database/models/companyFile";
import Company from "../database/models/company";

const HEAD_TIMEOUT_MS = 4000;

const headContentLength = (url: string): Promise<number> =>
  new Promise((resolve) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      resolve(0);
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      resolve(0);
      return;
    }
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      parsed,
      { method: "HEAD", timeout: HEAD_TIMEOUT_MS },
      (res) => {
        const loc = res.headers.location;
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && loc) {
          res.resume();
          headContentLength(new URL(loc, parsed).toString()).then(resolve);
          return;
        }
        const len = Number(res.headers["content-length"] || 0);
        res.resume();
        resolve(Number.isFinite(len) && len > 0 ? len : 0);
      },
    );
    req.on("error", () => resolve(0));
    req.on("timeout", () => {
      req.destroy();
      resolve(0);
    });
    req.end();
  });

const syncCompanyStoredBytes = async (companyId: number) => {
  const total = Number(
    (await CompanyFile.sum("byte_size", { where: { company_id: companyId } })) ||
      0,
  );
  const company = await Company.findByPk(companyId, {
    attributes: ["id", "storage_used_bytes"],
  });
  if (!company) return;
  if (total > Number(company.storage_used_bytes || 0)) {
    await company.update({ storage_used_bytes: total });
  }
};

/** HEAD company-owned file URLs that still have byte_size = 0 and persist sizes. */
export const hydrateCompanyFileSizes = async (): Promise<void> => {
  let rows: CompanyFile[] = [];
  try {
    rows = await CompanyFile.findAll({
      where: { byte_size: 0 },
      attributes: ["id", "company_id", "url", "byte_size"],
      limit: 200,
    });
  } catch {
    return;
  }
  if (!rows.length) return;

  const touched = new Set<number>();
  for (const row of rows) {
    const size = await headContentLength(row.url);
    if (size > 0) {
      await row.update({ byte_size: size });
      touched.add(row.company_id);
    }
  }
  await Promise.all([...touched].map(syncCompanyStoredBytes));
  if (touched.size) {
    console.log(`[storage] hydrated byte sizes for ${touched.size} tenant(s)`);
  }
};
