import { useAppRefs } from "../context/refContext.tsx";
import { useAppDispatch } from "../context/stateContext.tsx";
import { Citation } from "../history/history.ts";
import { getPDF } from "./content.ts";
import { scrollToPage } from "./pdf.tsx";

let pageIndex = 0;
export default function CitationBlock({ citation }: { citation: Citation }) {
    const dispatch = useAppDispatch();
    const { pdfViewerRef, main } = useAppRefs();

    return (
        <cite title="View document" onClick={async (e) => {
            e.preventDefault();
            console.log("Citation clicked:", citation);
            const { document_name, page_indices } = citation;
            const pdfPage = page_indices[pageIndex % page_indices.length];
            const { url, page } = await getPDF(document_name, pdfPage);
            pageIndex++;

            const mainDiv = main.current;
            if (mainDiv) {
                const currentColumns = mainDiv.style.gridTemplateColumns.split(" ")[2];
                if (currentColumns === "0fr") {
                    mainDiv.style.setProperty("grid-template-columns", "1fr 12px 1fr");
                }
            }

            const name = pdfViewerRef.current?.dataset.name;
            if (pdfViewerRef.current && name === document_name) {
                scrollToPage(pdfViewerRef.current!, page);
            } else {
                dispatch({ type: "SET_PDF_VIEWER", payload: { src: url, name: document_name, page: page } });
            }
        }}>
            {`${citation.document_name} - Page(s): ${citation.page_labels.join(", ")}`}
        </cite>
    );
}