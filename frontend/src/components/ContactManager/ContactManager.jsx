import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Upload, Trash2, Search } from "lucide-react";
import styles from "./ContactManager.module.scss";

export default function ContactManager({
	selectedContacts,
	setSelectedContacts,
}) {
	const [contactos, setContactos] = useState([]);
	const [filtro, setFiltro] = useState("");
	const [textPaste, setTextPaste] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);

	const cargarContactos = async () => {
		try {
			const res = await fetch("/api/contactos");
			const data = await res.json();
			setContactos(data);
		} catch {
			toast.error("Error al cargar contactos de la base de datos.");
		}
	};

	useEffect(() => {
		// eslint-disable-next-line
		cargarContactos();
	}, []);

	const procesarImportacion = async () => {
		const file = document.getElementById("fileExcel").files[0];
		let nuevosContactos = [];
		setIsProcessing(true);

		try {
			// 1. Procesar Excel
			if (file) {
				const data = await file.arrayBuffer();
				const workbook = XLSX.read(data);
				const sheet = workbook.Sheets[workbook.SheetNames[0]];
				const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

				rows.forEach((row) => {
					if (row.length > 0) {
						const email = row[1]
							? row[1].toString().trim()
							: row[0].toString().trim();
						const nombre = row[1] ? row[0].toString().trim() : "";
						if (email.includes("@")) nuevosContactos.push({ nombre, email });
					}
				});
			}

			// 2. Procesar Texto
			if (textPaste) {
				const lineas = textPaste.split("\n");
				lineas.forEach((linea) => {
					const partes = linea.split(/[\t,;]+/).map((s) => s.trim());
					if (partes.length > 0) {
						const email = partes[partes.length - 1];
						const nombre = partes.length > 1 ? partes[0] : "";
						if (email.includes("@")) nuevosContactos.push({ nombre, email });
					}
				});
			}

			if (nuevosContactos.length === 0) {
				toast.error("No se detectaron correos válidos.");
				setIsProcessing(false);
				return;
			}

			// 3. Enviar a BD
			const res = await fetch("/api/contactos-bulk", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ contactos: nuevosContactos }),
			});
			const data = await res.json();

			toast.success(`¡${data.procesados} contactos guardados!`);
			document.getElementById("fileExcel").value = "";
			setTextPaste("");
			cargarContactos();
		} catch {
			toast.error("Error al procesar y guardar contactos.");
		}
		setIsProcessing(false);
	};

	const eliminarContacto = async (email) => {
		if (!confirm(`¿Eliminar a ${email}?`)) return;
		try {
			await fetch(`/api/contactos/${email}`, { method: "DELETE" });
			toast.success("Contacto eliminado");
			// Quitarlo de los seleccionados si estaba
			setSelectedContacts((prev) => prev.filter((c) => c.email !== email));
			cargarContactos();
		} catch {
			toast.error("Error al eliminar");
		}
	};

	const handleSelectAll = (e) => {
		if (e.target.checked) {
			setSelectedContacts(filtrados);
		} else {
			setSelectedContacts([]);
		}
	};

	const handleSelectOne = (contacto, checked) => {
		if (checked) {
			setSelectedContacts((prev) => [...prev, contacto]);
		} else {
			setSelectedContacts((prev) =>
				prev.filter((c) => c.email !== contacto.email),
			);
		}
	};

	const filtrados = contactos.filter(
		(c) =>
			(c.nombre && c.nombre.toLowerCase().includes(filtro.toLowerCase())) ||
			c.email.toLowerCase().includes(filtro.toLowerCase()),
	);

	const todosSeleccionados =
		filtrados.length > 0 &&
		filtrados.every((f) => selectedContacts.some((sc) => sc.email === f.email));

	return (
		<div>
			<div className={styles.uploadModule}>
				<p className={styles.title}>Importar Contactos Masivos</p>
				<input
					type='file'
					id='fileExcel'
					accept='.xlsx, .xls, .csv'
					className='input'
					style={{ marginBottom: "0.5rem" }}
				/>
				<textarea
					className='textarea'
					rows='2'
					placeholder='O pega: Nombre, Correo (uno por línea)'
					value={textPaste}
					onChange={(e) => setTextPaste(e.target.value)}
				/>
				<button
					className='btn btn-outline'
					style={{ width: "100%", marginTop: "0.5rem" }}
					onClick={procesarImportacion}
					disabled={isProcessing}
				>
					<Upload size={16} style={{ marginRight: "0.5rem" }} />
					{isProcessing ? "Procesando..." : "Procesar y Guardar"}
				</button>
			</div>

			<div className={styles.toolbar}>
				<label
					style={{
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						fontSize: "0.875rem",
					}}
				>
					<input
						type='checkbox'
						checked={todosSeleccionados}
						onChange={handleSelectAll}
					/>
					Seleccionar Todos
				</label>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						position: "relative",
					}}
				>
					<Search
						size={16}
						style={{
							position: "absolute",
							left: "0.5rem",
							color: "var(--muted-foreground)",
						}}
					/>
					<input
						type='text'
						className='input'
						placeholder='Buscar...'
						style={{ paddingLeft: "2rem", width: "200px" }}
						value={filtro}
						onChange={(e) => setFiltro(e.target.value)}
					/>
				</div>
			</div>

			<div className={styles.contactList}>
				{filtrados.length === 0 ? (
					<p
						style={{
							textAlign: "center",
							color: "var(--muted-foreground)",
							marginTop: "2rem",
						}}
					>
						No hay resultados.
					</p>
				) : (
					filtrados.map((c) => {
						const isChecked = selectedContacts.some(
							(sc) => sc.email === c.email,
						);
						return (
							<div key={c.email} className={styles.contactItem}>
								<label className={styles.label}>
									<input
										type='checkbox'
										checked={isChecked}
										onChange={(e) => handleSelectOne(c, e.target.checked)}
									/>
									{c.nombre ? (
										<>
											{c.nombre}{" "}
											<span style={{ color: "var(--muted-foreground)" }}>
												({c.email})
											</span>
										</>
									) : (
										c.email
									)}
								</label>
								<button
									className={styles.deleteBtn}
									onClick={() => eliminarContacto(c.email)}
								>
									<Trash2 size={16} />
								</button>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
