import { useEffect } from "react";
import { useAppDispatch, useAppState } from "../context/stateContext.tsx";
import { useAppRefs } from "../context/refContext.tsx";

export default function RenderPDF() {
    const dispatch = useAppDispatch();
    const { pdfViewer } = useAppState();
    const { main, pdfViewerRef } = useAppRefs();

    useEffect(() => {
        const iframe = pdfViewerRef.current;
        if (!iframe || !pdfViewer) return;

        let offPageChanging: (() => void) | undefined;

        function onLoad() {
            const pdfApp = (iframe!.contentWindow as any)?.PDFViewerApplication;
            if (!pdfApp) return;

            pdfApp.initializedPromise.then(() => {
                const handler = (e: any) => {
                    dispatch({ type: "SET_PDF_PAGE_CACHE", payload: { name: pdfViewer!.name, page: e.pageNumber } });
                };
                pdfApp.eventBus.on("pagechanging", handler);
                offPageChanging = () => pdfApp.eventBus.off("pagechanging", handler);
            });
        }

        iframe.addEventListener("load", onLoad);
        return () => {
            iframe.removeEventListener("load", onLoad);
            offPageChanging?.();
        };
    }, [pdfViewer]);

    if (!pdfViewer) return null;

    // const mainDiv = main.current;
    // if (mainDiv ) {
    //     const currentColumns = mainDiv.style.gridTemplateColumns.split(" ")[2];
    //     if (currentColumns === "0fr") {
    //         mainDiv.style.setProperty("grid-template-columns", "1fr 12px 1fr");
    //     }
    // }

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