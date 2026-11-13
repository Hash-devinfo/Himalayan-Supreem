import { Router } from "express";
import { requireAdmin } from "../../middleware/requireAdmin.js";
import { validateBody } from "../../middleware/validate.js";
import * as orderController from "./order.controller.js";
import {
  cancelOrderSchema,
  declineCancellationSchema,
  logCallSchema,
  recordCancellationRequestSchema,
  updateNotesSchema,
} from "./order.validation.js";
import { packOrderSchema, unpackOrderSchema } from "./packing.validation.js";
import {
  deliverOrderSchema,
  failDeliverySchema,
  remitSchema,
  returnOrderSchema,
  shipOrderSchema,
} from "./fulfillment.validation.js";
import { updateContactSchema } from "./contact.validation.js";
import { manualOrderSchema } from './manualOrder.validation.js';

// Admin: /api/admin/orders  (:id = database ID or order number)
export const orderAdminRoutes = Router();

orderAdminRoutes.use(requireAdmin);

orderAdminRoutes.get("/", orderController.list);
// Before '/:id' routes, so "remit" is not read as an order
orderAdminRoutes.post(
  "/remit",
  validateBody(remitSchema),
  orderController.remit,
);

orderAdminRoutes.get("/:id", orderController.get);
orderAdminRoutes.post(
  "/:id/calls",
  validateBody(logCallSchema),
  orderController.logCall,
);
orderAdminRoutes.post(
  "/:id/cancel",
  validateBody(cancelOrderSchema),
  orderController.cancel,
);
orderAdminRoutes.patch(
  "/:id/notes",
  validateBody(updateNotesSchema),
  orderController.updateNotes,
);

// Packing (8B)
orderAdminRoutes.get("/:id/packing", orderController.packingPlan);
orderAdminRoutes.post(
  "/:id/pack",
  validateBody(packOrderSchema),
  orderController.pack,
);
orderAdminRoutes.post(
  "/:id/unpack",
  validateBody(unpackOrderSchema),
  orderController.unpack,
);
orderAdminRoutes.get("/:id/packing-slip", orderController.packingSlip);

// Delivery (8C)
orderAdminRoutes.post(
  "/:id/ship",
  validateBody(shipOrderSchema),
  orderController.ship,
);
orderAdminRoutes.post(
  "/:id/deliver",
  validateBody(deliverOrderSchema),
  orderController.deliver,
);
orderAdminRoutes.post(
  "/:id/fail",
  validateBody(failDeliverySchema),
  orderController.failDelivery,
);
orderAdminRoutes.post(
  "/:id/return",
  validateBody(returnOrderSchema),
  orderController.returnOrder,
);

// Cancellation requests (8D). Approving = POST /:id/cancel
orderAdminRoutes.post(
  "/:id/cancellation-request",
  validateBody(recordCancellationRequestSchema),
  orderController.recordCancellationRequest,
);
orderAdminRoutes.post(
  "/:id/cancellation-request/decline",
  validateBody(declineCancellationSchema),
  orderController.declineCancellationRequest,
);

// Address and contact before packing; invoice (12C)
orderAdminRoutes.patch(
  "/:id/contact",
  validateBody(updateContactSchema),
  orderController.updateContact,
);
orderAdminRoutes.get("/:id/invoice", orderController.invoice);
orderAdminRoutes.get("/couriers", orderController.couriers);
// Manual order for a WhatsApp or phone customer (13B)
orderAdminRoutes.post('/manual', validateBody(manualOrderSchema), orderController.createManual);