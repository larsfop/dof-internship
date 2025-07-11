export class Pdf {
    constructor(pdfPath) {
        this.chatContainer = document.getElementById('chat-container');
        this.pdfPath = pdfPath;
        this.viewer = './pdfjs/web/viewer.html?file='; // Path to the PDF.js viewer
        this.createPdfViewer();
    }

    createPdfViewer() {
        // built-in PDF viewer
        // this.canvas = document.createElement('div');
        // this.canvas.innerHTML = `<embed src="${this.pdfPath}" width="100%" height="100%"></embed>`;
        // this.canvas.style.width = '100%';
        // this.canvas.style.height = 'calc(100vh - 66px)'; // Adjust height as needed
        // this.chatContainer.innerHTML = ''; // Clear previous content
        // this.chatContainer.appendChild(this.canvas);

        // Use Mozilla's PDF.js viewer
        this.canvas = document.createElement('embed');
        this.canvas.src = this.viewer + encodeURIComponent(this.pdfPath); // Use the app path to construct the full URL
        this.canvas.width = '100%';
        this.canvas.height = '100%'; // Full width and height
    }

    appendContainer() {
        this.chatContainer.innerHTML = ''; // Clear previous content
        this.chatContainer.appendChild(this.canvas);
    }

    focusInput() {
        // No input to focus in PDF viewer
    }
}