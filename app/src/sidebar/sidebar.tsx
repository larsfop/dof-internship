import { useState } from "react";

import { useAppDispatch, useAppState } from "../context/stateContext.tsx";
import ChatHistoryEntry from "../history/history.tsx";
import PDFEntry from "./documents/pdfEntry.tsx";
import { ChatHistory, loadChatHistory } from "../history/history.ts";
import { PDF } from "./documents/pdfEntry.tsx";

import Hamburger from "../assets/hamburger.svg";
import NewChat from "../assets/new-chat.svg";
import LightMode from "../assets/light-mode.svg";
import DarkMode from "../assets/dark-mode.svg";

let chatHistory: ChatHistory[] = [];
let pdfList: PDF[] = [];
let isChatHistoryLoaded = false;
let isPDFListLoaded = false;
export default function Sidebar() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [isChatList, setIsChatList] = useState(true);
    const { newHistoryEntry } = useAppState();
    const dispatch = useAppDispatch();

    if (!isChatHistoryLoaded) {
        loadChatHistory().then((history) => {
            chatHistory = history;
            isChatHistoryLoaded = true;
        }).catch((error) => {
            console.error("Failed to load chat history:", error);
        });
    }

    if (!isPDFListLoaded) {
        loadPDFs().then((pdfs) => {
            pdfList = pdfs;
            isPDFListLoaded = true;
        }).catch((error) => {
            console.error("Failed to load PDF list:", error);
        });
    }

    if (newHistoryEntry) {
        const index = chatHistory.findIndex(entry => entry.sessionID === newHistoryEntry.sessionID);
        if (index !== -1) {
            chatHistory = [...chatHistory.slice(0, index), ...chatHistory.slice(index + 1), chatHistory[index]];
        } else {
            chatHistory = [...chatHistory, newHistoryEntry];
        }
    }

    let pdfCategories = new Set(pdfList.map(pdf => pdf.category));
    return (
        <nav id="sidebar" style={{
            width: `${isExpanded ? 16 : 3}rem`,
        }}>
            <button style={{
                justifyContent: "center",
                alignItems: "center",
                marginTop: "0.5rem",
            }}
            onClick={() => setIsExpanded(!isExpanded)}
            title="Expand sidebar">
                <img src={Hamburger} alt="" style={{ width: "55%", height: "55%"}} />
            </button>
            <div inert={!isExpanded} style={{
                transform: `translateX(${isExpanded ? "0" : "-100%"})`,
                transition: "transform 0.2s ease",
                width: "inherit",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
            }}>
                <button style={{ width: "-webkit-fill-available" }} title="New Chat" 
                onClick={() => {
                    dispatch({ type: "NEW_SESSION" });
                }} >
                    <img src={NewChat} alt="" />
                    <span>New Chat</span>
                </button>
                <div id="sidebar-content">
                    <button style={{ 
                        margin: 0,
                        width: "-webkit-fill-available",
                        gridArea: "history",
                    }} title="Chat History" 
                    onClick={() => setIsChatList(true)}>
                        <span style={{ marginInline: "auto" }}>Chat history</span>
                    </button>
                    <button style={{
                        margin: 0,
                        width: "-webkit-fill-available",
                        gridArea: "documents",
                    }} title="Documents" 
                    onClick={() => setIsChatList(false)}>
                        <span style={{ marginInline: "auto" }}>Documents</span>
                    </button>
                    <div style={{
                        overflowY: "auto",
                        gridArea: "content",
                    }}>
                        <ul id="chat-history-list" style={{
                            display: isChatList ? "block" : "none"
                        }}>
                            {[...chatHistory].reverse().map((entry) => (
                                <ChatHistoryEntry key={entry.sessionID} entry={entry} />
                            ))}
                        </ul>
                        <ul id="document-list" style={{
                            display: isChatList ? "none" : "block",
                        }}>
                            {[...pdfCategories].map((category) => (
                                <details key={category} >
                                    <summary >{category}</summary>
                                    {pdfList.filter(pdf => pdf.category === category).map((pdf) => (
                                        <PDFEntry key={pdf.id} pdf={pdf} />
                                    ))}
                                </details>
                            ))}

                        </ul>
                    </div>
                </div>
            </div>
            <button title={`Toggle ${isDarkMode ? "light" : "dark"} mode`}
            style={{
                marginBottom: "0.5rem"
            }}
            onClick={() => {
                setIsDarkMode(!isDarkMode);
                document.documentElement.setAttribute("data-theme", isDarkMode ? "light" : "dark");
            }}>
                <img src={isDarkMode ? LightMode : DarkMode} alt="" style={{ filter: "invert(0%)" }} />
            </button>
        </nav>
    )
}


async function loadPDFs() {
    const response = await fetch(`http://192.168.0.71:8015/fetch_all_pdfs`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();

    return data as PDF[];
}