import { createRef, RefObject, createContext, useContext, useMemo } from "react";

interface AppRefs {
    main: RefObject<HTMLDivElement | null>;
    sidebar: RefObject<HTMLDivElement | null>;
    chatContainer: RefObject<HTMLDivElement | null>;
    chatInput: RefObject<HTMLDivElement | null>;
    chatMessagesContainer: RefObject<HTMLDivElement | null>;
    chatMessage: RefObject<HTMLDivElement | null>;
    pdfViewerRef: RefObject<HTMLIFrameElement | null>;
}

const RefContext = createContext<AppRefs | null>(null);

export const useAppRefs = () => {
    const ctx = useContext(RefContext);
    if (!ctx) throw new Error("useAppRefs must be used within RefProvider");
    return ctx;
};

export function RefProvider({ children }: { children: React.ReactNode }) {
    // createRef inside useMemo so refs are stable across renders
    const refs = useMemo<AppRefs>(() => ({
        main: createRef<HTMLDivElement>(),
        sidebar: createRef<HTMLDivElement>(),
        chatContainer: createRef<HTMLDivElement>(),
        chatInput: createRef<HTMLDivElement>(),
        chatMessagesContainer: createRef<HTMLDivElement>(),
        chatMessage: createRef<HTMLDivElement>(),
        pdfViewerRef: createRef<HTMLIFrameElement>(),
    }), []);

    return <RefContext.Provider value={refs}>{children}</RefContext.Provider>;
}