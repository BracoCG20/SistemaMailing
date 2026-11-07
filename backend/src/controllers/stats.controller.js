// backend/src/controllers/stats.controller.js
import { pool } from "../config/db.js";
import { sincronizarRebotesIMAP } from "../services/bounderReader.service.js";
import { NOMBRE_REMITENTE } from "../config/mailer.js";

const decodificarParametro = (valor = "") => {
	if (!valor || typeof valor !== "string") return "";
	let limpio = valor;
	try {
		limpio = decodeURIComponent(limpio.replace(/\+/g, " "));
		if (limpio.includes("%")) {
			limpio = decodeURIComponent(limpio);
		}
	} catch {
		// Fallback manual si viene mal formado
	}
	return limpio
		.replace(/%40/gi, "@")
		.replace(/%3A/gi, ":")
		.replace(/%2F/gi, "/")
		.replace(/\+/g, " ")
		.trim();
};

// Detecta si quien abre el enlace es un bot de seguridad de correo (SafeLinks, Mimecast, Barracuda, etc.)
const esBotDeSeguridad = (req) => {
	// Los bots de pre-escaneo suelen hacer peticiones HEAD en vez de GET
	if (req.method && req.method.toUpperCase() !== "GET") return true;

	const ua = (req.headers["user-agent"] || "").toLowerCase();
	if (!ua || ua.length < 15) return true;

	const patronesBot = [
		"bot",
		"spider",
		"crawl",
		"slurp",
		"headless",
		"python",
		"curl",
		"wget",
		"axios",
		"node-fetch",
		"go-http-client",
		"java/",
		"proofpoint",
		"mimecast",
		"barracuda",
		"safelinks",
		"ATP",
		"office365",
		"microsoft office",
		"ms-office",
		"symantec",
		"Sophos",
		"trendmicro",
		"kaspersky",
		"bitdefender",
		"fortinet",
		"urlscan",
		"whatsapp",
		"facebookexternalhit",
	];

	return patronesBot.some((patron) => ua.includes(patron.toLowerCase()));
};

export const descargarReporteEnvios = async (req, res) => {
	try {
		// 1. Antes de exportar, sincronizamos por IMAP los rebotes reales de las campañas
		const campanaEspecifica = req.query.campana || null;
		await sincronizarRebotesIMAP(campanaEspecifica);

		// 2. Consultamos el historial actualizado con los motivos detallados de cada rebote
		const result = await pool.query(`
            SELECT 
                TO_CHAR(h.fecha, 'YYYY-MM-DD HH24:MI:SS') as fecha_envio,
                h.campana,
                COALESCE(NULLIF(TRIM(h.nombre), ''), NULLIF(TRIM(co.nombre), ''), '') as nombre,
                h.email,
                h.estado,
                CASE 
                    WHEN h.estado = 'ENVIADO' AND (h.detalle IS NULL OR h.detalle = '') 
                        THEN 'Entregado correctamente al servidor destino'
                    ELSE h.detalle
                END as detalle
            FROM historial_envios h
            LEFT JOIN contactos co ON LOWER(TRIM(h.email)) = LOWER(TRIM(co.email))
            ORDER BY h.id DESC
            LIMIT 5000
        `);

		const header = [
			"Fecha",
			"Campaña",
			"Nombre",
			"Email",
			"Estado de recepción",
			"Diagnóstico / Motivo detallado",
		];
		const rows = result.rows.map((r) =>
			[
				`"${r.fecha_envio}"`,
				`"${r.campana}"`,
				`"${r.nombre}"`,
				`"${r.email}"`,
				`"${r.estado}"`,
				`"${(r.detalle || "").replace(/"/g, '""')}"`,
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
		console.error("Error generando reporte:", err.message);
		res.status(500).send("Error generando reporte");
	}
};

export const obtenerStatsResumen = async (req, res) => {
	try {
		const result = await pool.query(`
            SELECT 
                original_url, 
                campana, 
                COUNT(*) as click_count 
            FROM clicks 
            WHERE email IS NOT NULL 
              AND email != 'null' 
              AND email != 'undefined' 
              AND TRIM(email) != ''
            GROUP BY original_url, campana 
            ORDER BY click_count DESC
        `);
		res.json(result.rows);
	} catch {
		res.status(500).json({ error: "Error" });
	}
};

export const obtenerClicksDetalle = async (req, res) => {
	try {
		const result = await pool.query(`
            SELECT 
                c.email,
                COALESCE(
                    NULLIF(TRIM(co.nombre), ''),
                    (
                        SELECT NULLIF(TRIM(h.nombre), '')
                        FROM historial_envios h
                        WHERE LOWER(TRIM(h.email)) = LOWER(TRIM(c.email))
                          AND NULLIF(TRIM(h.nombre), '') IS NOT NULL
                        ORDER BY h.id DESC
                        LIMIT 1
                    ),
                    (
                        SELECT NULLIF(TRIM(cd.nombre), '')
                        FROM cola_destinatarios cd
                        WHERE LOWER(TRIM(cd.email)) = LOWER(TRIM(c.email))
                          AND NULLIF(TRIM(cd.nombre), '') IS NOT NULL
                        ORDER BY cd.id DESC
                        LIMIT 1
                    )
                ) AS usuario_nombre,
                c.original_url,
                c.campana,
                c.fecha,
                c.nombre_enlace
            FROM clicks c
            LEFT JOIN contactos co ON LOWER(TRIM(c.email)) = LOWER(TRIM(co.email))
            ORDER BY c.fecha DESC
        `);
		res.json(result.rows);
	} catch (err) {
		console.error("Error obteniendo detalle de clics:", err.message);
		res.status(500).json({ error: "Error" });
	}
};

export const registrarClickYRedirigir = async (req, res) => {
	const rawUrl = req.query.url;
	if (!rawUrl) return res.redirect("https://www.google.com");

	const urlLimpia = decodificarParametro(rawUrl);
	const emailLimpio = decodificarParametro(req.query.email);
	const campanaLimpia = decodificarParametro(req.query.campana);
	const enlaceLimpio =
		decodificarParametro(req.query.nombre_enlace) || "Enlace";

	// 1. Si no tiene correo válido o si es un Bot de seguridad escaneando el correo,
	// redirigimos limpiamente pero NO guardamos el clic falso en la BD.
	if (
		!emailLimpio ||
		emailLimpio === "null" ||
		emailLimpio === "undefined" ||
		!emailLimpio.includes("@") ||
		esBotDeSeguridad(req)
	) {
		return res.redirect(urlLimpia);
	}

	try {
		// 2. Evitar doble clic robótico en el mismo segundo (Debounce de 3 segundos por usuario + URL)
		const checkReciente = await pool.query(
			`SELECT id FROM clicks 
             WHERE LOWER(email) = LOWER($1) 
               AND original_url = $2 
               AND fecha >= NOW() - INTERVAL '3 seconds' 
             LIMIT 1`,
			[emailLimpio, urlLimpia],
		);

		if (checkReciente.rows.length === 0) {
			await pool.query(
				`INSERT INTO clicks (email, original_url, campana, nombre_enlace) VALUES ($1, $2, $3, $4)`,
				[emailLimpio, urlLimpia, campanaLimpia, enlaceLimpio],
			);
		}
	} catch (err) {
		console.error(err.message);
	}
	res.redirect(urlLimpia);
};

const procesarBajaDB = async (email, campana) => {
	if (!email) return;
	const emailLimpio = decodificarParametro(email);
	const campanaLimpia = decodificarParametro(campana) || "General";
	try {
		await pool.query(
			`INSERT INTO bajas (email, campana) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING`,
			[emailLimpio, campanaLimpia],
		);
		await pool.query(`DELETE FROM contactos WHERE LOWER(email) = LOWER($1)`, [
			emailLimpio,
		]);
	} catch (err) {
		console.error("Error procesando baja:", err.message);
	}
};

export const vistaUnsubscribe = async (req, res) => {
	const email = decodificarParametro(req.query.email);
	const campana = decodificarParametro(req.query.campana);
	await procesarBajaDB(email, campana);

	res.setHeader("Content-Type", "text/html; charset=utf-8");
	res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>Suscripción cancelada | ${NOMBRE_REMITENTE}</title>
            <style>
                body {
                    margin: 0; padding: 0; background-color: #f4f4f5; color: #09090b;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    display: flex; align-items: center; justify-content: center; min-height: 100vh;
                }
                .card {
                    background: #ffffff; border: 1px solid #e4e4e7; border-radius: 10px;
                    padding: 36px 28px; max-width: 420px; width: 90%; text-align: center;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
                }
                .tag {
                    display: inline-block; background: #18181b; color: #fafafa;
                    font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
                    padding: 4px 10px; border-radius: 4px; margin-bottom: 16px;
                }
                h1 { font-size: 20px; margin: 0 0 10px 0; }
                p { font-size: 14px; color: #71717a; line-height: 1.5; margin: 0; }
                .email { color: #09090b; font-weight: 600; }
            </style>
        </head>
        <body>
            <div class="card">
                <span class="tag">${NOMBRE_REMITENTE}</span>
                <h1>Tu correo fue removido</h1>
                <p>
                    Hemos dado de baja la dirección 
                    <span class="email">${email ? email.replace(/</g, "&lt;") : ""}</span> 
                    de nuestra lista de envíos. Ya no recibirás nuevas campañas.
                </p>
            </div>
        </body>
        </html>
    `);
};

export const postUnsubscribeOneClick = async (req, res) => {
	const { email, campana } = req.query;
	await procesarBajaDB(email, campana);
	res.status(200).send("Unsubscribed");
};
