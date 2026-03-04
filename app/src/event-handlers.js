import { newHTMLElement, toggleHidden } from "./utils/html-helper-functions.js";
// import { newPDFViewer } from "./pdf_viewer/viewer.js";

// --------------------------------------------------------------------------------------
//                      Content event handler functions
// --------------------------------------------------------------------------------------

const pdfArray = {};
var currentViewer;

// export async function displayPDF(name, page) {
//     const viewerContainer = document.getElementById('viewer-container');
//     var pdf = document.getElementById(name);
//     if (!pdf) {
//         const pdfResponse = await fetch(`http://192.168.0.71:8015/pdf?name=${encodeURIComponent(name)}`, {
//             method: 'GET',
//             headers: {
//                 'method': 'GET',
//                 'authorization': `Bearer ${sessionStorage.getItem('access_token')}`
//             }
//         });
//         const pdfBlob = await pdfResponse.blob();
//         const pdfUrl = URL.createObjectURL(pdfBlob);

//         const viewer = await newPDFViewer(pdfUrl, viewerContainer, name);
//         pdfArray[name] = viewer;
//         currentViewer = viewer;
//     } else {
//         currentViewer = pdfArray[name];
//     }


//     if (viewerContainer.children.length > 1) {
//         [...viewerContainer.children].forEach((child) => {
//             if (child.id === name) {
//                 toggleHidden(child, false);
//                 viewerContainer.prepend(child);
//             } else {
//                 toggleHidden(child, true);
//             }
//         });
//     } else {
//         const main = document.getElementById('main');
//         main.style.gridTemplateColumns = '1fr 8px 1fr';
//     }
//     await currentViewer.scrollToPage(page);
// }

export async function displayPDF(name, page) {
    const pdfContainer = document.getElementById('pdf-container');
    var pdf = document.getElementById(name);
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

        const viewer = `./pdfjs/web/viewer.html?file=${encodeURIComponent(pdfUrl)}`;
        pdf = newHTMLElement('iframe', null, {
            className: 'pdf-viewer',
            id: name,
            src: viewer,
            width: '100%',
            height: '100%',
        });
    }
    pdf.src = pdf.src.split('#')[0] + `#page=${page}`;
    pdfContainer.prepend(pdf);

    const main = document.getElementById('main');
    main.style.gridTemplateColumns = '1fr 12px 1fr';
    
    // if (pdfContainer.children.length > 1) {
    //     [...pdfContainer.children].forEach((child) => {
    //         if (child.id === name) {
    //             toggleHidden(child, false);
    //         } else {
    //             toggleHidden(child, true);
    //         }
    //     });
    // } else {
    //     const main = document.getElementById('main');
    //     main.style.gridTemplateColumns = '1fr 8px 1fr';
    // }
}
