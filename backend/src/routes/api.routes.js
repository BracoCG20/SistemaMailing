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

const router = Router();

// Contactos
router.get("/contactos", obtenerContactos);
router.post("/contactos-bulk", importarContactosBulk);
router.delete("/contactos/:email", eliminarContacto);

// Campañas y Cola
router.post("/send-background", iniciarCampana);
router.get("/status-envio", obtenerEstadoEnvio);
router.post("/cancelar-envio", cancelarCampana);
router.post("/limpiar-rebotes", limpiarRebotes);

// Reportes y Estadísticas
router.get("/reporte-envios", descargarReporteEnvios);
router.get("/stats", obtenerStatsResumen);
router.get("/clicks-detail", obtenerClicksDetalle);

export default router;
