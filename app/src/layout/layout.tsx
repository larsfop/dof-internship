import { useEffect, useRef } from "react";
import Split from "split-grid";

import { useAppRefs } from "../context/refContext";

import ChatbotContainer from "./chatbotContainer";
import RenderPDF from "./pdf";

import GutterDrag from "../assets/gutter-drag.svg";


export default function Main() {
    const { main } = useAppRefs();
    const gutterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const instance = Split({
            columnGutters: [{
                track: 1,
                element: gutterRef.current!,
            }],
            minSize: 0,
            snapOffset: 180,
        });
        return () => instance.destroy();
    }, []);

    return (
        <main id="main" ref={main}>
            <ChatbotContainer />
            <div id="gutter" ref={gutterRef}>
                <img src={GutterDrag} alt="" />
            </div>
            <div id="pdf-container" >
                <RenderPDF />
            </div>
        </main>
    )
}