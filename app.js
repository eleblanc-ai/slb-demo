import express from 'express';
import bodyParser from 'body-parser';
import OpenAI from 'openai';
import { fileURLToPath, pathToFileURL } from 'url';
import { promises as fsPromises } from 'fs';
import { extractStandards } from './public/js/extractStandards.js';

import ExcelJS from 'exceljs'; // for Excel file handling
import HTMLtoDOCX from 'html-to-docx';
import pkg from 'file-saver';
const { saveAs } = pkg; // Use file-saver for client-side file saving

import { dirname } from 'path';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

import fs from 'fs';
import path from 'path';
import { Document, Packer, Paragraph, TextRun } from 'docx'; // Ensure you import necessary classes

import dotenv from 'dotenv';
dotenv.config();

// Add this helper function at the top of app.js
function stripHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
}

async function saveToWord(contentId, summary, tags, vocabularyWords, glossedText, mcqs) {
    // Add debugging log
    console.log('Processing content:', {
        summary: summary?.substring(0, 100),
        tags: tags?.substring(0, 100),
        vocabularyWords: vocabularyWords?.substring(0, 100),
        glossedText: glossedText?.substring(0, 100),
        mcqs: mcqs?.substring(0, 100)
    });

  function splitIntoParagraphs(content) {
    if (!content) return [];
    
    try {
        // Fix special characters first
        const decodedContent = content
            .replace(/&rsquo;/g, "'")
            .replace(/&ldquo;/g, '"')
            .replace(/&rdquo;/g, '"')
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&");

// Special handling for vocabulary words with bullets
if (content.includes('(noun):') || content.includes('(verb):') || content.includes('(adjective):') || content.includes('(proper')) {
    const sections = decodedContent
        .replace(/<p>/g, '')
        .replace(/<\/p>/g, '\n')
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<ul>/g, '')
        .replace(/<\/ul>/g, '')
        .replace(/<li>/g, '')  // Remove the li tags without adding bullets
        .replace(/<\/li>/g, '\n')
        .replace(/<[^>]*>/g, '')
        .split('\n')
        .filter(line => line.trim());

    return sections.map(line => {
        return new Paragraph({
            children: [
                new TextRun({
                    text: line.trim(),
                    font: "Aptos",
                    size: 24,
                })
            ],
            spacing: {
                after: 120
            },
            bullet: {
                level: 0  // This creates a proper Word bullet point
            }
        });
    });
}

        // Special handling for MCQs
        if (content.includes('A.') && content.includes('B.') && content.includes('C.') && content.includes('D.')) {
            const sections = decodedContent
                .replace(/<p>/g, '')
                .replace(/<\/p>/g, '\n')
                .replace(/<br\s*\/?>/g, '\n')
                .replace(/<[^>]*>/g, '')
                .split('\n')
                .filter(line => line.trim());

            return sections.map(line => {
                const isStandard = /^\[.*\]/.test(line.trim());
                return new Paragraph({
                    children: [
                        new TextRun({
                            text: line.trim(),
                            font: "Aptos",
                            size: 24,
                            // Removed bold setting
                        })
                    ],
                    spacing: {
                        before: /^\d+\./.test(line.trim()) ? 240 : 0, // Space before new questions
                        after: isStandard ? 240 : 60  // Less space between answer choices
                    }
                });
            });
        }

        // For other content types, preserve formatting
        const sections = decodedContent
            .replace(/<p>/g, '')
            .replace(/<\/p>/g, '\n\n')
            .replace(/<br\s*\/?>/g, '\n')
            .split('\n')
            .filter(line => line.trim());

        return sections.map(line => {
            // Process each line to preserve formatting
            const runs = [];
            let currentText = '';
            let currentFormat = { bold: false, italic: false };
            
            // Split the line into segments based on formatting tags
            const segments = line.split(/(<\/?(?:strong|b|em|i)>)/);
            
            segments.forEach(segment => {
                if (segment === '<strong>' || segment === '<b>') {
                    if (currentText) {
                        runs.push(new TextRun({
                            text: currentText,
                            bold: currentFormat.bold,
                            italic: currentFormat.italic,
                            font: "Aptos",
                            size: 24,
                        }));
                        currentText = '';
                    }
                    currentFormat.bold = true;
                } else if (segment === '</strong>' || segment === '</b>') {
                    if (currentText) {
                        runs.push(new TextRun({
                            text: currentText,
                            bold: currentFormat.bold,
                            italic: currentFormat.italic,
                            font: "Aptos",
                            size: 24,
                        }));
                        currentText = '';
                    }
                    currentFormat.bold = false;
                } else if (segment === '<em>' || segment === '<i>') {
                    if (currentText) {
                        runs.push(new TextRun({
                            text: currentText,
                            bold: currentFormat.bold,
                            italic: currentFormat.italic,
                            font: "Aptos",
                            size: 24,
                        }));
                        currentText = '';
                    }
                    currentFormat.italic = true;
                } else if (segment === '</em>' || segment === '</i>') {
                    if (currentText) {
                        runs.push(new TextRun({
                            text: currentText,
                            bold: currentFormat.bold,
                            italic: currentFormat.italic,
                            font: "Aptos",
                            size: 24,
                        }));
                        currentText = '';
                    }
                    currentFormat.italic = false;
                } else if (!segment.startsWith('<')) {
                    currentText += segment;
                }
            });

            // Add any remaining text
            if (currentText) {
                runs.push(new TextRun({
                    text: currentText,
                    bold: currentFormat.bold,
                    italic: currentFormat.italic,
                    font: "Aptos",
                    size: 24,
                }));
            }

            return new Paragraph({
                children: runs,
                spacing: {
                    after: 200
                }
            });
        });

    } catch (error) {
        console.error('Error processing content:', error);
        return [new Paragraph({
            children: [
                new TextRun({
                    text: content
                        .replace(/<[^>]*>/g, '')
                        .replace(/&rsquo;/g, "'")
                        .replace(/&ldquo;/g, '"')
                        .replace(/&rdquo;/g, '"')
                        .trim(),
                    font: "Aptos",
                    size: 24,
                })
            ]
        })];
    }
}
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                // Document Title
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Lesson Plan - ${contentId} - ${new Date().toLocaleDateString()}`,
                            bold: true,
                            font: "Aptos",
                            size: 32,
                        }),
                    ],
                }),
                new Paragraph({ text: '' }),

                // Summary Section
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Summary:`,
                            bold: true,
                            font: "Aptos",
                            size: 24,
                        }),
                    ],
                }),
                ...splitIntoParagraphs(summary),
                new Paragraph({ text: '' }),

                // Tags Section
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Tags:`,
                            bold: true,
                            font: "Aptos",
                            size: 24,
                        }),
                    ],
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: tags || '',
                            font: "Aptos",
                            size: 24,
                        }),
                    ],
                }),
                new Paragraph({ text: '' }),

                // Glossed Text Section
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Glossed Text:`,
                            bold: true,
                            font: "Aptos",
                            size: 24,
                        }),
                    ],
                }),
                ...splitIntoParagraphs(glossedText),
                new Paragraph({ text: '' }),

                // Vocabulary Words Section
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Vocabulary Words:`,
                            bold: true,
                            font: "Aptos",
                            size: 24,
                        }),
                    ],
                }),
                ...splitIntoParagraphs(vocabularyWords),
                new Paragraph({ text: '' }),

                // MCQs Section
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Multiple Choice Questions:`,
                            bold: true,
                            font: "Aptos",
                            size: 24,
                        }),
                    ],
                }),
                ...splitIntoParagraphs(mcqs),
            ],
        }],
    });

    const buffer = await Packer.toBuffer(doc);

    const date = new Date();
    const formattedDate = date.toLocaleDateString('en-CA', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).replace(/-/g, '');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const formattedTime = `${hours}${minutes}`;
    const fileName = `${contentId}-${formattedDate}-${formattedTime}.docx`;

    const dirPath = path.join(__dirname, 'completed-lesson-plans');
    fs.mkdirSync(dirPath, { recursive: true });
    const filePath = path.join(dirPath, fileName);
    fs.writeFileSync(filePath, buffer);

    return filePath;
}

const standardsFileName = "../assets/files/MOAC.xlsx"; // Restore this constant
const vocabJsonPath = path.join(__dirname, 'public/assets/files/vocabularies.json'); 

// Initialize OpenAI with the API key from the .env file
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Check if the API key is available
if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OpenAI API key not found. Please set OPENAI_API_KEY in your environment variables.');
  process.exit(1);
}

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/completed-lesson-plans', express.static(path.join(__dirname, 'completed-lesson-plans')));

async function addToExcel(contentId, summary, tags, glossedText, vocabularyWords, mcqs) {
  // Get today's date in 'YYYYMMDD' format
  const date = new Date();
  const formattedDate = date.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/-/g, '');

  // Define the file name with today's date
const dailyExcelFilePath = path.join(__dirname, 'completed-lesson-plans', `smart-lesson-plans-${formattedDate}.xlsx`);

  // Check if the file exists
  let workbook;
  try {
    await fsPromises.access(dailyExcelFilePath);
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(dailyExcelFilePath); // Load the existing workbook
  } catch (error) {
    // If the file does not exist, create a new workbook with a header row
    workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Lesson Plans');
    worksheet.addRow(['Content ID', 'Summary', 'Tags', 'Glossed Text', 'Vocabulary Words', 'MCQs']); // Add headers
  }

  const worksheet = workbook.getWorksheet(1); // Get the first worksheet

  // Add the new row of lesson plan data
  worksheet.addRow([contentId, summary, tags, glossedText, vocabularyWords, mcqs]);

  // Save the workbook (create a new file if it doesn't exist)
  await workbook.xlsx.writeFile(dailyExcelFilePath);
  return dailyExcelFilePath;
}

app.post('/submit-lesson', async (req, res) => {
  const { contentId, summary, tags, vocabularyWords, glossedText, mcqs } = req.body;

  try {
    // Save data to Word document
    await saveToWord(contentId, summary, tags, vocabularyWords, glossedText, mcqs);
    
    // Add data to Excel
    await addToExcel(contentId, summary, tags, vocabularyWords, glossedText, mcqs);

    const wordFilePath = await saveToWord(contentId, summary, tags, vocabularyWords, glossedText, mcqs);
    const excelFilePath = await addToExcel(contentId, summary, tags, vocabularyWords, glossedText, mcqs);

    // Return the URLs to download these files
 res.json({
      success: true,
      wordFile: `/completed-lesson-plans/${path.basename(wordFilePath)}`,  // Use the correct Word file path
      excelFile: `/completed-lesson-plans/${path.basename(excelFilePath)}`  // Use the correct Excel file path
    });

  } catch (error) {
    console.error('Error submitting lesson plan:', error);
    res.status(500).json({ success: false, error: 'Failed to submit lesson plan.' });
  }
});

// Load vocabularies.json
async function loadVocabularies() {
  try {
    const data = await fsPromises.readFile(vocabJsonPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading vocabularies.json:', error);
    return {};
  }
}

// Gloss vocabulary words in the full text selection using GPT
async function glossTextWithGPT(selectionText, gradeBand, author, genre, writing_prompt) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'user',
        content: `Identify vocabulary words in the following text that are not understood by students in the ${gradeBand} grade band. Highlight these words by wrapping them in asterisks (*). Separate every paragraph with one line break.

        ${selectionText}`,
      },
    ],
  });

  return response.choices[0]?.message?.content?.trim() || selectionText; // Return modified text or original if nothing is glossed
}

app.post('/generate', async (req, res) => {
  const { contentId } = req.body;

  try {
    const lessonDataPath = path.join(__dirname, 'lesson-data', `${contentId}_lessonData.js`);
    const lessonDataURL = pathToFileURL(lessonDataPath).href;

    await fsPromises.access(lessonDataPath);

    const lessonData = await import(lessonDataURL);
    const selection_text = lessonData.selection_text_function_calling;  // Extract the selection text
    const primary_reading_codes = lessonData.primary_reading_codes;
    const grade_band = lessonData.grade_band;
    const writing_prompt = lessonData.writing_prompt;
    const genre = lessonData.genre;
    const author = lessonData.author;

    const standardsDictionary = await extractStandards(standardsFileName, primary_reading_codes, grade_band);

    const vocabList = await loadVocabularies();  // Load vocabularies.json

    // Gloss the selection text using the GPT model
    const glossedText = await glossTextWithGPT(selection_text, grade_band);

    // Generate the vocabulary list
    const vocabResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `From the following selection text, extract all words surrounded by asterisks (*) and return them as a vocabulary list. Format each entry as:
          
          term (part of speech): definition
          
          For the part of speech, you must identify proper nouns and proper adjectives such as names, nationalities, political affiliations and parties, geographical locations, etc. For example, "Communism (proper noun)." Do not include possessive words with apostrophes like "India's." All words that are not proper nouns or adjectives should be lower-case. For example, "relationship." Do not add any extra commentary or include asterisks in the vocabulary list. Separate each entry by a single newline.

          Selection text: ${glossedText}`,
        },
      ],
    });

    const vocabContent = vocabResponse.choices[0]?.message?.content?.replace(/\n{2,}/g, '\n').trim() || 'No vocabulary generated';

    // 3. Generate Multiple Choice Questions (MCQs) using the writing prompt
    const mcqResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Generate five Multiple Choice Questions (MCQs) based on the article below. The questions should aim towards the provided ${writing_prompt} and primary CCSS standards. Do not add any additional commentary. The MCQs should involve critical thinking and align with the following standards: 
            ${JSON.stringify(standardsDictionary)}. Do not make up standards. Only use the standards in the standards dictionary.

            Use the following writing prompt for context: ${writing_prompt}

            Format the MCQs as follows:
            1. Question Text
               A. Answer Choice
               B. Answer Choice
               C. Answer Choice
               D. Answer Choice
               [Standards e.g. BLOOM.X.X; CCSS.X.X.X; TEKS.ELAR.X.X; BEST.ELA.X.X]
               Key: Correct Answer Letter
            
            Article:
            ${selection_text}
          `,
        },
      ],
    });
    const mcqContent = mcqResponse.choices[0]?.message?.content?.replace(/\n{2,}/g, '\n').trim() || 'No MCQs generated';

    // Fetch the summary and tags
    const responseSummary = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Write a 2-3 sentence summary describing what the article is about and the author in objective language without any added commentary or critique. 
                The genre of the article is: ${genre}. You must use this exact genre in the summary. Do not create a new genre or modify it. 
                Instead, rephrase the genre naturally in the summary. The author's name is ${author}.

                For example, if the genre is "Informational Text; e-Book," write something like: "This informational e-book
                presents factual information about..." or "In this informative e-book..."

                Follow this template exactly: In this (genre), (author) describes (x) through (x) kinds of language choices.
                The summary **must** include this genre: "${genre}" rephrased naturally.

                Selection text: ${selection_text}`
        },
      ],
    });

    const responseTags = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: `Generate 5 keywords based on this text that could be used to search for this lesson on our online platform, e.g. major people; places; events; authors; genre; skills practiced, etc. Separate each keyword by a semicolon.\n\nSelection text: ${selection_text}`,
        },
      ],
    });

    const summaryContent = responseSummary.choices[0]?.message?.content?.trim() || 'No summary generated';
    const tagsContent = responseTags.choices[0]?.message?.content?.replace(/\n/g, '; ') || 'No tags generated';

    // Send response
    res.json({
      summary: summaryContent,
      tags: tagsContent,
      vocabularyWords: vocabContent,
      modifiedSelectionText: glossedText, // Send formatted selection text with glossed terms
      standardsDictionary,
      mcqs: mcqContent,
    });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(400).json({ error: `Lesson not found or error occurred: ${err.message}` });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});