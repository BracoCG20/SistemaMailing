// frontend/src/components/Dashboard/Dashboard.jsx
import { useState, useEffect, useMemo } from "react";
import {
	BarChart,
	Bar,
	XAxis,
	YAxis,
	Tooltip,
	ResponsiveContainer,
	PieChart,
	Pie,
} from "recharts";
import { Filter, MousePointerClick, TrendingUp, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
	COLORES_GRAFICOS,
	obtenerNombreReal,
	esClickValido,
	esArtistaValido,
} from "../../utils/campaigns.utils.js";
import styles from "./Dashboard.module.scss";

const TOOLTIP_STYLE = {
	borderRadius: "8px",
	border: "1px solid var(--border)",
	fontSize: "0.75rem",
	boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
};

export default function Dashboard() {
	const [allClicks, setAllClicks] = useState([]);
	const [selectedCampaign, setSelectedCampaign] = useState("TODAS");
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const cargarMetricas = async () => {
			try {
				const res = await fetch("/api/clicks-detail");
				const dataRaw = await res.json();
				const dataLimpia = dataRaw.filter(esClickValido);
				setAllClicks(dataLimpia);
			} catch {
				toast.error("Error cargando el dashboard");
			} finally {
				setLoading(false);
			}
		};

		cargarMetricas();
	}, []);

	// Lista única de campañas disponibles para el selector
	const listaCampanas = useMemo(() => {
		const unicas = new Set(allClicks.map((item) => item.campana));
		return Array.from(unicas);
	}, [allClicks]);

	// Recálculo reactivo según la campaña seleccionada
	const { statsCampana, statsArtista, totales } = useMemo(() => {
		const filtrados =
			selectedCampaign === "TODAS"
				? allClicks
				: allClicks.filter((item) => item.campana === selectedCampaign);

		const agrupadoCampana = {};
		const agrupadoArtista = {};

		filtrados.forEach((item) => {
			agrupadoCampana[item.campana] = (agrupadoCampana[item.campana] || 0) + 1;

			const artista = obtenerNombreReal(item.original_url, item.nombre_enlace);

			if (esArtistaValido(artista)) {
				agrupadoArtista[artista] = (agrupadoArtista[artista] || 0) + 1;
			}
		});

		const dataCampana = Object.entries(agrupadoCampana)
			.map(([name, clics]) => ({ name, clics }))
			.sort((a, b) => b.clics - a.clics)
			.map((item, index) => ({
				...item,
				fill: COLORES_GRAFICOS[index % COLORES_GRAFICOS.length],
			}));

		const dataArtista = Object.entries(agrupadoArtista)
			.map(([name, clics]) => ({ name, clics }))
			.sort((a, b) => b.clics - a.clics)
			.slice(0, 7);

		return {
			statsCampana: dataCampana,
			statsArtista: dataArtista,
			totales: {
				clics: filtrados.length,
				campanas:
					selectedCampaign === "TODAS"
						? listaCampanas.length
						: filtrados.length > 0
							? 1
							: 0,
				mejorArtista: dataArtista.length > 0 ? dataArtista[0].name : "Ninguno",
			},
		};
	}, [allClicks, selectedCampaign, listaCampanas.length]);

	if (loading) {
		return <p className={styles.loadingState}>Cargando métricas...</p>;
	}

	return (
		<div className={styles.dashboard}>
			{/* BARRA DE FILTRO POR CAMPAÑA */}
			<div
				style={{
					display: "flex",
					justifyContent: "flex-end",
					alignItems: "center",
					gap: "0.5rem",
					marginBottom: "1rem",
				}}
			>
				<div
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: "0.5rem",
						backgroundColor: "var(--card)",
						border: "1px solid var(--border)",
						borderRadius: "var(--radius)",
						padding: "0.35rem 0.75rem",
						fontSize: "0.75rem",
					}}
				>
					<Filter size={14} color='var(--muted-foreground)' />
					<span style={{ color: "var(--muted-foreground)", fontWeight: 500 }}>
						Campaña:
					</span>
					<select
						value={selectedCampaign}
						onChange={(e) => setSelectedCampaign(e.target.value)}
						style={{
							border: "none",
							background: "transparent",
							fontSize: "0.75rem",
							fontWeight: 600,
							color: "var(--foreground)",
							cursor: "pointer",
							outline: "none",
						}}
					>
						<option value='TODAS'>
							Todas las campañas ({listaCampanas.length})
						</option>
						{listaCampanas.map((camp) => (
							<option key={camp} value={camp}>
								{camp}
							</option>
						))}
					</select>
				</div>
			</div>

			<div className={styles.dashboardGrid}>
				<div className={styles.summaryCard}>
					<div className={styles.cardHeader}>
						<span>
							{selectedCampaign === "TODAS"
								? "Clics Totales Históricos"
								: "Clics de la Campaña"}
						</span>
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
						<span>Director / Enlace más visto</span>
						<Trophy size={16} color='#eab308' />
					</div>
					<span className={`${styles.cardValue} ${styles.cardHighlight}`}>
						{totales.mejorArtista}
					</span>
				</div>
			</div>

			<div className={styles.chartsGrid}>
				<div className={styles.chartContainer}>
					<div className={styles.chartHeader}>
						<h3>Ranking de Enlaces por Clics</h3>
						<p>
							{selectedCampaign === "TODAS"
								? "Top 7 enlaces más visitados globalmente"
								: `Top enlaces en "${selectedCampaign}"`}
						</p>
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
									/>
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
