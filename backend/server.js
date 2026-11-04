import "dotenv/config";
import express from "express";
import nodemailer from "nodemailer";
import { Pool } from "pg";
import * as cheerio from "cheerio";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// 1. Configuración de rutas para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// 2. Apuntar a los archivos estáticos de React (retrocediendo una carpeta)
app.use(express.static(path.join(__dirname, "../frontend/dist")));

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let estadoEnvio = { activo: false, total: 0, enviados: 0, errores: 0, log: [] };

const initDB = async () => {
	try {
		await pool.query(`
      CREATE TABLE IF NOT EXISTS clicks (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255),
        original_url TEXT,
        campana TEXT,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      /* AÑADIR LA NUEVA COLUMNA SI NO EXISTE */
      ALTER TABLE clicks ADD COLUMN IF NOT EXISTS nombre_enlace VARCHAR(255);
      
      CREATE TABLE IF NOT EXISTS contactos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS historial_envios (
        id SERIAL PRIMARY KEY,
        campana TEXT,
        nombre VARCHAR(255),
        email VARCHAR(255),
        estado VARCHAR(50),
        detalle TEXT,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
		console.log("✅ PostgreSQL conectado y tablas listas.");
	} catch (err) {
		console.error("❌ Error conectando a PostgreSQL:", err.message);
	}
};
initDB();

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});

// --- ENDPOINTS DE CONTACTOS ---
app.get("/api/contactos", async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT * FROM contactos ORDER BY nombre ASC",
		);
		res.json(result.rows);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.post("/api/contactos-bulk", async (req, res) => {
	const { contactos } = req.body;
	if (!Array.isArray(contactos))
		return res.status(400).json({ error: "Formato inválido" });

	let agregados = 0;
	try {
		for (const c of contactos) {
			if (c.email) {
				await pool.query(
					`INSERT INTO contactos (nombre, email) VALUES ($1, $2) 
           ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre`,
					[c.nombre || "", c.email],
				);
				agregados++;
			}
		}
		res.json({ success: true, procesados: agregados });
	} catch (err) {
		res.status(500).json({ error: "Error procesando la base de datos." });
	}
});

app.delete("/api/contactos/:email", async (req, res) => {
	try {
		await pool.query("DELETE FROM contactos WHERE email = $1", [
			req.params.email,
		]);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

// --- ENDPOINT DE ENVÍO CON GOTEO (THROTTLING) ---
app.post("/api/send-background", async (req, res) => {
	const { recipients, subject, htmlContent, mensaje } = req.body;
	const campana = subject || "Campaña sin nombre";

	if (estadoEnvio.activo)
		return res.status(400).json({ error: "Ya hay una campaña en curso." });
	if (
		!Array.isArray(recipients) ||
		recipients.length === 0 ||
		!subject ||
		(!htmlContent && !mensaje)
	) {
		return res.status(400).json({ error: "Datos inválidos." });
	}

	estadoEnvio = {
		activo: true,
		total: recipients.length,
		enviados: 0,
		errores: 0,
		log: [],
	};
	res.status(200).json({ message: "Proceso iniciado en segundo plano." });

	(async () => {
		let baseHtml = "";
		const mensajeFormateado = mensaje
			? `<div style="font-family: Arial, sans-serif; padding: 20px;">${mensaje.replace(/\n/g, "<br>")}</div>`
			: "";
		if (mensaje && htmlContent) baseHtml = mensajeFormateado + htmlContent;
		else if (mensaje) baseHtml = mensajeFormateado;
		else baseHtml = htmlContent;

		const LOTE = 100;
		const ESPERA_LOTE = 5 * 60 * 1000;
		const ESPERA_CORREO = 1000;

		for (let i = 0; i < recipients.length; i++) {
			const { email, nombre = "" } = recipients[i];

			try {
				let finalHtml = baseHtml;
				if (baseHtml) {
					const $ = cheerio.load(baseHtml);
					$("a").each((idx, link) => {
						const originalUrl = $(link).attr("href");
						if (originalUrl && originalUrl.startsWith("http")) {
							// EXTRAER EL TEXTO O EL ATRIBUTO ALT DE LA IMAGEN
							let textName = $(link).text().trim();
							if (!textName) {
								textName =
									$(link).find("img").attr("alt") || "Enlace sin nombre";
							}

							const trackUrl = new URL("/track", BASE_URL);
							trackUrl.searchParams.append("url", originalUrl);
							trackUrl.searchParams.append("email", email);
							trackUrl.searchParams.append("campana", campana);
							trackUrl.searchParams.append("nombre_enlace", textName); // <- SE ENVÍA EL DATO

							$(link).attr("href", trackUrl.toString());
						}
					});
					finalHtml = $.html();
				}

				await transporter.sendMail({
					from: `"Mailing" <${process.env.EMAIL_USER}>`,
					to: email,
					subject: subject,
					text: mensaje || "",
					html: finalHtml,
				});

				await pool.query(
					`INSERT INTO historial_envios (campana, nombre, email, estado, detalle) VALUES ($1, $2, $3, $4, $5)`,
					[campana, nombre, email, "ENVIADO", ""],
				);

				estadoEnvio.enviados++;
				estadoEnvio.log.push({ email, status: "ok" });
			} catch (error) {
				await pool.query(
					`INSERT INTO historial_envios (campana, nombre, email, estado, detalle) VALUES ($1, $2, $3, $4, $5)`,
					[campana, nombre, email, "FALLÓ", error.message],
				);
				estadoEnvio.errores++;
				estadoEnvio.log.push({
					email,
					status: "error",
					detalle: error.message,
				});
			}

			if ((i + 1) % LOTE === 0 && i + 1 !== recipients.length) {
				estadoEnvio.log.push({
					email: "SISTEMA",
					status: "ok",
					detalle: `Pausando 5 min (Anti-Spam)...`,
				});
				await new Promise((resolve) => setTimeout(resolve, ESPERA_LOTE));
			} else {
				await new Promise((resolve) => setTimeout(resolve, ESPERA_CORREO));
			}
		}
		estadoEnvio.activo = false;
	})();
});

app.get("/api/status-envio", (req, res) => res.json(estadoEnvio));

// --- REPORTES Y ESTADÍSTICAS ---
app.get("/api/reporte-envios", async (req, res) => {
	try {
		const result = await pool.query(`
      SELECT TO_CHAR(fecha, 'YYYY-MM-DD HH24:MI:SS') as fecha_envio, campana, nombre, email, estado, detalle
      FROM historial_envios ORDER BY id DESC LIMIT 5000
    `);
		const header = ["Fecha", "Campaña", "Nombre", "Email", "Estado", "Detalle"];
		const rows = result.rows.map((r) =>
			[
				`"${r.fecha_envio}"`,
				`"${r.campana}"`,
				`"${r.nombre}"`,
				`"${r.email}"`,
				`"${r.estado}"`,
				`"${r.detalle || ""}"`,
			].join(","),
		);
		const csvContent = [header.join(","), ...rows].join("\n");
		res.setHeader("Content-Type", "text/csv; charset=utf-8");
		res.setHeader(
			"Content-Disposition",
			'attachment; filename="reporte_envios.csv"',
		);
		res.send("\uFEFF" + csvContent);
	} catch (err) {
		res.status(500).send("Error generando reporte");
	}
});

app.get("/track", async (req, res) => {
	// RECUPERAR LA NUEVA VARIABLE DESDE LA URL
	const { url, email, campana, nombre_enlace } = req.query;
	if (!url) return res.redirect("https://www.google.com");
	try {
		await pool.query(
			// INSERTARLA EN LA BASE DE DATOS
			`INSERT INTO clicks (email, original_url, campana, nombre_enlace) VALUES ($1, $2, $3, $4)`,
			[email, url, campana, nombre_enlace || "Enlace"],
		);
	} catch (err) {
		console.error(err.message);
	}
	res.redirect(url);
});

app.get("/api/stats", async (req, res) => {
	try {
		res.json(
			(
				await pool.query(
					`SELECT original_url, campana, COUNT(*) as click_count FROM clicks GROUP BY original_url, campana ORDER BY click_count DESC`,
				)
			).rows,
		);
	} catch (err) {
		res.status(500).json({ error: "Error" });
	}
});

app.get("/api/clicks-detail", async (req, res) => {
	try {
		res.json(
			(
				await pool.query(
					// TRAER LA NUEVA COLUMNA AL FRONTEND
					`SELECT email, original_url, campana, fecha, nombre_enlace FROM clicks ORDER BY fecha DESC`,
				)
			).rows,
		);
	} catch (err) {
		res.status(500).json({ error: "Error" });
	}
});

// 3. Catch-all: Si la ruta no es una API, entrégasela a React
app.get("*", (req, res) => {
	res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend ejecutándose en puerto ${PORT}`));
