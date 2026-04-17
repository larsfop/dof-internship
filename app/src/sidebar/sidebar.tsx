import { useState } from "react";

import { useAppDispatch, useAppState } from "../context/stateContext.tsx";

import SidebarContent from "./content.tsx";

import Hamburger from "../assets/hamburger.svg";
import NewChat from "../assets/new-chat.svg";
import LightMode from "../assets/light-mode.svg";
import DarkMode from "../assets/dark-mode.svg";

export default function Sidebar() {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const { currentSessionData } = useAppState();
    const dispatch = useAppDispatch();

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
                    if (currentSessionData.length < 1) return;
                    dispatch({ type: "NEW_SESSION" });
                }} >
                    <img src={NewChat} alt="" />
                    <span>New Chat</span>
                </button>
                <SidebarContent />
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