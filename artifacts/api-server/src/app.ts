import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { buildCorsOptions } from "./lib/cors";
import { attachUser } from "./lib/auth";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors(buildCorsOptions()));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Resolves the session cookie into req.user for every request without
// requiring one. Routes that write opt in to requireAuth individually.
app.use(attachUser);

app.use("/api", router);

// Anything a route handler passes to next() lands here. Without it Express
// prints the stack trace into the response body, which on a 500 would leak
// query fragments and file paths to whoever triggered it.
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  req.log?.error({ err }, "Unhandled error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong on our end" });
});

export default app;
