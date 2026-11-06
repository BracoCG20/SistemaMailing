// frontend/src/utils/auth.utils.js

const STORAGE_KEY = "fertil_admin_key";

export const getAdminKey = () => localStorage.getItem(STORAGE_KEY) || "";

export const setAdminKey = (key) => localStorage.setItem(STORAGE_KEY, key);

export const clearAdminKey = () => localStorage.removeItem(STORAGE_KEY);

// Wrapper de fetch que inyecta automáticamente tu clave de administrador
export const authFetch = (url, options = {}) => {
	const key = getAdminKey();
	const headers = {
		...(options.headers || {}),
		"x-admin-key": key,
	};
	return fetch(url, { ...options, headers });
};
