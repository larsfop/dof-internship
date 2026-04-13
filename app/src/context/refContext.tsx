import { createRef, RefObject, createContext, useContext, useMemo } from "react";

interface AppRefs {
    file: RefObject<HTMLDivElement | null>;
    main: RefObject<HTMLDivElement | null>;
    chatInput: RefObject<HTMLDivElement | null>;
    chatMessagesContainer: RefObject<HTMLDivElement | null>;
    chatMessage: RefObject<HTMLDivElement | null>;
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
    file: createRef<HTMLDivElement>(),
    main: createRef<HTMLDivElement>(),
    chatInput: createRef<HTMLDivElement>(),
    chatMessagesContainer: createRef<HTMLDivElement>(),
    chatMessage: createRef<HTMLDivElement>(),
  }), []);

  return <RefContext.Provider value={refs}>{children}</RefContext.Provider>;
}