// backend/src/config/db.js
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const initDB = async (onReadyCallback) => {
  try {
    await pool.query(`
            CREATE TABLE IF NOT EXISTS clicks (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255),
                original_url TEXT,
                campana TEXT,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            ALTER TABLE clicks ADD COLUMN IF NOT EXISTS nombre_enlace VARCHAR(255);
            
            CREATE TABLE IF NOT EXISTS contactos (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(255),
                email VARCHAR(255) UNIQUE NOT NULL,
                fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS historial_envios (
                id SERIAL PRIMARY KEY,
                campana TEXT,
                nombre VARCHAR(255),
                email VARCHAR(255),
                estado VARCHAR(50),
                detalle TEXT,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS bajas (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                campana TEXT,
                fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS cola_campanas (
                id SERIAL PRIMARY KEY,
                subject TEXT NOT NULL,
                base_html TEXT,
                mensaje TEXT,
                html_content TEXT,
                total INT DEFAULT 0,
                enviados INT DEFAULT 0,
                errores INT DEFAULT 0,
                estado VARCHAR(30) DEFAULT 'ACTIVA',
                fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE cola_campanas ADD COLUMN IF NOT EXISTS html_content TEXT;

            CREATE TABLE IF NOT EXISTS cola_destinatarios (
                id SERIAL PRIMARY KEY,
                campana_id INT REFERENCES cola_campanas(id) ON DELETE CASCADE,
                email VARCHAR(255) NOT NULL,
                nombre VARCHAR(255),
                estado VARCHAR(30) DEFAULT 'PENDIENTE',
                detalle TEXT,
                fecha_procesado TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_historial_campana_email ON historial_envios(email, campana, estado);
            CREATE INDEX IF NOT EXISTS idx_historial_fecha_estado ON historial_envios(fecha, estado);
            CREATE INDEX IF NOT EXISTS idx_cola_dest_pendientes ON cola_destinatarios(campana_id, estado);

            -- AUTO-LIMPIEZA DE REGISTROS CON DOBLE CODIFICACIÓN URL (%40, +, %3A%2F%2F)
            UPDATE clicks
            SET 
                email = REPLACE(email, '%40', '@'),
                campana = REPLACE(REPLACE(campana, '+-+', ' - '), '+', ' '),
                nombre_enlace = REPLACE(nombre_enlace, '+', ' '),
                original_url = REPLACE(REPLACE(original_url, 'https%3A%2F%2F', 'https://'), 'http%3A%2F%2F', 'http://')
            WHERE email LIKE '%\%%'
               OR campana LIKE '%+%'
               OR original_url LIKE 'http%3A%2F%2F%'
               OR original_url LIKE 'https%3A%2F%2F%';
        `);
    console.log(
      '✅ PostgreSQL conectado, tablas listas y registros URL normalizados.',
    );

    if (onReadyCallback) await onReadyCallback();
  } catch (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
  }
};
