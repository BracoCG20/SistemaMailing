// backend/src/middlewares/auth.middleware.js

const ADMIN_SECRET = process.env.ADMIN_SECRET || "fertil2026";

export const requireAdminKey = (req, res, next) => {
	const clientKey = req.headers["x-admin-key"];

	if (!clientKey || clientKey !== ADMIN_SECRET) {
		return res.status(401).json({
			error: "No autorizado. Clave de administrador inválida.",
		});
	}

	next();
};

export const verificarAdminKey = (req, res) => {
	const { key } = req.body;
	if (key && key === ADMIN_SECRET) {
		return res.json({ valid: true });
	}
	return res.status(401).json({ valid: false, error: "Clave incorrecta" });
};
