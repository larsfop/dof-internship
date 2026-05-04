import { ChatSession } from "../history/history";
import CitationBlock from "./citationBlock";
import CodeBlock from "./codeBlock";
import { handleCopyToClipboard } from "./content";
import { generateResponse } from "./inputBlock";
import { useAppDispatch, useAppState } from "../context/stateContext";
import DOMPurify from "dompurify";

import Reload from "../assets/reload.svg";
import Copy from "../assets/copy.svg";
import Delete from "../assets/delete.svg";

enum NodeType {
    TEXT = "#text",
    PARAGRAPH = "P",
    PRE = "PRE",
    TABLE = "TABLE",
    LINE_BREAK = "BR",
    UNORDERED_LIST = "UL",
    ORDERED_LIST = "OL",
    HEADING_3 = "H3"
}

export default function OutputBlock({ entry }: { entry: ChatSession }) {
    const dispatch = useAppDispatch();
    const { currentSessionID, currentSessionData } = useAppState();

    if (entry.responseError) {
        return <p style={{ color: "red" }}>An error occurred while generating the response. Please try again.</p>;
    }

    const content = HTMLParser(DOMPurify.sanitize(entry.response || ""));
    const fromCache = entry.cache_id ? true : false;

    return (
        <>
            {Array.from(content.childNodes).map((node, index) => {
                // HTML string from the server, no user input
                switch (node.nodeName) {
                    case NodeType.TEXT:
                        return <p key={index}>{node.textContent}</p>
                    case NodeType.PARAGRAPH:
                        return <p key={index}>{node.textContent}</p>
                    case NodeType.PRE:
                        return <CodeBlock key={index} content={node.textContent || ""} />
                    case NodeType.TABLE:
                        return <table key={index} dangerouslySetInnerHTML={{ __html: (node as Element).innerHTML }}></table>
                    case NodeType.LINE_BREAK:
                        return <br key={index} />
                    case NodeType.UNORDERED_LIST:
                        return <ul key={index} dangerouslySetInnerHTML={{ __html: (node as Element).innerHTML }}></ul>
                    case NodeType.ORDERED_LIST:
                        return <ol key={index} dangerouslySetInnerHTML={{ __html: (node as Element).innerHTML }}></ol>
                    case NodeType.HEADING_3:
                        return <h3 key={index}>{node.textContent}</h3>
                    default:
                        console.warn("Unhandled node type:", node.nodeName);
                        return <div key={index} dangerouslySetInnerHTML={{ __html: (node as Element).outerHTML }} />
                }
            })}
            {entry.citations?.map((citation, i) => (
                <CitationBlock key={i} citation={citation} />
            ))}

            {fromCache && (
                <p style={{ fontStyle: "italic", color: "gray" }}>This response was generated from the cache. Retry to get a fresh response.</p>
            )}
            <div className="output-buttons">
                <button title="Copy" onClick={(e) => {
                    const node = e.currentTarget.parentElement?.parentElement?.firstChild as HTMLElement;
                    console.log("Copying content from node:", node);
                    handleCopyToClipboard(e.currentTarget, node);
                }}>
                    <img src={Copy} alt="Copy" 
                /></button>
                <button title="Retry" onClick={async () => {
                    console.log("Retrying response: ", entry.response_id);
                    const chunk = await generateResponse(
                        entry.prompt, 
                        currentSessionID, 
                        entry.response_id, 
                        !fromCache
                    );

                    if (!chunk) {
                        console.error("Failed to generate response");
                        return;
                    }
                    
                    entry.response = chunk.content.response;
                    entry.citations = chunk.content.citations;
                    entry.cache_id = chunk.content.cache_id;
                    dispatch({ type: "SET_SESSION_DATA", payload: [...currentSessionData] });
                }}>
                    <img src={Reload} alt="Retry" 
                /></button>
                {fromCache && (
                    <button title="Remove response from cache" onClick={async () => {
                        await fetch(`http://192.168.50.20:8015/remove_cache?cache_id=${entry.cache_id}`, {
                            method: "GET",
                            headers: {
                                "Content-Type": "application/json"
                            }
                        });

                        dispatch({ type: "SET_SESSION_DATA", payload: [...currentSessionData] });
                    }}>
                        <img src={Delete} alt="Delete" />
                    </button>
                )}
            </div>
        </>
    )
}

function HTMLParser(string: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(string, "text/html");
    return doc.body;
}