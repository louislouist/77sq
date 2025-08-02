import { Router } from "express";
import { rootPage } from "../controllers/root.controller";

const router = Router();

router.get('/', rootPage);

export default router;
