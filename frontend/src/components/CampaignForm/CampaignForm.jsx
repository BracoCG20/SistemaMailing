import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { SendHorizontal, Activity } from "lucide-react";
import styles from "./CampaignForm.module.scss";

export default function CampaignForm({ selectedContacts, onClearSelection }) {
	const [subject, setSubject] = useState("");
	const [mensaje, setMensaje] = useState("");
	const [htmlContent, setHtmlContent] = useState("");

	// Estado del proceso
	const [isSending, setIsSending] = useState(false);
	const [status, setStatus] = useState({
		total: 0,
		enviados: 0,
		errores: 0,
		log: [],
	});
	const pollingTimer = useRef(null);

	const checkStatus = async () => {
		try {
			const res = await fetch("/api/status-envio");
			const data = await res.json();
			setStatus(data);

			if (data.activo) {
				pollingTimer.current = setTimeout(checkStatus, 2000);
			} else if (data.total > 0 && !data.activo) {
				setIsSending(false);
				toast.success("¡Campaña finalizada!");
				onClearSelection();
			}
		} catch (error) {
			console.error(error);
			pollingTimer.current = setTimeout(checkStatus, 3000); // Reintentar si hay fallo de red
		}
	};

	const iniciarEnvio = async () => {
		if (selectedContacts.length === 0)
			return toast.error("Selecciona al menos 1 destinatario.");
		if (!subject) return toast.error("El asunto es obligatorio.");
		if (!mensaje && !htmlContent)
			return toast.error("Debes incluir un mensaje o código HTML.");

		setIsSending(true);
		setStatus({
			total: selectedContacts.length,
			enviados: 0,
			errores: 0,
			log: [
				{
					email: "SISTEMA",
					status: "ok",
					detalle: "Enviando orden al servidor...",
				},
			],
		});

		try {
			const res = await fetch("/api/send-background", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					recipients: selectedContacts,
					subject,
					mensaje,
					htmlContent,
				}),
			});

			if (!res.ok) {
				const err = await res.json();
				toast.error(err.error || "Error al iniciar campaña");
				setIsSending(false);
				return;
			}

			toast.success("Envío en segundo plano iniciado.");
			checkStatus(); // Iniciar polling
		} catch {
			toast.error("Error de conexión con el servidor.");
			setIsSending(false);
		}
	};

	// Limpiar timer si el componente se desmonta
	useEffect(() => {
		return () => clearTimeout(pollingTimer.current);
	}, []);

	const porcentaje =
		status.total > 0
			? Math.round(((status.enviados + status.errores) / status.total) * 100)
			: 0;
	const ultimosLogs = status.log.slice(-10).reverse();

	return (
		<div>
			<div className={styles.formGroup}>
				<label>Asunto del correo:</label>
				<input
					className='input'
					type='text'
					value={subject}
					onChange={(e) => setSubject(e.target.value)}
					placeholder='Ej: Novedades FERTIL'
				/>
			</div>

			<div className={styles.formGroup}>
				<label>Mensaje (Opcional):</label>
				<textarea
					className='textarea'
					rows='3'
					value={mensaje}
					onChange={(e) => setMensaje(e.target.value)}
					placeholder='Escribe un mensaje...'
				/>
			</div>

			<div className={styles.formGroup}>
				<label>Código HTML (Opcional):</label>
				<textarea
					className='textarea'
					rows='8'
					value={htmlContent}
					onChange={(e) => setHtmlContent(e.target.value)}
					placeholder='Pega tu HTML aquí...'
					style={{ fontFamily: "monospace", fontSize: "12px" }}
				/>
			</div>

			<button
				className='btn btn-primary'
				style={{ width: "100%", padding: "0.75rem" }}
				onClick={iniciarEnvio}
				disabled={isSending}
			>
				{isSending ? (
					<Activity
						size={18}
						style={{
							marginRight: "0.5rem",
							animation: "spin 2s linear infinite",
						}}
					/>
				) : (
					<SendHorizontal size={18} style={{ marginRight: "0.5rem" }} />
				)}
				{isSending
					? "Enviando Campaña..."
					: `Enviar a ${selectedContacts.length} Seleccionados`}
			</button>

			{/* VERIFICADOR EN VIVO */}
			{(isSending || status.total > 0) && (
				<div className={styles.progressContainer}>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontSize: "0.875rem",
							fontWeight: "bold",
						}}
					>
						<span>
							Enviando: {status.enviados + status.errores} de {status.total}
						</span>
						<span>{porcentaje}%</span>
					</div>
					<div className={styles.progressBarBg}>
						<div
							className={styles.progressBar}
							style={{ width: `${porcentaje}%` }}
						></div>
					</div>
					<ul className={styles.logList}>
						{ultimosLogs.map((log, i) => (
							<li key={i}>
								{log.email === "SISTEMA" && (
									<span style={{ color: "#3b82f6" }}>🕒 {log.detalle}</span>
								)}
								{log.status === "ok" && log.email !== "SISTEMA" && (
									<span style={{ color: "#22c55e" }}>
										✅ Enviado: {log.email}
									</span>
								)}
								{log.status === "error" && (
									<span style={{ color: "#ef4444" }}>
										❌ Error: {log.email}
									</span>
								)}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
