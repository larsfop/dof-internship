import { useAppRefs } from "../../context/refContext.tsx";
import { useAppDispatch, useAppState } from "../../context/stateContext.tsx";
import { getPDF } from "../../layout/content.ts";
import { scrollToPage } from "../../layout/pdf.tsx";

export interface PDF {
    id: string;
    document_name: string;
    document_path: string;
    category: string;
}

export interface PDFViewer {
    src: string;
    name: string;
    page: number;
}

export default function PDFEntry({ name } : { name: string }) {
    const dispatch = useAppDispatch();
    const { pdfPageCache } = useAppState();
    const { pdfViewerRef, main } = useAppRefs();

    return (
        <span id={name} title={name} onClick={async (e) => {
            e.preventDefault();
            const newPage = pdfPageCache.get(name) ?? 1;
            const { url, page } = await getPDF(name, newPage);

            const mainDiv = main.current;
            if (mainDiv) {
                const currentColumns = mainDiv.style.gridTemplateColumns.split(" ")[2];
                if (currentColumns === "0fr") {
                    mainDiv.style.setProperty("grid-template-columns", "1fr 12px 1fr");
                }
            }

            const currentName = pdfViewerRef.current?.dataset.name;
            if (pdfViewerRef.current && name === currentName) {
                scrollToPage(pdfViewerRef.current!, page);
            } else {
                dispatch({ type: "SET_PDF_VIEWER", payload: { src: url, name: name, page: page } });
            }
        }} style={{ overflow: "hidden", textOverflow: "ellipsis", }} >{name}</span>
    )
}