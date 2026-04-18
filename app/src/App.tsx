import { useEffect } from "react";
import { useAppRefs } from "./context/refContext.tsx";
import Sidebar from "./sidebar/sidebar.tsx";
import Main from "./layout/layout.tsx";

import "./styles/main.css";
import "./styles/sidebar.css";
import "./styles/content.css";
import "./styles/viewer.css";

export default function App() {
    const { chatContainer } = useAppRefs();

    if (!localStorage["userID"]) localStorage["userID"] = crypto.randomUUID();

    useEffect(() => {
        function handleWheel(event: WheelEvent) {
            if (event.ctrlKey) {
                const { clientX, clientY, deltaY } = event;
                const chatContainerRef = chatContainer.current;
                if (chatContainerRef && clientInElement(clientX, clientY, chatContainerRef)) {
                    event.preventDefault();
                    event.stopPropagation();
                    const currentFontSize = parseFloat(chatContainerRef.style.fontSize)
                    const delta = deltaY > 0 ? -0.5 : 0.5;
                    chatContainerRef.style.setProperty("font-size", `${clamp(currentFontSize + delta, 8, 32)}pt`);
                    return;
                }
            }
        }
        window.addEventListener("wheel", handleWheel, { passive: false });
        return () => window.removeEventListener("wheel", handleWheel);
    }, []);

    return (
        <div id="layout">
            <Sidebar />
            <Main />
        </div>
    );
}

function clientInElement(clientX: number, clientY: number, element: HTMLElement | null) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}