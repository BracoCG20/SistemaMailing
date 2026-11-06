// backend/src/routes/api.routes.js
import { Router } from "express";
import {
	obtenerContactos,
	importarContactosBulk,
	eliminarContacto,
} from "../controllers/contact.controller.js";
import {
	iniciarCampana,
	obtenerEstadoEnvio,
	cancelarCampana,
	limpiarRebotes,
} from "../controllers/campaign.controller.js";
import {
	descargarReporteEnvios,
	obtenerStatsResumen,
	obtenerClicksDetalle,
} from "../controllers/stats.controller.js";
import {
	requireAdminKey,
	verificarAdminKey,
} from "../middlewares/auth.middleware.js";

const router = Router();

// Verificación de clave para desbloquear el modo Admin en el Frontend
router.post("/verify-admin", verificarAdminKey);

// Contactos (Protegido solo para ti)
router.get("/contactos", requireAdminKey, obtenerContactos);
router.post("/contactos-bulk", requireAdminKey, importarContactosBulk);
router.delete("/contactos/:email", requireAdminKey, eliminarContacto);

// Campañas y Cola (Protegido solo para ti)
router.post("/send-background", requireAdminKey, iniciarCampana);
router.get("/status-envio", requireAdminKey, obtenerEstadoEnvio);
router.post("/cancelar-envio", requireAdminKey, cancelarCampana);
router.post("/limpiar-rebotes", requireAdminKey, limpiarRebotes);
router.get("/reporte-envios", requireAdminKey, descargarReporteEnvios);

// Estadísticas Públicas (Para Dashboard Visual y Tablas de Datos)
router.get("/stats", obtenerStatsResumen);
router.get("/clicks-detail", obtenerClicksDetalle);

export default router;
