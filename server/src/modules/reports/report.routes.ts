import { Router } from "express";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import * as reportController from "./report.controller.js";

// Admin: /api/admin/reports  (all read-only)
export const reportAdminRoutes = Router();

reportAdminRoutes.use(requireAdmin);

// ?from=2026-11-01&to=2026-11-30&groupBy=day|product|variant|category|courier
reportAdminRoutes.get("/sales", reportController.sales);

// ?from=2026-11-01&to=2026-11-30
reportAdminRoutes.get("/profit", reportController.profit);

// Stock now, low stock, expiry; ?from&to for stock movements
reportAdminRoutes.get("/inventory", reportController.inventory);

// Orders by status, courier performance, failures, COD held and remitted
reportAdminRoutes.get("/fulfillment", reportController.fulfillment);

// Cancellations by type and reason; refunds by reason, method and product; open refunds
reportAdminRoutes.get("/cancellations", reportController.cancellations);

// Website analytics: visitors, funnel, top products and searches, traffic sources, abandoned carts
reportAdminRoutes.get("/analytics", reportController.analytics);

// Risk overview: refusals and cancellations by city and by phone number
reportAdminRoutes.get("/risk", reportController.risk);
