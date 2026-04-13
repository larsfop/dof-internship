import { createContext, useContext, useReducer, Dispatch } from "react";

import { ChatSession, ChatHistory } from "../history/history.ts";
import { PDFViewer } from "../sidebar/documents/pdfEntry.tsx";


interface AppState {
    currentSessionID: string | null;
    currentSessionData: ChatSession[];
    newHistoryEntry: ChatHistory | null;
    pdfViewer: PDFViewer | null;
    inputArray: string[];
    scrollUp: boolean;
    scrollDown: boolean;
}

type AppAction =
    | { type: "SET_SESSION"; payload: string }
    | { type: "NEW_SESSION" }
    | { type: "SET_SESSION_DATA"; payload: ChatSession[] }
    | { type: "NEW_HISTORY_ENTRY"; payload: ChatHistory | null }
    | { type: "SET_PDF_VIEWER"; payload: PDFViewer | null }
    | { type: "ADD_INPUT"; payload: string }
    | { type: "SET_INPUT"; payload: string[] }
    | { type: "SET_SCROLL_UP"; payload: boolean }
    | { type: "SET_SCROLL_DOWN"; payload: boolean };

const reducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case "SET_SESSION":
            return { ...state, currentSessionID: action.payload };
        case "NEW_SESSION":
            return { ...state, currentSessionID: null, currentSessionData: [], inputArray: [] };
        case "SET_SESSION_DATA":
            return { ...state, currentSessionData: action.payload };
        case "NEW_HISTORY_ENTRY":
            return { ...state, newHistoryEntry: action.payload };
        case "ADD_INPUT":
            if (action.payload === state.inputArray[state.inputArray.length - 1]) {
                return state;
            }
            else {
                return { ...state, inputArray: [...state.inputArray, action.payload] };
            }
        case "SET_INPUT":
            return { ...state, inputArray: action.payload };
        case "SET_SCROLL_UP":
            return { ...state, scrollUp: action.payload };
        case "SET_SCROLL_DOWN":
            return { ...state, scrollDown: action.payload };
        case "SET_PDF_VIEWER":
            return { ...state, pdfViewer: action.payload };
    }
};

const initialState: AppState = {
    currentSessionID: null,
    currentSessionData: [],
    newHistoryEntry: null,
    pdfViewer: null,
    inputArray: [],
    scrollUp: false,
    scrollDown: false,
};

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<AppAction> | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(reducer, initialState);
    return (
        <StateContext.Provider value={state}>
            <DispatchContext.Provider value={dispatch}>
                {children}
            </DispatchContext.Provider>
        </StateContext.Provider>
    );
}

export const useAppState = () => {
    const context = useContext(StateContext);
    if (!context) throw new Error("useAppState must be used within AppProvider");
    return context;
};

export const useAppDispatch = () => {
    const context = useContext(DispatchContext);
    if (!context) throw new Error("useAppDispatch must be used within AppProvider");
    return context;
};