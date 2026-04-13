import { handleCopyToClipboard } from "./content";

import Copy from "../assets/copy.svg";

export default function CodeBlock({ content }: { content: string }) {

    return (
        <div className="code-block-container">
            <pre>{content}</pre>
            <button className="content-button" title="Copy" onClick={(e) => {
                const node = e.currentTarget.previousElementSibling as HTMLElement;
                if (!node) return;
                handleCopyToClipboard(e.currentTarget, node);
            }}>
                <img src={Copy} alt="Copy" />
            </button>
        </div>
    )
}