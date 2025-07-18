export class Dropbox {
    constructor(token) {
        this.dbx = new window.Dropbox.Dropbox({
            accessToken: token
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