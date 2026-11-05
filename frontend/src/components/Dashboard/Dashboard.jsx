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
import {
	COLORES_GRAFICOS,
	obtenerNombreReal,
	esClickValido,
	esArtistaValido,
} from "../../utils/campaigns.utils";
import styles from "./Dashboard.module.scss";

const TOOLTIP_STYLE = {
	borderRadius: "8px",
	border: "1px solid var(--border)",
	fontSize: "0.75rem",
	boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
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

	useEffect(() => {
		const cargarMetricas = async () => {
			try {
				const res = await fetch("/api/clicks-detail");
				const dataRaw = await res.json();

				const data = dataRaw.filter(esClickValido);
				const agrupadoCampana = {};
				const agrupadoArtista = {};

				data.forEach((item) => {
					agrupadoCampana[item.campana] =
						(agrupadoCampana[item.campana] || 0) + 1;

					const artista = obtenerNombreReal(
						item.original_url,
						item.nombre_enlace,
					);

					if (esArtistaValido(artista)) {
						agrupadoArtista[artista] = (agrupadoArtista[artista] || 0) + 1;
					}
				});

				const dataCampana = Object.entries(agrupadoCampana)
					.map(([name, clics]) => ({ name, clics }))
					.sort((a, b) => b.clics - a.clics);

				const dataArtista = Object.entries(agrupadoArtista)
					.map(([name, clics]) => ({ name, clics }))
					.sort((a, b) => b.clics - a.clics)
					.slice(0, 7);

				setStatsCampana(dataCampana);
				setStatsArtista(dataArtista);
				setTotales({
					clics: data.length,
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

	if (loading) {
		return <p className={styles.loadingState}>Cargando métricas...</p>;
	}

	return (
		<div className={styles.dashboard}>
			{/* TARJETAS KPI ESTILO SHADCN */}
			<div className={styles.dashboardGrid}>
				<div className={styles.summaryCard}>
					<div className={styles.cardHeader}>
						<span>Clics Totales Históricos</span>
						<MousePointerClick size={16} color='var(--primary)' />
					</div>
					<span className={styles.cardValue}>{totales.clics}</span>
				</div>

				<div className={styles.summaryCard}>
					<div className={styles.cardHeader}>
						<span>Campañas con Tráfico</span>
						<TrendingUp size={16} color='#107c41' />
					</div>
					<span className={styles.cardValue}>{totales.campanas}</span>
				</div>

				<div className={styles.summaryCard}>
					<div className={styles.cardHeader}>
						<span>Director más visto</span>
						<Trophy size={16} color='#eab308' />
					</div>
					<span className={`${styles.cardValue} ${styles.cardHighlight}`}>
						{totales.mejorArtista}
					</span>
				</div>
			</div>

			{/* GRÁFICOS */}
			<div className={styles.chartsGrid}>
				<div className={styles.chartContainer}>
					<div className={styles.chartHeader}>
						<h3>Ranking de Directores por Clics</h3>
						<p>Top 7 enlaces de portafolio más visitados</p>
					</div>
					<div className={styles.chartBody}>
						{statsArtista.length === 0 ? (
							<p className={styles.emptyChart}>Sin datos suficientes</p>
						) : (
							<ResponsiveContainer width='100%' height='100%'>
								<BarChart
									data={statsArtista}
									layout='vertical'
									margin={{ top: 0, right: 24, left: 10, bottom: 0 }}
								>
									<XAxis type='number' hide />
									<YAxis
										dataKey='name'
										type='category'
										axisLine={false}
										tickLine={false}
										tick={{ fill: "var(--foreground)", fontSize: 12 }}
										width={135}
									/>
									<Tooltip
										cursor={{ fill: "var(--muted)" }}
										contentStyle={TOOLTIP_STYLE}
									/>
									<Bar
										dataKey='clics'
										fill='var(--primary)'
										radius={[0, 4, 4, 0]}
										barSize={22}
									/>
								</BarChart>
							</ResponsiveContainer>
						)}
					</div>
				</div>

				<div className={styles.chartContainer}>
					<div className={styles.chartHeader}>
						<h3>Tráfico por Campaña</h3>
						<p>Distribución proporcional de clics acumulados</p>
					</div>
					<div className={styles.chartBody}>
						{statsCampana.length === 0 ? (
							<p className={styles.emptyChart}>Sin datos suficientes</p>
						) : (
							<ResponsiveContainer width='100%' height='100%'>
								<PieChart>
									<Pie
										data={statsCampana}
										cx='50%'
										cy='50%'
										innerRadius={68}
										outerRadius={98}
										paddingAngle={2}
										dataKey='clics'
									>
										{statsCampana.map((_, index) => (
											<Cell
												key={`cell-${index}`}
												fill={COLORES_GRAFICOS[index % COLORES_GRAFICOS.length]}
											/>
										))}
									</Pie>
									<Tooltip contentStyle={TOOLTIP_STYLE} />
								</PieChart>
							</ResponsiveContainer>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
