import pymupdf
import re
import mysql
from mysql.connector import errorcode

def str_to_number(s):
    try:
        # Replace comma with dot for float conversion
        s = s.replace(',', '.')
        if '.' in s:
            return float(s)
        else:
            return int(s)
    except (ValueError, AttributeError):
        return s


class PDFTableReader:
    def __init__(self, pdf_path, SQL_connection, database) -> None:
        self.pdf_path = pdf_path
        self.SQL_connection = SQL_connection
        self.cursor = SQL_connection.cursor()
        self.cursor.execute(f'USE {database}')

        self.doc = pymupdf.open(pdf_path)
        self.idx = 1

    def extract_tables_pages(self, *page_numbers, recreate_table=False):
        for page_number in page_numbers:
            if not isinstance(page_number, int):
                raise TypeError("Page number must be an integer")
            if page_number < 0 or page_number >= len(self.doc):
                raise ValueError("Page number out of range")
            
            page = self.doc[page_number]

            # Extract tables from the text
            tables = page.find_tables()

            # Save the extracted tables to the database
            for table in tables:
                self.save_to_database(page, table, recreate_table)

    def extract_tables(self, recreate_table=False) -> None:
        # Extract tables from all pages in the PDF
        for page in self.doc:
            tables = page.find_tables()
            for table in tables:
                # Save each table to the database
                self.save_to_database(page, table, recreate_table)

    def caption(self, page, table) -> str:
        # Extract caption from the table
        bbox = list(table.bbox)

        bbox[0] = 72
        bbox[2] = 524

        bbox[3] = bbox[1]
        bbox[1] -= 23

        rec = pymupdf.Rect(bbox)
        caption = page.get_text("text", clip=rec)[:-2] # Remove trailing newline characters

        return caption

    def save_to_database(self, page, table, recreate_table=False):
        db = table.extract()

        # Get table caption for table naming
        caption = self.caption(page, table)

        # Create table in the database
        name, fields_with_types, fields, types = self.create_table(db, caption)
        if recreate_table:
            self.cursor.execute(f"DROP TABLE IF EXISTS {name}")
        try:
            self.cursor.execute(f"CREATE TABLE {name} ({', '.join(fields_with_types)})")
        except mysql.connector.Error as err:
            if err.errno == errorcode.ER_TABLE_EXISTS_ERROR:
                print(f"WARNING Table {name} already exists.")
                return
            else:
                print(err)
                exit(1)

        # Insert data into the table
        for row in db[self.idx:]:
            data = self.insert_into_table(row, types)
            self.cursor.executemany(f'INSERT INTO {name} ({", ".join(fields)}) VALUES ({", ".join(["%s"] * len(fields))})', data)

        # Commit the changes to the database
        self.SQL_connection.commit()

    def create_table(self, db, caption):
        # Name the table based on the caption
        try:
            name = caption.split(' — ')[1].replace('-\n', '').replace(' \n', '_').replace('\n', '_').replace(' ', '_').lower().replace('-', '_')
        except:
            name = caption.split(' – ')[1].replace('-\n', '').replace(' \n', '_').replace('\n', '_').replace(' ', '_').lower().replace('-', '_')

        # Create fields based on the first row and/or second row of the table
        fields = []
        for i, val in enumerate(db[0]):
            if val is not None:
                val = re.sub(r'\(.*\)', '', val)  # Remove any text in parentheses
                fields.append(val.replace(' ', '_').replace('-\n', '').replace('\n', '_').replace('-', '_').replace('/', '_or_'))
            else:
                fields.append(fields[-1])

        if None in db[1]:
            self.idx = 2
            for i in range(len(db[1])):
                if db[1][i] is not None:
                    fields[i] = fields[i] + '_' + db[1][i].replace(' ', '_').replace('-\n', '').replace('\n', '_').replace('–', '_').replace('/', '_or_')

        # Determine the data types based on the third row of the table
        types = []
        fields_with_types = []
        for i, val in enumerate(db[self.idx]):
            val = str_to_number(val.split('\n')[0])
            if isinstance(val, int):
                types.append(int)
                fields_with_types.append(fields[i] + ' INT')
            elif isinstance(val, float): # or val == '–':
                types.append(float)
                fields_with_types.append(fields[i] + ' DOUBLE')
            else:
                types.append(str)
                fields_with_types.append(fields[i] + ' VARCHAR(255)')

        return name, fields_with_types, fields, types

    def insert_into_table(self, row, types):
        nrows = 1
        # Check if the row contains multiple lines
        print(row)
        for i, val in enumerate(row):
            if not isinstance(str_to_number(val), types[i]):
                nrows = len(val.split('\n'))

        # If there are multiple rows, split the values accordingly
        for i, val in enumerate(row):
            if '\n' in val:
                val = val.split('\n')
                if len(val) < nrows:
                    row[i] = ' '.join(val)
                elif len(val) > nrows:
                    for j in range(1, len(val)):
                        val[j] = val[0] + ' ' + val[j]
                    row[i] = val[1:]
                else:
                    row[i] = val

        # Prepare the data for insertion
        data = []
        for i in range(nrows):
            new_data = []
            for j, val in enumerate(row):
                if isinstance(val, list):
                    val = str_to_number(val[i])
                else:
                    val = str_to_number(val)

                if not isinstance(val, types[j]):
                    if types[j] == int or types[j] == float:
                        val = None

                new_data.append(val)

            data.append(new_data)

        return data

    def close(self):
        self.doc.close()
        self.cursor.close()
        self.SQL_connection.close()


if __name__ == "__main__":
    mydb = mysql.connector.connect(
        host='192.168.0.41',
        user='lars',
        password='Lilleaker01',
    )

    pdf = PDFTableReader(
        'ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf',
        mydb,
        'tables',
    )

    pdf.extract_tables_pages(20, recreate_table=True)

    pdf.close()