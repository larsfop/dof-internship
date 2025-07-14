export class Splitter {
    constructor(direction) {
        this.direction = direction;

        this.createSplitter();
    }

    createSplitter() {
        this.splitter = document.createElement('div');
        this.splitter.id = 'splitter';
        
        if (this.direction === 'horizontal') {
            this.splitter.className = 'splitter-horizontal';
        } else if (this.direction === 'vertical') {
            this.splitter.className = 'splitter-vertical';
        } else {
            throw new Error('Invalid splitter direction');
        }

    }

    appendContainer(container) {
        // this.splitter.style.left = `${container.clientWidth / 2 + 4}px`; // Example positioning logic
        container.appendChild(this.splitter);
    }

    dragElement() {
        const self = this; // Preserve context for event handlers
        var md

        const elements = this.splitter.parentElement.getElementsByClassName('panel-container');
        const elm1 = elements[0];
        const elm2 = elements[1];

        this.splitter.onmousedown = onMouseDown;

        function onMouseDown(e) {
            const pdfs = document.getElementsByClassName('pdf-viewer');
            [...pdfs].forEach(pdf => {
                pdf.style.pointerEvents = 'none'; // Disable pointer events on PDF viewers
            });

            md = {e,
                offsetLeft: self.splitter.offsetLeft,
                offsetTop: self.splitter.offsetTop,
                elm1Width: elm1.offsetWidth,
                elm2Width: elm2.offsetWidth,
            };
        
            document.onmousemove = onMouseMove;
            document.onmouseup = onMouseUp;
        }

        function onMouseMove(e) {
            var delta = {
                x: e.clientX - md.e.clientX,
                y: e.clientY - md.e.clientY,
            }
            if (self.direction === 'vertical') {
                delta.x = Math.min(Math.max(delta.x, -md.elm1Width), md.elm2Width);

                const totalWidth = md.elm1Width + md.elm2Width;
                const percentageDelta = (delta.x / totalWidth) * 100;

                elm1.style.width = `${((md.elm1Width / totalWidth) * 100) + percentageDelta}%`;
                elm2.style.width = `${((md.elm2Width / totalWidth) * 100) - percentageDelta}%`;
            }
        }

        function onMouseUp() {
            const pdfs = document.getElementsByClassName('pdf-viewer');
            [...pdfs].forEach(pdf => {
                pdf.style.pointerEvents = 'auto'; // Re-enable pointer events on PDF viewers
            });

            document.onmousemove = document.onmouseup = null; // Clean up event listeners
        }
    }
}   