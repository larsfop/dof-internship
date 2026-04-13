import { RefProvider } from "./context/refContext.tsx";
import { AppProvider } from "./context/stateContext.tsx";

import Sidebar from "./sidebar/sidebar.tsx";
import Main from "./layout/layout.tsx";

import "./styles/main.css";
import "./styles/sidebar.css";
import "./styles/content.css";
import "./styles/viewer.css";

export default function App() {

    // if (!localStorage["userID"]) localStorage["userID"] = crypto.randomUUID();
    localStorage["userID"] = "61a1df2c-e2f9-4fa4-9222-d28e31b43573";


    return (
        <RefProvider>
            <AppProvider>
                <div id="layout">
                    <Sidebar />
                    <Main />
                </div>
            </AppProvider>
        </RefProvider>
    );
}
