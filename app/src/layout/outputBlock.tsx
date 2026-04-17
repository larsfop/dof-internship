import { ChatSession } from "../history/history";
import CitationBlock from "./citationBlock";
import CodeBlock from "./codeBlock";

export default function OutputBlock({ entry }: { entry: ChatSession }) {
    if (entry.responseError) {
        return <p style={{ color: "red" }}>An error occurred while generating the response. Please try again.</p>;
    }

    const content = HTMLParser(entry.response || "");

    return (
        <>
            {Array.from(content.childNodes).map((node, index) => {
                // HTML string from the server, no user input
                switch (node.nodeName) {
                    case "#text":
                        return <p key={index}>{node.textContent}</p>
                    case "P":
                        return <p key={index}>{node.textContent}</p>
                    case "PRE":
                        return <CodeBlock key={index} content={node.textContent || ""} />
                    case "TABLE":
                        return <table key={index} dangerouslySetInnerHTML={{ __html: (node as Element).innerHTML }}></table>
                    case "BR":
                        return <br key={index} />
                    case "UL":
                        return <ul key={index} dangerouslySetInnerHTML={{ __html: (node as Element).innerHTML }}></ul>
                    case "OL":
                        return <ol key={index} dangerouslySetInnerHTML={{ __html: (node as Element).innerHTML }}></ol>
                    default:
                        console.warn("Unhandled node type:", node.nodeName);
                        return <div key={index} dangerouslySetInnerHTML={{ __html: (node as Element).outerHTML }} />
                }
            })}
            {entry.citations?.map((citation, i) => (
                <CitationBlock key={i} citation={citation} />
            ))}
        </>
    )
}

function HTMLParser(string: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(string, "text/html");
    return doc.body;
}