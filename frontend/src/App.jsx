import {
  FileDown,
  LayoutDashboard,
  Mail,
  Menu,
  PieChart,
  TableProperties,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import styles from './App.module.scss';
import CampaignForm from './components/CampaignForm/CampaignForm';
import ContactManager from './components/ContactManager/ContactManager';
import Dashboard from './components/Dashboard/Dashboard';
import StatsTable from './components/StatsTable/StatsTable';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard Visual', icon: PieChart },
  { id: 'campana', label: 'Nueva Campaña', icon: Mail },
  { id: 'estadisticas', label: 'Tablas de Datos', icon: TableProperties },
];

function App() {
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const descargarReporteExcel = async () => {
    try {
      toast.info('Generando reporte Excel...');
      const res = await fetch('/api/reporte-envios');
      const csvText = await res.text();

      const rows = csvText.split('\n').map((row) => {
        const valores = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        return valores.map((v) => v.replace(/^"|"$/g, '').trim());
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);

      ws['!cols'] = [
        { wch: 22 },
        { wch: 25 },
        { wch: 20 },
        { wch: 30 },
        { wch: 15 },
        { wch: 40 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Reporte Envios');
      XLSX.writeFile(wb, 'Reporte_Envios_Profesional.xlsx');
      toast.success('Excel descargado correctamente.');
    } catch {
      toast.error('Error al generar el archivo Excel.');
    }
  };

  const handleNavClick = (viewId) => {
    setActiveView(viewId);
    setIsSidebarOpen(false);
  };

  return (
    <div className={styles.layout}>
      {isSidebarOpen && (
        <div
          className={styles.overlay}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}
      >
        <div className={styles.sidebarHeader}>
          <div className={styles.brand}>
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
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`${styles.navButton} ${activeView === id ? styles.navButtonActive : ''}`}
              onClick={() => handleNavClick(id)}
            >
              <Icon size={17} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
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
          <span className={styles.mobileBrand}>MailingPro</span>
        </div>

        {/* VISTA 0: DASHBOARD VISUAL */}
        {activeView === 'dashboard' && (
          <div className={styles.viewContainer}>
            <header className={styles.viewHeader}>
              <h1>Dashboard General</h1>
              <p>Visión general del rendimiento de tus campañas.</p>
            </header>
            <Dashboard />
          </div>
        )}

        {/* VISTA 1: NUEVA CAMPAÑA */}
        {activeView === 'campana' && (
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
        {activeView === 'estadisticas' && (
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
