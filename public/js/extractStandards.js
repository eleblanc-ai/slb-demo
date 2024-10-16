import ExcelJS from 'exceljs';
import path, { dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { promises as fsPromises } from 'fs';

// Create the equivalent of __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to extract number ranges (e.g., "3-5" -> [3, 4, 5])
function extractNumberRange(rangeStr) {
    const [start, end] = rangeStr.split('-').map(Number);
    const range = [];
    for (let i = start; i <= end; i++) {
        range.push(i);
    }
    return range;
}

// Function to extract and process data from the Excel file
export async function extractStandards(excelFilePath, codes, gradeBand) {
    try {

        // Convert the standards to a list if needed
        const primary_reading_codes = codes.split(';').map(code => code.trim());

        const grades = extractNumberRange(gradeBand);

        // Load the Excel file using ExcelJS
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(path.join(__dirname, excelFilePath));

        // Initialize the JSON dictionary
        const jsonDictionary = {};

        // Iterate over each grade in the grade band
        for (let grade of grades) {
            const sheetName = `Grade ${grade}`;
            const worksheet = workbook.getWorksheet(sheetName);

            if (!worksheet) {
                console.log(`Sheet not found for grade ${grade}`);
                continue;
            }

            // Iterate over primary reading codes
            for (let code of primary_reading_codes) {
                let found = false;
                const trimmedCode = code.trim();  // Store the trimmed code once

                // Search for the code in any column of the worksheet row
                worksheet.eachRow((row, rowIndex) => {
                    row.eachCell((cell, colNumber) => {
                        let cellValue = cell.value ? cell.value.toString().trim() : '';  // Trim cell value

                        // Check if the cell contains a hyperlink
                        if (cell.hyperlink) {
                            cellValue = cell.text ? cell.text.toString().trim() : '';  // Use the hyperlink text for comparison
                        }

                        if (cellValue === trimmedCode) {
                            found = true;

                            // Initialize the key for this code in the JSON dictionary
                            jsonDictionary[trimmedCode] = [];

                            // Collect the cell values up to the next empty column
                            for (let col = colNumber + 1; col <= row.cellCount; col++) {
                                const nextCell = row.getCell(col);
                                const nextCellValue = nextCell.value ? nextCell.value.toString().trim() : null;

                                if (!nextCellValue) {
                                    break;  // Stop when reaching an empty (None) cell
                                }

                                // Add the value to the dictionary under the code key
                                jsonDictionary[trimmedCode].push(nextCellValue);
                            }
                        }
                    });
                });
            }
        }

        // Return the generated JSON dictionary
        return jsonDictionary;

    } catch (err) {
        console.error('Error:', err.message);
        throw new Error(`Error processing data: ${err.message}`);
    }
}
