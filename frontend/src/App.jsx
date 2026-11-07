// frontend/src/App.jsx
import {
	FileDown,
	KeyRound,
	LayoutDashboard,
	Lock,
	Mail,
	Menu,
	PieChart,
	TableProperties,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import styles from "./App.module.scss";
import CampaignForm from "./components/CampaignForm/CampaignForm";
import ContactManager from "./components/ContactManager/ContactManager";
import Dashboard from "./components/Dashboard/Dashboard";
import StatsTable from "./components/StatsTable/StatsTable";
import {
	authFetch,
	clearAdminKey,
	getAdminKey,
	setAdminKey,
} from "./utils/auth.utils.js";

const NAV_ITEMS = [
	{
		id: "dashboard",
		label: "Dashboard Visual",
		icon: PieChart,
		adminOnly: false,
	},
	{ id: "campana", label: "Nueva Campaña", icon: Mail, adminOnly: true },
	{
		id: "estadisticas",
		label: "Tablas de Datos",
		icon: TableProperties,
		adminOnly: false,
	},
];

function App() {
	const [activeView, setActiveView] = useState("dashboard");
	const [selectedContacts, setSelectedContacts] = useState([]);
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);

	// Estados del Modo Admin Oculto
	const [isAdmin, setIsAdmin] = useState(() => Boolean(getAdminKey()));
	const [showAuthModal, setShowAuthModal] = useState(false);
	const [passwordInput, setPasswordInput] = useState("");
	const [isVerifying, setIsVerifying] = useState(false);

	const clickCountRef = useRef(0);
	const clickTimerRef = useRef(null);

	// Atajo de teclado adicional: Ctrl + Shift + M
	useEffect(() => {
		const handleKeyDown = (e) => {
			if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "m") {
				e.preventDefault();
				if (!isAdmin) setShowAuthModal(true);
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isAdmin]);

	// Gesto oculto: 5 clics rápidos en el logo "MailingPro"
	const handleSecretLogoClick = () => {
		if (isAdmin) return;
		clickCountRef.current += 1;
		clearTimeout(clickTimerRef.current);

		if (clickCountRef.current >= 5) {
			clickCountRef.current = 0;
			setShowAuthModal(true);
		} else {
			clickTimerRef.current = setTimeout(() => {
				clickCountRef.current = 0;
			}, 1200);
		}
	};

	const handleVerifyAdmin = async (e) => {
		e.preventDefault();
		if (!passwordInput.trim()) return;

		setIsVerifying(true);
		try {
			const res = await fetch("/api/verify-admin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ key: passwordInput.trim() }),
			});

			if (res.ok) {
				setAdminKey(passwordInput.trim());
				setIsAdmin(true);
				setShowAuthModal(false);
				setPasswordInput("");
				setActiveView("campana");
				toast.success("Modo Administrador activado");
			} else {
				toast.error("Clave de acceso incorrecta");
			}
		} catch {
			toast.error("Error verificando clave con el servidor");
		} finally {
			setIsVerifying(false);
		}
	};

	const handleLogoutAdmin = () => {
		clearAdminKey();
		setIsAdmin(false);
		if (activeView === "campana") {
			setActiveView("dashboard");
		}
		toast.info("Módulo de campaña ocultado");
	};

	const descargarReporteExcel = async () => {
		try {
			toast.info("Generando reporte Excel...");
			const res = await authFetch("/api/reporte-envios");
			if (!res.ok) throw new Error("No autorizado");
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
				{ wch: 75 },
			];

			XLSX.utils.book_append_sheet(wb, ws, "Reporte Envios");
			XLSX.writeFile(wb, "Reporte_Envios_Profesional.xlsx");
			toast.success("Excel descargado correctamente.");
		} catch {
			toast.error("Error al generar el archivo Excel.");
		}
	};

	const handleNavClick = (viewId) => {
		setActiveView(viewId);
		setIsSidebarOpen(false);
	};

	const visibleNavItems = NAV_ITEMS.filter(
		(item) => !item.adminOnly || isAdmin,
	);

	return (
		<div className={styles.layout}>
			{isSidebarOpen && (
				<div
					className={styles.overlay}
					onClick={() => setIsSidebarOpen(false)}
				/>
			)}

			{/* MODAL OCULTO DE ACCESO ADMIN */}
			{showAuthModal && (
				<div
					className={styles.modalBackdrop}
					onClick={() => setShowAuthModal(false)}
				>
					<div
						className={styles.modalCard}
						onClick={(e) => e.stopPropagation()}
					>
						<div className={styles.modalHeader}>
							<div className={styles.modalTitle}>
								<KeyRound size={18} />
								<h3>Acceso Administrador</h3>
							</div>
							<button
								className={styles.modalClose}
								onClick={() => setShowAuthModal(false)}
							>
								<X size={16} />
							</button>
						</div>
						<p className={styles.modalDesc}>
							Ingresa tu clave para habilitar el módulo de Nueva Campaña.
						</p>
						<form onSubmit={handleVerifyAdmin} className={styles.modalForm}>
							<input
								type='password'
								className='input'
								placeholder='Clave de administrador...'
								value={passwordInput}
								onChange={(e) => setPasswordInput(e.target.value)}
								autoFocus
							/>
							<div className={styles.modalActions}>
								<button
									type='button'
									className='btn btn-outline'
									onClick={() => setShowAuthModal(false)}
								>
									Cancelar
								</button>
								<button
									type='submit'
									className='btn btn-primary'
									disabled={isVerifying}
								>
									{isVerifying ? "Verificando..." : "Desbloquear"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{/* SIDEBAR */}
			<aside
				className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}
			>
				<div className={styles.sidebarHeader}>
					<div
						className={styles.brand}
						onClick={handleSecretLogoClick}
						style={{ userSelect: "none", cursor: "pointer" }}
					>
						<LayoutDashboard size={22} />
						<span>MailingPro</span>
					</div>
					<button
						className={`btn btn-outline ${styles.closeMenuBtn}`}
						onClick={() => setIsSidebarOpen(false)}
						aria-label='Cerrar menú'
					>
						<X size={18} />
					</button>
				</div>

				<nav className={styles.navMenu}>
					{visibleNavItems.map(({ id, label, icon: Icon }) => (
						<button
							key={id}
							className={`${styles.navButton} ${activeView === id ? styles.navButtonActive : ""}`}
							onClick={() => handleNavClick(id)}
						>
							<Icon size={17} />
							<span>{label}</span>
						</button>
					))}
				</nav>

				{isAdmin && (
					<div className={styles.sidebarFooter}>
						<button className={styles.lockAdminBtn} onClick={handleLogoutAdmin}>
							<Lock size={14} />
							<span>Ocultar Modo Admin</span>
						</button>
					</div>
				)}
			</aside>

			{/* CONTENIDO PRINCIPAL */}
			<main className={styles.mainContent}>
				<div className={styles.mobileHeader}>
					<button
						className={`btn btn-outline ${styles.menuTriggerBtn}`}
						onClick={() => setIsSidebarOpen(true)}
						aria-label='Abrir menú'
					>
						<Menu size={18} />
					</button>
					<span
						className={styles.mobileBrand}
						onClick={handleSecretLogoClick}
						style={{ userSelect: "none" }}
					>
						MailingPro
					</span>
				</div>

				{/* VISTA 0: DASHBOARD VISUAL */}
				{activeView === "dashboard" && (
					<div className={styles.viewContainer}>
						<header className={styles.viewHeader}>
							<h1>Dashboard General</h1>
							<p>Visión general del rendimiento de tus campañas.</p>
						</header>
						<Dashboard />
					</div>
				)}

				{/* VISTA 1: NUEVA CAMPAÑA (Solo renderiza si isAdmin es true) */}
				{activeView === "campana" && isAdmin && (
					<div className={styles.viewContainer}>
						<header className={styles.viewHeader}>
							<h1>Lanzar Nueva Campaña</h1>
							<p>Configura tu correo y selecciona destinatarios.</p>
						</header>

						<div className={styles.gridContainer}>
							<section className='card'>
								<div className={styles.cardHeader}>
									<h2>1. Configuración de Campaña</h2>
								</div>
								<CampaignForm
									selectedContacts={selectedContacts}
									onClearSelection={() => setSelectedContacts([])}
								/>
							</section>

							<section className='card'>
								<div className={styles.cardHeader}>
									<h2>2. Destinatarios</h2>
									<button
										onClick={descargarReporteExcel}
										className={`btn ${styles.excelReportBtn}`}
									>
										<FileDown size={14} /> Exportar Registros
									</button>
								</div>
								<ContactManager
									selectedContacts={selectedContacts}
									setSelectedContacts={setSelectedContacts}
								/>
							</section>
						</div>
					</div>
				)}

				{/* VISTA 2: TABLAS DE DATOS */}
				{activeView === "estadisticas" && (
					<div className={styles.viewContainer}>
						<header className={styles.viewHeader}>
							<h1>Tablas de Datos</h1>
							<p>Explora los clics detallados y descarga informes.</p>
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
