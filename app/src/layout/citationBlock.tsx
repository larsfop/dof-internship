import { useAppRefs } from "../context/refContext.tsx";
import { useAppDispatch } from "../context/stateContext.tsx";
import { Citation } from "../history/history.ts";
import { getPDF } from "./content.ts";
import { scrollToPage } from "./pdf.tsx";

let pageIndex = 0;
export default function CitationBlock({ citation }: { citation: Citation }) {
    const dispatch = useAppDispatch();
    const { pdfViewerRef } = useAppRefs();
    
    return (
        <cite title="View document" onClick={async (e) => {
            e.preventDefault();
            const { documentName, pdfPages } = citation;
            const pdfPage = pdfPages[pageIndex % pdfPages.length];
            const { url, page } = await getPDF(documentName, pdfPage);
            pageIndex++;

            const name = pdfViewerRef.current?.dataset.name;
            if (pdfViewerRef.current && name === documentName) {
                scrollToPage(pdfViewerRef.current!, page);
            } else {
                dispatch({ type: "SET_PDF_VIEWER", payload: { src: url, name: documentName, page: page } });
            }
        }}>
            {`${citation.documentName} - Page(s): ${citation.pageLabels.join(", ")}`}
        </cite>
    );
}