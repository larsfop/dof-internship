import { useState } from "react";
import { useAppState } from "../context/stateContext.tsx";

import ChatHistoryEntry from "../history/history.tsx";
import PDFEntry from "./documents/pdfEntry.tsx";

import { ChatHistory, loadChatHistory } from "../history/history.ts";
import { PDF } from "./documents/pdfEntry.tsx";

let chatHistory: ChatHistory[] = [];
let pdfList: PDF[] = [];
let isChatHistoryLoaded = false;
let isPDFListLoaded = false;
export default function SidebarContent() {
    const [isChatList, setIsChatList] = useState(true);
    const { newHistoryEntry } = useAppState();

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

    return <div id="sidebar-content">
        <div style={{
            marginTop: "1rem",
            gridArea: "1 / 1 / 2 / 3"
        }}></div>
        <button style={{
            margin: 0,
            width: "-webkit-fill-available",
            gridArea: "history",
            border: isChatList ? "1px solid var(--border-color)" : "",
            borderRadius: "0",
            borderBottomRightRadius: "0.5rem",
            borderTopRightRadius: "0.5rem",
            backgroundColor: isChatList ? "" : "var(--bg-dark)",
        }} title="Chat History"
            onClick={() => setIsChatList(true)}>
            <span style={{ 
                marginInline: "auto",
            }}>Chat history</span>
        </button>
        <button style={{
            margin: 0,
            width: "-webkit-fill-available",
            gridArea: "documents",
            border: !isChatList ? "1px solid var(--border-color)" : "",
            borderRadius: "0",
            borderBottomLeftRadius: "0.5rem",
            borderTopLeftRadius: "0.5rem",
            backgroundColor: !isChatList ? "" : "var(--bg-dark)",
        }} title="Documents"
            onClick={() => setIsChatList(false)}>
            <span style={{ 
                marginInline: "auto",
            }}>Documents</span>
        </button>
        <div style={{
            display: "flex",
            overflow: "hidden",
            gridArea: "content",
            paddingBlock: "0.5rem",
            borderTopRightRadius: isChatList ? "0.5rem" : "0",
            borderTopLeftRadius: !isChatList ? "0.5rem" : "0",
        }}>
            <ul id="chat-history-list" style={{
                overflowY: "auto",
                display: isChatList ? "block" : "none",
                paddingInline: "0.5rem",
            }}>
                {[...chatHistory].reverse().map((entry) => (
                    <ChatHistoryEntry key={entry.sessionID} entry={entry} />
                ))}
            </ul>
            <FolderRoot pdfList={pdfList} isChatList={isChatList} />
        </div>
    </div>;
}

function FolderRoot( { pdfList, isChatList } : { pdfList: PDF[], isChatList: boolean } ) {
    const [isExpanded, setIsExpanded] = useState(true);

    let pdfPathMap = new Map<string, any>();
    for (let pdf of pdfList) {
        const folders = pdf.path.split("/").slice(3, -1);
        
        const depth = folders.length;
        let path: any = pdfPathMap;
        for (let i = 0; i < depth; i++) {
            if (!path.has(folders[i])) {
                if (i === depth - 1) {
                    path.set(folders[i], []);
                } else {
                    path.set(folders[i], new Map<string, any>());
                }
            }
            path = path.get(folders[i]);
            
            if (path instanceof Array) {
                path.push(pdf.name);
            }
        }
    }
    
    return (
        <ul id="document-list" style={{
            display: isChatList ? "none" : "block",
        }}>
            {[...pdfPathMap.keys()].map((key) => {
                const node = pdfPathMap.get(key);
                return (
                    <li>
                        <span className={`directory ${isExpanded ? 'expanded' : ''}`} title={key} onClick={() => {
                            setIsExpanded(!isExpanded)
                        }}>{key}</span>
                        <ul style={{ display: isExpanded ? "block" : "none", }}>
                            <FolderNode node={node} />
                        </ul>
                    </li>
                );
            })}
        </ul>
    )
}

function FolderContent( { name, list } : { name: string, list: Map<string, any> | string[] } ) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <li>
                <span className={`directory ${isExpanded ? 'expanded' : ''}`} title={name} onClick={(e) => {
                    e.preventDefault();
                    setIsExpanded(!isExpanded);
                }}>{name}</span>
                <ul style={{ display: isExpanded ? "block" : "none" }}>
                    <FolderNode node={list} />
                </ul>
            </li>
        </>
    )
}

function FolderNode( { node } : { node: Map<string, any> | string[] } ) {
    return (
        <>
            {node instanceof Map ? (
                [...node.entries()].map(([key, value]) => (
                    <FolderContent key={key} name={key} list={value} />
                ))
            ): (
                <>
                {node.map((pdfName) => (
                    <li>
                        <PDFEntry key={pdfName} name={pdfName} />
                    </li>
                ))}
                </>
            )}
        </>
    )
}

async function loadPDFs() {
    const response = await fetch(`http://192.168.50.20:8015/fetch_all_pdfs`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();

    return data as PDF[];
}