import nodemailer from "nodemailer";

export const NOMBRE_REMITENTE = process.env.SENDER_NAME || "FERTIL";
export const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

export const transporter = nodemailer.createTransport({
	service: "gmail",
	pool: true,
	maxConnections: 2,
	maxMessages: 100,
	rateDelta: 1000,
	rateLimit: 1,
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_PASS,
	},
});
