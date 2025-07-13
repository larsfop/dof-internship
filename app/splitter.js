export class Splitter {
    constructor(panelIndex, direction) {
        this.panelIndex = panelIndex;
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

        // Set initial position and size
        this.splitter.style.top = '0px'; // Adjust as needed
    }

    appendContainer(container) {
        this.splitter.style.left = `${container.clientWidth / 2 + 4}px`; // Example positioning logic
        container.appendChild(this.splitter);
    }

    dragElement(elm1, elm2) {
        const self = this; // Preserve context for event handlers
        var md

        this.splitter.onmousedown = onMouseDown;

        function onMouseDown(e) {
            const elements = document.getElementsByClassName('pdf-viewer');
            [...elements].forEach(element => {
                element.style.pointerEvents = 'none'; // Disable pointer events on PDF viewers
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

                self.splitter.style.left = `${md.offsetLeft + delta.x}px`;
                elm1.style.width = `${md.elm1Width + delta.x}px`;
                elm2.style.width = `${md.elm2Width - delta.x}px`;
            }
        }

        function onMouseUp() {
            const elements = document.getElementsByClassName('pdf-viewer');
            [...elements].forEach(element => {
                element.style.pointerEvents = 'auto'; // Re-enable pointer events on PDF viewers
            });

            document.onmousemove = document.onmouseup = null; // Clean up event listeners
        }
    }
}   