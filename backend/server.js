// backend/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { initDB } from "./src/config/db.js";
import { recuperarCampanaPendiente } from "./src/services/queueWorker.service.js";
import apiRoutes from "./src/routes/api.routes.js";
import publicRoutes from "./src/routes/public.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Inicializar PostgreSQL y retomar campañas activas si el VPS se reinició
initDB(recuperarCampanaPendiente);

// Rutas modulares
app.use("/api", apiRoutes);
app.use("/", publicRoutes);

// Fallback SPA para React
app.get("*", (req, res) => {
	res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
	console.log(`🚀 Backend ejecutándose en puerto ${PORT}`),
);
