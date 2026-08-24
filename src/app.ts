import express from "express";
import dotenv from "dotenv";

dotenv.config();

import cors from "cors";
import sequelize from "./database/models/index";
import { associateModels } from "./database/models/associations";
import router from "./routes";
import { globalErrorHandler } from "./utils/errorHandler";
import { apiCallWrapper } from "./utils/apiResponse";
import {
  razorpayWebhook,
  stripeWebhook,
} from "./controllers/billing.controller";
import { hydrateCompanyFileSizes } from "./services/storageHydrate";

associateModels();

const app = express();
const PORT = Number(process.env.PORT) || 4005;
app.set("trust proxy", 1);

const corsOrigins = [
  "http://localhost:3000",
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
].filter((origin, index, all) => all.indexOf(origin) === index);

app.use(
  cors({
    origin: corsOrigins.length && !corsOrigins.includes("*") ? corsOrigins : true,
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
    ],
  }),
);

// Webhooks must receive the raw body for signature verification, so they are
// registered BEFORE express.json(). They are NOT behind Super Admin auth.
app.post(
  "/api/platform/billing/webhook/razorpay",
  express.raw({ type: "*/*" }),
  apiCallWrapper(razorpayWebhook),
);
app.post(
  "/api/platform/billing/webhook/stripe",
  express.raw({ type: "*/*" }),
  apiCallWrapper(stripeWebhook),
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "RFQ Cloud — Super Admin Platform API is running",
    docs: "Endpoints under /api — e.g. GET /api/health, GET /api/platform/dashboard",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "OK", timestamp: new Date().toISOString() });
});

app.use("/api", router);
app.use(globalErrorHandler);

sequelize
  .authenticate()
  .then(() => {
    console.log("DB Connected");
    app.listen(PORT, "0.0.0.0", () =>
      console.log(`Super Admin Platform API running on port ${PORT}`),
    );
    hydrateCompanyFileSizes().catch((err) =>
      console.error("[storage] hydrate failed:", (err as Error).message),
    ); // non-blocking; list uses stored byte sizes once hydrated
  })
  .catch((err) => console.error("Unable to connect to DB:", err));

export default app;
