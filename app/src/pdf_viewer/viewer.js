
// const pdfjsLib = window.pdfjsLib;
import * as pdfjsLib from '../../node_modules/pdfjs-dist/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '../node_modules/pdfjs-dist/build/pdf.worker.mjs';

/*
    TODO:
    - Scale PDF (Specific width, automatic)
    - Page list
    - Page render buffer
    - Jump to section/citation from contents and citations
    - Highlight cited text spans

    TOFIX:
    - Text layer scale slightly off for some spans
    - Text highlight more lines below mouse when not inside a span element

    MISC:
    - Use page labels from database
    - Text search
*/


const main = document.getElementById('main');
const pageContainer = document.getElementById('viewer-container');

const pageNumberInput = document.getElementById('page-number');
const numPagesSpan = document.getElementById('num-pages');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');


pageNumberInput.addEventListener('focus', function() {
    pageNumberInput.select();
});

pageNumberInput.addEventListener('change', function(e) {
    const pageNumber = parseInt(pageNumberInput.value, 10);
    const children = pageContainer.firstElementChild.children;
    if (isNaN(pageNumber)) {
        pageNumberInput.value = '';
        return;
    }
    if (pageNumber < 1 || pageNumber > children.length) {
        pageNumberInput.value = '';
        return;
    }
    pageContainer.firstElementChild.children[pageNumber - 1].scrollIntoView();
});

prevPageButton.onclick = function() {
    const pageNumber = parseInt(pageNumberInput.value, 10);
    console.log(pageNumber);
    if (pageNumber < 2) return;
    const page = pageContainer.firstElementChild.children[pageNumber - 2];
    page.scrollIntoView();
}
nextPageButton.onclick = function() {
    const pageNumber = parseInt(pageNumberInput.value, 10);
    console.log(pageNumber);
    if (pageNumber >= pageContainer.firstElementChild.children.length) return;
    const page = pageContainer.firstElementChild.children[pageNumber];
    page.scrollIntoView();
}

async function loadPDF(url) {
    const pdf = await pdfjsLib.getDocument(url).promise;
    // console.log(pdf.numPages);
    // console.log(await pdf.getMetadata());
    return pdf;
}

pageContainer.onclick = function(e) {
    const startTime = performance.now();
    const pageDiv = e.target.closest('.page');
    console.log(pageDiv)
    for (const span of pageDiv.querySelectorAll('.text-item')) {
        const rect = span.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            // console.log(span.innerText);
            return;
        }
    }
    window.getSelection().removeAllRanges();
    console.log('Execution time: ' + (performance.now() - startTime) + 'ms');
}

class PDFViewer {
    constructor(pdf, container, pdfName, scale=1.0, pageBuffer=2, scaleMethod=null) {
        this.pdf = pdf;
        this.pdfName = pdfName;
        this.container = container;
        this.numPages = pdf.numPages;
        this.scale = scale;
        this.transform = [scale, 0, 0, scale, 0, 0];
        this.scaleMethod = scaleMethod;
        this.pageBuffer = pageBuffer;
    }

    async init() {
        const viewport = await this.pdf.getPage(1).then(page => page.getViewport({ scale: 1 }));
        this.width = viewport.width;
        this.height = viewport.height;
        const containerWidth = document.getElementById('viewer-container').clientWidth;
        switch (this.scaleMethod) {
            case "auto":
                console.log('Container width:', containerWidth, 'Viewport width:', viewport.width);
                const scale = containerWidth / viewport.width;
                this.scale = scale;
                this.transform = [scale, 0, 0, scale, 0, 0];
                break;
            default:
                break;
        }

        console.log('Initializing PDF viewer with scale:', this.scale);

        numPagesSpan.innerText = ` / ${this.numPages}`;

        for (let pageNumber = 1; pageNumber < this.numPages + 1; pageNumber++) {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.dataset.pageNumber = pageNumber;
            pageDiv.dataset.rendered = false;

            this.pdf.getPage(pageNumber).then(page => {
                const viewport = page.getViewport({ scale: 1 });
                pageDiv.style.width = `round(down, var(--scale-factor) * ${viewport.width}px, 1px)`;
                pageDiv.style.height = `round(down, var(--scale-factor) * ${viewport.height}px, 1px)`;
            });

            this.container.appendChild(pageDiv);
        }

        function debounce(func) {
            var timer;
            return function(event) {
                if (timer) clearTimeout(timer);
                timer = setTimeout(func, 400, event);
            }
        };

        this.container.addEventListener('scale', function(e) {
            const newScale = e.detail.newScale;
            this.scaleViewer(newScale);
        }.bind(this));

        window.addEventListener('resize', debounce(async function(e) {
            console.log('Window resized');
            if (this.scaleMethod === "auto") {
                for (const pageDiv of this.container.children) {
                    if (pageDiv.dataset.rendered === 'false') continue;
                    pageDiv.innerHTML = '';
                    pageDiv.dataset.rendered = 'false';

                    const pageNumber = parseInt(pageDiv.dataset.pageNumber, 10);
                    this.renderPage(pageNumber);
                }
            }
        }.bind(this)));
    }

    renderVisiblePages() {
        const viewportObserver = new IntersectionObserver(entries => {
            // const startTime = performance.now();
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    if (entry.intersectionRect.y < entry.intersectionRect.height) {
                        if (entry.intersectionRatio > 0.5 || entry.intersectionRect.height + entry.intersectionRect.y >= entry.target.clientHeight) {
                            this.currentPage = parseInt(entry.target.dataset.pageNumber, 10);
                            pageNumberInput.value = this.currentPage;
                        } else {
                            this.currentPage = parseInt(entry.target.dataset.pageNumber, 10) + 1;
                            pageNumberInput.value = this.currentPage;
                        }
                    }
                    this.updateRenderedPages();
                }
            }
            // console.log('Render pass in ms:', performance.now() - startTime);
        }, { 
            threshold: [0, 0.25, 0.5, 0.75, 1]
        });

        for (const pageDiv of this.container.children) {
            viewportObserver.observe(pageDiv);
        }

        const resizeObserver = new ResizeObserver(async entries => {
            if (this.scaleMethod !== "auto") return;
            for (const entry of entries) {
                if (entry.target === this.container) {
                    const containerWidth = entry.contentRect.width;
                    const viewport = await this.pdf.getPage(1).then(page => page.getViewport({ scale: 1 }));
                    const newScale = containerWidth / viewport.width;
                    if (newScale !== this.scale) {
                        this.container.dispatchEvent(
                            new CustomEvent('scale', { detail: { newScale: newScale } })
                        );
                    }
                }
            }
        });
        resizeObserver.observe(this.container);
    }

    updateRenderedPages() {
        const startPage = Math.max(1, this.currentPage - this.pageBuffer);
        const endPage = Math.min(this.numPages, this.currentPage + this.pageBuffer);

        for (let i = 1; i < this.numPages + 1; i++) {
            const pageDiv = this.container.children[i - 1];

            if (i >= startPage && i <= endPage) {
                if (pageDiv.dataset.rendered === 'false') {
                    this.renderPage(i);
                }
            } else {
                if (pageDiv.dataset.rendered === 'true') {
                    pageDiv.innerHTML = '';
                    pageDiv.dataset.rendered = 'false';
                }
            }
        }
    }

    async scaleViewer(newScale) {
        this.scale = newScale;
        this.transform = [newScale, 0, 0, newScale, 0, 0];
        this.container.style.setProperty('--scale-factor', newScale);


        // for (const pageDiv of this.container.children) {
        //     const width = Math.floor(this.width * this.scale);
        //     const height = Math.floor(this.height * this.scale);
        //     pageDiv.style.width = `${width}px`;
        //     pageDiv.style.height = `${height}px`;
        // }
    }

    async renderPages(pageNumbers) {
        for (const pageNumber of pageNumbers) {
            this.renderPage(pageNumber);
        }
    }

    async renderPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > this.numPages) {
            throw new Error(`Invalid page number: ${pageNumber}. Valid range is 1-${this.numPages}.`);
        }
        const pageDiv = this.container.children[pageNumber - 1];
        if (pageDiv.dataset.rendered === 'true') return;
        pageDiv.dataset.rendered = 'true';

        const page = await this.pdf.getPage(pageNumber);

        this.render(page, pageDiv);
        this.renderTextLayer(page, pageDiv);
    }

    async render(page, pageDiv) {
        const viewport = page.getViewport({ scale: 1 });

        const canvasWrapper = document.createElement('div');
        canvasWrapper.className = 'canvas-wrapper';
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        canvas.width = Math.floor(viewport.width * this.scale * window.devicePixelRatio);
        canvas.height = Math.floor(viewport.height * this.scale * window.devicePixelRatio);
        canvas.role = 'presentation';

        var renderContext = {
            canvasContext: context,
            transform: this.transform,
            viewport: viewport
        };
        if (pageDiv.children.length < 1) {
            page.render(renderContext);
        }
        pageDiv.appendChild(canvasWrapper);
        canvasWrapper.appendChild(canvas);
    }

    async renderTextLayer(page, pageDiv) {
        const textLayer = document.createElement('div');
        textLayer.className = 'textLayer';
        pageDiv.appendChild(textLayer);

        const textContent = await page.getTextContent();

        let previousHeight = 0;
        for (let i = 0; i < textContent.items.length; i++) {
            const item = textContent.items[i];
            const styles = textContent.styles[item.fontName];


            const height = item.transform[5]*this.scale;
            const width = item.transform[4]*this.scale;
            const fontSize = item.height * this.scale

            if (height < previousHeight) {
                const lineBreak = document.createElement('br');
                lineBreak.role = 'presentation';
                textLayer.appendChild(lineBreak);
            }

            const textDiv = document.createElement('span');
            textDiv.className = 'text-item';
            textDiv.dir = item.dir;
            textDiv.role = 'presentation';
            textDiv.style.left = `${width/pageDiv.clientWidth*100}%`;
            textDiv.style.bottom = `${height/pageDiv.clientHeight*100}%`;
            textDiv.style.width = `${item.width* this.scale}px`;
            textDiv.style.height = `${item.height* this.scale}px`;
            textDiv.style.fontSize = `${fontSize}px`;
            textDiv.style.fontFamily = styles.fontFamily;
            textDiv.textContent = item.str;
            textLayer.appendChild(textDiv);

            previousHeight = height;
        }
    }

    async scrollToPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > this.numPages) {
            throw new Error(`Invalid page number: ${pageNumber}. Valid range is 1-${this.numPages}.`);
        }
        const pageDiv = this.container.children[pageNumber - 1];
        pageDiv.scrollIntoView();
    }
    
}

export async function newPDFViewer(pdfUrl, pageContainer, id='viewer') {

    const viewerContainer = document.createElement('div');
    viewerContainer.id = id;

    const pdf = await loadPDF(pdfUrl);
    const viewer = new PDFViewer(pdf, viewerContainer, pdfUrl, 1.5, 2, "auto");
    await viewer.init();
    viewer.renderVisiblePages();
    pageContainer.appendChild(viewerContainer);

    return viewer;
}


// for (let pageNumber = 1; pageNumber < viewer.numPages + 1; pageNumber++) {
//     viewer.renderPage(pageNumber);
// }
// viewer.renderPages([14,15,16,17]);
