import { useAppDispatch } from "../../context/stateContext.tsx";
import { getPDF } from "../../layout/content.ts";

export interface PDF {
    id: string;
    name: string;
    path: string;
    category: string;
}

export default function PDFEntry({ pdf } : { pdf: PDF }) {
    const dispatch = useAppDispatch();

    return (
        <li title={pdf.name} style={{
            marginLeft: "0.75rem"
        }}>
            <span className="chat-entry-name" onClick={async (e) => {
                e.preventDefault();
                const pdfURL = await getPDF(pdf.name + ".pdf");
                dispatch({ type: "SET_FILE_SRC", payload: pdfURL });
            }} style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
            }}>{pdf.name}</span>
        </li>
    )
}