
content:
 - pdf
    - title, path
    - sections
        - sub-section, etc.
    - tables
        - id (caption? uuid?)
        - caption
        - table number
        - headers
        - cells
    - pages


database: Name (field 1, field 2, ..., field N)
 - document (title, pdfPath, tableID, tableName, page, caption, tableNumber)
 - table (fields...) name (tableID)
 - sections (title, pdf, page, header, text?, section, subsection, subsubsection, etc)


Commands:
 - Print table
    - cmd: table
    - args: [tableName, columns(index, headers)]