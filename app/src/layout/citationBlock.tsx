import { useAppDispatch } from "../context/stateContext.tsx";
import { Citation } from "../history/history.ts";
import { getPDF } from "./content.ts";

export default function CitationBlock({ citation }: { citation: Citation }) {
    const dispatch = useAppDispatch();
    
    return (
        <cite title="View document" onClick={async (e) => {
            e.preventDefault();
            const { documentName, pdfPages } = citation;
            const pdfURL = await getPDF(documentName, pdfPages[0]);
            dispatch({ type: "SET_FILE_SRC", payload: pdfURL });
        }}>
            {`${citation.documentName} - Page(s): ${citation.pageLabels.join(", ")}`}
        </cite>
    );
}