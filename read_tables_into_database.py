import pymupdf
import re
import mysql
from mysql.connector import errorcode
import uuid
import enlighten
from timer import Timer

"""
TODO

 x Fix naming identifiers for long captions (maybe change to UUIDs)
 / Additional information from the PDFs (Sections, pages, links, non-table text, etc.)
 x Add more metadata to the tables (e.g. page number, section, etc.)
 - Create table with standards (EN and NS)
 - Improve error handling (printing of errors)
    - Add more tests for edge cases (e.g. empty tables, tables with only one row, etc.)
    - Make errors easily parseable
 x Add a progress bar for the document processing
    x Count successful and failed tables
 - New eurocode pdf gave a lot of new problems
    - Change caption splitting (table number and caption text) (new splits such as ':' and ' ')
    - New table formats need new handling
    - Tables without headers
    - Rotated tables
    - Update handling of multiple header rows
    - Update handling of multiple data rows and columns
    - Update handling of empty cells

"""

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
    def __init__(
        self, 
        pdf_path, 
        SQL_connection, 
        database,
        drop_tables: bool = False,
        pbar: bool = True
    ) -> None:
        
        self.pbar = pbar
        self.pdf_path = pdf_path
        self.SQL_connection = SQL_connection
        self.cursor = SQL_connection.cursor()
        self.cursor.execute(f'USE {database}')
        
        # Drop existing tables if specified
        if drop_tables:
            self.drop_tables()

        self.doc = pymupdf.open(pdf_path)
        self.idx = 1
        text = self.doc[0].get_text('text')
        
        self.title = re.findall(r'Eurocode .*\s.*\s.*', text)[0].replace('\n', ' – ')
        
        # Create the main table for storing document metadata if it doesn't exist
        self.cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS document_metadata (
                title VARCHAR(255),
                pdfPath VARCHAR(255),
                tableID VARCHAR(64),
                tableName VARCHAR(255),
                page INT,
                caption TEXT,
                tableNumber VARCHAR(64),
                PRIMARY KEY (tableID)
            )
        """)
        
    def insert_into_document_table(self, table_id, table_name, page_number, caption, table_number):
        # Insert metadata into the document table
        self.cursor.execute(f"""
            INSERT INTO document_metadata (title, pdfPath, tableID, tableName, page, caption, tableNumber)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (self.title, self.pdf_path, table_id, table_name, page_number, caption, table_number))

    # Need update for multiple documents
    def drop_tables(self):
        # Fetch all table names from the database
        self.cursor.execute("SHOW TABLES")
        tables = self.cursor.fetchall()

        # Iterate over tables and delete them
        for table in tables:
            self.cursor.execute(f"DROP TABLE {table[0]}")
            print(f"Deleted table: {table[0]}")

    def extract_tables(self, *page_numbers) -> None:
        for page in page_numbers:
            if not isinstance(page, int):
                raise TypeError("Page number must be an integer")
            if page < 0 or page >= len(self.doc):
                raise ValueError("Page number out of range")
        
        if page_numbers:
            doc = [self.doc[page] for page in page_numbers]
        else:
            doc = self.doc
        
        # Extract tables from all pages in the PDF
        with enlighten.get_manager() as manager:
            pages_bar_format = u'{desc}{desc_pad}{percentage:3.0f}%|{bar}| ' + \
                u'{count:{len_total}d}/{total:d} ' + \
                u'[{elapsed}<{eta}, {rate:.2f}{unit_pad}{unit}/s]'
            pb_pages = manager.counter(
                all_fields=False, total=len(doc), desc='Pages:', color='green3', bar_format=pages_bar_format, enabled=self.pbar
            )
            
            tables_bar_format = u'{desc}{desc_pad}{total:d}|{bar}| ' + \
                u'S:' + manager.term.green3(u'{count_0:{len_total}d}') + u' ' + \
                u'E:' + manager.term.red2(u'{count_1:{len_total}d}')
                
            pb_success = manager.counter(
                all_fields=False, total=1, desc='Tables:', color='green3', bar_format=tables_bar_format, enabled=self.pbar
            )
            pb_error = pb_success.add_subcounter('red2', all_fields=True)
            for page in doc:
                tables = page.find_tables()
                for table in tables:
                    # Save each table to the database
                    with Timer():
                        success = self.save_to_database(page, table)
                    if success:
                        pb_success.update()
                    else:
                        pb_error.update()
                    pb_success.total += 1
                        
                pb_pages.update()

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

    def save_to_database(self, page, table):
        db = table.extract()
        identifier = str(uuid.uuid4()).replace('-', '_')  # Generate a unique identifier for the table

        # Get table caption for table naming
        caption = self.caption(page, table)

        # Create table in the database
        try:        
            try:
                table_number, caption = caption.split(' — ')
            except:
                table_number, caption = caption.split(' – ')
            name, fields_with_types, fields, types = self.create_table(db, caption)
        except Exception as e:
            print(f"WARNING creating table:\n    Invalid table caption '{caption}'\n    In document page {page.number + 1}\n    Error: {e}")
            return False
        print(f"Processing table: {name} in document page {page.number + 1}")
        print(f'{"-" * 150}\n')

        # if self.name_to_long():
        #     return False
        
        # if recreate_table:
        #     self.cursor.execute(f"DROP TABLE IF EXISTS {identifier}")
        try:
            self.cursor.execute(f"CREATE TABLE {identifier} ({', '.join(fields_with_types)})")
        except mysql.connector.Error as err:
            if err.errno == errorcode.ER_TABLE_EXISTS_ERROR:
                print(f"WARNING Table {name} with identifier {identifier} already exists.")
                return False
            else:
                print(fields_with_types)
                print(f'WARNING Table could not be created\nError: {err}')
                return False

        # Insert data into the table
        try:
            print(f'Inserting data into table {name} with fields: {fields}')
            for i, row in enumerate(db[self.idx:], start=1):
                data = self.insert_into_table(row, types)
                print(f'    Inserting row {i} with {len(data)} rows')
                print(f'    Row data: {data[0]}')
                self.cursor.executemany(f'INSERT INTO {identifier} ({", ".join(fields)}) VALUES ({", ".join(["%s"] * len(fields))})', data)
        except Exception as err:
            print(f'\nWARNING failed to insert data into table\nError: {err}')
        
        # Insert metadata into the document table
        self.insert_into_document_table(
            identifier, 
            caption, 
            page.number + 1, 
            name, 
            table_number
        )
        
        # Commit the changes to the database
        self.SQL_connection.commit()
        
        return True

    def create_table(self, db, caption):
        # Name the table based on the caption
        name = caption.replace('-\n', '').replace(' \n', '_').replace('\n', '_').replace(' ', '_').lower().replace('-', '_')

        # Create fields based on the first row and/or second row of the table
        fields = []
        i = 0
        for val in db[0]:
            if val is not None:
                if val == '':
                    fields.append(f'empty_field_{i}')
                    i += 1
                else:
                    val = re.sub(r'\(.*\)', '', val)  # Remove any text in parentheses
                    fields.append(val.replace(' ', '_').replace('-\n', '').replace('\n', '_').replace('-', '_').replace('/', '_or_').replace(',', '_and_'))
            else:
                fields.append(fields[-1])

        self.idx = 1
        if None in db[1]:
            self.idx = 2
            for i in range(len(db[1])):
                if db[1][i] is not None:
                    fields[i] = fields[i] + '_' + db[1][i].replace(' ', '_').replace('-\n', '').replace('\n', '_').replace('–', '_').replace('/', '_or_').replace(',', '_and_')

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
        
    def name_to_long(self):
        # Check if the name is too long
        if len(self.name) > 64:
            print(f'Table name is too long ({len(self.name)} characters). It should be less than 64 characters.')
            self.name = input('Enter a new name for the table (Leave empty to ignore table): ')
            if not self.name:
                print('Skipping table.')
                return True
            else:
                return self.name_to_long()
        return False


if __name__ == "__main__":
    import json
    from argparse import ArgumentParser
    import argcomplete
    
    parser = ArgumentParser(description="Read tables from a PDF and save them to a MySQL database.")
    parser.add_argument('pdf_path', type=str, nargs='?', default='ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf', choices=[
        'ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf',
        'ns-en-1992-1-1_2004+a1_2014+na_2024_en_002.pdf',
        ], help='Path to the PDF file')
    parser.add_argument('--recreate_table', action='store_false', help='Recreate the table in the database (default: True)')
    parser.add_argument('-p', '--pages', type=int, nargs='*', default=[], help='List of page numbers to extract tables from (default: all pages)')
    argcomplete.autocomplete(parser, exclude=['--recreate_table', '--pages'])
    args = parser.parse_args()
    
    config = json.load(open('mysql_connection.json', 'r'))
    user = config['user']
    mydb = mysql.connector.connect(
        host=user['host'],
        user=user['user'],
        password=user['password'],
    )

    pdf = PDFTableReader(
        args.pdf_path,
        mydb,
        'tables',
        drop_tables=True,
    )

    pdf.extract_tables(*args.pages)