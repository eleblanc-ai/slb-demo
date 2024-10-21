// Function to check if the Content ID field is empty and disable/enable the Generate button
function toggleGenerateButton() {
  const contentId = document.getElementById('content-id').value.trim();
  document.getElementById('generate-btn').disabled = contentId === '';  // Disable if Content ID is blank
}

// Function to check if any form field has content and enable/disable buttons accordingly
function toggleButtons() {
  const contentId = document.getElementById('content-id').value.trim();
  const summary = document.getElementById('summary').value.trim();
  const tags = document.getElementById('tags').value.trim();
  const vocabularyWords = document.getElementById('vocabulary-words').value.trim();
  const glossedText = document.getElementById('glossed-text').value.trim();
  const mcqs = document.getElementById('multiple-choice-questions').value.trim();

  const isFormFilled = contentId || summary || tags || vocabularyWords || glossedText || mcqs;

  document.getElementById('submit-btn').disabled = !isFormFilled;
  document.getElementById('clear-btn').disabled = !isFormFilled;

  toggleGenerateButton();  // Call the function to check and disable the Generate button
}

// Add event listeners to all form fields to detect changes
document.getElementById('content-id').addEventListener('input', toggleButtons);
document.getElementById('summary').addEventListener('input', toggleButtons);
document.getElementById('tags').addEventListener('input', toggleButtons);
document.getElementById('vocabulary-words').addEventListener('input', toggleButtons);
document.getElementById('glossed-text').addEventListener('input', toggleButtons);
document.getElementById('multiple-choice-questions').addEventListener('input', toggleButtons);

// Autocomplete functionality for Content ID field
const contentIdInput = document.getElementById('content-id');
const autocompleteList = document.getElementById('autocomplete-list');

// Function to fetch content IDs from the external file
async function fetchContentIDs() {
  try {
const response = await fetch('/assets/files/contentIDs.json');
    const data = await response.json(); // Parse the JSON data
    return data.contentIDs; // Return the list of content IDs
  } catch (error) {
    console.error('Error fetching content IDs:', error);
    return [];
  }
}

// Function to filter and display the matching content IDs
function filterContentIDs(contentIDs) {
  const searchTerm = contentIdInput.value.toLowerCase();
  autocompleteList.innerHTML = ''; // Clear the current list

  if (searchTerm.length === 0) {
    autocompleteList.classList.add('hidden');
    return;
  }

  // Filter content IDs based on user input
  const filteredIDs = contentIDs.filter(id => id.toLowerCase().includes(searchTerm));

  // Show suggestions if any match
  if (filteredIDs.length > 0) {
    filteredIDs.forEach(id => {
      const listItem = document.createElement('li');
      listItem.textContent = id;
      listItem.addEventListener('click', () => {
        contentIdInput.value = id;  // Set input field to the selected ID
        autocompleteList.classList.add('hidden'); // Hide suggestion list
        toggleButtons(); // Update buttons based on content
      });
      autocompleteList.appendChild(listItem);
    });

    autocompleteList.classList.remove('hidden');
  } else {
    autocompleteList.classList.add('hidden');
  }
}

// Load content IDs and initialize the autocomplete
fetchContentIDs().then(contentIDs => {
  contentIdInput.addEventListener('input', () => filterContentIDs(contentIDs));
});

// Hide autocomplete when user clicks outside
document.addEventListener('click', (event) => {
  if (!autocompleteList.contains(event.target) && event.target !== contentIdInput) {
    autocompleteList.classList.add('hidden');
  }
});

// Generate Lesson Plan
document.getElementById('generate-btn').addEventListener('click', async () => {
  const contentId = document.getElementById('content-id').value;

  if (!contentId) {
    alert('Please enter a content ID.');
    return;
  }

  // Disable the button
  const generateButton = document.getElementById('generate-btn');
  generateButton.disabled = true;

  // Show the loading message and progress bar
  document.getElementById('success-message').classList.add('hidden');
  const loadingMessage = document.getElementById('loading-message');
  loadingMessage.textContent = 'Generating lesson plan. This might take up to 30 seconds. Please wait.';
  loadingMessage.classList.remove('hidden');
  const progressContainer = document.querySelector('.progress-container');
  const progressBar = document.getElementById('progress-bar');
  progressContainer.classList.remove('hidden');

  // Start the progress bar animation
  progressBar.style.width = '0%';
  let progress = 0;

  const interval = setInterval(() => {
    if (progress < 100) {  // Progress bar will max out at 100%
      progress += 0.3;     // Increase progress by 0.3% every 100ms
    } else {
      progress = 0;  // Reset progress to 0 if it reaches 100% and lesson is still generating
    }
    progressBar.style.width = `${progress}%`;
  }, 100); // Update every 100ms

  try {
    const response = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId })
    });

    const data = await response.json();

    // Populate the text fields with the generated content
    document.getElementById('summary').value = data.summary;
    document.getElementById('tags').value = data.tags;
    document.getElementById('vocabulary-words').value = data.vocabularyWords; // Ensure vocab terms are formatted correctly
    document.getElementById('glossed-text').value = data.modifiedSelectionText; // Populate glossed text
    document.getElementById('multiple-choice-questions').value = data.mcqs; // Populate multiple choice questions

    // Logic to show extracted standards - unhide the title and pre tags
    document.getElementById('standards-dictionary').textContent = JSON.stringify(data.standardsDictionary, null, 2);
    document.getElementById('standards-title').classList.remove('hidden');
    document.getElementById('standards-dictionary').classList.remove('hidden');

    // Change button text to "Regenerate"
    generateButton.textContent = 'Regenerate';

    // Progress bar to 100% when done
    clearInterval(interval); // Stop the progress interval
    progressBar.style.width = '100%';  // Ensure it fills to 100%
    loadingMessage.textContent = 'Done!';  // Change the loading message to "Done!"
  } catch (error) {
    console.error('Error generating lesson plan:', error);
  } finally {
    // Keep the progress bar and message for 1 second before hiding them
    setTimeout(() => {
      generateButton.disabled = false;  // Re-enable the button
      progressContainer.classList.add('hidden');  // Hide the progress bar
      loadingMessage.classList.add('hidden');     // Hide the loading message
    }, 1500); // Delay hiding
  }
});

// Submit Lesson Plan with confirmation
document.getElementById('submit-btn').addEventListener('click', async () => {
  const confirmation = confirm('Submit all lesson plan content?');
  if (!confirmation) {
    return;  // If the user clicks Cancel, do nothing
  }

  const contentId = document.getElementById('content-id').value;
  const summary = document.getElementById('summary').value;
  const tags = document.getElementById('tags').value;
  const vocabularyWords = document.getElementById('vocabulary-words').value;
  const glossedText = document.getElementById('glossed-text').value;
  const mcqs = document.getElementById('multiple-choice-questions').value;

  try {
    const response = await fetch('/submit-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentId, summary, tags, vocabularyWords, glossedText, mcqs })
    });

    const result = await response.json();

    if (result.success) {
      const popup = document.getElementById('success-popup');
      popup.style.display = 'block';

      // Set the href attributes for the download links
      document.getElementById('word-link').setAttribute('href', result.wordFile);
      document.getElementById('excel-link').setAttribute('href', result.excelFile);

      // Set the download attribute with the correct filenames
      const wordFileName = result.wordFile.split('/').pop();  // Extract the actual Word filename
      const excelFileName = result.excelFile.split('/').pop();  // Extract the actual Excel filename
      document.getElementById('word-link').setAttribute('download', wordFileName);
      document.getElementById('excel-link').setAttribute('download', excelFileName);

      document.getElementById('generate-btn').textContent = 'Generate Lesson Plan';
      toggleButtons();
    } else {
      alert('Error submitting the lesson plan.');
    }
  } catch (error) {
    console.error('Error submitting lesson plan:', error);
  }
});

// Close the success popup and reset the form after clicking OK
document.getElementById('close-popup').addEventListener('click', () => {
  const popup = document.getElementById('success-popup');
  popup.style.display = 'none';

  document.getElementById('content-id').value = '';
  document.getElementById('summary').value = '';
  document.getElementById('tags').value = '';
  document.getElementById('vocabulary-words').value = '';
  document.getElementById('glossed-text').value = '';
  document.getElementById('multiple-choice-questions').value = '';
  document.getElementById('standards-dictionary').textContent = '';
  document.getElementById('standards-title').classList.add('hidden');
  document.getElementById('standards-dictionary').classList.add('hidden');

  document.getElementById('generate-btn').textContent = 'Generate Lesson Plan';
  toggleButtons();
});

// Clear form functionality with confirmation
document.getElementById('clear-btn').addEventListener('click', () => {
  const confirmation = confirm('This will delete all lesson plan content. Do you want to proceed?');
  
  if (confirmation) {
    document.getElementById('content-id').value = '';
    document.getElementById('summary').value = '';
    document.getElementById('tags').value = '';
    document.getElementById('vocabulary-words').value = '';
    document.getElementById('glossed-text').value = '';
    document.getElementById('multiple-choice-questions').value = '';
    document.getElementById('standards-dictionary').textContent = '';
    document.getElementById('standards-title').classList.add('hidden');
    document.getElementById('standards-dictionary').classList.add('hidden');

    document.getElementById('generate-btn').textContent = 'Generate Lesson Plan';
    toggleButtons();
  }
});

// Initial call to disable/enable buttons based on form content
toggleButtons();
