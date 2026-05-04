import { useRef } from "react";
import { ChatHistory, loadSession, handleInputData } from "./history";
import { useAppDispatch, useAppState } from "../context/stateContext";

import HDots from "../assets/hdots.svg";
import Delete from "../assets/delete.svg";
import Rename from "../assets/new-chat.svg";

export default function ChatHistoryEntry({entry}: {entry: ChatHistory}) {
    const dispatch = useAppDispatch();
    const { currentSessionID } = useAppState();
    const inputRef = useRef<HTMLDivElement>(null);

    let sessionName = entry.name;
    const sessionID = entry.sessionID;
    const isActive = currentSessionID === sessionID;
    return (
        <li title={sessionName} style={{
            anchorName: `--entry-${sessionID}`,
        }}>
            <span className="chat-entry-name" ref={inputRef}
                suppressContentEditableWarning={true}
                onClick={async () => {
                    try {
                        const sessionData = await loadSession(sessionID);
                        const inputArray = handleInputData(sessionData);
                        dispatch({ type: "SET_SESSION_DATA", payload: sessionData });
                        dispatch({ type: "SET_INPUT", payload: inputArray });
                        dispatch({ type: "SET_SESSION", payload: sessionID });
                    } catch (error) {
                        console.error("Failed to load session data:", error);
                    }
                }}
                onBlur={async () => {
                    const node = inputRef.current;
                    if (!node) return;
                    node.contentEditable = "false";
                    if (!node.textContent) {
                        node.innerHTML = sessionName;
                        return;
                    }
                    if (node.textContent !== sessionName) {
                        fetch(`http://192.168.50.20:8015/update_session_name?session_id=${sessionID}&new_name=${encodeURIComponent(node.textContent)}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                    };
                    sessionName = node.textContent;
                }}
                onKeyDown={(e) => {
                    const node = e.currentTarget;
                    if (e.key === "Enter") {
                        e.preventDefault();
                        node.blur();
                    }
                }}
                style={{
                    gridArea: "1/1",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    background: isActive ? "var(--highlight)" : "",
                }}
                dangerouslySetInnerHTML={{ __html: sessionName }}
            />
            <button title="Chat options" style={{
                opacity: isActive ? 1 : ""
            }}
            popoverTarget={sessionID}>
                <img src={HDots} alt="Options" />
            </button>
            <div id={sessionID} popover="auto" style={{
                positionAnchor: `--entry-${sessionID}`,
                position: "absolute",
                positionArea: "right span-bottom",
                border: "none",
                borderRadius: "12px",
                padding: "0.5rem 0.25rem",
                marginLeft: "0.25rem",
                background: "var(--bg-light)",
                boxShadow: "0px 0px 8px #151515"
            }}>
                <button title="Rename chat session"
                style={{
                    width: "-webkit-fill-available"
                }}
                onClick={() => {
                    const node = inputRef.current;
                    if (!node) return;
                    node.contentEditable = "true";
                    node.focus();
                    highlightText(node);
                }}
                >
                    <img src={Rename} alt="Rename"/>
                    <span style={{
                        background: "transparent"
                    }}>
                        Rename
                    </span>
                </button>
                <hr style={{
                    border: "1px solid var(--border)",
                    marginInline: "0.25rem",
                    marginBlock: "0.15rem"
                }}/>
                <button title="Delete chat session"
                style={{
                    width: "-webkit-fill-available",
                }}
                onClick={async () => {
                    const node = inputRef.current;
                    if (!node) return;
                    node.parentElement?.remove();

                    await fetch(`http://192.168.50.20:8015/remove_session?session_id=${sessionID}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });
                }}
                >
                    <img src={Delete} alt="Delete"/>
                    <span style={{
                        color: 'red',
                        background: "transparent"
                    }}>
                        Delete
                    </span>
                </button>
            </div>
        </li>
    )
}

function highlightText(element: HTMLElement) {
    const range = document.createRange();
    range.selectNodeContents(element);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
}