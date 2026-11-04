// frontend/src/App.jsx
import { useState } from "react";
import {
	Mail,
	Users,
	FileDown,
	BarChart3,
	LayoutDashboard,
	Menu,
	X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import CampaignForm from "./components/CampaignForm/CampaignForm";
import ContactManager from "./components/ContactManager/ContactManager";
import StatsTable from "./components/StatsTable/StatsTable";
import styles from "./App.module.scss"; // <-- Importamos los estilos responsive

function App() {
	const [activeView, setActiveView] = useState("campana");
	const [selectedContacts, setSelectedContacts] = useState([]);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Estado para el menú móvil

	const descargarReporteExcel = async () => {
		try {
			toast.info("Generando reporte Excel...");
			const res = await fetch("/api/reporte-envios");
			const csvText = await res.text();

			const rows = csvText.split("\n").map((row) => {
				const valores = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
				return valores.map((v) => v.replace(/^"|"$/g, "").trim());
			});

			const wb = XLSX.utils.book_new();
			const ws = XLSX.utils.aoa_to_sheet(rows);

			ws["!cols"] = [
				{ wch: 22 },
				{ wch: 25 },
				{ wch: 20 },
				{ wch: 30 },
				{ wch: 15 },
				{ wch: 40 },
			];

			XLSX.utils.book_append_sheet(wb, ws, "Reporte Envios");
			XLSX.writeFile(wb, "Reporte_Envios_Profesional.xlsx");
			toast.success("Excel descargado correctamente.");
		} catch {
			toast.error("Error al generar el archivo Excel.");
		}
	};

	const handleNavClick = (view) => {
		setActiveView(view);
		setIsSidebarOpen(false); // Cierra el menú en móvil al hacer clic
	};

	const navButtonStyle = (isActive) => ({
		display: "flex",
		alignItems: "center",
		gap: "0.75rem",
		padding: "0.75rem 1rem",
		borderRadius: "var(--radius)",
		border: "none",
		cursor: "pointer",
		fontSize: "0.875rem",
		fontWeight: "500",
		width: "100%",
		textAlign: "left",
		backgroundColor: isActive ? "var(--primary)" : "transparent",
		color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
		transition: "all 0.2s",
	});

	return (
		<div className={styles.layout}>
			{/* Fondo oscuro para móvil cuando el menú está abierto */}
			{isSidebarOpen && (
				<div
					className={styles.overlay}
					onClick={() => setIsSidebarOpen(false)}
				></div>
			)}

			{/* SIDEBAR */}
			<aside
				className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}
			>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: "2.5rem",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							fontSize: "1.25rem",
							fontWeight: "bold",
							color: "var(--foreground)",
						}}
					>
						<LayoutDashboard size={24} color='var(--primary)' />
						MailingPro
					</div>
					{/* Botón cerrar solo visible en móvil (manejado por css o render condicional) */}
					<button
						className='btn btn-outline'
						style={{ padding: "0.25rem" }}
						onClick={() => setIsSidebarOpen(false)}
						aria-label='Cerrar menú'
					>
						<X
							size={20}
							className='md-hidden'
							style={{ display: window.innerWidth > 768 ? "none" : "block" }}
						/>
					</button>
				</div>

				<nav
					style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
				>
					<button
						style={navButtonStyle(activeView === "campana")}
						onClick={() => handleNavClick("campana")}
					>
						<Mail size={18} /> Nueva Campaña
					</button>
					<button
						style={navButtonStyle(activeView === "estadisticas")}
						onClick={() => handleNavClick("estadisticas")}
					>
						<BarChart3 size={18} /> Estadísticas y Clics
					</button>
				</nav>
			</aside>

			{/* CONTENIDO PRINCIPAL */}
			<main className={styles.mainContent}>
				{/* Header Móvil (Hamburguesa) */}
				<div className={styles.mobileHeader}>
					<button
						className='btn btn-outline'
						style={{ padding: "0.5rem" }}
						onClick={() => setIsSidebarOpen(true)}
					>
						<Menu size={20} />
					</button>
					<span style={{ fontWeight: "bold", fontSize: "1.125rem" }}>
						MailingPro
					</span>
				</div>

				{/* VISTA 1: NUEVA CAMPAÑA */}
				{activeView === "campana" && (
					<div style={{ maxWidth: "1200px", margin: "0 auto" }}>
						<header style={{ marginBottom: "2rem" }}>
							<h1
								style={{
									fontSize: "1.5rem",
									fontWeight: "bold",
									marginBottom: "0.25rem",
								}}
							>
								Lanzar Nueva Campaña
							</h1>
							<p
								style={{
									color: "var(--muted-foreground)",
									fontSize: "0.875rem",
								}}
							>
								Configura tu correo y selecciona destinatarios.
							</p>
						</header>

						<div className={styles.gridContainer}>
							<section className='card'>
								<h2
									style={{
										fontSize: "1.125rem",
										marginBottom: "1.5rem",
										borderBottom: "1px solid var(--border)",
										paddingBottom: "0.75rem",
										fontWeight: "600",
									}}
								>
									1. Configuración de Campaña
								</h2>
								<CampaignForm
									selectedContacts={selectedContacts}
									onClearSelection={() => setSelectedContacts([])}
								/>
							</section>

							<section className='card'>
								<h2
									style={{
										fontSize: "1.125rem",
										marginBottom: "1.5rem",
										borderBottom: "1px solid var(--border)",
										paddingBottom: "0.75rem",
										fontWeight: "600",
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										flexWrap: "wrap",
										gap: "1rem",
									}}
								>
									<span
										style={{
											display: "flex",
											alignItems: "center",
											gap: "0.5rem",
										}}
									>
										<Users size={20} /> 2. Destinatarios
									</span>
									<button
										onClick={descargarReporteExcel}
										className='btn'
										style={{
											background: "#107c41",
											color: "white",
											border: "none",
											cursor: "pointer",
											padding: "0.4rem 0.75rem",
											fontSize: "0.75rem",
										}}
									>
										<FileDown size={14} style={{ marginRight: "0.25rem" }} />{" "}
										Descargar Excel
									</button>
								</h2>
								<ContactManager
									selectedContacts={selectedContacts}
									setSelectedContacts={setSelectedContacts}
								/>
							</section>
						</div>
					</div>
				)}

				{/* VISTA 2: ESTADÍSTICAS */}
				{activeView === "estadisticas" && (
					<div style={{ maxWidth: "1200px", margin: "0 auto" }}>
						<header style={{ marginBottom: "2rem" }}>
							<h1
								style={{
									fontSize: "1.5rem",
									fontWeight: "bold",
									marginBottom: "0.25rem",
								}}
							>
								Análisis de Interacción
							</h1>
							<p
								style={{
									color: "var(--muted-foreground)",
									fontSize: "0.875rem",
								}}
							>
								Revisa el rendimiento de tus enlaces.
							</p>
						</header>

						<section className='card'>
							<StatsTable />
						</section>
					</div>
				)}
			</main>
		</div>
	);
}

export default App;
