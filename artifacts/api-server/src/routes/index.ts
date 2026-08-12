import { Router, type IRouter } from "express";
import healthRouter from "./health";
import potholesRouter from "./potholes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(potholesRouter);

export default router;
