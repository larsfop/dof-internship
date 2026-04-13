import { useAppState } from "../context/stateContext.tsx";
import { useAppRefs } from "../context/refContext.tsx";

let firstRender = true;
export default function RenderPDF() {
    const { pdfViewer } = useAppState();
    const { main, pdfViewerRef } = useAppRefs();

    if (!pdfViewer) return null;

    if (firstRender) {
        main.current?.style.setProperty("grid-template-columns", "1fr 12px 1fr");
        firstRender = false;
    }

    return (
        <iframe 
            id="pdf-viewer"
            ref={pdfViewerRef}
            src={pdfViewer.src}
            data-name={pdfViewer.name}
            style={{
                position: "absolute",
                width: "100%",
                height: "100vh",
                border: "none"
            }}
        ></iframe>
    )
}

export function scrollToPage(iframe: HTMLIFrameElement, pageNumber: number) {
    const viewer = iframe.contentDocument!.getElementById("viewer") as HTMLDivElement;
    if (!viewer) return;

    const page = viewer.querySelector(`[data-page-number="${pageNumber}"]`) as HTMLDivElement;
    page?.scrollIntoView();
}