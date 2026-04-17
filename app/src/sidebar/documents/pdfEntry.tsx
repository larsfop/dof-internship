import { useAppRefs } from "../../context/refContext.tsx";
import { useAppDispatch } from "../../context/stateContext.tsx";
import { getPDF } from "../../layout/content.ts";
import { scrollToPage } from "../../layout/pdf.tsx";

export interface PDF {
    id: string;
    name: string;
    path: string;
    category: string;
}

export interface PDFViewer {
    src: string;
    name: string;
    page: number;
}

export default function PDFEntry({ name } : { name: string }) {
    const dispatch = useAppDispatch();
    const { pdfViewerRef } = useAppRefs();

    return (
        // <li title={name} className={pdfViewer?.name === name ? "active" : ""} style={{ marginLeft: "0.5rem" }} >
        <span id={name} title={name} onClick={async (e) => {
            e.preventDefault();
            const { url, page } = await getPDF(name);

            const currentName = pdfViewerRef.current?.dataset.name;
            if (pdfViewerRef.current && name === currentName) {
                console.log("Scrolling to page", page);
                scrollToPage(pdfViewerRef.current!, page);
            } else {
                dispatch({ type: "SET_PDF_VIEWER", payload: { src: url, name: name, page: page } });
            }
        }} style={{ overflow: "hidden", textOverflow: "ellipsis", }} >{name}</span>
        // </li>
    )
}