import { useAppRefs } from "../context/refContext.tsx";
import { useAppDispatch } from "../context/stateContext.tsx";
import { Citation } from "../history/history.ts";
import { getPDF } from "./content.ts";
import { scrollToPage } from "./pdf.tsx";

export default function CitationBlock({ citation }: { citation: Citation }) {
    const dispatch = useAppDispatch();
    const { pdfViewerRef } = useAppRefs();
    
    return (
        <cite title="View document" onClick={async (e) => {
            e.preventDefault();
            const { documentName, pdfPages } = citation;
            const { url, page } = await getPDF(documentName, pdfPages[0]);

            const name = pdfViewerRef.current?.dataset.name;
            if (pdfViewerRef.current && name === documentName) {
                console.log("Scrolling to page", page);
                scrollToPage(pdfViewerRef.current!, page);
            } else {
                dispatch({ type: "SET_PDF_VIEWER", payload: { src: url, name: documentName, page: page } });
            }
        }}>
            {`${citation.documentName} - Page(s): ${citation.pageLabels.join(", ")}`}
        </cite>
    );
}