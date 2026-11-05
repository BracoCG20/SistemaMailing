import { useState, useEffect, Fragment } from "react";
import {
	RefreshCcw,
	FileDown,
	ChevronDown,
	ChevronRight,
	ChevronLeft,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import styles from "./StatsTable.module.scss";

const MAPA_ARTISTAS = {
	maxou: "Santi Chávez",
	Fd0k_franco: "Franco Finocchiaro",
	GtQV_Fertil_Florian: "Florian Florian",
	"0ncP_Alvaro_luque": "Álvaro Luque",
	qfg6u: "Julián Fernández",
	qu4L_Guido_Barbosch: "Guido Barbosh",
};

const obtenerNombreReal = (url, nombreOriginal) => {
	if (url && url.includes("simian.me/")) {
		const urlId = url.split("simian.me/")[1]?.split("?")[0];
		if (urlId && MAPA_ARTISTAS[urlId]) {
			return MAPA_ARTISTAS[urlId];
		}
	}
	return nombreOriginal;
};

export default function StatsTable() {
	const [activeTab, setActiveTab] = useState("resumen");
	const [stats, setStats] = useState([]);
	const [detalles, setDetalles] = useState([]);
	const [loading, setLoading] = useState(true);

	const [pageResumen, setPageResumen] = useState(1);
	const [pageDetalle, setPageDetalle] = useState(1);
	const itemsPerPage = 10;

	const [expandedCampaigns, setExpandedCampaigns] = useState(new Set());

	const cargarDatos = async () => {
		setLoading(true);
		try {
			const [resStats, resDetail] = await Promise.all([
				fetch("/api/stats"),
				fetch("/api/clicks-detail"),
			]);

			const statsRaw = await resStats.json();
			const detallesRaw = await resDetail.json();

			// FILTRAMOS ESTADISTICAS BRUTAS
			const statsLimpio = statsRaw.filter(
				(s) =>
					s.campana &&
					s.campana !== "null" &&
					s.campana !== "FRTIL - Directores",
			);
			setStats(statsLimpio);

			// CORREGIMOS Y FILTRAMOS LOS DETALLES
			const datosCorregidos = detallesRaw
				.filter(
					(item) =>
						item.email &&
						item.email !== "null" &&
						item.email !== "undefined" &&
						item.campana &&
						item.campana !== "null" &&
						item.campana !== "FRTIL - Directores",
				)
				.map((item) => ({
					...item,
					nombre_enlace: obtenerNombreReal(
						item.original_url,
						item.nombre_enlace,
					),
				}));

			setDetalles(datosCorregidos);
		} catch {
			toast.error("Error cargando estadísticas");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		// eslint-disable-next-line
		cargarDatos();
	}, []);

	const handleTabChange = (tab) => {
		setActiveTab(tab);
		setPageResumen(1);
		setPageDetalle(1);
	};

	const formatearFecha = (fechaISO) => {
		return new Date(fechaISO).toLocaleString("es-PE", {
			day: "2-digit",
			month: "2-digit",
			year: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const toggleExpand = (campana) => {
		setExpandedCampaigns((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(campana)) newSet.delete(campana);
			else newSet.add(campana);
			return newSet;
		});
	};

	const statsAgrupados = stats.reduce((acc, curr) => {
		if (!acc[curr.campana]) acc[curr.campana] = { totalClicks: 0, enlaces: [] };
		acc[curr.campana].totalClicks += parseInt(curr.click_count, 10);
		acc[curr.campana].enlaces.push(curr);
		return acc;
	}, {});

	const arrayResumen = Object.entries(statsAgrupados).map(
		([campana, data]) => ({ campana, ...data }),
	);
	const totalPagesResumen = Math.ceil(arrayResumen.length / itemsPerPage) || 1;
	const paginatedResumen = arrayResumen.slice(
		(pageResumen - 1) * itemsPerPage,
		pageResumen * itemsPerPage,
	);

	const totalPagesDetalle = Math.ceil(detalles.length / itemsPerPage) || 1;
	const paginatedDetalle = detalles.slice(
		(pageDetalle - 1) * itemsPerPage,
		pageDetalle * itemsPerPage,
	);

	const exportarExcel = () => {
		try {
			const wb = XLSX.utils.book_new();

			if (activeTab === "resumen") {
				const dataPlana = stats.map((s) => [
					s.campana,
					s.original_url,
					s.click_count,
				]);
				dataPlana.unshift([
					"Campaña",
					"Destino (URL Original)",
					"Cantidad Clics",
				]);
				const ws = XLSX.utils.aoa_to_sheet(dataPlana);
				ws["!cols"] = [{ wch: 25 }, { wch: 50 }, { wch: 15 }];
				XLSX.utils.book_append_sheet(wb, ws, "Resumen Clics");
				XLSX.writeFile(wb, "Resumen_Clics.xlsx");
			} else {
				const dataPlana = detalles.map((d) => [
					formatearFecha(d.fecha),
					d.usuario_nombre || "Sin Nombre",
					d.email,
					d.campana,
					d.nombre_enlace || "-",
					d.original_url,
				]);
				dataPlana.unshift([
					"Fecha y Hora",
					"Usuario",
					"Correo",
					"Campaña",
					"Director / Enlace",
					"URL Visitada",
				]);
				const ws = XLSX.utils.aoa_to_sheet(dataPlana);
				ws["!cols"] = [
					{ wch: 20 },
					{ wch: 25 },
					{ wch: 30 },
					{ wch: 25 },
					{ wch: 25 },
					{ wch: 50 },
				];
				XLSX.utils.book_append_sheet(wb, ws, "Detalle Usuarios");
				XLSX.writeFile(wb, "Detalle_Clics_Usuarios.xlsx");
			}
			toast.success("Excel descargado correctamente");
		} catch {
			toast.error("Error al exportar a Excel");
		}
	};

	return (
		<div>
			<div className={styles.header}>
				<div className={styles.tabs}>
					<button
						className={`${styles.tab} ${activeTab === "resumen" ? styles.active : ""}`}
						onClick={() => handleTabChange("resumen")}
					>
						Resumen por Campaña
					</button>
					<button
						className={`${styles.tab} ${activeTab === "detalle" ? styles.active : ""}`}
						onClick={() => handleTabChange("detalle")}
					>
						Detalle por Usuario
					</button>
				</div>
				<div className={styles.actions}>
					<button
						className='btn btn-outline'
						onClick={exportarExcel}
						style={{ color: "#107c41", borderColor: "#107c41" }}
					>
						<FileDown size={16} style={{ marginRight: "0.5rem" }} /> Exportar
						Vista
					</button>
					<button
						className='btn btn-outline'
						onClick={cargarDatos}
						disabled={loading}
					>
						<RefreshCcw size={16} style={{ marginRight: "0.5rem" }} />{" "}
						Actualizar
					</button>
				</div>
			</div>

			<div className={styles.tableWrapper}>
				{activeTab === "resumen" ? (
					<>
						<table className={styles.table}>
							<thead>
								<tr>
									<th style={{ width: "40px" }}></th>
									<th>Nombre de la Campaña</th>
									<th>Total de Clics</th>
								</tr>
							</thead>
							<tbody>
								{paginatedResumen.length === 0 ? (
									<tr>
										<td colSpan='3' style={{ textAlign: "center" }}>
											No hay campañas registradas.
										</td>
									</tr>
								) : (
									paginatedResumen.map((row) => {
										const isExpanded = expandedCampaigns.has(row.campana);
										return (
											<Fragment key={row.campana}>
												<tr
													className={styles.mainRow}
													onClick={() => toggleExpand(row.campana)}
												>
													<td>
														{isExpanded ? (
															<ChevronDown size={18} />
														) : (
															<ChevronRight size={18} />
														)}
													</td>
													<td>
														<strong>{row.campana}</strong>
													</td>
													<td>
														<span className={styles.badge}>
															{row.totalClicks} clics globales
														</span>
													</td>
												</tr>
												{isExpanded && (
													<tr>
														<td colSpan='3' style={{ padding: 0 }}>
															<div className={styles.expandedContent}>
																<table className={styles.subTable}>
																	<tbody>
																		{row.enlaces.map((enlace, idx) => (
																			<tr key={idx}>
																				<td>
																					<a
																						href={enlace.original_url}
																						target='_blank'
																						rel='noreferrer'
																						style={{ color: "#0066cc" }}
																					>
																						{enlace.original_url}
																					</a>
																				</td>
																				<td
																					style={{
																						width: "100px",
																						fontWeight: "500",
																					}}
																				>
																					{enlace.click_count} clics
																				</td>
																			</tr>
																		))}
																	</tbody>
																</table>
															</div>
														</td>
													</tr>
												)}
											</Fragment>
										);
									})
								)}
							</tbody>
						</table>
						<div className={styles.pagination}>
							<span>
								Página {pageResumen} de {totalPagesResumen}
							</span>
							<div className={styles.pageControls}>
								<button
									className='btn btn-outline'
									disabled={pageResumen === 1}
									onClick={() => setPageResumen((p) => p - 1)}
								>
									<ChevronLeft size={16} /> Anterior
								</button>
								<button
									className='btn btn-outline'
									disabled={pageResumen === totalPagesResumen}
									onClick={() => setPageResumen((p) => p + 1)}
								>
									Siguiente <ChevronRight size={16} />
								</button>
							</div>
						</div>
					</>
				) : (
					<>
						<table className={styles.table}>
							<thead>
								<tr>
									<th>Fecha y Hora</th>
									<th>Usuario</th>
									<th>Correo</th>
									<th>Campaña</th>
									<th>Director / Enlace</th>
									<th>Enlace Visitado</th>
								</tr>
							</thead>
							<tbody>
								{paginatedDetalle.length === 0 ? (
									<tr>
										<td colSpan='6' style={{ textAlign: "center" }}>
											No hay registros detallados.
										</td>
									</tr>
								) : (
									paginatedDetalle.map((row, i) => (
										<tr key={i}>
											<td style={{ color: "var(--muted-foreground)" }}>
												{formatearFecha(row.fecha)}
											</td>
											<td>
												<strong>
													{row.usuario_nombre || (
														<span
															style={{
																color: "var(--muted-foreground)",
																fontWeight: "normal",
															}}
														>
															Sin Nombre
														</span>
													)}
												</strong>
											</td>
											<td style={{ color: "var(--muted-foreground)" }}>
												{row.email}
											</td>
											<td>{row.campana}</td>
											<td>
												<span
													style={{ fontWeight: 600, color: "var(--primary)" }}
												>
													{row.nombre_enlace || "-"}
												</span>
											</td>
											<td>
												<a
													href={row.original_url}
													target='_blank'
													rel='noreferrer'
													style={{
														color: "#0066cc",
														fontSize: "0.75rem",
														wordBreak: "break-all",
													}}
												>
													{row.original_url}
												</a>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
						<div className={styles.pagination}>
							<span>
								Página {pageDetalle} de {totalPagesDetalle}
							</span>
							<div className={styles.pageControls}>
								<button
									className='btn btn-outline'
									disabled={pageDetalle === 1}
									onClick={() => setPageDetalle((p) => p - 1)}
								>
									<ChevronLeft size={16} /> Anterior
								</button>
								<button
									className='btn btn-outline'
									disabled={pageDetalle === totalPagesDetalle}
									onClick={() => setPageDetalle((p) => p + 1)}
								>
									Siguiente <ChevronRight size={16} />
								</button>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
