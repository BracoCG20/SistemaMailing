import { pool } from "../config/db.js";

export const obtenerContactos = async (req, res) => {
	try {
		const result = await pool.query(
			"SELECT * FROM contactos ORDER BY nombre ASC",
		);
		res.json(result.rows);
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};

export const importarContactosBulk = async (req, res) => {
	const { contactos } = req.body;
	if (!Array.isArray(contactos)) {
		return res.status(400).json({ error: "Formato inválido" });
	}

	let agregados = 0;
	try {
		for (const c of contactos) {
			if (c.email) {
				await pool.query(
					`INSERT INTO contactos (nombre, email) VALUES ($1, $2) 
                     ON CONFLICT (email) DO UPDATE SET nombre = EXCLUDED.nombre`,
					[c.nombre || "", c.email.trim()],
				);
				agregados++;
			}
		}
		res.json({ success: true, procesados: agregados });
	} catch {
		res.status(500).json({ error: "Error procesando la base de datos." });
	}
};

export const eliminarContacto = async (req, res) => {
	try {
		await pool.query("DELETE FROM contactos WHERE email = $1", [
			req.params.email,
		]);
		res.json({ success: true });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
};
