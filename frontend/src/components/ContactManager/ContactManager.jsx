import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Upload, Trash2, Search, Users, ListChecks } from "lucide-react";
import styles from "./ContactManager.module.scss";

export default function ContactManager({
	selectedContacts,
	setSelectedContacts,
}) {
	const [contactos, setContactos] = useState([]);
	const [filtro, setFiltro] = useState("");
	const [textPaste, setTextPaste] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [loteSize, setLoteSize] = useState(1200);

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
			setSelectedContacts((prev) => prev.filter((c) => c.email !== email));
			cargarContactos();
		} catch {
			toast.error("Error al eliminar");
		}
	};

	const eliminarSeleccionados = async () => {
		if (
			!confirm(
				`¿Estás seguro de eliminar los ${selectedContacts.length} usuarios seleccionados?`,
			)
		)
			return;

		setIsProcessing(true);
		toast.info("Eliminando usuarios...");

		try {
			await Promise.all(
				selectedContacts.map((c) =>
					fetch(`/api/contactos/${c.email}`, { method: "DELETE" }),
				),
			);

			toast.success("Usuarios eliminados correctamente.");
			setSelectedContacts([]);
			cargarContactos();
		} catch {
			toast.error("Error al eliminar algunos usuarios.");
		}
		setIsProcessing(false);
	};

	const filtrados = contactos.filter(
		(c) =>
			(c.nombre && c.nombre.toLowerCase().includes(filtro.toLowerCase())) ||
			c.email.toLowerCase().includes(filtro.toLowerCase()),
	);

	const handleSelectAll = (e) => {
		if (e.target.checked) {
			setSelectedContacts(filtrados);
		} else {
			setSelectedContacts([]);
		}
	};

	const handleSelectLote = () => {
		const cantidad = parseInt(loteSize, 10) || 0;
		if (cantidad <= 0) return toast.error("Ingresa una cantidad válida");
		const lote = filtrados.slice(0, cantidad);
		setSelectedContacts(lote);
		toast.success(`${lote.length} contactos seleccionados en este lote.`);
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
				<div className={styles.toolbarLeft}>
					<label className={styles.selectAllLabel}>
						<input
							type='checkbox'
							checked={todosSeleccionados}
							onChange={handleSelectAll}
						/>
						Todos
					</label>

					<div className={styles.batchSelector}>
						<input
							type='number'
							className='input'
							value={loteSize}
							onChange={(e) => setLoteSize(e.target.value)}
							title='Cantidad a enviar'
						/>
						<button className='btn btn-outline' onClick={handleSelectLote}>
							<ListChecks size={14} /> Seleccionar Lote
						</button>
					</div>

					{selectedContacts.length > 0 && (
						<button
							className={styles.bulkDeleteBtn}
							onClick={eliminarSeleccionados}
							disabled={isProcessing}
						>
							<Trash2 size={14} /> Eliminar ({selectedContacts.length})
						</button>
					)}
				</div>

				<div className={styles.toolbarRight}>
					<span className={styles.totalBadge}>
						<Users size={14} /> {contactos.length} Totales
					</span>
					<div className={styles.searchBox}>
						<Search size={14} />
						<input
							type='text'
							className='input'
							placeholder='Buscar...'
							value={filtro}
							onChange={(e) => setFiltro(e.target.value)}
						/>
					</div>
				</div>
			</div>

			<div className={styles.contactList}>
				{filtrados.length === 0 ? (
					<p
						style={{
							textAlign: "center",
							color: "var(--muted-foreground)",
							marginTop: "2rem",
							fontSize: "0.75rem",
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
								<input
									type='checkbox'
									checked={isChecked}
									onChange={(e) => handleSelectOne(c, e.target.checked)}
									style={{ cursor: "pointer", marginTop: "2px" }}
								/>

								<div
									className={styles.contactInfo}
									onClick={() => handleSelectOne(c, !isChecked)}
								>
									<span className={styles.contactName}>
										{c.nombre || (
											<span style={{ color: "var(--muted-foreground)" }}>
												Sin Nombre
											</span>
										)}
									</span>
									<span className={styles.contactEmail}>{c.email}</span>
								</div>

								<button
									className={styles.deleteBtn}
									onClick={() => eliminarContacto(c.email)}
									title='Eliminar usuario'
								>
									<Trash2 size={14} />
								</button>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
