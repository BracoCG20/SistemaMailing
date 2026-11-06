// backend/src/controllers/campaign.controller.js
import { pool } from '../config/db.js';
import {
  agregarLog,
  estadoEnvio,
  isWorkerRunning,
  procesarColaPersistente,
  resetEstadoEnvio,
  solicitarCancelacion,
} from '../services/queueWorker.service.js';

export const iniciarCampana = async (req, res) => {
  const { recipients, subject, htmlContent, mensaje, forzarReenvio } = req.body;
  const campana = (subject || 'Campaña sin nombre').trim();

  if (estadoEnvio.activo || isWorkerRunning()) {
    return res.status(400).json({
      error:
        'Ya hay una campaña activa en curso. Detenla o espera a que finalice.',
    });
  }
  if (
    !Array.isArray(recipients) ||
    recipients.length === 0 ||
    !subject ||
    (!htmlContent && !mensaje)
  ) {
    return res.status(400).json({ error: 'Datos de campaña incompletos.' });
  }

  let baseHtml = '';
  const mensajeFormateado = mensaje
    ? `<div style="font-family: Arial, sans-serif; padding: 20px;">${mensaje.replace(/\n/g, '<br>')}</div>`
    : '';
  if (mensaje && htmlContent) baseHtml = mensajeFormateado + htmlContent;
  else if (mensaje) baseHtml = mensajeFormateado;
  else baseHtml = htmlContent;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (forzarReenvio) {
      const listaCorreos = recipients
        .map((r) => r.email?.trim().toLowerCase())
        .filter(Boolean);

      if (listaCorreos.length > 0) {
        await client.query(
          `DELETE FROM historial_envios 
                     WHERE campana = $1 AND LOWER(TRIM(email)) = ANY($2::text[])`,
          [campana, listaCorreos],
        );
      }
    }

    const campRes = await client.query(
      `INSERT INTO cola_campanas (subject, base_html, mensaje, html_content, total, enviados, errores, estado)
             VALUES ($1, $2, $3, $4, $5, 0, 0, 'ACTIVA') RETURNING id`,
      [campana, baseHtml, mensaje || '', htmlContent || '', recipients.length],
    );
    const campanaId = campRes.rows[0].id;

    for (const r of recipients) {
      if (r.email) {
        await client.query(
          `INSERT INTO cola_destinatarios (campana_id, email, nombre, estado)
                     VALUES ($1, $2, $3, 'PENDIENTE')`,
          [campanaId, r.email.trim(), r.nombre || ''],
        );
      }
    }

    await client.query('COMMIT');

    resetEstadoEnvio(campanaId, recipients.length, {
      subject: campana,
      mensaje: mensaje || '',
      htmlContent: htmlContent || '',
    });

    agregarLog(
      'SISTEMA',
      'ok',
      `🚀 Campaña "${campana}" guardada en cola (${recipients.length} destinatarios)${forzarReenvio ? ' [Reenvío habilitado sobre la misma campaña]' : ''}.`,
    );

    res.status(200).json({
      message: 'Campaña guardada en cola e iniciada en segundo plano.',
    });

    procesarColaPersistente(campanaId);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creando cola de campaña:', err.message);
    res.status(500).json({
      error: 'No se pudo registrar la campaña en la base de datos.',
    });
  } finally {
    client.release();
  }
};

export const obtenerEstadoEnvio = (req, res) => {
  res.json(estadoEnvio);
};

export const cancelarCampana = (req, res) => {
  const cancelado = solicitarCancelacion();
  if (cancelado) {
    res.json({ success: true, message: 'Deteniendo envío...' });
  } else {
    res.status(400).json({ error: 'No hay envíos activos para detener.' });
  }
};

export const limpiarRebotes = async (req, res) => {
  const { textoError } = req.body;
  if (!textoError) return res.status(400).json({ error: 'Texto vacío' });

  const regexCorreos = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
  const correosEncontrados = textoError.match(regexCorreos);

  if (!correosEncontrados) {
    return res.json({
      eliminados: 0,
      mensaje: 'No se detectaron correos en el texto.',
    });
  }

  const correosUnicos = [...new Set(correosEncontrados)];
  const aEliminar = correosUnicos.filter(
    (email) =>
      !email.includes('google.com') &&
      !email.includes('outlook.com') &&
      !email.includes('ppops.net'),
  );

  let borrados = 0;
  try {
    for (const email of aEliminar) {
      const result = await pool.query(
        'DELETE FROM contactos WHERE email = $1',
        [email],
      );
      if (result.rowCount > 0) borrados++;
    }
    res.json({ eliminados: borrados, correos: aEliminar });
  } catch {
    res.status(500).json({ error: 'Error eliminando contactos.' });
  }
};
