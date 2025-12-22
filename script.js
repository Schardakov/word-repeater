let accounts = [];
let currentAccount = null;
let currentFile = null;
let pendingFileToSave = null;
let replaceAction = null;
let isCreatingAccount = false;
let pendingDeleteFileIndex = null;
let pendingDeleteAccountIndex = null;
let pendingRepetitionsRequired = null;
let isCheatBlocked = false;

const fromDeviceBtn = document.querySelector('.action-btn:first-child');
const fromAccountBtn = document.querySelectorAll('.action-btn')[1];
const removeBtn = document.querySelectorAll('.action-btn')[2];
const studyBtn = document.getElementById('studyBtn');
const testBtn = document.getElementById('testBtn');
const studyInput = document.getElementById('wordInput');
const testInput = document.getElementById('testInput');

// BLOCKS
function blockPasteWithNoCheating(input) {
  if (!input) return;

  function showNoCheating() {
    isCheatBlocked = true; // ?? lock logic

    input.value = 'No cheating';
    input.classList.add('incorrect');

    setTimeout(() => {
      input.value = '';
      input.classList.remove('incorrect');
      isCheatBlocked = false; // ?? unlock
      input.focus();
    }, 800);
  }

  input.addEventListener('paste', e => {
    e.preventDefault();
    showNoCheating();
  });

  input.addEventListener('drop', e => {
    e.preventDefault();
    showNoCheating();
  });

  input.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      showNoCheating();
    }
  });
}
blockPasteWithNoCheating(studyInput);
blockPasteWithNoCheating(testInput);

// Study mode state
let selectedWords = [];
let pickMode = 'manually'; // 'manually' or 'randomly'
let currentWordIndex = 0;
let currentWordPair = null;
let repetitionsRequired = 5;
let currentRepetitionCount = 0;

// Test mode state
let testMode = 'write'; // 'translate', 'write', or 'random'
let currentTestPair = null;
let testTimerEnabled = false;
let testTimerSeconds = 30;
let testMistakesEnabled = false;
let testMaxMistakes = 3;
let testCurrentMistakes = 0;
let testTimer = null;
let testTimeRemaining = 0;

// Timer
function startTestTimer() {
  const timerDisplay = document.getElementById('testTimer');
  
  if (!testTimerEnabled) {
    // Hide timer when disabled
    if (timerDisplay) {
      timerDisplay.style.display = 'none';
    }
    return;
  }

  // Show timer when enabled
  if (timerDisplay) {
    timerDisplay.style.display = 'block';
    timerDisplay.textContent = testTimerSeconds;
    timerDisplay.classList.remove('warning', 'critical');
  }

  testTimeRemaining = testTimerSeconds;

  // Clear any existing timer
  if (testTimer) {
    clearInterval(testTimer);
  }

  testTimer = setInterval(() => {
    testTimeRemaining--;

    if (timerDisplay) {
      timerDisplay.textContent = testTimeRemaining;
      
      // Add warning class when 10 seconds or less
      if (testTimeRemaining <= 10 && testTimeRemaining > 5) {
        timerDisplay.classList.add('warning');
        timerDisplay.classList.remove('critical');
      }
      // Add critical class when 5 seconds or less
      else if (testTimeRemaining <= 5) {
        timerDisplay.classList.add('critical');
        timerDisplay.classList.remove('warning');
      }
      // Remove classes when above 10 seconds
      else {
        timerDisplay.classList.remove('warning', 'critical');
      }
    }

    if (testTimeRemaining <= 0) {
      clearInterval(testTimer);
      testTimer = null;

      // Time ran out – move to next word WITHOUT counting as mistake
      const testInput = document.getElementById('testInput');
      testInput.value = '';
      testInput.classList.remove('incorrect', 'correct');

      displayTestWord();
      testInput.focus();
    }
  }, 1000);
}

// Restart timer for new word
if (testTimer) {
  clearInterval(testTimer);
  testTimer = null;
}

startTestTimer();

// ===== WORD PAIR PARSER =====
function parseWordPairs(content) {
  const lines = content.split('\n');
  const wordPairs = [];
  
  for (let line of lines) {
    line = line.trim();
    if (line === '') continue; // Skip empty lines
    
    // Split by dash, allowing for spaces around the dash
    const parts = line.split('-').map(part => part.trim());
    
    if (parts.length >= 2 && parts[0] && parts[1]) {
      wordPairs.push({
        word: parts[0],        // First part is the WORD
        translation: parts[1]   // Second part is the TRANSLATION
      });
    }
  }
  
  return wordPairs;
}

// ===== FILE IMPORT HANDLERS =====
fromAccountBtn.addEventListener('click', function () {
  if (fromAccountBtn.classList.contains('disabled')) return;
  openFromAccountModal();
});

removeBtn.addEventListener('click', function () {
  if (!currentFile) return;

  // Reset the appropriate button based on where the file came from
  if (currentFile.fromAccount) {
    fromAccountBtn.textContent = 'From Account';
    fromAccountBtn.classList.remove('file-loaded');
    // Re-enable FROM DEVICE button
    fromDeviceBtn.classList.remove('disabled');
  } else {
    fromDeviceBtn.textContent = 'From Device';
    fromDeviceBtn.classList.remove('file-loaded');
    // Re-enable FROM ACCOUNT button will be handled by updateFromAccountButton()
  }

  currentFile = null;
  updateFromAccountButton();
});

fromDeviceBtn.addEventListener('click', function () {
  if (this.classList.contains('file-loaded') || this.classList.contains('disabled')) return;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt';

  fileInput.onchange = function (e) {
    const file = e.target.files[0];
    if (!file) return;

    // Read the file content
    const reader = new FileReader();
    reader.onload = function(event) {
      const content = event.target.result;
      const wordPairs = parseWordPairs(content);
      
      currentFile = {
        name: file.name,
        file: file,
        content: content,
        wordPairs: wordPairs,
        wordCount: wordPairs.length,
        fromAccount: false
      };

      fromDeviceBtn.textContent = file.name;
      fromDeviceBtn.classList.add('file-loaded');

      if (currentAccount) {
        showSaveFileModal(file);
      }

      updateFromAccountButton();
    };
    reader.readAsText(file);
  };

  fileInput.click();
});

// ===== FROM ACCOUNT MODAL =====
function openFromAccountModal() {
  renderFromAccountFiles();
  document.getElementById('fromAccountModal').classList.add('active');
}

function closeFromAccountModal() {
  document.getElementById('fromAccountModal').classList.remove('active');
}

function renderFromAccountFiles() {
  const container = document.getElementById('fromAccountFiles');

  if (!currentAccount || !currentAccount.files || currentAccount.files.length === 0) {
    container.innerHTML = `
      <div class="empty-message">
        No files saved in this account
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="files-list">
      ${currentAccount.files.map((file, index) => `
        <div class="file-item">
          <span class="file-item-name">${file.name}</span>
          <button class="select-account-btn" onclick="selectAccountFile(${index})">
            SELECT
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function selectAccountFile(fileIndex) {
  const file = currentAccount.files[fileIndex];
  if (!file) return;

  // Load the file with its content
  const wordPairs = parseWordPairs(file.content);
  
  currentFile = {
    name: file.name,
    content: file.content,
    wordPairs: wordPairs,
    wordCount: wordPairs.length,
    fromAccount: true
  };

  // Update UI - show file name on FROM ACCOUNT button
  fromAccountBtn.textContent = file.name;
  fromAccountBtn.classList.add('file-loaded');

  // Disable FROM DEVICE button
  fromDeviceBtn.classList.add('disabled');

  closeFromAccountModal();
  updateFromAccountButton();

  console.log('Loaded file from account:', file.name, 'Word count:', currentFile.wordCount);
}

document.getElementById('fromAccountModal').addEventListener('click', function (e) {
  if (e.target === this) closeFromAccountModal();
});

// ===== LOCAL STORAGE =====
function loadAccounts() {
  const stored = localStorage.getItem('accounts');
  if (stored) accounts = JSON.parse(stored);
  const currentStored = localStorage.getItem('currentAccount');
  if (currentStored) currentAccount = JSON.parse(currentStored);
}

function saveAccounts() {
  localStorage.setItem('accounts', JSON.stringify(accounts));
}

function saveCurrentAccount() {
  localStorage.setItem('currentAccount', JSON.stringify(currentAccount));
}

// ===== ACCOUNT MANAGEMENT =====
function showCreateAccountInput() {
  isCreatingAccount = true;
  renderAccountsModal();
}

function createAccount() {
  const input = document.getElementById('accountNameInput');
  const name = input.value.trim();
  if (name === '') {
    alert('Please enter an account name');
    return;
  }
  if (accounts.some(acc => acc.name === name)) {
    alert('An account with this name already exists');
    return;
  }
  const newAccount = { name: name, createdAt: new Date().toISOString(), files: [] };
  accounts.push(newAccount);
  currentAccount = newAccount;
  saveAccounts();
  saveCurrentAccount();
  isCreatingAccount = false;
  renderAccountsModal();
  updateFromAccountButton();
}

function logoutAccount() {
  document.getElementById('logoutModal').classList.add('active');
}

function confirmLogout(shouldLogout) {
  document.getElementById('logoutModal').classList.remove('active');
  
  if (shouldLogout) {
    currentAccount = null;
    localStorage.removeItem('currentAccount');
    renderAccountsModal();
    updateFromAccountButton();
  }
}

function selectAccount(index) {
  currentAccount = accounts[index];
  saveCurrentAccount();
  renderAccountsModal();
  updateFromAccountButton();
}

function deleteAccount(index) {
  const account = accounts[index];
  pendingDeleteAccountIndex = index;
  document.getElementById('deleteAccountMessage').textContent = `Are you sure you want to delete account "${account.name}"?`;
  document.getElementById('deleteAccountModal').classList.add('active');
}

function confirmDeleteAccount(shouldDelete) {
  document.getElementById('deleteAccountModal').classList.remove('active');
  
  if (shouldDelete && pendingDeleteAccountIndex !== null) {
    accounts.splice(pendingDeleteAccountIndex, 1);
    saveAccounts();
    renderAccountsModal();
  }
  
  pendingDeleteAccountIndex = null;
}

function deleteFile(fileIndex) {
  if (!currentAccount) return;
  const file = currentAccount.files[fileIndex];
  pendingDeleteFileIndex = fileIndex;
  document.getElementById('deleteFileMessage').textContent = `Are you sure you want to delete "${file.name}"?`;
  document.getElementById('deleteFileModal').classList.add('active');
}

function confirmDeleteFile(shouldDelete) {
  document.getElementById('deleteFileModal').classList.remove('active');
  
  if (shouldDelete && pendingDeleteFileIndex !== null) {
    currentAccount.files.splice(pendingDeleteFileIndex, 1);
    const accountIndex = accounts.findIndex(acc => acc.name === currentAccount.name);
    if (accountIndex !== -1) {
      accounts[accountIndex] = currentAccount;
    }
    saveAccounts();
    saveCurrentAccount();
    renderAccountsModal();
  }
  
  pendingDeleteFileIndex = null;
}

// ===== RENDER ACCOUNTS MODAL =====
function renderAccountsModal() {
  const content = document.getElementById('accountsContent');
  const createBtn = document.getElementById('createAccountBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const modalTitle = document.querySelector('#accountModal .modal-title');

  if (currentAccount) {
    modalTitle.textContent = currentAccount.name;
    createBtn.style.display = 'none';
    logoutBtn.classList.remove('hidden');
  } else {
    modalTitle.textContent = 'Accounts';
    createBtn.style.display = 'flex';
    logoutBtn.classList.add('hidden');
  }

  if (isCreatingAccount) {
    createBtn.style.display = 'none';
    logoutBtn.classList.add('hidden');
    content.innerHTML = `
      <div class="account-input-section">
        <input type="text" class="account-name-input" id="accountNameInput" placeholder="Enter account name" autofocus />
        <button class="submit-account-btn" onclick="createAccount()">CREATE</button>
      </div>
    `;
    return;
  }

  if (currentAccount) {
    const totalFiles = currentAccount.files.length;
    const totalWords = currentAccount.files.reduce((sum, file) => sum + (file.wordCount || 0), 0);
    
    const filesHtml = currentAccount.files && currentAccount.files.length > 0
      ? `<div class="files-list">
          ${currentAccount.files.map((file, fileIndex) => `
            <div class="file-item">
              <span class="file-item-name">${file.name} <span style="color: #6a6a6a; font-size: 0.85rem;">(${file.wordCount || 0} words)</span></span>
              <button class="delete-file-btn" onclick="deleteFile(${fileIndex})">Delete</button>
            </div>
          `).join('')}
        </div>`
      : '<div class="empty-files-message">No files saved yet</div>';

    content.innerHTML = `
      <div class="account-box">
        <div class="mini-box">
          <div class="mini-box-text">TOTAL FILES</div>
          <div class="mini-box-number">${totalFiles}</div>
        </div>
        <div class="mini-box">
          <div class="mini-box-text">TOTAL WORDS</div>
          <div class="mini-box-number">${totalWords}</div>
        </div>
      </div>
      <div class="my-files-section">
        <div class="section-title">MY FILES</div>
        ${filesHtml}
      </div>
    `;
  } else if (accounts.length === 0) {
    content.innerHTML = '<div class="empty-message">Currently there are no accounts</div>';
  } else {
    content.innerHTML = `
      <div class="accounts-list">
        ${accounts.map((account, index) => `
          <div class="account-item">
            <span class="account-item-name">${account.name}</span>
            <div class="account-item-actions">
              <button class="select-account-btn" onclick="selectAccount(${index})">Select</button>
              <button class="delete-account-btn" onclick="deleteAccount(${index})">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

function openAccountModal() {
  loadAccounts();
  isCreatingAccount = false;
  renderAccountsModal();
  document.getElementById('accountModal').classList.add('active');
}

function closeAccountModal() {
  isCreatingAccount = false;
  document.getElementById('accountModal').classList.remove('active');
  updateFromAccountButton();
}

// ===== UPDATE BUTTON STATES =====
function updateFromAccountButton() {
  // FROM ACCOUNT logic
  if (
    currentAccount &&
    currentAccount.files &&
    currentAccount.files.length > 0 &&
    !currentFile
  ) {
    fromAccountBtn.classList.remove('disabled');
  } else {
    fromAccountBtn.classList.add('disabled');
  }

  // FROM DEVICE logic - disable if file is loaded from account
  if (currentFile && currentFile.fromAccount) {
    fromDeviceBtn.classList.add('disabled');
  } else if (!currentFile || !currentFile.fromAccount) {
    fromDeviceBtn.classList.remove('disabled');
  }

  // REMOVE logic
  if (currentFile) {
    removeBtn.classList.remove('disabled');
  } else {
    removeBtn.classList.add('disabled');
  }

  // STUDY and TEST buttons logic
  if (currentFile) {
    studyBtn.classList.remove('disabled');
    testBtn.classList.remove('disabled');
  } else {
    studyBtn.classList.add('disabled');
    testBtn.classList.add('disabled');
  }
}

// ===== FILE SAVE MODALS =====
function showSaveFileModal(file) {
  pendingFileToSave = file;
  document.getElementById('saveFileMessage').textContent = `Would you like to save "${file.name}" to your account?`;
  document.getElementById('saveFileModal').classList.add('active');
}

function confirmSaveFile(shouldSave) {
  document.getElementById('saveFileModal').classList.remove('active');
  if (shouldSave && pendingFileToSave) {
    saveFileToAccount(pendingFileToSave);
  } else {
    pendingFileToSave = null;
  }
}

function showReplaceFileModal(fileName) {
  document.getElementById('replaceFileMessage').textContent = `A file with the name "${fileName}" already exists. Do you want to replace it?`;
  document.getElementById('replaceFileModal').classList.add('active');
}

function confirmReplaceFile(action) {
  document.getElementById('replaceFileModal').classList.remove('active');
  replaceAction = action;
  if (action !== 'cancel' && pendingFileToSave) {
    continueFileSave(pendingFileToSave);
  } else {
    pendingFileToSave = null;
    replaceAction = null;
  }
}

function continueFileSave(file) {
  if (!currentAccount) return;
  const existingFileIndex = currentAccount.files.findIndex(f => f.name === file.name);

  const fileData = { 
    name: file.name, 
    content: currentFile.content,
    wordCount: currentFile.wordCount,
    addedAt: new Date().toISOString() 
  };

  if (replaceAction === 'replace') {
    currentAccount.files[existingFileIndex] = fileData;
  } else if (replaceAction === 'keep') {
    let counter = 1;
    let newName = file.name;
    const nameParts = file.name.split('.');
    const extension = nameParts.pop();
    const baseName = nameParts.join('.');
    while (currentAccount.files.some(f => f.name === newName)) {
      newName = `${baseName} (${counter}).${extension}`;
      counter++;
    }
    fileData.name = newName;
    currentAccount.files.push(fileData);
  }

  const accountIndex = accounts.findIndex(acc => acc.name === currentAccount.name);
  if (accountIndex !== -1) {
    accounts[accountIndex] = currentAccount;
  }
  saveAccounts();
  saveCurrentAccount();
  showFileSavedModal();
  pendingFileToSave = null;
  replaceAction = null;
}

function saveFileToAccount(file) {
  if (!currentAccount) return;
  const existingFileIndex = currentAccount.files.findIndex(f => f.name === file.name);
  if (existingFileIndex !== -1) {
    showReplaceFileModal(file.name);
  } else {
    const fileData = { 
      name: file.name, 
      content: currentFile.content,
      wordCount: currentFile.wordCount,
      addedAt: new Date().toISOString() 
    };
    currentAccount.files.push(fileData);
    const accountIndex = accounts.findIndex(acc => acc.name === currentAccount.name);
    if (accountIndex !== -1) {
      accounts[accountIndex] = currentAccount;
    }
    saveAccounts();
    saveCurrentAccount();
    showFileSavedModal();
    pendingFileToSave = null;
  }
}

// ===== FILE SAVED SUCCESS MODAL =====
function showFileSavedModal() {
  document.getElementById('fileSavedModal').classList.add('active');
}

function closeFileSavedModal() {
  document.getElementById('fileSavedModal').classList.remove('active');
}

// ===== STUDY AREA FUNCTIONS =====
function applyPendingRepetitionsIfNeeded() {
  if (pendingRepetitionsRequired !== null) {
    repetitionsRequired = pendingRepetitionsRequired;
    pendingRepetitionsRequired = null;

    currentRepetitionCount = 0;
    updateRepetitionDisplay();
  }
}

function openStudyArea() {
  document.querySelector('.practice-settings').classList.add('hidden');
  document.getElementById('studyArea').classList.add('active');
  
  // Get repetitions from input
  const repInput = document.querySelector('.repetition-input');
  repetitionsRequired = parseInt(repInput.value) || 5;
  currentRepetitionCount = 0;
  
  // Set the study rep input to match
  const studyRepInput = document.getElementById('studyRepInput');
  if (studyRepInput) {
    studyRepInput.value = repetitionsRequired;
  }
  
  // Update UI
  updateRepetitionDisplay();
  
  // Reset input
  const wordInput = document.getElementById('wordInput');
  wordInput.value = '';
  wordInput.classList.remove('correct', 'incorrect');
  
  // Display the first word
  if (pickMode === 'manually') {
    // In manually mode, wait for user to select a word
    if (selectedWords.length > 0) {
      displayCurrentWord();
    }
  } else {
    // In random mode, display a random word
    displayRandomWord();
  }
  
  // Focus on input
  wordInput.focus();
}

function closeStudyArea() {
  document.querySelector('.practice-settings').classList.remove('hidden');
  document.getElementById('studyArea').classList.remove('active');
  selectedWords = []; // Reset selected words
  currentWordIndex = 0;
  currentWordPair = null;
  currentRepetitionCount = 0;
}

function showExitStudyModal() {
  document.getElementById('exitStudyModal').classList.add('active');
}

function confirmExitStudy(shouldExit) {
  document.getElementById('exitStudyModal').classList.remove('active');
  
  if (shouldExit) {
    closeStudyArea();
  }
}

function updateRepetitionDisplay() {
  document.getElementById('currentRep').textContent = currentRepetitionCount;
  document.getElementById('totalRep').textContent = repetitionsRequired;
}

function displayCurrentWord() {
  applyPendingRepetitionsIfNeeded();
  if (!currentFile || !currentFile.wordPairs || currentFile.wordPairs.length === 0) {
    document.getElementById('currentWord').textContent = 'No words available';
    document.getElementById('currentTranslation').textContent = '';
    return;
  }

  // In manually mode, use the last selected word
  if (pickMode === 'manually' && selectedWords.length > 0) {
    currentWordPair = selectedWords[selectedWords.length - 1];
  } else if (pickMode === 'randomly') {
    // Get a random word pair
    const randomIndex = Math.floor(Math.random() * currentFile.wordPairs.length);
    currentWordPair = currentFile.wordPairs[randomIndex];
  }

  if (currentWordPair) {
    document.getElementById('currentWord').textContent = currentWordPair.word;
    document.getElementById('currentTranslation').textContent = currentWordPair.translation;
  }
}

function displayRandomWord() {
  applyPendingRepetitionsIfNeeded();
  if (!currentFile || !currentFile.wordPairs || currentFile.wordPairs.length === 0) {
    document.getElementById('currentWord').textContent = 'No words available';
    document.getElementById('currentTranslation').textContent = '';
    return;
  }

  // Get a random word pair
  const randomIndex = Math.floor(Math.random() * currentFile.wordPairs.length);
  currentWordPair = currentFile.wordPairs[randomIndex];

  // Display the word and translation
  document.getElementById('currentWord').textContent = currentWordPair.word;
  document.getElementById('currentTranslation').textContent = currentWordPair.translation;
}

function checkWordInput() {
  const wordInput = document.getElementById('wordInput');
  const userInput = wordInput.value.trim();

  // Check if input is empty
  if (userInput === '') {
    console.log('? Input is empty!');
    wordInput.classList.add('empty');
    setTimeout(() => {
      wordInput.classList.remove('empty');
    }, 300);
    return;
  }

  if (!currentWordPair) return;

  const correctAnswer = currentWordPair.word.toLowerCase();
  const userInputLower = userInput.toLowerCase();

  console.log('User input:', userInput);
  console.log('Correct answer:', correctAnswer);
  console.log('Repetition:', currentRepetitionCount + 1, '/', repetitionsRequired);

  if (userInputLower === correctAnswer) {
    console.log('? CORRECT!');
    currentRepetitionCount++;
    updateRepetitionDisplay();

    wordInput.classList.remove('incorrect');
    wordInput.classList.add('correct');

    // Check if user has completed all repetitions
    if (currentRepetitionCount >= repetitionsRequired) {
      console.log('?? All repetitions completed!');

      // Wait a moment to show the success state
      setTimeout(() => {
        // Reset repetition count for next word
        currentRepetitionCount = 0;
        updateRepetitionDisplay();

        wordInput.value = '';
        wordInput.classList.remove('correct');

        // In manually mode, open word selection modal again
        if (pickMode === 'manually') {
          closeStudyArea();
          openSelectWordsModal();
        } else {
          // In random mode, show next random word
          displayRandomWord();
          wordInput.focus();
        }
      }, 500);
    } else {
      // Still need more repetitions, clear input and let them continue
      setTimeout(() => {
        wordInput.value = '';
        wordInput.classList.remove('correct');
        wordInput.focus();
      }, 300);
    }
  } else {
    console.log('? INCORRECT - try again');
    wordInput.classList.remove('correct');
    wordInput.classList.add('incorrect');
    // Clear input and remove incorrect state after animation
    setTimeout(() => {
      wordInput.value = '';
      wordInput.classList.remove('incorrect');
      wordInput.focus();
    }, 300);
  }
}

// ===== TEST AREA FUNCTIONS =====
function openTestArea() {
  document.querySelector('.practice-settings').classList.add('hidden');
  document.getElementById('testArea').classList.add('active');
  
  // Get test settings
  testTimerEnabled = document.querySelector('.mini-section:first-child .mini-toggle .mini-toggle-btn.active').textContent === 'ON';
  testTimerSeconds = parseInt(document.querySelector('.mini-section:first-child .mini-input').value) || 30;
  testMistakesEnabled = document.querySelector('.mini-section:last-child .mini-toggle .mini-toggle-btn.active').textContent === 'ON';
  testMaxMistakes = parseInt(document.querySelector('.mini-section:last-child .mini-input').value) || 3;
  
  console.log('Test settings:', {
    timerEnabled: testTimerEnabled,
    timerSeconds: testTimerSeconds,
    mistakesEnabled: testMistakesEnabled,
    maxMistakes: testMaxMistakes
  });
  
  // Show or hide timer display based on setting
  const timerDisplay = document.getElementById('testTimer');
  if (timerDisplay) {
    if (testTimerEnabled) {
      timerDisplay.style.display = 'block';
    } else {
      timerDisplay.style.display = 'none';
    }
  }
  
  // Reset mistakes counter
  testCurrentMistakes = 0;
  
  // Reset input
  const testInput = document.getElementById('testInput');
  testInput.value = '';
  testInput.classList.remove('correct', 'incorrect');
  
  // Display the first test word
  displayTestWord();
  
  // Focus on input
  testInput.focus();
}

function closeTestArea() {
  document.querySelector('.practice-settings').classList.remove('hidden');
  document.getElementById('testArea').classList.remove('active');
  currentTestPair = null;
  testCurrentMistakes = 0;
  
  // Clear timer if active
  if (testTimer) {
    clearInterval(testTimer);
    testTimer = null;
  }
}

function showExitTestModal() {
  document.getElementById('exitTestModal').classList.add('active');
}

function confirmExitTest(shouldExit) {
  document.getElementById('exitTestModal').classList.remove('active');
  
  if (shouldExit) {
    closeTestArea();
  }
}

function displayTestWord() {
  if (!currentFile || !currentFile.wordPairs || currentFile.wordPairs.length === 0) {
    document.getElementById('testWord').textContent = 'No words available';
    return;
  }
  
  // Get a random word pair
  const randomIndex = Math.floor(Math.random() * currentFile.wordPairs.length);
  currentTestPair = currentFile.wordPairs[randomIndex];
  
  // Determine what to show based on test mode
  let displayText = '';
  let questionType = testMode;
  
  if (testMode === 'random') {
    // Randomly choose between translate or write
    questionType = Math.random() < 0.5 ? 'translate' : 'write';
  }
  
  if (questionType === 'translate') {
    // Show WORD, ask for TRANSLATION
    displayText = currentTestPair.word;
    currentTestPair.askingFor = 'translation';
    console.log('Test Mode: TRANSLATE - Show word, ask for translation');
  } else {
    // Show TRANSLATION, ask for WORD
    displayText = currentTestPair.translation;
    currentTestPair.askingFor = 'word';
    console.log('Test Mode: WRITE - Show translation, ask for word');
  }
  
  document.getElementById('testWord').textContent = displayText;
  console.log('Displayed:', displayText);
  console.log('Expected answer:', currentTestPair.askingFor === 'translation' ? currentTestPair.translation : currentTestPair.word);
  
  // Restart timer for new word
  if (testTimer) {
    clearInterval(testTimer);
    testTimer = null;
  }
  startTestTimer();
}

function checkTestInput() {
  if (isCheatBlocked) return;

  const testInput = document.getElementById('testInput');
  const userInput = testInput.value.trim();
  
  // Check if input is empty
  if (userInput === '') {
    console.log('? Input is empty!');
    testInput.classList.add('empty');
    setTimeout(() => {
      testInput.classList.remove('empty');
    }, 300);
    return;
  }
  
  if (!currentTestPair) return;
  
  // Determine the correct answer based on what we're asking for
  const correctAnswer = currentTestPair.askingFor === 'translation' 
    ? currentTestPair.translation.toLowerCase() 
    : currentTestPair.word.toLowerCase();
  const userInputLower = userInput.toLowerCase();
  
  console.log('User input:', userInput);
  console.log('Correct answer:', correctAnswer);
  
  if (userInputLower === correctAnswer) {
    console.log('? CORRECT!');
    testInput.classList.remove('incorrect');
    testInput.classList.add('correct');
    
    // Reset mistakes counter
    testCurrentMistakes = 0;
    
    // Wait a moment to show the success state, then show next word
    setTimeout(() => {
      testInput.value = '';
      testInput.classList.remove('correct');
      displayTestWord(); // This will restart the timer
      testInput.focus();
    }, 500);
  } else {
    console.log('? INCORRECT');
    testInput.classList.remove('correct');
    testInput.classList.add('incorrect');
    
    // Increment mistakes counter
    testCurrentMistakes++;
    console.log(`Mistakes: ${testCurrentMistakes} / ${testMaxMistakes}`);
    
    // Check if mistakes limit is enabled and reached
    if (testMistakesEnabled && testCurrentMistakes >= testMaxMistakes) {
      console.log('?? Max mistakes reached! Moving to next word...');
      
      // Reset mistakes counter
      testCurrentMistakes = 0;
      
      // Wait a moment, then show next word
      setTimeout(() => {
        testInput.value = '';
        testInput.classList.remove('incorrect');
        displayTestWord(); // This will restart the timer
        testInput.focus();
      }, 500);
    } else {
      // Clear input and remove incorrect state after animation
      setTimeout(() => {
        testInput.value = '';
        testInput.classList.remove('incorrect');
        testInput.focus();
      }, 300);
    }
  }
}

// ===== SELECT WORDS MODAL =====
function openSelectWordsModal() {
  renderWordsList();
  document.getElementById('selectWordsModal').classList.add('active');
}

function closeSelectWordsModal() {
  document.getElementById('selectWordsModal').classList.remove('active');
}

function renderWordsList() {
  const container = document.getElementById('wordsListContent');

  if (!currentFile || !currentFile.wordPairs || currentFile.wordPairs.length === 0) {
    container.innerHTML = '<div class="empty-message">No words available</div>';
    return;
  }

  container.innerHTML = `
    <div class="words-list">
      ${currentFile.wordPairs
        .map((pair, index) => {
          const isSelected = selectedWords.some(
            w =>
              w.word === pair.word &&
              w.translation === pair.translation
          );

          return `
            <div
              class="word-checkbox-item ${isSelected ? 'selected' : ''}"
              onclick="toggleWordSelection(${index})"
            >
              <div class="word-checkbox"></div>
              <div class="word-checkbox-text">
                <div class="word-checkbox-word">
                  ${pair.word}
                </div>
                <div class="word-checkbox-translation">
                  ${pair.translation}
                </div>
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function toggleWordSelection(index) {
  const wordPair = currentFile.wordPairs[index];

  // In manually mode, only allow selecting one word at a time
  if (pickMode === 'manually') {
    selectedWords = [wordPair];
  } else {
    const existingIndex = selectedWords.findIndex(
      w => w.word === wordPair.word && w.translation === wordPair.translation
    );

    if (existingIndex !== -1) {
      // Word is already selected, remove it
      selectedWords.splice(existingIndex, 1);
    } else {
      // Add word to selection
      selectedWords.push(wordPair);
    }
  }

  renderWordsList();
  updateStartStudyButton();
}

function updateStartStudyButton() {
  const startBtn = document.getElementById('startStudyBtn');
  if (selectedWords.length > 0) {
    startBtn.classList.remove('disabled');
  } else {
    startBtn.classList.add('disabled');
  }
}

function startStudyWithSelectedWords() {
  if (selectedWords.length === 0) return;
  closeSelectWordsModal();
  openStudyArea();
}

// ===== EVENT LISTENERS =====
loadAccounts();
updateFromAccountButton();

document.querySelector('.account-btn').addEventListener('click', openAccountModal);


function showNoCheatingMessage() {
  studyInput.value = '';
  studyInput.placeholder = 'No cheating';
  studyInput.classList.add('incorrect');

  setTimeout(() => {
    studyInput.placeholder = '';
    studyInput.classList.remove('incorrect');
    studyInput.focus();
  }, 800);
}

// Block copy
['copy', 'cut', 'contextmenu'].forEach(event => {
  document.getElementById('currentWord')?.addEventListener(event, e => {
    e.preventDefault();
  });

  document.getElementById('currentTranslation')?.addEventListener(event, e => {
    e.preventDefault();
  });
});

// Study button click handler
studyBtn.addEventListener('click', function() {
  if (studyBtn.classList.contains('disabled')) return;

  // Check which mode is selected
  const manuallyBtn = document.querySelector('.pick-row .toggle-group .toggle-btn.active');
  pickMode = manuallyBtn.textContent.trim().toLowerCase();

  if (pickMode === 'manually') {
    // Open word selection modal
    openSelectWordsModal();
  } else {
    // Randomly mode - go directly to study area
    selectedWords = []; // Clear selection for random mode
    openStudyArea();
  }
});

// Test button click handler
testBtn.addEventListener('click', function() {
  if (testBtn.classList.contains('disabled')) return;
  
  // Get the active test mode
  const activeTestBtn = document.querySelector('.test-row .toggle-group .toggle-btn.active');
  testMode = activeTestBtn.textContent.trim().toLowerCase();
  
  console.log('Starting test with mode:', testMode);
  openTestArea();
});

// Back from Study Area
document.getElementById('backFromStudy').addEventListener('click', function() {
  showExitStudyModal();
});

// Back from Test Area
document.getElementById('backFromTest').addEventListener('click', function() {
  showExitTestModal();
});

// Word input enter button
document.getElementById('enterBtn').addEventListener('click', function() {
  checkWordInput();
});

// Word input Enter key
document.getElementById('wordInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    checkWordInput();
  }
});

// Test input enter button
document.getElementById('testEnterBtn').addEventListener('click', function() {
  checkTestInput();
});

// Test input Enter key
document.getElementById('testInput').addEventListener('keypress', function(e) {
  if (e.key === 'Enter') {
    checkTestInput();
  }
});

// Update ENTER button state based on input
document.getElementById('wordInput').addEventListener('input', function() {
  const enterBtn = document.getElementById('enterBtn');
  if (this.value.trim() === '') {
    enterBtn.disabled = true;
  } else {
    enterBtn.disabled = false;
  }
});

// Update TEST ENTER button state based on input
document.getElementById('testInput').addEventListener('input', function() {
  const testEnterBtn = document.getElementById('testEnterBtn');
  if (this.value.trim() === '') {
    testEnterBtn.disabled = true;
  } else {
    testEnterBtn.disabled = false;
  }
});

// Initialize ENTER button as disabled
document.addEventListener('DOMContentLoaded', function() {
  const enterBtn = document.getElementById('enterBtn');
  if (enterBtn) {
    enterBtn.disabled = true;
  }
  
  const testEnterBtn = document.getElementById('testEnterBtn');
  if (testEnterBtn) {
    testEnterBtn.disabled = true;
  }

// Prevent copying study words via selection
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const wordEl = document.getElementById('currentWord');
  const translationEl = document.getElementById('currentTranslation');

  if (
    (wordEl && wordEl.contains(selection.anchorNode)) ||
    (translationEl && translationEl.contains(selection.anchorNode))
  ) {
    selection.removeAllRanges();
  }
});

  // Make repetition input accept only numbers
  const repInput = document.querySelector('.repetition-input');
  if (repInput) {
    repInput.addEventListener('input', function() {
      // Remove any non-numeric characters
      this.value = this.value.replace(/[^0-9]/g, '');
      // Ensure minimum value of 1
      if (this.value === '' || parseInt(this.value) < 1) {
        this.value = '1';
      }
    });

    // Prevent typing non-numeric characters
    repInput.addEventListener('keypress', function(e) {
      if (!/[0-9]/.test(e.key) && e.key !== 'Enter') {
        e.preventDefault();
      }
    });
  }

  // Study repetition input handler
  const studyRepInput = document.getElementById('studyRepInput');
  if (studyRepInput) {
    studyRepInput.addEventListener('input', function() {
      // Remove any non-numeric characters
      this.value = this.value.replace(/[^0-9]/g, '');
      // Ensure minimum value of 1
      if (this.value === '' || parseInt(this.value) < 1) {
        this.value = '1';
      }
      
      // Update repetitionsRequired for the NEXT word (not current)
      pendingRepetitionsRequired = parseInt(this.value) || 5;
    });

    // Prevent typing non-numeric characters
    studyRepInput.addEventListener('keypress', function(e) {
      if (!/[0-9]/.test(e.key) && e.key !== 'Enter') {
        e.preventDefault();
      }
    });
  }
  
  // Mini inputs (timer and mistakes) handlers
  document.querySelectorAll('.mini-input').forEach(input => {
    // Initially disable inputs that have OFF toggle
    const miniSection = input.closest('.mini-section');
    const activeToggle = miniSection.querySelector('.mini-toggle .mini-toggle-btn.active');
    if (activeToggle && activeToggle.textContent === 'OFF') {
      input.disabled = true;
      input.classList.add('disabled');
    }
    
    input.addEventListener('input', function() {
      // Remove any non-numeric characters
      this.value = this.value.replace(/[^0-9]/g, '');
      // Ensure minimum value of 1
      if (this.value === '' || parseInt(this.value) < 1) {
        this.value = '1';
      }
    });

    // Prevent typing non-numeric characters
    input.addEventListener('keypress', function(e) {
      if (!/[0-9]/.test(e.key) && e.key !== 'Enter') {
        e.preventDefault();
      }
    });
  });
});

// Close select words modal on overlay click
document.getElementById('selectWordsModal').addEventListener('click', function(e) {
  if (e.target === this) closeSelectWordsModal();
});

document.getElementById('accountModal').addEventListener('click', function(e) {
  if (e.target === this) closeAccountModal();
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const accountModal = document.getElementById('accountModal');
    if (accountModal.classList.contains('active')) closeAccountModal();

    const fromAccountModal = document.getElementById('fromAccountModal');
    if (fromAccountModal.classList.contains('active')) closeFromAccountModal();

    const selectWordsModal = document.getElementById('selectWordsModal');
    if (selectWordsModal.classList.contains('active')) closeSelectWordsModal();
  }
  
  // ESC key to exit study mode
  if (e.code === 'Escape') {
    const studyArea = document.getElementById('studyArea');
    const testArea = document.getElementById('testArea');
    
    if (studyArea.classList.contains('active')) {
      e.preventDefault(); // Prevent page scroll
      showExitStudyModal();
    } else if (testArea.classList.contains('active')) {
      e.preventDefault(); // Prevent page scroll
      showExitTestModal();
      showNextWord();
    }
  }
  
  if (e.key === 'Enter' && isCreatingAccount) {
    createAccount();
  }
});

document.querySelectorAll('.toggle-group').forEach(group => {
  group.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      // Update pick mode when toggling in Pick words section
      if (group.closest('.pick-row')) {
        pickMode = this.textContent.trim().toLowerCase();
      }
      
      // Update test mode when toggling in Test section
      if (group.closest('.test-row')) {
        testMode = this.textContent.trim().toLowerCase();
        console.log('Test mode changed to:', testMode);
      }
    });
  });
});

document.querySelectorAll('.mini-toggle').forEach(toggle => {
  toggle.querySelectorAll('.mini-toggle-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      toggle.querySelectorAll('.mini-toggle-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      
      // Get the parent mini-section to find the corresponding input
      const miniSection = toggle.closest('.mini-section');
      const miniInput = miniSection.querySelector('.mini-input');
      
      if (this.textContent === 'OFF') {
        // Disable the input
        miniInput.disabled = true;
        miniInput.classList.add('disabled');
      } else {
        // Enable the input
        miniInput.disabled = false;
        miniInput.classList.remove('disabled');
      }
    });
  });
});