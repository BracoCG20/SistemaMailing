// frontend/src/App.jsx
import { useState } from "react";
import {
	Mail,
	Users,
	FileDown,
	BarChart3,
	LayoutDashboard,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import CampaignForm from "./components/CampaignForm/CampaignForm";
import ContactManager from "./components/ContactManager/ContactManager";
import StatsTable from "./components/StatsTable/StatsTable";

function App() {
	// Estado para la navegación del Dashboard ('campana' o 'estadisticas')
	const [activeView, setActiveView] = useState("campana");

	// Estado global para conectar la lista con el formulario
	const [selectedContacts, setSelectedContacts] = useState([]);

	// Función para descargar el CSV como un Excel nativo formateado
	const descargarReporteExcel = async () => {
		try {
			toast.info("Generando reporte Excel...");
			const res = await fetch("/api/reporte-envios");
			const csvText = await res.text();

			// Parsear el CSV recibido del backend
			const rows = csvText.split("\n").map((row) => {
				// Expresión regular para separar por comas ignorando comas dentro de comillas
				const valores = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
				return valores.map((v) => v.replace(/^"|"$/g, "").trim());
			});

			// Crear libro de trabajo
			const wb = XLSX.utils.book_new();
			const ws = XLSX.utils.aoa_to_sheet(rows);

			// Ajustar ancho de columnas para que se vea profesional
			ws["!cols"] = [
				{ wch: 22 }, // Fecha
				{ wch: 25 }, // Campaña
				{ wch: 20 }, // Nombre
				{ wch: 30 }, // Email
				{ wch: 15 }, // Estado
				{ wch: 40 }, // Detalle
			];

			XLSX.utils.book_append_sheet(wb, ws, "Reporte Envios");
			XLSX.writeFile(wb, "Reporte_Envios_Profesional.xlsx");
			toast.success("Excel descargado correctamente.");
		} catch {
			toast.error("Error al generar el archivo Excel.");
		}
	};

	// Estilo dinámico para los botones del menú lateral
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
		<div
			style={{
				display: "flex",
				minHeight: "100vh",
				backgroundColor: "var(--background)",
			}}
		>
			{/* SIDEBAR (MENÚ LATERAL) */}
			<aside
				style={{
					width: "260px",
					backgroundColor: "var(--card)",
					borderRight: "1px solid var(--border)",
					padding: "1.5rem",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						fontSize: "1.25rem",
						fontWeight: "bold",
						marginBottom: "2.5rem",
						color: "var(--foreground)",
					}}
				>
					<LayoutDashboard size={24} color='var(--primary)' />
					MailingPro
				</div>

				<nav
					style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
				>
					<button
						style={navButtonStyle(activeView === "campana")}
						onClick={() => setActiveView("campana")}
					>
						<Mail size={18} /> Nueva Campaña
					</button>

					<button
						style={navButtonStyle(activeView === "estadisticas")}
						onClick={() => setActiveView("estadisticas")}
					>
						<BarChart3 size={18} /> Estadísticas y Clics
					</button>
				</nav>
			</aside>

			{/* CONTENIDO PRINCIPAL */}
			<main
				style={{
					flex: 1,
					padding: "2rem 3rem",
					overflowY: "auto",
					height: "100vh",
				}}
			>
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
								Configura tu correo y selecciona los destinatarios para el envío
								por lotes.
							</p>
						</header>

						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
								gap: "2rem",
							}}
						>
							{/* COLUMNA IZQUIERDA */}
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

							{/* COLUMNA DERECHA */}
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
										Descargar Excel (.xlsx)
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
								Revisa el rendimiento de tus enlaces y descubre quién interactúa
								con tus correos.
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
