//frontend/src/components/CampaignForm/CampaignForm.jsx
import { Activity, SendHorizontal, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import styles from './CampaignForm.module.scss';

export default function CampaignForm({ selectedContacts, onClearSelection }) {
  const [subject, setSubject] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [htmlContent, setHtmlContent] = useState('');

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
      const res = await fetch('/api/status-envio');
      const data = await res.json();
      setStatus(data);

      if (data.activo) {
        setIsSending(true);
        pollingTimer.current = setTimeout(checkStatus, 2500);
      } else if (data.total > 0 && !data.activo) {
        setIsSending((prevSending) => {
          if (prevSending) {
            if (data.cancelado) {
              toast.error(
                'El envío se detuvo. Revisa el registro de actividad.',
              );
            } else {
              toast.success('¡Campaña finalizada!');
            }
            onClearSelection();
          }
          return false;
        });
      }
    } catch (error) {
      console.error(error);
      pollingTimer.current = setTimeout(checkStatus, 4000);
    }
  };

  useEffect(() => {
    checkStatus();
    return () => clearTimeout(pollingTimer.current);
    // eslint-disable-next-line
  }, []);

  const iniciarEnvio = async () => {
    if (selectedContacts.length === 0)
      return toast.error('Selecciona al menos 1 destinatario.');
    if (!subject) return toast.error('El asunto es obligatorio.');
    if (!mensaje && !htmlContent)
      return toast.error('Debes incluir un mensaje o código HTML.');

    setIsSending(true);
    setStatus({
      total: selectedContacts.length,
      enviados: 0,
      errores: 0,
      log: [
        {
          email: 'SISTEMA',
          status: 'ok',
          detalle: 'Registrando cola segura en el servidor...',
        },
      ],
    });

    try {
      const res = await fetch('/api/send-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: selectedContacts,
          subject,
          mensaje,
          htmlContent,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Error al iniciar campaña');
        setIsSending(false);
        return;
      }

      toast.success('Campaña en cola e iniciada en segundo plano.');
      checkStatus();
    } catch {
      toast.error('Error de conexión con el servidor.');
      setIsSending(false);
    }
  };

  const cancelarEnvio = async () => {
    if (
      !confirm(
        '¿Estás seguro de detener el envío? Esto cancelará los correos restantes.',
      )
    )
      return;
    try {
      const res = await fetch('/api/cancelar-envio', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success('Enviando orden de detención...');
      }
    } catch {
      toast.error(
        'No se pudo contactar con el servidor para detener el envío.',
      );
    }
  };

  const porcentaje =
    status.total > 0
      ? Math.round(((status.enviados + status.errores) / status.total) * 100)
      : 0;
  const ultimosLogs = status.log ? status.log.slice(-15).reverse() : [];

  return (
    <div className={styles.campaignForm}>
      <div className={styles.formGroup}>
        <label>Asunto del correo</label>
        <input
          className='input'
          type='text'
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder='Ej: Novedades FERTIL'
        />
      </div>

      <div className={styles.formGroup}>
        <label>Mensaje (Opcional — puedes usar {'{{nombre}}'})</label>
        <textarea
          className='textarea'
          rows='3'
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
          placeholder='Hola {{nombre}}, te compartimos nuestras novedades...'
        />
      </div>

      <div className={styles.formGroup}>
        <label>Código HTML (Opcional)</label>
        <textarea
          className='textarea'
          rows='7'
          value={htmlContent}
          onChange={(e) => setHtmlContent(e.target.value)}
          placeholder='Pega tu HTML aquí...'
        />
      </div>

      <div className={styles.actionButtons}>
        <button
          className='btn btn-primary'
          style={{ flex: 1 }}
          onClick={iniciarEnvio}
          disabled={isSending}
        >
          {isSending ? (
            <Activity
              size={16}
              style={{
                marginRight: '0.5rem',
                animation: 'spin 2s linear infinite',
              }}
            />
          ) : (
            <SendHorizontal
              size={16}
              style={{ marginRight: '0.5rem' }}
            />
          )}
          {isSending
            ? 'Campaña en Curso...'
            : `Enviar a ${selectedContacts.length} Seleccionados`}
        </button>

        {isSending && (
          <button
            className='btn btn-outline'
            style={{ color: '#ef4444', borderColor: '#ef4444' }}
            onClick={cancelarEnvio}
          >
            <XCircle
              size={16}
              style={{ marginRight: '0.5rem' }}
            />{' '}
            Detener
          </button>
        )}
      </div>

      {/* VERIFICADOR EN VIVO */}
      {(isSending || status.total > 0) && (
        <div className={styles.progressContainer}>
          <div className={styles.progressHeader}>
            <span>
              Procesados: {status.enviados + status.errores} de {status.total}{' '}
              {status.errores > 0 && (
                <span className={styles.errorText}>
                  ({status.errores} fallidos)
                </span>
              )}
            </span>
            <span className={styles.percentText}>{porcentaje}%</span>
          </div>
          <div className={styles.progressBarBg}>
            <div
              className={styles.progressBar}
              style={{
                width: `${porcentaje}%`,
                backgroundColor: status.cancelado
                  ? '#ef4444'
                  : 'var(--primary)',
              }}
            ></div>
          </div>
          <ul className={styles.logList}>
            {ultimosLogs.map((log, i) => (
              <li key={i}>
                {log.email === 'SISTEMA' && log.status !== 'error' && (
                  <span className={styles.logSystem}>ℹ️ {log.detalle}</span>
                )}
                {log.email === 'SISTEMA' && log.status === 'error' && (
                  <span className={styles.logSystemError}>{log.detalle}</span>
                )}
                {log.status === 'ok' && log.email !== 'SISTEMA' && (
                  <span className={styles.logSuccess}>
                    ✅ {log.email}{' '}
                    <span className={styles.logDetail}>{log.detalle}</span>
                  </span>
                )}
                {log.status === 'error' && log.email !== 'SISTEMA' && (
                  <span className={styles.logError}>
                    ❌ <strong>{log.email}</strong>: {log.detalle}
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
