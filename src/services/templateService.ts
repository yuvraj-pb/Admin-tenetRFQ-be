import SolutionTemplate from "../database/models/solutionTemplate";
import { MODULE_FLAG_KEYS } from "../utils/entitlements";
import { catalogToMarketing } from "../utils/onboardingMaps";

export const SEED_TEMPLATES = [
  {
    id: "procurement",
    name: "Procurement Suite",
    pitch: "Run RFQs, collect quotes and negotiate in one workspace.",
    best_for: "Buyers who need a clean RFQ-to-quote flow.",
    module_keys: [
      "rfqCore",
      "quotes",
      "negotiations",
      "users",
      "notifications",
      "analytics",
    ],
    base_plan_code: "basic",
    price_from_monthly: 4999,
    active: true,
  },
  {
    id: "suppliers",
    name: "Supplier Hub",
    pitch: "Work with your supplier network and give them a portal.",
    best_for: "Teams that source from a regular supplier base.",
    module_keys: [
      "rfqCore",
      "quotes",
      "supplierNetwork",
      "supplierPortal",
      "users",
      "notifications",
    ],
    base_plan_code: "professional",
    price_from_monthly: 14999,
    active: true,
  },
  {
    id: "operations",
    name: "Operations Desk",
    pitch: "Orders, dispatch, deliveries and quality in one desk.",
    best_for: "Operations teams moving work after the quote is won.",
    module_keys: [
      "rfqCore",
      "quotes",
      "orders",
      "dispatch",
      "deliveries",
      "quality",
      "branches",
    ],
    base_plan_code: "professional",
    price_from_monthly: 14999,
    active: true,
  },
  {
    id: "control",
    name: "Control & Approvals",
    pitch: "Approvals, deletion checks and role-based control.",
    best_for: "Organisations that need makers, checkers and an audit trail.",
    module_keys: [
      "rfqCore",
      "approvalWorkflow",
      "rfqDeletionApprovals",
      "approvalsHub",
      "roles",
      "analytics",
    ],
    base_plan_code: "professional",
    price_from_monthly: 14999,
    active: true,
  },
  {
    id: "full-rfq",
    name: "Full RFQ Platform",
    pitch:
      "Every RFQ Cloud module — procurement, suppliers, operations and control.",
    best_for: "Companies standardising the full source-to-settle process.",
    module_keys: [...MODULE_FLAG_KEYS],
    base_plan_code: "enterprise",
    price_from_monthly: 49999,
    active: true,
  },
];

export const seedSolutionTemplates = async () => {
  for (const row of SEED_TEMPLATES) {
    const existing = await SolutionTemplate.findByPk(row.id);
    if (existing) await existing.update(row as any);
    else await SolutionTemplate.create(row as any);
  }
};

export const listPublicTemplates = async () => {
  const count = await SolutionTemplate.count();
  if (!count) await seedSolutionTemplates();
  const rows = await SolutionTemplate.findAll({
    where: { active: true },
    order: [["id", "ASC"]],
  });
  const order = [
    "procurement",
    "suppliers",
    "operations",
    "control",
    "full-rfq",
  ];
  return rows
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    .map((row) => ({
    id: row.id,
    name: row.name,
    pitch: row.pitch ?? "",
    bestFor: row.best_for ?? "",
    modules: Array.isArray(row.module_keys) ? row.module_keys : [],
    basePlan: catalogToMarketing(row.base_plan_code),
    priceFromMonthly:
      row.price_from_monthly != null ? Number(row.price_from_monthly) : null,
  }));
};

export const getTemplateById = async (id: string) => {
  const row = await SolutionTemplate.findByPk(id);
  return row;
};
