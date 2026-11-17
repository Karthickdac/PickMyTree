import { Router, type IRouter } from "express";
import healthRouter from "./health";
import publicRouter from "./platform-public";
import accountRouter from "./platform-account";
import workspaceRouter from "./platform-workspace";
import farmManagementRouter from "./farm-management";
import catalogueImagesRouter from "./catalogue-images";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicRouter);
router.use(accountRouter);
router.use(workspaceRouter);
router.use(farmManagementRouter);
router.use(catalogueImagesRouter);

export default router;
