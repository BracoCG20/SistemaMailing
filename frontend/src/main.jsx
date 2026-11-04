// frontend/src/main.jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import App from "./App.jsx";
import "./index.scss";

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<App />
		<Toaster position='bottom-right' richColors />
	</StrictMode>,
);
