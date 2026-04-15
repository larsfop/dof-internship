import { useRef, useState } from "react";
import { useAppRefs } from "../context/refContext";
import { useAppState, useAppDispatch } from "../context/stateContext";
import { Citation } from "../history/history";

import SendMessage from "../assets/send-message.svg";

export interface Response {
    content: {
        response: string;
        summaryTitle: string;
        citations: Citation[];
    };
    metadata: {
        runID: string;
        tokenUsage: {
            completionTokens: number;
            promptTokens: number;
            reasoningTokens: number;
            totalTokens: number;
        }
    };
    node: string;
}

const inputPlaceholder = "Type your message here...";
export default function InputBlock() {
    const { chatInput } = useAppRefs();
    const { currentSessionData, currentSessionID, inputArray } = useAppState();
    const dispatch = useAppDispatch();
    const ref = useRef<HTMLButtonElement>(null);
    const [outline, setOutline] = useState(false);

    let currentInputIndex = useRef(inputArray.length);
    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        const node = e.currentTarget;
        const key = e.key.toLowerCase();
        if (!(e.shiftKey || e.ctrlKey || e.altKey) && key === "enter") {
            e.preventDefault();
            ref.current?.click();
        } 
        else if (!(e.ctrlKey || e.shiftKey || e.altKey) && (key === "arrowup" || key === "arrowdown")) {
            e.preventDefault();
            const delta = key === "arrowup" ? -1 : 1;
            const index = currentInputIndex.current + delta;
            if (index >= 0 && index <= inputArray.length) {
                if (index === inputArray.length) node.textContent = "";
                else node.textContent = inputArray[index];
                currentInputIndex.current = index;
            }
        } else if (e.ctrlKey && key === "x") {
            e.preventDefault();
            navigator.clipboard.writeText(node.textContent || "");
            node.textContent = "";
            currentInputIndex.current = inputArray.length;
        }
    }

    async function handleUserInput(input: string) {
        currentInputIndex.current = inputArray.length;
        if (!input.trim()) return;
        const sessionID = currentSessionID || crypto.randomUUID();
        const data = currentSessionData
        data.push({
            prompt: input,
        });
        dispatch({ type: "SET_SESSION_DATA", payload: [...data] });
        dispatch({ type: "ADD_INPUT", payload: input });

        const chunk = await generateResponse(input, sessionID);
        if (!chunk) {
            console.error("No response received");
            return;
        }
    
        data[data.length - 1].response = chunk.content.response;
        data[data.length - 1].citations = chunk.content.citations;
        dispatch({ type: "SET_SESSION_DATA", payload: [...data] });
        dispatch({ type: "SET_SESSION", payload: sessionID });
        dispatch({ type: "NEW_HISTORY_ENTRY", payload: { sessionID, name: chunk.content.summaryTitle } });
    }

    return (
        <div id="chat-input-container" style={{ outline: outline ? "blue auto 1px" : "none" }}>
            <div style={{
                display: "grid",
                flex: "1",
                paddingBottom: "0.35rem",
            }}>
                <span 
                    id="chat-input" 
                    role="textbox"
                    aria-multiline="true" 
                    contentEditable="true" 
                    suppressContentEditableWarning={true}
                    ref={chatInput}
                    style={{
                        gridArea: "1 / 1",
                        zIndex: 10,
                        wordBreak: "break-word",
                        outline: "none",
                        display: "block",
                        maxHeight: "19.5rem",
                        overflow: "auto",
                        color: "var(--text)",
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        const node = chatInput.current;
                        if (!node || node.textContent !== "") return;
                        setCursorToStart(node);
                        setOutline(true);
                    }} 
                    onBlur={() => {
                        const node = chatInput.current;
                        if (!node) return;
                        if (!node.textContent) {
                            node.textContent = "";
                            currentInputIndex.current = inputArray.length;
                        }
                        setOutline(false);
                    }}
                >
                </span>
                <span inert={true} style={{
                    gridArea: "1 / 1",
                    color: "var(--text-muted)",
                    alignContent: "end",
                    pointerEvents: "none",
                }} id="chat-input-placeholder">
                    {inputPlaceholder}
                </span>
            </div>
            <button id="chat-send-button" title="Send (Enter)" ref={ref} 
            onClick={(e) => {
                e.preventDefault();
                const node = chatInput.current;
                if (!node) return;

                if (!node.textContent!.trim()) {
                    node.textContent = "";
                    return;
                }

                handleUserInput(node.textContent!);
                node.textContent = "";
                currentInputIndex.current = inputArray.length + 1;
            } }>
                <img src={SendMessage} alt="" />
            </button>
        </div>
    )
}

function setCursorToStart(element: HTMLElement) {
    const range = document.createRange();
    const sel = window.getSelection();
    range.setStart(element, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
}

async function generateResponse(prompt: string, sessionID: string) {
    const queryParams = new URLSearchParams({
        session_id: sessionID,
        user_id: localStorage.getItem("userID") || "",
        prompt: prompt,
    });

    const response = await fetch(`http://192.168.0.71:8015/prompt?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    });

    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();

    let chunk;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const event = decoder.decode(value, { stream: true });
        try {
            chunk = JSON.parse(event);
        } catch (e) {
            console.error("Failed to parse chunk:", event, e);
            continue;
        }

        if (chunk.node === "semantic_cache" || chunk.node === "generate_answer") {
            console.log("Received chunk:", chunk);

            break;
        }
    }

    return chunk;
}