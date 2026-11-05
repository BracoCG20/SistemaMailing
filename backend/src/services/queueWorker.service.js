import * as cheerio from "cheerio";
import { pool } from "../config/db.js";
import { transporter, NOMBRE_REMITENTE, BASE_URL } from "../config/mailer.js";

const LIMITE_DIARIO_SEGURO = 1850;
const LOTE_TAMANO = 100;
const MAX_ERRORES_CONSECUTIVOS = 5;

let workerCorriendo = false;

export let estadoEnvio = {
	activo: false,
	cancelado: false,
	campanaId: null,
	total: 0,
	enviados: 0,
	errores: 0,
	log: [],
};

export const isWorkerRunning = () => workerCorriendo;

export const resetEstadoEnvio = (campanaId, total) => {
	estadoEnvio = {
		activo: true,
		cancelado: false,
		campanaId,
		total,
		enviados: 0,
		errores: 0,
		log: [],
	};
};

export const solicitarCancelacion = () => {
	if (!estadoEnvio.activo) return false;
	estadoEnvio.cancelado = true;
	agregarLog(
		"SISTEMA",
		"error",
		"⏳ Solicitud de detención recibida. Cerrando proceso tras el correo actual...",
	);
	return true;
};

export const agregarLog = (email, status, detalle = "") => {
	const hora = new Date().toLocaleTimeString("es-PE", {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
	const textoDetalle = detalle ? `[${hora}] ${detalle}` : `[${hora}]`;
	estadoEnvio.log.push({ email, status, detalle: textoDetalle });
	if (estadoEnvio.log.length > 80) {
		estadoEnvio.log = estadoEnvio.log.slice(-80);
	}
	console.log(`[MAILING] ${email} (${status}): ${detalle}`);
};

const sleepRandom = (minMs, maxMs) => {
	const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
	return new Promise((resolve) => setTimeout(resolve, ms));
};

const construirHtmlConTracking = (
	baseHtml,
	email,
	nombreCampana,
	unsubscribeUrl,
) => {
	if (!baseHtml) return "";
	const $ = cheerio.load(baseHtml);

	$("a").each((idx, link) => {
		const originalUrl = $(link).attr("href");
		if (
			originalUrl &&
			originalUrl.startsWith("http") &&
			!originalUrl.includes("/unsubscribe")
		) {
			let textName = $(link).text().trim();
			if (!textName) {
				textName = $(link).find("img").attr("alt") || "Enlace sin nombre";
			}

			const trackUrl = new URL("/track", BASE_URL);
			trackUrl.searchParams.append("url", originalUrl);
			trackUrl.searchParams.append("email", email);
			trackUrl.searchParams.append("campana", nombreCampana);
			trackUrl.searchParams.append("nombre_enlace", textName);

			$(link).attr("href", trackUrl.toString());
		}
	});

	const footerBaja = `
        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eaeaea; text-align: center; font-family: Arial, sans-serif; font-size: 11px; color: #888888;">
            Enviado por <strong>${NOMBRE_REMITENTE}</strong> · 
            <a href="${unsubscribeUrl}" style="color: #666666; text-decoration: underline;" target="_blank">Darse de baja</a>
        </div>
    `;

	if ($("body").length > 0) {
		$("body").append(footerBaja);
	} else {
		$.root().append(footerBaja);
	}

	return $.html();
};

export const recuperarCampanaPendiente = async () => {
	try {
		const res = await pool.query(
			`SELECT * FROM cola_campanas WHERE estado = 'ACTIVA' ORDER BY id DESC LIMIT 1`,
		);
		if (res.rows.length > 0) {
			const camp = res.rows[0];
			estadoEnvio = {
				activo: true,
				cancelado: false,
				campanaId: camp.id,
				total: camp.total,
				enviados: camp.enviados,
				errores: camp.errores,
				log: [],
			};
			agregarLog(
				"SISTEMA",
				"ok",
				`♻️ Servidor reiniciado: Retomando campaña "${camp.subject}" (${camp.enviados}/${camp.total} procesados).`,
			);
			procesarColaPersistente(camp.id);
		}
	} catch (err) {
		console.error("Error verificando campañas pendientes:", err.message);
	}
};

export const procesarColaPersistente = async (campanaId) => {
	if (workerCorriendo) return;
	workerCorriendo = true;

	let erroresConsecutivos = 0;
	let enviadosEnSesion = 0;

	try {
		const campRes = await pool.query(
			`SELECT * FROM cola_campanas WHERE id = $1`,
			[campanaId],
		);
		if (campRes.rows.length === 0) {
			workerCorriendo = false;
			estadoEnvio.activo = false;
			return;
		}

		const {
			subject: nombreCampana,
			base_html: baseHtml = "",
			mensaje: mensajeTexto = "",
		} = campRes.rows[0];

		while (true) {
			if (estadoEnvio.cancelado) {
				await pool.query(
					`UPDATE cola_campanas SET estado = 'CANCELADA' WHERE id = $1`,
					[campanaId],
				);
				agregarLog(
					"SISTEMA",
					"error",
					"🛑 Envío detenido manualmente por el usuario.",
				);
				break;
			}

			const nextRes = await pool.query(
				`SELECT * FROM cola_destinatarios WHERE campana_id = $1 AND estado = 'PENDIENTE' ORDER BY id ASC LIMIT 1`,
				[campanaId],
			);

			if (nextRes.rows.length === 0) {
				await pool.query(
					`UPDATE cola_campanas SET estado = 'COMPLETADA' WHERE id = $1`,
					[campanaId],
				);
				agregarLog(
					"SISTEMA",
					"ok",
					`🎉 Campaña "${nombreCampana}" completada con éxito.`,
				);
				break;
			}

			const destinatario = nextRes.rows[0];
			const email = destinatario.email.trim();
			const nombre = destinatario.nombre || "";

			// 1. Verificar si está en lista de bajas
			const checkBaja = await pool.query(
				`SELECT id FROM bajas WHERE LOWER(email) = LOWER($1)`,
				[email],
			);
			if (checkBaja.rows.length > 0) {
				await pool.query(
					`UPDATE cola_destinatarios SET estado = 'OMITIDO', detalle = 'Usuario dado de baja', fecha_procesado = NOW() WHERE id = $1`,
					[destinatario.id],
				);
				await pool.query(
					`UPDATE cola_campanas SET enviados = enviados + 1 WHERE id = $1`,
					[campanaId],
				);
				estadoEnvio.enviados++;
				agregarLog(
					"SISTEMA",
					"ok",
					`🚫 Omitido (${email}): Usuario solicitó baja previamente.`,
				);
				continue;
			}

			// 2. Verificar duplicado en la misma campaña
			const checkDuplicado = await pool.query(
				`SELECT id FROM historial_envios WHERE LOWER(email) = LOWER($1) AND campana = $2 AND estado = 'ENVIADO'`,
				[email, nombreCampana],
			);
			if (checkDuplicado.rows.length > 0) {
				await pool.query(
					`UPDATE cola_destinatarios SET estado = 'OMITIDO', detalle = 'Duplicado en campaña', fecha_procesado = NOW() WHERE id = $1`,
					[destinatario.id],
				);
				await pool.query(
					`UPDATE cola_campanas SET enviados = enviados + 1 WHERE id = $1`,
					[campanaId],
				);
				estadoEnvio.enviados++;
				agregarLog(
					"SISTEMA",
					"ok",
					`⏩ Omitido (${email}): Ya recibió esta campaña anteriormente.`,
				);
				continue;
			}

			// 3. Verificar cuota móvil de 24 horas
			const cuotaRes = await pool.query(`
                SELECT COUNT(*) AS enviados_24h
                FROM historial_envios
                WHERE estado = 'ENVIADO'
                  AND fecha >= NOW() - INTERVAL '24 hours'
            `);
			const enviadosUltimas24h =
				parseInt(cuotaRes.rows[0].enviados_24h, 10) || 0;

			if (enviadosUltimas24h >= LIMITE_DIARIO_SEGURO) {
				agregarLog(
					"SISTEMA",
					"ok",
					`⏸️ LÍMITE DIARIO ALCANZADO (${enviadosUltimas24h}/${LIMITE_DIARIO_SEGURO} en 24h). Pausando 15 min hasta liberar cuota...`,
				);
				for (let s = 0; s < 180; s++) {
					if (estadoEnvio.cancelado) break;
					await new Promise((r) => setTimeout(r, 5000));
				}
				continue;
			}

			// 4. Preparar contenido y cabeceras
			const unsubscribeUrl = `${BASE_URL}/unsubscribe?email=${encodeURIComponent(email)}&campana=${encodeURIComponent(nombreCampana)}`;
			const saludoNombre = nombre ? nombre.split(" ")[0] : "";

			let finalHtml = construirHtmlConTracking(
				baseHtml,
				email,
				nombreCampana,
				unsubscribeUrl,
			);
			finalHtml = finalHtml.replace(/\{\{nombre\}\}/gi, saludoNombre);

			const textoPlanoFinal =
				(mensajeTexto || "Mensaje de FERTIL").replace(
					/\{\{nombre\}\}/gi,
					saludoNombre,
				) + `\n\n---\nPara dejar de recibir estos correos: ${unsubscribeUrl}`;

			// 5. Enviar correo
			try {
				await transporter.sendMail({
					from: `"${NOMBRE_REMITENTE}" <${process.env.EMAIL_USER}>`,
					to: nombre ? `"${nombre}" <${email}>` : email,
					subject: nombreCampana.replace(/\{\{nombre\}\}/gi, saludoNombre),
					text: textoPlanoFinal,
					html: finalHtml,
					headers: {
						"List-Unsubscribe": `<${unsubscribeUrl}>`,
						"List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
						"X-Entity-Ref-ID": `fertil-${campanaId}-${destinatario.id}-${Date.now()}`,
					},
				});

				erroresConsecutivos = 0;
				enviadosEnSesion++;

				await pool.query(
					`UPDATE cola_destinatarios SET estado = 'ENVIADO', fecha_procesado = NOW() WHERE id = $1`,
					[destinatario.id],
				);
				await pool.query(
					`UPDATE cola_campanas SET enviados = enviados + 1 WHERE id = $1`,
					[campanaId],
				);
				await pool.query(
					`INSERT INTO historial_envios (campana, nombre, email, estado, detalle) VALUES ($1, $2, $3, $4, $5)`,
					[nombreCampana, nombre, email, "ENVIADO", ""],
				);

				estadoEnvio.enviados++;
				agregarLog(email, "ok", "Entrega confirmada por SMTP");
			} catch (error) {
				erroresConsecutivos++;
				const msgError = error.message || "Error SMTP desconocido";

				const esLimiteGoogle =
					msgError.includes("5.4.5") ||
					msgError.includes("Daily user sending quota") ||
					msgError.includes("Too many login attempts") ||
					msgError.includes("454");

				if (esLimiteGoogle) {
					agregarLog(
						"SISTEMA",
						"error",
						`⚠️ ADVERTENCIA GOOGLE SMTP: "${msgError}". Pausando 30 min para enfriar la cuenta...`,
					);
					transporter.close();
					for (let s = 0; s < 360; s++) {
						if (estadoEnvio.cancelado) break;
						await new Promise((r) => setTimeout(r, 5000));
					}
					continue;
				}

				await pool.query(
					`UPDATE cola_destinatarios SET estado = 'ERROR', detalle = $1, fecha_procesado = NOW() WHERE id = $2`,
					[msgError, destinatario.id],
				);
				await pool.query(
					`UPDATE cola_campanas SET errores = errores + 1 WHERE id = $1`,
					[campanaId],
				);
				await pool.query(
					`INSERT INTO historial_envios (campana, nombre, email, estado, detalle) VALUES ($1, $2, $3, $4, $5)`,
					[nombreCampana, nombre, email, "FALLÓ", msgError],
				);

				estadoEnvio.errores++;
				agregarLog(
					email,
					"error",
					`Fallo (${erroresConsecutivos}/${MAX_ERRORES_CONSECUTIVOS} seguidos): ${msgError}`,
				);

				if (erroresConsecutivos >= MAX_ERRORES_CONSECUTIVOS) {
					estadoEnvio.cancelado = true;
					await pool.query(
						`UPDATE cola_campanas SET estado = 'CANCELADA' WHERE id = $1`,
						[campanaId],
					);
					agregarLog(
						"SISTEMA",
						"error",
						`🛑 DETENIDO POR SEGURIDAD: ${MAX_ERRORES_CONSECUTIVOS} errores seguidos. Último: ${msgError}.`,
					);
					break;
				}
			}

			// 6. Pausas con Jitter
			const pendientesRestantes =
				estadoEnvio.total - (estadoEnvio.enviados + estadoEnvio.errores);

			if (
				enviadosEnSesion > 0 &&
				enviadosEnSesion % LOTE_TAMANO === 0 &&
				pendientesRestantes > 0
			) {
				agregarLog(
					"SISTEMA",
					"ok",
					`🛡️ Lote de ${LOTE_TAMANO} completado. Enfriamiento Anti-Spam de 4 a 7 min...`,
				);
				await sleepRandom(4 * 60 * 1000, 7 * 60 * 1000);
			} else if (pendientesRestantes > 0) {
				await sleepRandom(3200, 7500);
			}
		}
	} catch (errCritico) {
		agregarLog(
			"SISTEMA",
			"error",
			`💥 Error crítico en el motor de envío: ${errCritico.message}`,
		);
	} finally {
		workerCorriendo = false;
		estadoEnvio.activo = false;
	}
};
