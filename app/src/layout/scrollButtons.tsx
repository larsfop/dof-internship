import { useAppRefs } from "../context/refContext.tsx";
import { useAppState } from "../context/stateContext.tsx";

import ArrowUp from "../assets/arrow-up.svg";
import ArrowDown from "../assets/arrow-down.svg";

export default function ScrollButtons() {
    const { scrollUp, scrollDown } = useAppState();
    const { chatMessagesContainer } = useAppRefs();

    const scrollTo = (top: number) => {
        chatMessagesContainer.current?.scrollTo({ top, behavior: "smooth" });
    };

    return (
        <>
            <button id="scroll-up" title="Scroll up" inert={!scrollUp} 
                style={{
                    opacity: scrollUp ? 1 : 0,
                    top: "2.5rem",
                }} 
                onClick={() => scrollTo(0)}
            >
                <img src={ArrowUp} alt="Scroll up" />
            </button>
            <button id="scroll-down" title="Scroll down" inert={!scrollDown} 
                style={{
                    opacity: scrollDown ? 1 : 0,
                    positionAnchor: "--chat-input-container",
                    positionArea: "top center",
                    bottom: "2.5rem",
                }} 
                onClick={() => scrollTo(chatMessagesContainer.current?.scrollHeight ?? 0)}
            >
                <img src={ArrowDown} alt="Scroll down" />
            </button>
        </>
    );
}