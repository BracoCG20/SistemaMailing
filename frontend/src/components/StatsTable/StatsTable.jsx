// frontend/src/components/StatsTable/StatsTable.jsx
import {
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	FileDown,
	RefreshCcw,
	Search,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
	esCampanaValida,
	esClickValido,
	obtenerNombreReal,
} from "../../utils/campaigns.utils.js";
import styles from "./StatsTable.module.scss";

const ITEMS_PER_PAGE_RESUMEN = 10;
const ITEMS_PER_PAGE_DETALLE = 30;

const formatearFecha = (fechaISO) => {
	return new Date(fechaISO).toLocaleString("es-PE", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
};

const formatearNombreDesdeEmail = (nombreDB, email) => {
	if (nombreDB && nombreDB.trim() !== "") {
		return { texto: nombreDB.trim() };
	}
	if (!email || !email.includes("@")) {
		return { texto: "Sin Nombre" };
	}
	const localPart = email.split("@")[0];
	const limpio = localPart
		.replace(/[._-]+/g, " ")
		.replace(/\d+/g, "")
		.trim();

	if (!limpio) return { texto: "Sin Nombre" };

	const capitalizado = limpio
		.split(/\s+/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ");

	return { texto: capitalizado };
};

export default function StatsTable() {
	const [activeTab, setActiveTab] = useState("resumen");
	const [stats, setStats] = useState([]);
	const [detalles, setDetalles] = useState([]);
	const [loading, setLoading] = useState(true);

	const [pageResumen, setPageResumen] = useState(1);
	const [pageDetalle, setPageDetalle] = useState(1);
	const [filtroDetalle, setFiltroDetalle] = useState(""); // <-- NUEVO BUSCADOR DE USUARIOS
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

			const statsLimpio = statsRaw.filter((s) => esCampanaValida(s.campana));
			setStats(statsLimpio);

			const datosCorregidos = detallesRaw.filter(esClickValido).map((item) => ({
				...item,
				nombre_enlace: obtenerNombreReal(item.original_url, item.nombre_enlace),
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
		setFiltroDetalle("");
	};

	const toggleExpand = (campana) => {
		setExpandedCampaigns((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(campana)) newSet.delete(campana);
			else newSet.add(campana);
			return newSet;
		});
	};

	const arrayResumen = useMemo(() => {
		const agrupados = stats.reduce((acc, curr) => {
			if (!acc[curr.campana]) {
				acc[curr.campana] = { totalClicks: 0, enlaces: [] };
			}
			acc[curr.campana].totalClicks += parseInt(curr.click_count, 10);
			acc[curr.campana].enlaces.push(curr);
			return acc;
		}, {});

		return Object.entries(agrupados).map(([campana, data]) => ({
			campana,
			...data,
		}));
	}, [stats]);

	// Filtrar detalles por nombre o correo
	const detallesFiltrados = useMemo(() => {
		if (!filtroDetalle.trim()) return detalles;
		const query = filtroDetalle.toLowerCase();
		return detalles.filter((d) => {
			const { texto: nombreFormateado } = formatearNombreDesdeEmail(
				d.usuario_nombre,
				d.email,
			);
			return (
				nombreFormateado.toLowerCase().includes(query) ||
				d.email.toLowerCase().includes(query) ||
				d.campana.toLowerCase().includes(query)
			);
		});
	}, [detalles, filtroDetalle]);

	const totalPagesResumen =
		Math.ceil(arrayResumen.length / ITEMS_PER_PAGE_RESUMEN) || 1;
	const paginatedResumen = arrayResumen.slice(
		(pageResumen - 1) * ITEMS_PER_PAGE_RESUMEN,
		pageResumen * ITEMS_PER_PAGE_RESUMEN,
	);

	const totalPagesDetalle =
		Math.ceil(detallesFiltrados.length / ITEMS_PER_PAGE_DETALLE) || 1;
	const paginatedDetalle = detallesFiltrados.slice(
		(pageDetalle - 1) * ITEMS_PER_PAGE_DETALLE,
		pageDetalle * ITEMS_PER_PAGE_DETALLE,
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
				const dataPlana = detallesFiltrados.map((d) => {
					const { texto } = formatearNombreDesdeEmail(
						d.usuario_nombre,
						d.email,
					);
					return [
						formatearFecha(d.fecha),
						texto,
						d.email,
						d.campana,
						d.nombre_enlace || "-",
						d.original_url,
					];
				});
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
		<div className={styles.statsContainer}>
			<div className={styles.header}>
				<div className={styles.tabsList}>
					<button
						className={`${styles.tabTrigger} ${activeTab === "resumen" ? styles.active : ""}`}
						onClick={() => handleTabChange("resumen")}
					>
						Resumen por Campaña
					</button>
					<button
						className={`${styles.tabTrigger} ${activeTab === "detalle" ? styles.active : ""}`}
						onClick={() => handleTabChange("detalle")}
					>
						Detalle por Usuario
					</button>
				</div>

				<div className={styles.actions}>
					<button
						className={`btn btn-outline ${styles.exportBtn}`}
						onClick={exportarExcel}
					>
						<FileDown size={15} /> Exportar Vista
					</button>
					<button
						className={`btn btn-outline ${styles.actionBtn}`}
						onClick={cargarDatos}
						disabled={loading}
					>
						<RefreshCcw size={15} /> Actualizar
					</button>
				</div>
			</div>

			{/* BARRA DE BÚSQUEDA EXCLUSIVA PARA DETALLE POR USUARIO */}
			{activeTab === "detalle" && (
				<div
					style={{
						display: "flex",
						justifyContent: "flex-end",
						marginBottom: "0.75rem",
					}}
				>
					<div className={styles.searchBox}>
						<Search size={14} />
						<input
							type='text'
							className='input'
							placeholder='Buscar por usuario o correo...'
							value={filtroDetalle}
							onChange={(e) => {
								setFiltroDetalle(e.target.value);
								setPageDetalle(1);
							}}
							style={{
								width: "260px",
								fontSize: "0.75rem",
								paddingLeft: "2rem",
								height: "32px",
							}}
						/>
					</div>
				</div>
			)}

			<div className={styles.tableWrapper}>
				{activeTab === "resumen" ? (
					<>
						<table className={styles.table}>
							<thead>
								<tr>
									<th className={styles.iconCol}></th>
									<th>Nombre de la Campaña</th>
									<th>Total de Clics</th>
								</tr>
							</thead>
							<tbody>
								{paginatedResumen.length === 0 ? (
									<tr>
										<td colSpan='3' className={styles.emptyCell}>
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
													<td className={styles.chevronCell}>
														{isExpanded ? (
															<ChevronDown size={16} />
														) : (
															<ChevronRight size={16} />
														)}
													</td>
													<td className={styles.campaignCell}>{row.campana}</td>
													<td>
														<span className={styles.badge}>
															{row.totalClicks} clics globales
														</span>
													</td>
												</tr>
												{isExpanded && (
													<tr>
														<td colSpan='3' className={styles.expandedCell}>
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
																						className={styles.urlLink}
																					>
																						{enlace.original_url}
																					</a>
																				</td>
																				<td className={styles.subCountCell}>
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
									className={`btn btn-outline ${styles.pageBtn}`}
									disabled={pageResumen === 1}
									onClick={() => setPageResumen((p) => p - 1)}
								>
									<ChevronLeft size={15} /> Anterior
								</button>
								<button
									className={`btn btn-outline ${styles.pageBtn}`}
									disabled={pageResumen === totalPagesResumen}
									onClick={() => setPageResumen((p) => p + 1)}
								>
									Siguiente <ChevronRight size={15} />
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
										<td colSpan='6' className={styles.emptyCell}>
											No hay registros detallados.
										</td>
									</tr>
								) : (
									paginatedDetalle.map((row, i) => {
										const usuarioInfo = formatearNombreDesdeEmail(
											row.usuario_nombre,
											row.email,
										);
										return (
											<tr key={i}>
												<td className={styles.mutedCell}>
													{formatearFecha(row.fecha)}
												</td>
												<td className={styles.userCell}>
													<span>{usuarioInfo.texto}</span>
												</td>
												<td className={styles.mutedCell}>{row.email}</td>
												<td>{row.campana}</td>
												<td className={styles.directorCell}>
													{row.nombre_enlace || "-"}
												</td>
												<td>
													<a
														href={row.original_url}
														target='_blank'
														rel='noreferrer'
														className={styles.urlLink}
													>
														{row.original_url}
													</a>
												</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>

						<div className={styles.pagination}>
							<span>
								Página {pageDetalle} de {totalPagesDetalle} (
								{detallesFiltrados.length} registros)
							</span>
							<div className={styles.pageControls}>
								<button
									className={`btn btn-outline ${styles.pageBtn}`}
									disabled={pageDetalle === 1}
									onClick={() => setPageDetalle((p) => p - 1)}
								>
									<ChevronLeft size={15} /> Anterior
								</button>
								<button
									className={`btn btn-outline ${styles.pageBtn}`}
									disabled={pageDetalle === totalPagesDetalle}
									onClick={() => setPageDetalle((p) => p + 1)}
								>
									Siguiente <ChevronRight size={15} />
								</button>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
