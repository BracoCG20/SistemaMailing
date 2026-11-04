import { useState, useEffect } from "react";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
	PieChart,
	Pie,
	Cell,
} from "recharts";
import { MousePointerClick, TrendingUp, Trophy } from "lucide-react";
import { toast } from "sonner";
import styles from "./Dashboard.module.scss";

// MAPA DE ARTISTAS BASADO EN SUS URLS ÚNICAS
const MAPA_ARTISTAS = {
	maxou: "Santi Chávez",
	Fd0k_franco: "Franco Finocchiaro",
	GtQV_Fertil_Florian: "Florian Florian",
	"0ncP_Alvaro_luque": "Álvaro Luque",
	qfg6u: "Julián Fernández",
	qu4L_Guido_Barbosch: "Guido Barbosh",
};

const obtenerNombreReal = (url, nombreOriginal) => {
	// Si la URL es de Simian, buscamos su código en el mapa
	if (url && url.includes("simian.me/")) {
		const urlId = url.split("simian.me/")[1]?.split("?")[0];
		if (urlId && MAPA_ARTISTAS[urlId]) {
			return MAPA_ARTISTAS[urlId];
		}
	}
	// Si no está en el mapa, devolvemos el original
	return nombreOriginal;
};

export default function Dashboard() {
	const [statsCampana, setStatsCampana] = useState([]);
	const [statsArtista, setStatsArtista] = useState([]);
	const [totales, setTotales] = useState({
		clics: 0,
		campanas: 0,
		mejorArtista: "-",
	});
	const [loading, setLoading] = useState(true);

	const COLORES = [
		"#18181b",
		"#107c41",
		"#3f3f46",
		"#71717a",
		"#a1a1aa",
		"#d4d4d8",
	];

	useEffect(() => {
		const cargarMetricas = async () => {
			try {
				const res = await fetch("/api/clicks-detail");
				const data = await res.json();

				const agrupadoCampana = {};
				const agrupadoArtista = {};
				let totalClics = data.length;

				data.forEach((item) => {
					agrupadoCampana[item.campana] =
						(agrupadoCampana[item.campana] || 0) + 1;

					// REGLAS DE FILTRADO Y MAPEO
					let artista = obtenerNombreReal(
						item.original_url,
						item.nombre_enlace,
					);

					// Omitimos clics a la web principal o redes sociales en el ranking de directores
					if (
						artista &&
						artista !== "-" &&
						!artista.includes("www.fertil.tv") &&
						!artista.toLowerCase().includes("instagram") &&
						!artista.toLowerCase().includes("linkedin")
					) {
						agrupadoArtista[artista] = (agrupadoArtista[artista] || 0) + 1;
					}
				});

				const dataCampana = Object.keys(agrupadoCampana)
					.map((key) => ({
						name: key,
						clics: agrupadoCampana[key],
					}))
					.sort((a, b) => b.clics - a.clics);

				const dataArtista = Object.keys(agrupadoArtista)
					.map((key) => ({
						name: key,
						clics: agrupadoArtista[key],
					}))
					.sort((a, b) => b.clics - a.clics)
					.slice(0, 7);

				setStatsCampana(dataCampana);
				setStatsArtista(dataArtista);
				setTotales({
					clics: totalClics,
					campanas: dataCampana.length,
					mejorArtista:
						dataArtista.length > 0 ? dataArtista[0].name : "Ninguno",
				});
			} catch {
				toast.error("Error cargando el dashboard");
			} finally {
				setLoading(false);
			}
		};

		cargarMetricas();
	}, []);

	if (loading)
		return (
			<p style={{ color: "var(--muted-foreground)" }}>Cargando métricas...</p>
		);

	return (
		<div>
			<div className={styles.dashboardGrid}>
				<div className={styles.summaryCard}>
					<div className={styles.cardHeader}>
						<span>Clics Totales Históricos</span>
						<MousePointerClick size={18} color='var(--primary)' />
					</div>
					<span className={styles.cardValue}>{totales.clics}</span>
				</div>

				<div className={styles.summaryCard}>
					<div className={styles.cardHeader}>
						<span>Campañas Enviadas</span>
						<TrendingUp size={18} color='#107c41' />
					</div>
					<span className={styles.cardValue}>{totales.campanas}</span>
				</div>

				<div className={styles.summaryCard}>
					<div className={styles.cardHeader}>
						<span>Director más visto</span>
						<Trophy size={18} color='#eab308' />
					</div>
					<span
						className={styles.cardValue}
						style={{ fontSize: "1.25rem", marginTop: "0.25rem" }}
					>
						{totales.mejorArtista}
					</span>
				</div>
			</div>

			<div className={styles.chartsGrid}>
				<div className={styles.chartContainer}>
					<h3>Ranking de Directores por Clics</h3>
					<div style={{ flex: 1, width: "100%", height: "100%" }}>
						<ResponsiveContainer width='100%' height='100%'>
							<BarChart
								data={statsArtista}
								layout='vertical'
								margin={{ top: 0, right: 30, left: 30, bottom: 0 }}
							>
								<XAxis type='number' hide />
								<YAxis
									dataKey='name'
									type='category'
									axisLine={false}
									tickLine={false}
									tick={{ fill: "var(--foreground)", fontSize: 12 }}
									width={140}
								/>
								<Tooltip
									cursor={{ fill: "var(--muted)" }}
									contentStyle={{
										borderRadius: "8px",
										border: "1px solid var(--border)",
									}}
								/>
								<Bar
									dataKey='clics'
									fill='var(--primary)'
									radius={[0, 4, 4, 0]}
									barSize={24}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
				</div>

				<div className={styles.chartContainer}>
					<h3>Tráfico por Campaña</h3>
					<div style={{ flex: 1, width: "100%", height: "100%" }}>
						<ResponsiveContainer width='100%' height='100%'>
							<PieChart>
								<Pie
									data={statsCampana}
									cx='50%'
									cy='50%'
									innerRadius={70}
									outerRadius={100}
									paddingAngle={2}
									dataKey='clics'
								>
									{statsCampana.map((entry, index) => (
										<Cell
											key={`cell-${index}`}
											fill={COLORES[index % COLORES.length]}
										/>
									))}
								</Pie>
								<Tooltip
									contentStyle={{
										borderRadius: "8px",
										border: "1px solid var(--border)",
									}}
								/>
							</PieChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>
		</div>
	);
}
