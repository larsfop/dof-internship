const main = document.getElementById('main');
const gutter = document.getElementById('gutter');
const chatbotContainer = document.getElementById('chatbot-container');
const pdfContainer = document.getElementById('pdf-container');

const splitGrid = window.Split({
    columnGutters: [{
        track: 1,
        element: gutter,
    }],
    minSize: 0,
    snapOffset: 180,
    // onDragStart: function (direction, track) {
    //     this.element.classList.add('dragging');
    // },
    // onDragEnd: function (direction, track) {
    //     this.element.classList.remove('dragging');
    // }
})