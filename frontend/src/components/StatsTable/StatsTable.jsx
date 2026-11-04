import { useState, useEffect } from "react";
import { RefreshCcw } from "lucide-react";
import styles from "./StatsTable.module.scss";

export default function StatsTable() {
	const [activeTab, setActiveTab] = useState("resumen");
	const [stats, setStats] = useState([]);
	const [detalles, setDetalles] = useState([]);
	const [loading, setLoading] = useState(true);

	const cargarDatos = async () => {
		setLoading(true);
		try {
			const [resStats, resDetail] = await Promise.all([
				fetch("/api/stats"),
				fetch("/api/clicks-detail"),
			]);
			setStats(await resStats.json());
			setDetalles(await resDetail.json());
		} catch (error) {
			console.error("Error cargando estadísticas", error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		// Le indicamos al linter que esta llamada es segura y esperada
		// eslint-disable-next-line
		cargarDatos();
	}, []);

	const formatearFecha = (fechaISO) => {
		return new Date(fechaISO).toLocaleString("es-PE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<div>
			<div className={styles.header}>
				<div className={styles.tabs}>
					<button
						className={`${styles.tab} ${activeTab === "resumen" ? styles.active : ""}`}
						onClick={() => setActiveTab("resumen")}
					>
						Resumen por Enlace
					</button>
					<button
						className={`${styles.tab} ${activeTab === "detalle" ? styles.active : ""}`}
						onClick={() => setActiveTab("detalle")}
					>
						Detalle por Usuario
					</button>
				</div>
				<button
					className='btn btn-outline'
					onClick={cargarDatos}
					disabled={loading}
				>
					<RefreshCcw size={16} style={{ marginRight: "0.5rem" }} />
					Actualizar
				</button>
			</div>

			<div className={styles.tableWrapper}>
				{activeTab === "resumen" ? (
					<table className={styles.table}>
						<thead>
							<tr>
								<th>Campaña</th>
								<th>Destino (URL Original)</th>
								<th>Total Clics</th>
							</tr>
						</thead>
						<tbody>
							{stats.length === 0 ? (
								<tr>
									<td colSpan='3' style={{ textAlign: "center" }}>
										No hay clics registrados.
									</td>
								</tr>
							) : (
								stats.map((row, i) => (
									<tr key={i}>
										<td>
											<strong>{row.campana}</strong>
										</td>
										<td>
											<a
												href={row.original_url}
												target='_blank'
												rel='noreferrer'
												style={{ color: "#0066cc" }}
											>
												{row.original_url}
											</a>
										</td>
										<td>
											<span className={styles.badge}>
												{row.click_count} clics
											</span>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				) : (
					<table className={styles.table}>
						<thead>
							<tr>
								<th>Fecha y Hora</th>
								<th>Usuario (Email)</th>
								<th>Campaña</th>
								<th>Enlace Visitado</th>
							</tr>
						</thead>
						<tbody>
							{detalles.length === 0 ? (
								<tr>
									<td colSpan='4' style={{ textAlign: "center" }}>
										No hay registros detallados.
									</td>
								</tr>
							) : (
								detalles.map((row, i) => (
									<tr key={i}>
										<td style={{ color: "var(--muted-foreground)" }}>
											{formatearFecha(row.fecha)}
										</td>
										<td>
											<strong>{row.email}</strong>
										</td>
										<td>{row.campana}</td>
										<td>
											<a
												href={row.original_url}
												target='_blank'
												rel='noreferrer'
												style={{ color: "#0066cc" }}
											>
												{row.original_url}
											</a>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}
