export function handleCopyToClipboard(button: HTMLButtonElement, content: Element) {
    navigator.clipboard.writeText(content.textContent || "");
    const img = button.firstChild as HTMLImageElement;
    img.src = './src/assets/checkmark.svg';
    setTimeout(() => {
        img.src = './src/assets/copy.svg';
    }, 2000);
}

export function handleCodeBlocks(container: HTMLElement) {
    container.querySelectorAll("pre").forEach((pre) => {
        if (pre.parentElement?.classList.contains("code-block-container")) return;

        const container = document.createElement("div");
        container.className = "code-block-container";

        const copyBtn = document.createElement("button");
        copyBtn.className = "content-button";
        copyBtn.title = "Copy";
        copyBtn.onclick = () => handleCopyToClipboard(copyBtn, pre);

        const img = document.createElement("img");
        img.src = "./src/assets/copy.svg";

        pre.parentNode!.replaceChild(container, pre);
        container.appendChild(pre);
        container.appendChild(copyBtn);
        copyBtn.appendChild(img);
    });
}

let documentsArray: Map<string, string> = new Map();
export async function getPDF(name: string, page: number | null = null) {
    if (documentsArray.has(name)) {
        let pdfURL = documentsArray.get(name);
        let newPage: number;
        if (page) {
            pdfURL = pdfURL!.split("#page=")[0] + `#page=${page}`;
            newPage = page;
        } else {
            newPage = Number(pdfURL!.split("#page=")[1]);
        }

        documentsArray.set(name, pdfURL!);
        return { url: pdfURL!, page: newPage };
    }

    const pdfResponse = await fetch(`http://192.168.0.71:8015/pdf?name=${encodeURIComponent(name)}`, {
        method: 'GET',
        headers: {
            'method': 'GET',
        }
    });
    const pdfBlob = await pdfResponse.blob();
    const pdfURL = URL.createObjectURL(pdfBlob);
    const viewerURL = `./pdfjs/web/viewer.html?file=${encodeURIComponent(pdfURL)}#page=${page || 1}`;

    documentsArray.set(name, viewerURL);
    return { url: viewerURL, page: page || 1 };
}