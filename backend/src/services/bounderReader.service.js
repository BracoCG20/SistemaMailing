// backend/src/services/bounceReader.service.js
import { ImapFlow } from "imapflow";
import { pool } from "../config/db.js";

// Traduce los códigos técnicos SMTP (5.1.1, 5.2.2, 5.7.1, etc.) a un motivo claro en español
const clasificarMotivoRebote = (textoCuerpo = "") => {
	const raw = textoCuerpo.replace(/\r?\n/g, " ");

	// Extraer la línea técnica si existe (Diagnostic-Code o bloque con código 5xx/4xx)
	const matchDiagnostico =
		raw.match(/Diagnostic-Code:\s*smtp;\s*([^\n\r]{10,180})/i) ||
		raw.match(/(5\d{2}\s+5\.\d\.\d\s+[^\n\r]{10,140})/i) ||
		raw.match(/(4\d{2}\s+4\.\d\.\d\s+[^\n\r]{10,140})/i);

	const notaTecnica = matchDiagnostico
		? ` (${matchDiagnostico[1].trim().slice(0, 110)})`
		: "";

	const lower = raw.toLowerCase();

	// 1. Correo no existe (5.1.1 / User unknown / No such user)
	if (
		lower.includes("5.1.1") ||
		lower.includes("does not exist") ||
		lower.includes("user unknown") ||
		lower.includes("no such user") ||
		lower.includes("recipient address rejected: user") ||
		lower.includes("invalid recipient") ||
		lower.includes("address not found") ||
		lower.includes("direccion no se encontro") ||
		lower.includes("no existe")
	) {
		return `El correo no existe: La cuenta fue eliminada o está mal escrita${notaTecnica}`;
	}

	// 2. Buzón lleno (5.2.2 / Quota exceeded / Over quota)
	if (
		lower.includes("5.2.2") ||
		lower.includes("quota") ||
		lower.includes("mailbox full") ||
		lower.includes("over quota") ||
		lower.includes("storage") ||
		lower.includes("buzon lleno")
	) {
		return `Buzón lleno: El destinatario no tiene espacio disponible para recibir correos${notaTecnica}`;
	}

	// 3. Dominio no existe o error DNS (5.1.2 / Domain not found / NXDOMAIN)
	if (
		lower.includes("5.1.2") ||
		lower.includes("domain name not found") ||
		lower.includes("host or domain name not found") ||
		lower.includes("nxdomain") ||
		lower.includes("no mx record") ||
		lower.includes("dns error")
	) {
		return `Dominio inexistente: El dominio de la empresa (@...) ya no existe o no tiene servidor de correo${notaTecnica}`;
	}

	// 4. Rechazado por Firewall / Políticas Anti-Spam del receptor (5.7.1 / Blocked / Denied)
	if (
		lower.includes("5.7.1") ||
		lower.includes("5.7.") ||
		lower.includes("blocked") ||
		lower.includes("blacklisted") ||
		lower.includes("rejected by") ||
		lower.includes("policy") ||
		lower.includes("access denied") ||
		lower.includes("spam") ||
		lower.includes("service unavailable")
	) {
		return `Rechazado por servidor destino: El firewall o filtro de seguridad de su empresa bloqueó el correo${notaTecnica}`;
	}

	// 5.Cuenta deshabilitada o inactiva (5.2.1 / Disabled)
	if (
		lower.includes("5.2.1") ||
		lower.includes("disabled") ||
		lower.includes("inactive") ||
		lower.includes("suspended")
	) {
		return `Cuenta inactiva: El buzón del destinatario está temporalmente deshabilitado${notaTecnica}`;
	}

	// 6. Error temporal o servidor apagado (4.x.x / Timeout / Connection refused)
	if (
		lower.includes("timed out") ||
		lower.includes("connection refused") ||
		lower.includes("temporarily deferred") ||
		lower.includes("4.4.")
	) {
		return `Servidor destino no responde: El servidor de correo de la empresa estuvo caído o sin conexión${notaTecnica}`;
	}

	return `Rebote del servidor destino: No se pudo entregar en la bandeja del usuario${notaTecnica}`;
};

export const sincronizarRebotesIMAP = async (campanaFiltro = null) => {
	if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
		return { revisados: 0, actualizados: 0 };
	}

	const client = new ImapFlow({
		host: "imap.gmail.com",
		port: 993,
		secure: true,
		auth: {
			user: process.env.EMAIL_USER,
			pass: process.env.EMAIL_PASS,
		},
		logger: false,
	});

	let actualizados = 0;
	let revisados = 0;

	try {
		// 1. Obtener las campañas activas/recientes que existen en nuestra BD
		let queryCampanas = `SELECT DISTINCT campana FROM historial_envios WHERE fecha >= NOW() - INTERVAL '14 days'`;
		const paramsCampanas = [];

		if (campanaFiltro) {
			queryCampanas = `SELECT DISTINCT campana FROM historial_envios WHERE campana = $1`;
			paramsCampanas.push(campanaFiltro.trim());
		}

		const campRes = await pool.query(queryCampanas, paramsCampanas);
		const campanasRegistradas = campRes.rows
			.map((r) => r.campana)
			.filter(Boolean);

		if (campanasRegistradas.length === 0) {
			return { revisados: 0, actualizados: 0 };
		}

		await client.connect();
		const lock = await client.getMailboxLock("INBOX");

		try {
			// Buscar correos de rebote (mailer-daemon / postmaster) de los últimos 7 días
			const haceSieteDias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
			const uids = await client.search({
				since: haceSieteDias,
				or: [
					{ from: "mailer-daemon" },
					{ from: "postmaster" },
					{ subject: "Delivery Status Notification" },
					{ subject: "Undelivered Mail" },
					{ subject: "No se ha podido entregar" },
				],
			});

			if (!uids || uids.length === 0) {
				return { revisados: 0, actualizados: 0 };
			}

			// Revisar los últimos 200 rebotes como máximo para mantener respuesta rápida
			const uidsRecientes = uids.slice(-200);

			for await (const msg of client.fetch(uidsRecientes, { source: true })) {
				revisados++;
				const rawSource = msg.source.toString("utf8");

				// Decodificar texto básico por si el asunto tiene tildes (ej. FÉRTIL)
				const sourceLimpio = rawSource.replace(/=\r?\n/g, "");

				// A. Verificar a cuál de nuestras campañas pertenece este rebote
				// (Revisamos tanto por el nombre del Asunto como por la cabecera X-Entity-Ref-ID: fertil-)
				let campanaDetectada = campanasRegistradas.find((c) =>
					sourceLimpio.toLowerCase().includes(c.toLowerCase()),
				);

				// Extraer todos los correos mencionados dentro del reporte de rebote
				const matchesEmails =
					sourceLimpio.match(
						/([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
					) || [];

				const emailsCandidatos = [
					...new Set(
						matchesEmails
							.map((e) => e.toLowerCase().trim())
							.filter(
								(e) =>
									e !== process.env.EMAIL_USER.toLowerCase() &&
									!e.includes("mailer-daemon") &&
									!e.includes("postmaster") &&
									!e.includes("google.com") &&
									!e.includes("googlemail.com"),
							),
					),
				];

				if (emailsCandidatos.length === 0) continue;

				const motivoClaro = clasificarMotivoRebote(sourceLimpio);

				for (const emailRebotado of emailsCandidatos) {
					// B. Actualizar ÚNICAMENTE si el correo pertenece a la campaña en historial_envios
					let updateRes;
					if (campanaDetectada) {
						updateRes = await pool.query(
							`UPDATE historial_envios
                             SET estado = 'REBOTADO',
                                 detalle = $1
                             WHERE LOWER(TRIM(email)) = LOWER($2)
                               AND campana = $3
                               AND estado != 'REBOTADO'`,
							[motivoClaro, emailRebotado, campanaDetectada],
						);
					} else if (!campanaFiltro && sourceLimpio.includes("fertil-")) {
						// Si el servidor destino recortó el Subject pero conservó nuestro ID interno fertil-
						updateRes = await pool.query(
							`UPDATE historial_envios
                             SET estado = 'REBOTADO',
                                 detalle = $1
                             WHERE id = (
                                 SELECT id FROM historial_envios
                                 WHERE LOWER(TRIM(email)) = LOWER($2)
                                   AND estado = 'ENVIADO'
                                 ORDER BY fecha DESC LIMIT 1
                             )`,
							[motivoClaro, emailRebotado],
						);
					}

					if (updateRes && updateRes.rowCount > 0) {
						actualizados += updateRes.rowCount;
					}
				}
			}
		} finally {
			lock.release();
		}

		await client.logout();
	} catch (err) {
		console.error("⚠️ Aviso al sincronizar rebotes IMAP:", err.message);
	}

	return { revisados, actualizados };
};
