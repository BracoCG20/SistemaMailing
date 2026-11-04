// frontend/src/App.jsx
import { useState } from "react";
import { Mail, Users, FileDown } from "lucide-react";
import CampaignForm from "./components/CampaignForm/CampaignForm";
import ContactManager from "./components/ContactManager/ContactManager";

function App() {
	// Estado global para conectar la lista con el formulario
	const [selectedContacts, setSelectedContacts] = useState([]);

	return (
		<div
			style={{ maxWidth: "1200px", margin: "2rem auto", padding: "0 1.5rem" }}
		>
			<header
				style={{
					marginBottom: "2rem",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-start",
				}}
			>
				<div>
					<h1
						style={{
							fontSize: "1.5rem",
							fontWeight: "bold",
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							marginBottom: "0.25rem",
						}}
					>
						<Mail size={24} color='var(--primary)' />
						Panel de Mailing Profesional
					</h1>
					<p style={{ color: "var(--muted-foreground)", fontSize: "0.875rem" }}>
						Envío transaccional en segundo plano con goteo anti-spam.
					</p>
				</div>
			</header>

			<main
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))",
					gap: "2rem",
				}}
			>
				{/* COLUMNA IZQUIERDA: Configuración de la Campaña */}
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

				{/* COLUMNA DERECHA: Gestión de Usuarios */}
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
							style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
						>
							<Users size={20} /> 2. Destinatarios
						</span>
						<a
							href='/api/reporte-envios'
							className='btn'
							style={{
								background: "#107c41",
								color: "white",
								textDecoration: "none",
								padding: "0.25rem 0.75rem",
								fontSize: "0.75rem",
							}}
						>
							<FileDown size={14} style={{ marginRight: "0.25rem" }} /> Reporte
						</a>
					</h2>
					<ContactManager
						selectedContacts={selectedContacts}
						setSelectedContacts={setSelectedContacts}
					/>
				</section>
			</main>
		</div>
	);
}

export default App;
