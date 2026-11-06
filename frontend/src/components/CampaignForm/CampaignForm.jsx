// frontend/src/components/CampaignForm/CampaignForm.jsx
import { Activity, Lock, SendHorizontal, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { authFetch } from '../../utils/auth.utils.js';
import styles from './CampaignForm.module.scss';

const DRAFT_STORAGE_KEY = 'fertil_active_campaign_draft';

export default function CampaignForm({ selectedContacts, onClearSelection }) {
  const [subject, setSubject] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
      return saved.subject || '';
    } catch {
      return '';
    }
  });
  const [mensaje, setMensaje] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
      return saved.mensaje || '';
    } catch {
      return '';
    }
  });
  const [htmlContent, setHtmlContent] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
      return saved.htmlContent || '';
    } catch {
      return '';
    }
  });
  const [forzarReenvio, setForzarReenvio] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState({
    total: 0,
    enviados: 0,
    errores: 0,
    log: [],
  });
  const pollingTimer = useRef(null);

  // Guardar cambios en localStorage mientras editas para no perder nunca lo escrito
  useEffect(() => {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({ subject, mensaje, htmlContent }),
    );
  }, [subject, mensaje, htmlContent]);

  const checkStatus = async () => {
    try {
      const res = await authFetch('/api/status-envio');
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data);

      // Si hay una campaña activa en el servidor, rellenar los inputs con los datos de la BD y bloquearlos
      if (data.activo) {
        setIsSending(true);
        if (data.subject !== undefined && data.subject !== '') {
          setSubject(data.subject);
        }
        if (data.mensaje !== undefined) {
          setMensaje(data.mensaje);
        }
        if (data.htmlContent !== undefined) {
          setHtmlContent(data.htmlContent);
        }
        pollingTimer.current = setTimeout(checkStatus, 2500);
      } else if (data.total > 0 && !data.activo) {
        // Cuando termina de enviar a todos los seleccionados, se desbloquean los campos
        setIsSending((prevSending) => {
          if (prevSending) {
            if (data.cancelado) {
              toast.error(
                'El envío se detuvo. Los campos se han desbloqueado.',
              );
            } else {
              toast.success(
                '¡Campaña finalizada! Ya puedes editar para una nueva campaña.',
              );
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
      const res = await authFetch('/api/send-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: selectedContacts,
          subject,
          mensaje,
          htmlContent,
          forzarReenvio,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || 'Error al iniciar campaña');
        setIsSending(false);
        return;
      }

      toast.success('Campaña bloqueada e iniciada en segundo plano.');
      setForzarReenvio(false);
      checkStatus();
    } catch {
      toast.error('Error de conexión con el servidor.');
      setIsSending(false);
    }
  };

  const cancelarEnvio = async () => {
    if (
      !confirm(
        '¿Estás seguro de detener el envío? Esto cancelará los correos restantes y desbloqueará el formulario.',
      )
    )
      return;
    try {
      const res = await authFetch('/api/cancelar-envio', {
        method: 'POST',
      });
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

  const lockedInputStyle = isSending
    ? {
        backgroundColor: 'var(--muted)',
        color: 'var(--muted-foreground)',
        cursor: 'not-allowed',
        opacity: 0.85,
      }
    : undefined;

  return (
    <div className={styles.campaignForm}>
      {isSending && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            backgroundColor: 'var(--muted)',
            border: '1px solid var(--border)',
            borderRadius: 'calc(var(--radius) - 2px)',
            fontSize: '0.75rem',
            fontWeight: 500,
            color: 'var(--foreground)',
          }}
        >
          <Lock size={14} />
          <span>
            Campaña en envío activo — los campos están protegidos hasta
            finalizar.
          </span>
        </div>
      )}

      <div className={styles.formGroup}>
        <label>Asunto del correo</label>
        <input
          className='input'
          type='text'
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder='Ej: Novedades FERTIL'
          disabled={isSending}
          style={lockedInputStyle}
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
          disabled={isSending}
          style={lockedInputStyle}
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
          disabled={isSending}
          style={lockedInputStyle}
        />
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.75rem',
          color: 'var(--muted-foreground)',
          cursor: isSending ? 'not-allowed' : 'pointer',
          opacity: isSending ? 0.6 : 1,
          userSelect: 'none',
        }}
      >
        <input
          type='checkbox'
          checked={forzarReenvio}
          onChange={(e) => setForzarReenvio(e.target.checked)}
          disabled={isSending}
          style={{
            accentColor: 'var(--primary)',
            cursor: isSending ? 'not-allowed' : 'pointer',
          }}
        />
        Reenviar a destinatarios aunque ya hayan recibido este mismo asunto
      </label>

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
            ? 'Campaña en Curso (Campos Bloqueados)...'
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
