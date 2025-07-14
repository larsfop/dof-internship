export class Table {
    constructor(data, caption) {
        this.createTable(data, caption);

        const table = this.div.querySelector('table');

        this.tBody = table.tBodies[0];

        this.initialList = Array.from(this.tBody.rows);
        this.currentSortReference = null;
        this.currentOrder = 0

        this.createListeners(table);
    }

    createListeners(table) {
        const heads = table.tHead.rows[0].cells;
        Array.from(heads).forEach((head) => {
            head.addEventListener('click', this.onHeadClick.bind(this)
            );
        });
    }

    createTable(data, caption) {
        this.div = document.createElement('div');
        this.div.style.overflowX = 'auto';
        
        let html = '<table border="1" style="border-collapse: collapse; width: 100%;">';
        html += '<br>'; // Add empty line before table

        html += `<caption style="text-align: left; font-weight: bold; font-size: 1.2em;">${caption.replace(/_/g, ' ').replace(/^./, char => char.toUpperCase())}</caption>`;
        
        html += '<thead>'
        html += '<tr>' + Object.keys(data[0]).map(k => `<th>${k.replace(/_/g, ' ')}</th>`).join('') + '</tr>';
        
        html += '<tbody>';
        for (const row of data) {
            html += '<tr>' + Object.values(row).map(v => `<td>${v}</td>`).join('') + '</tr>';
        }
        html += '</tbody>';
        html += '</table>';
        html += '<br>'; // Add empty line after table

        this.div.innerHTML = html;
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

    onHeadClick({currentTarget}) {
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