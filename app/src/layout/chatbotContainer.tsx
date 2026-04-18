import { useEffect } from "react";
import { useAppDispatch, useAppState } from "../context/stateContext.tsx";
import { useAppRefs } from "../context/refContext.tsx";
import InputBlock from "./inputBlock.tsx";
import ContentBlock from "./contentBlock.tsx";
import ScrollButtons from "./scrollButtons.tsx";

export default function ChatbotContainer() {
    const { chatMessagesContainer, chatMessage, chatContainer } = useAppRefs();
    const { currentSessionData } = useAppState();
    const dispatch = useAppDispatch();

    useEffect(() => {
        const container = chatMessagesContainer.current;
        if (!container) return;

        const { scrollUp, scrollDown } = checkScroll(container);
        dispatch({ type: "SET_SCROLL_UP", payload: scrollUp });
        dispatch({ type: "SET_SCROLL_DOWN", payload: scrollDown });
    }, [currentSessionData] );

    return <div id="chatbot-container" ref={chatContainer} style={{ fontSize: "12pt" }}>
        <div id="chat-messages-container" ref={chatMessagesContainer} onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            const { scrollUp, scrollDown } = checkScroll(target);

            dispatch({ type: "SET_SCROLL_UP", payload: scrollUp });
            dispatch({ type: "SET_SCROLL_DOWN", payload: scrollDown });
        } }>
            <div id="chat-messages" >
                <div id="chat-message" className="chat-threads" ref={chatMessage}>
                    {currentSessionData.map((entry, index) => (
                        <ContentBlock key={index} entry={entry} />
                    ))}
                </div>
            </div>
        </div>
        <ScrollButtons />
        <InputBlock />
    </div>;
}

function checkScroll(container: HTMLDivElement) {
    const scrollTop = container.scrollTop > 200;
    const scrollBottom = container.scrollHeight - container.scrollTop > container.clientHeight + 500;
    return { scrollUp: scrollTop, scrollDown: scrollBottom };
}