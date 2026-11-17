import { Router, type IRouter } from "express";
import healthRouter from "./health";
import publicRouter from "./platform-public";
import accountRouter from "./platform-account";
import workspaceRouter from "./platform-workspace";
import farmManagementRouter from "./farm-management";
import catalogueImagesRouter from "./catalogue-images";
import schemeManagementRouter from "./scheme-management";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicRouter);
router.use(accountRouter);
router.use(workspaceRouter);
router.use(schemeManagementRouter);
router.use(farmManagementRouter);
router.use(catalogueImagesRouter);

export default router;
