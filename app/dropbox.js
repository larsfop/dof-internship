export class Dropbox {
    constructor() {
        this.dbx = new window.Dropbox.Dropbox({
            accessToken: 'sl.u.AF21nKae94bJEEaTjEeuRghb3_FgfLVDLbSze0N9wN12pVz-qdkMga3R2ovz5fP5AXmEypJw9yFjyWo2nMKJTKobChAc5AjvX80mH28q__93kgWidBantmUY4fxIplbnCxOkwOED9iTSzjae7Cg2_hYp-k2BAUDr8BJQq36mf3DFpjuBadY8kF-JZXLbXnfQyIDS8qafpuLXAO7Nuxn68_G5-7vO6uRepko1_LOYeyXF1avNCYc1UUTl_9rx8yJmVbeEJAMtQbvEq6V5GpSZ47Uf77vjdLCCnBann0G-Lrante0iSR10F1Pi0vsd5BeP5a14ayXrcgZ90XHcBJ-G6LzvOsSp8lSASzznaKar7Yp8TxBgYNl9ZUbTujYWh0jMWCen0HO7gjdJgodPRwe42Zw4Lag0wOGbxyrt2MCuaJNuIpFQxgYltYrg3PbFoFAXcfFo85ljzadNP248mjVbz_R2Rj2qxKEAVOzBdcl9AHMr47jSlwTcByAnumy0i3KZ7gjAvLja2_yW8Qykn_7Xd9dYVJB4PQDGJRM7J7V8pbIPMPHGaaTm7GVK9SsM_xXMGGEZg2H9craDQ93RKUysLppbQSGxxhdIY7mRRlt0lz1zBZm-eQ81V9_UmY66oEiY_6dwQ20Tv43nXpW8R02navzLfZPcUbo0Em_9i8LcpC5HKsp68gZc2JMp5WipV5JR8GCMvRsAOLRUo-6B_nLqkfJKG_1YNS78qNtRHUp6KykUS3Zkrq90e2kXs5oERtAEtUTxmdwe5YfsV4ECXyTJvJ3a1rqiAGd4KwAfebuAaNaZCWhP2ZB34S1S9rq73-xDP1fqZORInU-2QPfWeIpGyb5eOezbCsQHBhfYfx-ZMPa41wBabcx9kAGVpJWJpTtqdI-Eh26q49IavqoN20QvtJRDRHU3GnS0gCII5jOTHaXAQV7aZh8xtCvahCuS_FQTGwZoo7U3v7zks-P8pWFIlba7Qpp3sKA8zNWcRgflgjap1loFmupMIQu_JrzvMwdUXVtgw2LE2w5KHkbaglb85giFjo9UZrM24FMLV7VNm7gsZwEednMvGSRc_Tzl-_wu84pyxsH44WbNMFxtNbbo-nKnC2DenTH181OBQdT4WzjHY4Vn1LgkoaKLrQcvKYVlYALwcFa60Vqt5q_PWeXo8FclXUxDLt0TeUsXZCTC_y2DlPEd5Gfa-GODN4R5seWJv-HBzxFKlMcwe7odQFdES6sQ3epcajRzEjamLiVN0lhXqG0Ugrdv9lIjxLeLHuxhF2TkBk0slLBc-GNxp-GUecid'
        });
    }

    listFolders() {
        return this.dbx.filesListFolder({ path: '' })
            .then(response => {
                return response.result.entries
                    .filter(entry => entry[".tag"] === "folder")
                    .forEach(folder => {
                        console.log('Dropbox root folder:', folder.name);
                    });
            })
            .catch(error => {
                console.error('Dropbox error:', error);
                throw error;
            });
    }

    async listFolder(folderPath) {
        const response = await this.dbx.filesListFolder({ path: folderPath });
        if (!response.result.entries) {
            console.error('No entries found in Dropbox response.');
            return {};
        }

        const folderContents = {};

        const entries = response.result.entries;
        const promises = entries.map(entry => {
        if (entry[".tag"] === "folder") {
        // Recursively list subfolders
        return this.listFolder(entry.path_lower)
            .then(subEntries => {
            folderContents[entry.name] = subEntries;
            })
        } else {
        if (!folderContents[folderPath]) {
            folderContents[folderPath] = [];
        }
        folderContents[folderPath].push(entry.name);
        }
    });

    return folderContents

    }

    async getFile(filePath) {
        const response = await this.dbx.filesDownload({ path: filePath });
        if (!response.result.fileBlob) {
            console.error('No file blob found in Dropbox response.');
            return null;
        }
        return response.result;
    }
}