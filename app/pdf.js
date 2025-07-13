export class Pdf {
    constructor(pdfPath) {
        this.pdfPath = pdfPath;
        this.viewer = './pdfjs/web/viewer.html?file='; // Path to the PDF.js viewer
        this.createPdfViewer();
    }

    createPdfViewer() {
        // built-in PDF viewer
        this.mainContainer = document.createElement('div');
        this.mainContainer.className = 'pdf-viewer'; // Add a class for styling if needed
        this.mainContainer.innerHTML = `<embed src="${this.pdfPath}" width="100%" height="100%"></embed>`;
        this.mainContainer.style.width = '100%';
        this.mainContainer.style.height = '100%'; // Adjust height as needed

        // Use Mozilla's PDF.js viewer
        // this.mainContainer = document.createElement('embed');
        // this.mainContainer.className = 'pdf-viewer'; // Add a class for styling if needed
        // this.mainContainer.src = `${this.viewer}../../${encodeURIComponent(this.pdfPath)}`; // Use the app path to construct the full URL
        // this.mainContainer.width = '100%';
        // this.mainContainer.height = '100%'; // Full width and height
    }

    appendContainer(container) {
        container.appendChild(this.mainContainer);
    }

    focusInput() {
        // No input to focus in PDF viewer
    }
}