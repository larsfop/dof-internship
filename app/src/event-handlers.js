import { newTab, changeTab } from "./tab.js";
import { splitPanel, getOtherElementByID } from "./utils/html-helper-functions.js";

// --------------------------------------------------------------------------------------
//                      Content event handler functions
// --------------------------------------------------------------------------------------

export async function displayPDF(name, page, div) {
    console.log(`Displaying PDF: ${name} at page ${page}`);
    var pdf = document.querySelector(`[data-name="${name}"]`);
    if (!pdf) {
        // Get the PDF blob
        const pdfResponse = await fetch(`http://192.168.0.71:8015/pdf?name=${encodeURIComponent(name)}`, {
            method: 'GET',
            headers: {
                'method': 'GET',
                'authorization': `Bearer ${sessionStorage.getItem('access_token')}`
            }
        });
        const pdfBlob = await pdfResponse.blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);

        const panel = document.querySelector('.panel-container')
        var sessionID;
        // If the top panel is split, place the PDF in the right/bottom most panel
        if ( panel.classList.contains('split-row') || panel.classList.contains('split-column') )
        {
            sessionID = newTab(panel.lastChild, 'pdf', pdfUrl, null, name);
        // Else split the panel to the right and place the PDF there
        } else {
            const { panel1, panel2 } = splitPanel(panel, 'right');
            sessionID = newTab(panel2, 'pdf', pdfUrl, null, name);

            const tabsList = panel.querySelector('.tab-container');
            const contents = panel.querySelector('.window-container');

            panel1.appendChild(tabsList);
            panel1.appendChild(contents);
        }

        pdf = document.getElementById(`content:${sessionID}`);
    }
    console.log(pdf);
    const pdfParent = pdf.parentElement;
    const tab = getOtherElementByID(pdf, 'tab');

    // Attach the pdf to the DOM temporarily to change page
    div.appendChild(pdf);
    pdf.src = pdf.src.split('#')[0] + `#page=${page}`;

    // Move the pdf back to its original position
    pdfParent.insertBefore(pdf, pdfParent.firstChild);
    changeTab(tab);
}

// --------------------------------------------------------------------------------------
//                      Window highlight handler functions
// --------------------------------------------------------------------------------------

function handleDragenter(e) {
    e.preventDefault(); // Prevent default dragover behavior

    e.target.classList.add('highlight-display'); // Add a class to indicate the dragenter event
}

function handleDragleave(e) {
    e.preventDefault(); // Prevent default dragleave behavior

    e.target.classList.remove('highlight-display'); // Remove the class indicating the dragenter event
}

export function dragEnterHandler(e) {
    e.preventDefault();
    e.stopPropagation();

    const windowsHighlights = document.getElementsByClassName('window-highlight');
    [...windowsHighlights].forEach((windowsHighlight) => {
        windowsHighlight.style.pointerEvents = 'auto'; // Enable pointer events on window highlights
        [...windowsHighlight.children].forEach((div) => {
            div.addEventListener('dragenter', handleDragenter);
            div.addEventListener('dragleave', handleDragleave); // Handle drag leave on window containers
        })
    })
}

export function dragEndHandler(e) {
    e.preventDefault();
    e.stopPropagation();

    const windowsHighlights = document.getElementsByClassName('window-highlight');
    [...windowsHighlights].forEach((windowsHighlight) => {
        windowsHighlight.style.pointerEvents = 'none'; // Disable pointer events on window highlights
        [...windowsHighlight.children].forEach((div) => {
            div.removeEventListener('dragenter', handleDragenter);
            div.removeEventListener('dragleave', handleDragleave); // Remove drag leave event listener
        })
    });
}