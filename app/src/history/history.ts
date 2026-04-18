export type ChatHistory = {
    name: string;
    sessionID: string;
}

export async function loadChatHistory() {
    const userID = localStorage.getItem("userID");
    const response = await fetch(`http://192.168.0.71:8015/get_sessions?user_id=${userID}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });
    const data = await response.json();

    return data.map((entry: { name: string; session_id: string }) => ({
        name: entry.name,
        sessionID: entry.session_id,
    })) as ChatHistory[];
}

export type Citation = {
    document_name: string;
    page_labels: string[];
    page_indices: number[];
}

export type ChatSession = {
    prompt: string;
    cache_id?: string;
    response?: string;
    citations?: Citation[];
    response_id?: string;
    responseError?: boolean;
}

let sessions = new Map<string|null, ChatSession[]>();
export async function loadSession(sessionID: string) {
    if (sessions.has(sessionID)) {
        return sessions.get(sessionID)!;
    }

    const response = await fetch(`http://192.168.0.71:8015/get_chat?session_id=${sessionID}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    });

    const data = await response.json();

    const sessionData = data as ChatSession[];

    sessions.set(sessionID, sessionData);
    return sessionData;
}

export function handleInputData(sessionData: ChatSession[]) {
    let item = sessionData[0].prompt;
    const inputArray: string[] = [item];
    for (let i = 1; i < sessionData.length; i++) {
        const nextItem = sessionData[i].prompt;
        if (item === nextItem) continue;
        inputArray.push(nextItem);
        item = nextItem;
    }
    return inputArray;
}