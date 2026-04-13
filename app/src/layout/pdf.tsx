import { useAppState } from "../context/stateContext.tsx";
import { useAppRefs } from "../context/refContext.tsx";
import { useEffect } from "react";

export default function RenderPDF() {
    const { fileSrc } = useAppState();
    const { main } = useAppRefs();
    if (!fileSrc) return null;

    useEffect(() => {
        main.current?.style.setProperty("grid-template-columns", "1fr 12px 1fr");
        return () => {
            main.current?.style.setProperty("grid-template-columns", "1fr 0 0");
        }
    }, []);

    return (
        <iframe 
            src={fileSrc} 
            style={{
                width: "100%",
                height: "100vh",
                border: "none"
            }}
        ></iframe>
    )
}