import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AppProvider } from "./context/stateContext";
import { RefProvider } from "./context/refContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <RefProvider>
            <AppProvider>
                <App />
            </AppProvider>
        </RefProvider>
    </React.StrictMode>,
);
