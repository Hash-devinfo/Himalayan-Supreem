import express, { type Express, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import env from "./config/env.js";

const app: Express = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrls, credentials: true }));
app.use(express.json({ limit: "200kb" }));

if (!env.isProduction) {
  app.use(morgan("dev"));
}

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export default app;
