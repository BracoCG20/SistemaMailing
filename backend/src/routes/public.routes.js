import { Router } from "express";
import {
	registrarClickYRedirigir,
	vistaUnsubscribe,
	postUnsubscribeOneClick,
} from "../controllers/stats.controller.js";

const router = Router();

router.get("/track", registrarClickYRedirigir);
router.get("/unsubscribe", vistaUnsubscribe);
router.post("/unsubscribe", postUnsubscribeOneClick);

export default router;
