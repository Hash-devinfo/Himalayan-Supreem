import express, { type Express, type Request, type Response } from "express";
import mongoose from "mongoose";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import env from "./config/env.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import {
  categoryAdminRoutes,
  categoryPublicRoutes,
} from "./modules/categories/category.routes.js";
import {
  productAdminRoutes,
  productPublicRoutes,
} from "./modules/products/product.routes.js";
import { inventoryAdminRoutes } from "./modules/inventory/inventory.routes.js";
import { settingsAdminRoutes } from './modules/settings/settings.routes.js';
import { deliveryAdminRoutes, deliveryPublicRoutes } from './modules/delivery/delivery.routes.js';
import { cartRoutes } from './modules/cart/cart.routes.js';
import { checkoutRoutes } from './modules/checkout/checkout.routes.js';
import { orderAdminRoutes } from './modules/orders/order.routes.js';
import { orderPublicRoutes } from './modules/orders/orderPublic.routes.js';






const app: Express = express();

// 0. Server settings
if (env.isProduction) {
  app.set("trust proxy", 1);
}
app.disable("x-powered-by");

// 1. Security and parsing (run on every request)
app.use(helmet());
app.use(cors({ origin: env.clientUrls, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

if (!env.isProduction) {
  app.use(morgan("dev"));
}

// 2. Rate limit for all API routes
app.use("/api", apiLimiter);

// 3. Routes
app.get("/api/health", (_req: Request, res: Response) => {
  const dbConnected = mongoose.connection.readyState === 1;

  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    status: dbConnected ? "ok" : "degraded",
    database: dbConnected ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/admin/auth", authRoutes);
app.use("/api/categories", categoryPublicRoutes);
app.use("/api/admin/categories", categoryAdminRoutes);
app.use("/api/products", productPublicRoutes);
app.use("/api/admin/products", productAdminRoutes);
app.use("/api/admin/inventory", inventoryAdminRoutes);
app.use('/api/admin/settings', settingsAdminRoutes);
app.use('/api/delivery', deliveryPublicRoutes);
app.use('/api/admin/delivery', deliveryAdminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/admin/orders', orderAdminRoutes);
app.use('/api/orders', orderPublicRoutes);









// 4. Error handling (must be last)
app.use(notFound);
app.use(errorHandler);

export default app;
