// frontend/src/utils/campaigns.utils.js

export const MAPA_ARTISTAS = {
	maxou: "Santi Chávez",
	Fd0k_franco: "Franco Finocchiaro",
	GtQV_Fertil_Florian: "Florian Florian",
	"0ncP_Alvaro_luque": "Álvaro Luque",
	qfg6u: "Julián Fernández",
	qu4L_Guido_Barbosch: "Guido Barbosh",
};

export const COLORES_GRAFICOS = [
	"#18181b",
	"#107c41",
	"#3f3f46",
	"#71717a",
	"#a1a1aa",
	"#d4d4d8",
];

export const obtenerNombreReal = (url, nombreOriginal) => {
	const urlDecodificada = url
		? decodeURIComponent(url.replace(/\+/g, " "))
		: "";

	if (urlDecodificada && urlDecodificada.includes("simian.me/")) {
		const urlId = urlDecodificada.split("simian.me/")[1]?.split("?")[0]?.trim();
		if (urlId && MAPA_ARTISTAS[urlId]) {
			return MAPA_ARTISTAS[urlId];
		}
	}

	const limpio = (nombreOriginal || "").replace(/\+/g, " ").trim();
	if (limpio.toLowerCase() === "guido barbosch") {
		return "Guido Barbosh";
	}
	return limpio;
};

export const esCampanaValida = (campana) => {
	return (
		Boolean(campana) &&
		campana !== "null" &&
		campana !== "undefined" &&
		campana !== "FRTIL - Directores"
	);
};

export const esClickValido = (item) => {
	return (
		Boolean(item?.email) &&
		item.email !== "null" &&
		item.email !== "undefined" &&
		esCampanaValida(item?.campana)
	);
};

export const esArtistaValido = (artista) => {
	if (!artista || artista === "-") return false;
	const lower = artista.toLowerCase();
	return (
		!lower.includes("www.fertil.tv") &&
		!lower.includes("instagram") &&
		!lower.includes("linkedin")
	);
};
