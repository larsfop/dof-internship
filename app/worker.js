"use strict";

import * as mupdf from './node_modules/mupdf/dist/mupdf.js';

const methods = {};


class readPDF {
    constructor(file) {
        this.file = file;
    }

    async getText() {
        const doc = await mupdf.Document.load(this.file);
        const text = await doc.getText();
        doc.close();
        return text;
    }
}

methods.openDocument = function(file) {
    return new readPDF(file);
};