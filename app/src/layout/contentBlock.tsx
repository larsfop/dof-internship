import { useRef, useState } from "react";
import OutputBlock from "./outputBlock.tsx";
import { handleCopyToClipboard } from "./content.ts";
import { ChatSession } from "../history/history.ts";
import { generateResponse } from "./inputBlock.tsx";
import { useAppDispatch, useAppState } from "../context/stateContext.tsx";

import Write from "../assets/write.svg";
import Copy from "../assets/copy.svg";

export default function ContentBlock({entry}: { entry: ChatSession }) {
    const contentRef = useRef<HTMLSpanElement>(null);
    const [outline, setOutline] = useState(false);
    const { currentSessionData, currentSessionID } = useAppState();
    const dispatch = useAppDispatch();

    let prompt = entry.prompt;
    return (
        <div className="content-block">
            <div className="input-block" style={{ outline: outline ? "blue auto 1px" : "none" }}>
                <span className="input-message" ref={contentRef}
                role="textbox"
                suppressContentEditableWarning={true}
                spellCheck={false}
                aria-multiline={true}
                style={{ outline: "none", display: "block" }}
                onBlur={async (e) => {
                    const node = e.currentTarget;
                    node.contentEditable = "false";
                    setOutline(false);
                    if (!node.textContent) {
                        node.textContent = prompt;
                        return;
                    }

                    const response = await generateResponse(
                        node.textContent,
                        currentSessionID,
                        entry.response_id,
                        true
                    )

                    if (!response) {
                        console.error("Failed to generate response for edited prompt");
                        node.textContent = prompt;
                        return;
                    }

                    entry.prompt = node.textContent
                    entry.response = response.content.response;
                    entry.citations = response.content.citations;
                    entry.cache_id = response.content.cache_id;
                    dispatch({ type: "SET_SESSION_DATA", payload: [...currentSessionData] });
                }}
                onKeyDown={handeKeyDown}
                >
                    {prompt}
                </span>
                <div className="input-options"
                >
                    <button className="content-button" title="Edit" 
                    onClick={() => {
                        const node = contentRef.current;
                        if (!node) return;
                        node.contentEditable = "true";
                        node.focus();
                        highlightText(node);
                        setOutline(true);
                    }}>
                        <img src={Write} alt="Write" />
                    </button>
                    <button className="content-button" title="Copy"
                    onClick={(e) => {
                        const node = contentRef.current;
                        if (!node) return;
                        handleCopyToClipboard(e.currentTarget, node);
                    }}>
                        <img src={Copy} alt="Copy" />
                    </button>
                </div>
            </div>
            <div>
                <OutputBlock entry={entry} />
            </div>
        </div>
    )
}

function highlightText(element: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
}

function handeKeyDown(e: React.KeyboardEvent<HTMLSpanElement>) {
    const key = e.key.toLowerCase();
    const node = e.currentTarget
    if (key === "enter") {
        e.preventDefault();
        node.blur();
    } else if (e.ctrlKey && key === "x") {
        e.preventDefault();
        navigator.clipboard.writeText(node.textContent || "");
        node.textContent = "";
    }
}