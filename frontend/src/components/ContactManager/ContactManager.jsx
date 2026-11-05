import { useState, useEffect, useRef, useMemo } from "react";
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

	const [loteStart, setLoteStart] = useState(1);
	const [loteSize, setLoteSize] = useState(100);

	const fileInputRef = useRef(null);

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
		const file = fileInputRef.current?.files?.[0];
		const nuevosContactos = [];
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
					const partes = linea
						.split(/[\t,;]+/)
						.map((s) => s.trim())
						.filter(Boolean);
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
			if (fileInputRef.current) fileInputRef.current.value = "";
			setTextPaste("");
			cargarContactos();
		} catch {
			toast.error("Error al procesar y guardar contactos.");
		} finally {
			setIsProcessing(false);
		}
	};

	const eliminarContacto = async (email) => {
		if (!confirm(`¿Eliminar a ${email}?`)) return;
		try {
			await fetch(`/api/contactos/${encodeURIComponent(email)}`, {
				method: "DELETE",
			});
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
					fetch(`/api/contactos/${encodeURIComponent(c.email)}`, {
						method: "DELETE",
					}),
				),
			);

			toast.success("Usuarios eliminados correctamente.");
			setSelectedContacts([]);
			cargarContactos();
		} catch {
			toast.error("Error al eliminar algunos usuarios.");
		} finally {
			setIsProcessing(false);
		}
	};

	// Filtrado memorizado para no recalcular innecesariamente
	const filtrados = useMemo(() => {
		const query = filtro.toLowerCase();
		return contactos.filter(
			(c) =>
				(c.nombre && c.nombre.toLowerCase().includes(query)) ||
				c.email.toLowerCase().includes(query),
		);
	}, [contactos, filtro]);

	// Set O(1) para verificar selección instantáneamente en listas de miles de contactos
	const selectedEmailsSet = useMemo(
		() => new Set(selectedContacts.map((sc) => sc.email)),
		[selectedContacts],
	);

	const handleSelectAll = (e) => {
		setSelectedContacts(e.target.checked ? filtrados : []);
	};

	const handleSelectLote = () => {
		const inicio = parseInt(loteStart, 10) || 1;
		const cantidad = parseInt(loteSize, 10) || 0;

		if (inicio <= 0 || cantidad <= 0)
			return toast.error("Ingresa valores válidos");

		const indexInicio = inicio - 1;
		const lote = filtrados.slice(indexInicio, indexInicio + cantidad);

		if (lote.length === 0)
			return toast.warning("No hay más contactos en ese rango.");

		setSelectedContacts(lote);
		toast.success(
			`Seleccionados del ${inicio} al ${inicio + lote.length - 1}.`,
		);

		setLoteStart(inicio + lote.length);
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
		filtrados.every((f) => selectedEmailsSet.has(f.email));

	return (
		<div className={styles.contactManager}>
			{/* MÓDULO DE IMPORTACIÓN */}
			<div className={styles.uploadModule}>
				<p className={styles.title}>Importar Contactos Masivos</p>
				<input
					ref={fileInputRef}
					type='file'
					accept='.xlsx, .xls, .csv'
					className={`input ${styles.fileInput}`}
				/>
				<textarea
					className='textarea'
					rows='2'
					placeholder='O pega: Nombre, Correo (uno por línea)'
					value={textPaste}
					onChange={(e) => setTextPaste(e.target.value)}
				/>
				<button
					className={`btn btn-outline ${styles.uploadBtn}`}
					onClick={procesarImportacion}
					disabled={isProcessing}
				>
					<Upload size={15} />
					{isProcessing ? "Procesando..." : "Procesar y Guardar"}
				</button>
			</div>

			{/* BARRA DE HERRAMIENTAS Y LOTES */}
			<div className={styles.toolbar}>
				<div className={styles.toolbarLeft}>
					<label className={styles.selectAllLabel}>
						<input
							type='checkbox'
							className={styles.checkbox}
							checked={todosSeleccionados}
							onChange={handleSelectAll}
						/>
						Todos
					</label>

					<div className={styles.batchSelector}>
						<span className={styles.batchLabel}>Desde:</span>
						<input
							type='number'
							className='input'
							value={loteStart}
							onChange={(e) => setLoteStart(e.target.value)}
							title='Posición de inicio (Ej: 1)'
						/>
						<span className={styles.batchLabel}>Cant:</span>
						<input
							type='number'
							className='input'
							value={loteSize}
							onChange={(e) => setLoteSize(e.target.value)}
							title='Cantidad a seleccionar'
						/>
						<button className='btn btn-outline' onClick={handleSelectLote}>
							<ListChecks size={14} /> Seleccionar
						</button>
					</div>

					{selectedContacts.length > 0 && (
						<button
							className={styles.bulkDeleteBtn}
							onClick={eliminarSeleccionados}
							disabled={isProcessing}
							title='Eliminar seleccionados'
						>
							<Trash2 size={13} /> ({selectedContacts.length})
						</button>
					)}
				</div>

				<div className={styles.toolbarRight}>
					<span className={styles.totalBadge}>
						<Users size={13} /> {contactos.length} Totales
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

			{/* LISTA DE CONTACTOS */}
			<div className={styles.contactList}>
				{filtrados.length === 0 ? (
					<p className={styles.emptyState}>No hay resultados.</p>
				) : (
					filtrados.map((c, index) => {
						const isChecked = selectedEmailsSet.has(c.email);
						return (
							<div
								key={c.email}
								className={`${styles.contactItem} ${isChecked ? styles.contactItemSelected : ""}`}
							>
								<div className={styles.itemLeft}>
									<span className={styles.itemIndex}>{index + 1}.</span>
									<input
										type='checkbox'
										className={styles.checkbox}
										checked={isChecked}
										onChange={(e) => handleSelectOne(c, e.target.checked)}
									/>
								</div>

								<div
									className={styles.contactInfo}
									onClick={() => handleSelectOne(c, !isChecked)}
								>
									<span className={styles.contactName}>
										{c.nombre || (
											<span className={styles.noName}>Sin Nombre</span>
										)}
									</span>
									<span className={styles.contactEmail}>{c.email}</span>
								</div>

								<button
									className={styles.deleteBtn}
									onClick={() => eliminarContacto(c.email)}
									title={`Eliminar ${c.email}`}
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
