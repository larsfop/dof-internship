export class Table {
    constructor(tableID) {
        this.currentOrder = 0
        this.currentSortReference = null;
        this.tableID = tableID;
    }

    createListeners() {
        const table = this.div.querySelector('table');

        this.tBody = table.tBodies[0];

        this.initialList = Array.from(this.tBody.rows);
        const heads = table.tHead.rows[0].cells;
        Array.from(heads).forEach((head) => {
            head.addEventListener('click', this.onHeadClick.bind(this)
            );
        });

        //const pdfButton = this.div.querySelector('.button-show-in-pdf');
        /*const pdfButton = this.div.getElementsByClassName('button-show-in-pdf')[0];
        if (pdfButton) {
            pdfButton.addEventListener('click', async () => {
                const query = await window.database.queryTable(`select * from pdf_page where table_name = '${this.caption}'`);
                const results = query[0];
                console.log(pdfButton, results)

                const pdf = document.getElementById(results.pdf)
                if (pdf) {
                    const pdfParent = pdf.parentElement;
                    const idx = Array.from(pdfParent.children).indexOf(pdf);

                    // Attach the pdf to the DOM such that the page number can be changed
                    pdfButton.appendChild(pdf);
                    console.log(pdf.src.split('#')[0] + `#page=${results.page}`) 
                    pdf.src = pdf.src.split('#')[0] + `#page=${results.page}`;

                    // Move the pdf back to its original position
                    pdfParent.insertBefore(pdf, pdfParent.children[idx]);
                } else {

                }
            });
        }*/
    }

    async createTable(data, caption) {
        this.caption = caption;
        this.div = document.createElement('div');
        this.div.className = 'table-wrapper';

        const table = document.createElement('table');

        this.title = document.createElement('caption');
        this.title.innerHTML = caption.replace(/B.*\sB/, (x) => `<sub>${x.slice(1, -2)}</sub>`);
        if (caption !== 'Document Tables') {
            this.title.style.cursor = 'pointer';
            this.title.setAttribute('data-tooltip', 'Show table in PDF');
        }

        const query = await window.database.queryTable(`select * from pdf_page where table_name = '${caption}'`);
        const results = query[0];
        // this.pdfButton = document.createElement('button');
        // if (results) {
        //     this.pdfButton.className = 'button-show-in-pdf';
        //     this.pdfButton.textContent = 'Show in PDF';
        //     this.title.appendChild(this.pdfButton);  
        // }

        const head = document.createElement('thead');
        const headRow = document.createElement('tr');
        headRow.innerHTML = Object.keys(data[0]).map(k => `<th>${k.replace(/_/g, ' ')}</th>`).join('');
        head.appendChild(headRow);

        const body = document.createElement('tbody');
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = Object.values(row).map(v => `<td>${v}</td>`).join('');
            if (caption === 'Document Tables') {
                tr.style.cursor = 'pointer';
                // tr.setAttribute('data-tooltip', 'Show in PDF');
            }
            body.appendChild(tr);
        });

        table.appendChild(this.title);
        table.appendChild(head);
        table.appendChild(body);

        this.div.appendChild(table);

        console.log(this.div)
    }

    emptyTable(list) {
        list.forEach(() => this.tBody.deleteRow(-1));
    }

    fillTable(list) {
        list.forEach((row) => this.tBody.appendChild(row));
    }

    valueFromCell(element) {
        return Number(element.textContent)
    }

    compareRows(a, b, index) {
        const valueA = this.valueFromCell(a.cells[index]);
        const valueB = this.valueFromCell(b.cells[index]);
        return valueA >= valueB ? 1 : -1;
    }

    onHeadClick({ currentTarget }) {
        const index = currentTarget.cellIndex;
        if (this.currentSortReference === index) {
            this.currentOrder = (this.currentOrder + 1) % 3; // Toggle order
        } else {
            this.currentSortReference = index;
            this.currentOrder = 1; // Reset order to ascending
        }
        this.sortTable()
    }

    sortTable() {
        this.emptyTable(this.initialList);
        if (this.currentOrder === 0) {
            this.fillTable(this.initialList);
        } else {
            const newList = [...this.initialList]
            newList.sort((a, b) => this.compareRows(a, b, this.currentSortReference))
            if (this.currentOrder === 2) {
                newList.reverse();
            }
            this.fillTable(newList);
        }
    }

}