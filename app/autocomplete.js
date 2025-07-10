
export function tablesAutocomplete(input) {
    // This function will return a list of table names that match the input
    const lookupTable = window.lookupTable || [];
    if (!input) {
        return lookupTable; // Return all tables if input is empty
    }
    return lookupTable.filter(table => table.toLowerCase().includes(input.toLowerCase()));
}