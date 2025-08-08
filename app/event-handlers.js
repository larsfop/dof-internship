export function tabListEventHandler(e) {
    const tab = e.target.closest('.tab');
    e.dataTransfer.setDragImage(e.target, -20, -20);
    if (!tab) return;

    tab.classList.add('dragging'); // Add a class to indicate the tab is being dragged
    const tabs = [...document.querySelectorAll('.tab')];
    const tabIndex = tabs.indexOf(tab);
    const window = this.parentElement.querySelector('.window-container');
    const content = window.querySelector(`[data-index="${tab.dataset.index}"]`);

    const rect = this.lastChild.getBoundingClientRect();
    const clampX = rect.left;
    const { left, right, width } = tab.getBoundingClientRect();
    var x = left + width / 2; // Calculate the x position to center the tab under the mouse cursor

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function dragHandler(ev) {
        ev.stopPropagation();

        if (ev.clientY <= 24 && ev.clientY > 0) { // Check if the mouse is within the window height
            // tab.style.left = `${ev.clientX - x}px`; // Center the tab under the mouse cursor
            const dx = clamp(ev.clientX - x, -left, clampX - right);
            tab.style.transform = `translateX(${dx}px)`; // Center the tab under the mouse cursor
        }
    }

    function dragOverHandler(e) {
        e.preventDefault();
        const tabRect = tab.getBoundingClientRect();
        const center1 = tabRect.left + tabRect.width / 2;
        const tabTransform = parseFloat(tab.style.transform.slice(11)) || 0;

        // Check if we're moving before or after the hovered tab
        // const shouldInsertBefore = e.clientX < hoverRect.left + hoverRect.width / 2;

        // Move in DOM
        // container.insertBefore(dragging, shouldInsertBefore ? hoverTab : hoverTab.nextSibling);

        if (tabTransform <= 0) {
            for (let i = 0; i < tabs.length; i++) {
                const t = tabs[i];
                const rect = t.getBoundingClientRect();
                const center2 = rect.left + rect.width / 2;
                if (t === tab) {
                    continue;
                } else if (i < tabs.indexOf(tab)) {
                    if (center1 <= center2) { // Move the tab to the left
                        t.style.transform = `translateX(${width}px)`;
                    } else {
                        t.style.transform = ''; // Reset the transform for other tabs
                    }
                } else {
                    t.style.transform = ''; // Reset the transform for other tabs
                }
            }
        } else if (tabTransform > 0) {
            for (let i = 0; i < tabs.length; i++) {
                const t = tabs[i];
                const rect = t.getBoundingClientRect();
                const center2 = rect.left + rect.width / 2;
                if (t === tab) {
                    continue;
                } else if (i > tabIndex) {
                    if (center1 > center2) { // Move the tab to the right
                        t.style.transform = `translateX(${-width}px)`;
                    } else {
                        t.style.transform = ''; // Reset the transform for other tabs
                    }
                } else {
                    t.style.transform = ''; // Reset the transform for other tabs
                }
            }
        }

    }

    function dragEndHandler(ev) {
        for (let t of tabs) {
            t.style.transform = ''; // Reset all tabs' transform
        }
        tab.style.transform = ''; // Reset the dragged tab's transform
        tab.classList.remove('dragging'); // Remove the dragging class from the tab
        
        tab.removeEventListener('drag', dragHandler); // Remove the drag event listener
        this.removeEventListener('dragover', dragOverHandler);
    }

    tab.addEventListener('drag', dragHandler);
    this.addEventListener('dragover', dragOverHandler);
    tab.addEventListener('dragend', dragEndHandler.bind(this), { once: true });

}
