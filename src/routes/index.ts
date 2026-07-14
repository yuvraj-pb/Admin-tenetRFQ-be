import express from "express";
import platformRoutes from "./platformRoutes";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "OK",
    timestamp: new Date().toISOString(),
  });
});

platformRoutes(router);

export default router;
