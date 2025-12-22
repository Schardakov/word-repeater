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
let testInputLocked = false;
let testWordStartTime = null;

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
let repetitionsCompletedForWord = 0;

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

// Word performance tracking
let wordPerformance = {}; // Stores performance data for each word

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
      document.getElementById('testEnterBtn').addEventListener('click', checkTestInput);
      testInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    checkTestInput();
  }
});
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

function loadAccounts() {
  const stored = localStorage.getItem('accounts');
  if (stored) accounts = JSON.parse(stored);
  const currentStored = localStorage.getItem('currentAccount');
  if (currentStored) currentAccount = JSON.parse(currentStored);
  
  // Ensure all accounts have stats
  accounts.forEach(acc => {
    if (!acc.stats) {
      acc.stats = {
        totalRepetitions: 0,
        totalWords: 0
      };
    }
  });
  
  // Sync currentAccount with accounts array if it exists
  if (currentAccount) {
    const accountIndex = accounts.findIndex(acc => acc.name === currentAccount.name);
    if (accountIndex !== -1) {
      currentAccount = accounts[accountIndex];
    }
  }
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
  const newAccount = {
  name: name,
  createdAt: new Date().toISOString(),
  files: [],
  stats: {
    totalRepetitions: 0,
    totalWords: 0
  }
};
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
    const totalRepetitions = currentAccount.stats?.totalRepetitions || 0;
    const totalWords = currentAccount.stats?.totalWords || 0;
    
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
        <div class="stats-row">
          <div class="mini-box">
            <div class="mini-box-text">TOTAL REPETITIONS</div>
            <div class="mini-box-number">${totalRepetitions}</div>
          </div>
          <div class="mini-box">
            <div class="mini-box-text">TOTAL WORDS</div>
            <div class="mini-box-number">${totalWords}</div>
          </div>
        </div>
        <button class="reset-stats-btn" onclick="showResetStatsModal()">RESET STATS</button>
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

function updateAccountStatsUI() {
  const repEl = document.querySelector(
    '.mini-box:nth-child(1) .mini-box-number'
  );
  const wordEl = document.querySelector(
    '.mini-box:nth-child(2) .mini-box-number'
  );

  if (!currentAccount || !currentAccount.stats) return;

  if (repEl) repEl.textContent = currentAccount.stats.totalRepetitions;
  if (wordEl) wordEl.textContent = currentAccount.stats.totalWords;
}

function closeStudyArea() {
  document.querySelector('.practice-settings').classList.remove('hidden');
  document.getElementById('studyArea').classList.remove('active');
  selectedWords = []; // Reset selected words
  currentWordIndex = 0;
  currentWordPair = null;
  currentRepetitionCount = 0;
  repetitionsCompletedForWord = 0;
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

  if (userInput === '') return;
  if (!currentWordPair) return;

  const correctAnswer = currentWordPair.word;

// ? CORRECT ANSWER
if (isAnswerCorrect(userInput, correctAnswer)) {
    currentRepetitionCount++;
    repetitionsCompletedForWord++;

    // ? COUNT REPETITION (ONCE)
    if (currentAccount?.stats) {
      currentAccount.stats.totalRepetitions += 1;

      saveCurrentAccount();

      const accIndex = accounts.findIndex(
        acc => acc.name === currentAccount.name
      );
      if (accIndex !== -1) {
        accounts[accIndex] = currentAccount;
        saveAccounts();
      }

      updateAccountStatsUI(); // ?? LIVE UPDATE
    }

    updateRepetitionDisplay();

    wordInput.classList.remove('incorrect');
    wordInput.classList.add('correct');

    // ? WORD COMPLETED
    if (currentRepetitionCount >= repetitionsRequired) {

      if (currentAccount?.stats) {
        currentAccount.stats.totalWords += 1;

        saveCurrentAccount();

        const accIndex = accounts.findIndex(
          acc => acc.name === currentAccount.name
        );
        if (accIndex !== -1) {
          accounts[accIndex] = currentAccount;
          saveAccounts();
        }

        updateAccountStatsUI(); // ?? LIVE UPDATE
      }

      setTimeout(() => {
        currentRepetitionCount = 0;
        repetitionsCompletedForWord = 0;
        updateRepetitionDisplay();

        wordInput.value = '';
        wordInput.classList.remove('correct');

        if (pickMode === 'manually') {
          closeStudyArea();
          openSelectWordsModal();
        } else {
          displayRandomWord();
          wordInput.focus();
        }
      }, 500);

    } else {
      // Continue same word
      setTimeout(() => {
        wordInput.value = '';
        wordInput.classList.remove('correct');
        wordInput.focus();
      }, 300);
    }

  // ? INCORRECT ANSWER
  } else {
    wordInput.classList.remove('correct');
    wordInput.classList.add('incorrect');

    setTimeout(() => {
      wordInput.value = '';
      wordInput.classList.remove('incorrect');
      wordInput.focus();
    }, 300);
  }
}

// ===== WORD PERFORMANCE TRACKING =====
function initializeWordPerformance() {
  if (!currentFile || !currentFile.wordPairs) return;
  
  // Load saved performance data from localStorage
  const savedPerformance = localStorage.getItem(`wordPerformance_${currentFile.name}`);
  if (savedPerformance) {
    wordPerformance = JSON.parse(savedPerformance);
  } else {
    wordPerformance = {};
  }
  
  // Initialize any new words that don't have performance data
  currentFile.wordPairs.forEach(pair => {
    const wordKey = `${pair.word}_${pair.translation}`;
    if (!wordPerformance[wordKey]) {
      wordPerformance[wordKey] = {
        correctCount: 0,
        mistakeCount: 0,
        totalAttempts: 0,
        lastSeen: null,
        weight: 1.0,
        streak: 0,
        consecutiveMistakes: 0, // NEW: Track consecutive mistakes
        masteryLevel: 0, // NEW: 0-100 scale indicating mastery
        recentHistory: [], // NEW: Last 10 attempts (true/false)
        avgResponseTime: null, // NEW: Average time to answer correctly
        difficulty: 1.0 // NEW: Calculated difficulty based on all users' performance
      };
    }
  });
  
  saveWordPerformance();
}

function saveWordPerformance() {
  if (!currentFile) return;
  localStorage.setItem(`wordPerformance_${currentFile.name}`, JSON.stringify(wordPerformance));
}

function updateWordPerformance(wordPair, wasCorrect, responseTimeMs = null) {
  const wordKey = `${wordPair.word}_${wordPair.translation}`;
  const performance = wordPerformance[wordKey];
  
  if (!performance) return;
  
  performance.totalAttempts++;
  performance.lastSeen = Date.now();
  
  // Update recent history (keep last 10 attempts)
  performance.recentHistory.push(wasCorrect);
  if (performance.recentHistory.length > 10) {
    performance.recentHistory.shift();
  }
  
  if (wasCorrect) {
    performance.correctCount++;
    performance.streak++;
    performance.consecutiveMistakes = 0;
    
    // Update average response time for correct answers
    if (responseTimeMs !== null) {
      if (performance.avgResponseTime === null) {
        performance.avgResponseTime = responseTimeMs;
      } else {
        // Weighted average favoring recent performance
        performance.avgResponseTime = (performance.avgResponseTime * 0.7) + (responseTimeMs * 0.3);
      }
    }
    
    // Calculate mastery level (0-100)
    const recentSuccessRate = performance.recentHistory.filter(x => x).length / performance.recentHistory.length;
    const overallSuccessRate = performance.correctCount / performance.totalAttempts;
    performance.masteryLevel = Math.min(100, 
      (recentSuccessRate * 60) + // 60% weight on recent performance
      (overallSuccessRate * 30) + // 30% weight on overall performance
      (Math.min(performance.streak, 10) * 1) // 10% weight on streak (capped at 10)
    );
    
    // Decrease weight for correct answers
    // The higher the mastery level, the more aggressively we reduce weight
    const masteryFactor = 1 - (performance.masteryLevel / 150);
    performance.weight = Math.max(0.05, performance.weight * (0.75 + masteryFactor * 0.15));
    
    // Bonus reduction for long streaks
    if (performance.streak >= 5) {
      performance.weight = Math.max(0.05, performance.weight * 0.6);
    }
  } else {
    performance.mistakeCount++;
    performance.streak = 0;
    performance.consecutiveMistakes++;
    
    // Update mastery level (decrease on mistakes)
    const recentSuccessRate = performance.recentHistory.filter(x => x).length / performance.recentHistory.length;
    const overallSuccessRate = performance.correctCount / performance.totalAttempts;
    performance.masteryLevel = Math.max(0,
      (recentSuccessRate * 60) +
      (overallSuccessRate * 30) +
      (Math.min(performance.streak, 10) * 1)
    );
    
    // Increase weight for mistakes
    // Multiple consecutive mistakes = much higher priority
    const mistakePenalty = 1.5 + (performance.consecutiveMistakes * 0.3);
    performance.weight = Math.min(15.0, performance.weight * mistakePenalty);
    
    // Extra penalty if mistake rate is high
    if (performance.mistakeCount > performance.correctCount * 1.5) {
      performance.weight = Math.min(15.0, performance.weight * 1.4);
    }
    
    // If mastery level is very low, boost priority even more
    if (performance.masteryLevel < 30) {
      performance.weight = Math.min(15.0, performance.weight * 1.3);
    }
  }
  
  saveWordPerformance();
}

function selectWeightedRandomWord() {
  if (!currentFile || !currentFile.wordPairs || currentFile.wordPairs.length === 0) {
    return null;
  }
  
  // Calculate weights for all words
  const wordWeights = currentFile.wordPairs.map(pair => {
    const wordKey = `${pair.word}_${pair.translation}`;
    const performance = wordPerformance[wordKey];
    
    if (!performance) return { pair, weight: 1.0 };
    
    let finalWeight = performance.weight;
    
    // TIME-BASED BONUS: Words not seen recently get higher priority
    if (performance.lastSeen) {
      const minutesSince = (Date.now() - performance.lastSeen) / (1000 * 60);
      
      if (minutesSince > 5) finalWeight *= 1.1;
      if (minutesSince > 15) finalWeight *= 1.3;
      if (minutesSince > 30) finalWeight *= 1.6;
      if (minutesSince > 60) finalWeight *= 2.0;
    } else {
      // Never seen before - very high priority
      finalWeight *= 3.0;
    }
    
    // MASTERY-BASED ADJUSTMENT: Lower mastery = higher priority
    const masteryPenalty = 1 + ((100 - performance.masteryLevel) / 100);
    finalWeight *= masteryPenalty;
    
    // MISTAKE STREAK BONUS: Recent consecutive mistakes = much higher priority
    if (performance.consecutiveMistakes > 0) {
      finalWeight *= (1 + performance.consecutiveMistakes * 0.5);
    }
    
    // RECENT PERFORMANCE: Look at last 5 attempts
    if (performance.recentHistory.length >= 5) {
      const recentFive = performance.recentHistory.slice(-5);
      const recentMistakes = recentFive.filter(x => !x).length;
      
      if (recentMistakes >= 3) {
        // 3+ mistakes in last 5 attempts = needs urgent review
        finalWeight *= 1.8;
      }
    }
    
    // ACCURACY RATIO: If overall accuracy is poor, boost priority
    if (performance.totalAttempts >= 5) {
      const accuracy = performance.correctCount / performance.totalAttempts;
      if (accuracy < 0.5) {
        finalWeight *= 1.5;
      } else if (accuracy < 0.3) {
        finalWeight *= 2.0;
      }
    }
    
    return { pair, weight: Math.max(0.05, finalWeight) };
  });
  
  // Use weighted random selection
  const totalWeight = wordWeights.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const item of wordWeights) {
    random -= item.weight;
    if (random <= 0) {
      return item.pair;
    }
  }
  
  // Fallback (should rarely happen)
  return wordWeights[wordWeights.length - 1].pair;
}

renderAccountsModal();

// ===== TEST AREA FUNCTIONS =====
function openTestArea() {
  document.querySelector('.practice-settings').classList.add('hidden');
  document.getElementById('testArea').classList.add('active');
  initializeWordPerformance();

  // Get test settings
  testTimerEnabled =
    document.querySelector('.mini-section:first-child .mini-toggle .mini-toggle-btn.active').textContent === 'ON';
  testTimerSeconds =
    parseInt(document.querySelector('.mini-section:first-child .mini-input').value) || 30;
const mistakesToggle = document.querySelector(
  '#mistakesSection .mini-toggle .mini-toggle-btn.active'
);
const mistakesInput = document.querySelector(
  '#mistakesSection .mini-input'
);

testMistakesEnabled = mistakesToggle?.textContent === 'ON';
testMaxMistakes = parseInt(mistakesInput?.value) || 3;

console.log('Mistakes enabled:', testMistakesEnabled, 'Max:', testMaxMistakes);

  // ===== MISTAKE COUNTER SETUP =====
  const mistakeCounter = document.getElementById('mistakeCounter');
  const mistakeCount = document.getElementById('mistakeCount');
  const maxMistakes = document.getElementById('maxMistakes');

  if (testMistakesEnabled) {
    if (maxMistakes) maxMistakes.textContent = testMaxMistakes;
    mistakeCounter.classList.remove('hidden');
  } else {
    mistakeCounter.classList.add('hidden');
  }

  console.log('Test settings:', {
    timerEnabled: testTimerEnabled,
    timerSeconds: testTimerSeconds,
    mistakesEnabled: testMistakesEnabled,
    maxMistakes: testMaxMistakes
  });

  // Reset input
  const testInput = document.getElementById('testInput');
  testInput.value = '';
  testInput.classList.remove('correct', 'incorrect');

  displayTestWord();
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

function resetMistakesForNewWord() {
  testCurrentMistakes = 0;

  const mistakeCount = document.getElementById('mistakeCount');
  if (mistakeCount) {
    mistakeCount.textContent = '0';
  }
}

 function displayTestWord() {
  if (testMistakesEnabled) {
    resetMistakesForNewWord();
  }

  if (!currentFile || !currentFile.wordPairs || currentFile.wordPairs.length === 0) {
    document.getElementById('testWord').textContent = 'No words available';
    return;
  }
  
  currentTestPair = selectWeightedRandomWord();
  
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
  
  // Record when the word was displayed (for response time tracking)
  testWordStartTime = Date.now();
  
  // Restart timer for new word
  if (testTimer) {
    clearInterval(testTimer);
    testTimer = null;
  }
  startTestTimer();
}

function checkTestInput() {
  if (isCheatBlocked || testInputLocked) return;

  const testInput = document.getElementById('testInput');
  const userInput = testInput.value.trim();

  if (userInput === '') return;
  if (!currentTestPair) return;

  testInputLocked = true;
  
  // Calculate response time
  const responseTime = testWordStartTime ? Date.now() - testWordStartTime : null;

  const correctAnswer =
    currentTestPair.askingFor === 'translation'
      ? currentTestPair.translation
      : currentTestPair.word;

  console.log('Checking answer. User:', userInput, 'Correct:', correctAnswer);

  // ===== CORRECT ANSWER =====
  if (isAnswerCorrect(userInput, correctAnswer)) {
    testInput.classList.remove('incorrect');
    testInput.classList.add('correct');
    
    updateWordPerformance(currentTestPair, true, responseTime);

    setTimeout(() => {
      testInput.value = '';
      testInput.classList.remove('correct');
      testInputLocked = false;
      displayTestWord();
      testInput.focus();
    }, 400);

  // ===== INCORRECT ANSWER =====
  } else {
    testInput.classList.add('incorrect');
    
    updateWordPerformance(currentTestPair, false, null);

    // ? MISTAKES OFF ? always move on
    if (!testMistakesEnabled) {
      setTimeout(() => {
        testInput.value = '';
        testInput.classList.remove('incorrect');
        testInputLocked = false;
        displayTestWord();
        testInput.focus();
      }, 400);
      return;
    }

    // ? MISTAKES ON ? increment + update UI
    testCurrentMistakes++;

    // ?? UPDATE COUNTER DISPLAY
    const mistakeCount = document.getElementById('mistakeCount');
    if (mistakeCount) {
      mistakeCount.textContent = testCurrentMistakes;
    }

    // ?? Reached max mistakes ? move on to next word
    if (testCurrentMistakes >= testMaxMistakes) {
      testCurrentMistakes = 0;

      // Reset counter display for next word
      if (mistakeCount) {
        mistakeCount.textContent = '0';
      }

      setTimeout(() => {
        testInput.value = '';
        testInput.classList.remove('incorrect');
        testInputLocked = false;
        displayTestWord();
        testInput.focus();
      }, 500);

    // ?? Still attempts left ? retry same word
    } else {
      setTimeout(() => {
        testInput.value = '';
        testInput.classList.remove('incorrect');
        testInputLocked = false;
        testInput.focus();
      }, 300);
    }
  }
}

// ===== HELPER FUNCTION: Get word statistics for debugging/UI =====
function getWordStatistics(wordPair) {
  const wordKey = `${wordPair.word}_${wordPair.translation}`;
  const performance = wordPerformance[wordKey];
  
  if (!performance) return null;
  
  const accuracy = performance.totalAttempts > 0 
    ? ((performance.correctCount / performance.totalAttempts) * 100).toFixed(1)
    : 0;
  
  return {
    attempts: performance.totalAttempts,
    correct: performance.correctCount,
    mistakes: performance.mistakeCount,
    accuracy: `${accuracy}%`,
    masteryLevel: performance.masteryLevel.toFixed(1),
    streak: performance.streak,
    weight: performance.weight.toFixed(2)
  };
}

// ===== OPTIONAL: Reset performance for a specific word =====
function resetWordPerformance(wordPair) {
  const wordKey = `${wordPair.word}_${wordPair.translation}`;
  if (wordPerformance[wordKey]) {
    wordPerformance[wordKey] = {
      correctCount: 0,
      mistakeCount: 0,
      totalAttempts: 0,
      lastSeen: null,
      weight: 1.0,
      streak: 0,
      consecutiveMistakes: 0,
      masteryLevel: 0,
      recentHistory: [],
      avgResponseTime: null,
      difficulty: 1.0
    };
    saveWordPerformance();
  }
}

// ===== OPTIONAL: View all word performances (for statistics page) =====
function getAllWordStatistics() {
  if (!currentFile || !currentFile.wordPairs) return [];
  
  return currentFile.wordPairs.map(pair => {
    const stats = getWordStatistics(pair);
    return {
      word: pair.word,
      translation: pair.translation,
      ...stats
    };
  }).sort((a, b) => parseFloat(b.weight) - parseFloat(a.weight)); // Sort by weight (highest first)
}

// ===== SELECT WORDS MODAL =====
function openSelectWordsModal() {
  // Clear search query when opening modal
  const searchInput = document.getElementById('wordSearchInput');
  if (searchInput) {
    searchInput.value = '';
  }
  
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

  // Check if search input already exists
  let searchInput = document.getElementById('wordSearchInput');
  const isFirstRender = !searchInput;
  
  if (isFirstRender) {
    // First render - create the full structure
    container.innerHTML = `
      <div class="search-container">
        <input 
          type="text" 
          id="wordSearchInput" 
          class="word-search-input" 
          placeholder="Search words..." 
          autocomplete="off"
        />
      </div>
      <div id="wordsListResults" class="words-list"></div>
    `;
    
    // Attach event listener
    searchInput = document.getElementById('wordSearchInput');
    searchInput.addEventListener('input', function() {
      updateWordsList();
    });
  }
  
  // Update the words list (not the search input)
  updateWordsList();
}

function renderWordsList() {
  const container = document.getElementById('wordsListContent');

  if (!currentFile || !currentFile.wordPairs || currentFile.wordPairs.length === 0) {
    container.innerHTML = '<div class="empty-message">No words available</div>';
    return;
  }

  // Check if search input already exists
  let searchInput = document.getElementById('wordSearchInput');
  const isFirstRender = !searchInput;
  
  if (isFirstRender) {
    // First render - create the full structure
    container.innerHTML = `
      <div class="search-container">
        <input 
          type="text" 
          id="wordSearchInput" 
          class="word-search-input" 
          placeholder="Search words..." 
          autocomplete="off"
        />
      </div>
      <div id="wordsListResults" class="words-list"></div>
    `;
    
    // Attach event listener
    searchInput = document.getElementById('wordSearchInput');
    searchInput.addEventListener('input', function() {
      updateWordsList();
    });
  }
  
  // Update the words list (not the search input)
  updateWordsList();
}

  // Re-attach event listener to search input
  const newSearchInput = document.getElementById('wordSearchInput');
  if (newSearchInput) {
    newSearchInput.addEventListener('input', function() {
      renderWordsList();
    });
    
    // Restore focus and cursor position
    newSearchInput.focus();
    newSearchInput.setSelectionRange(cursorPosition, cursorPosition);
}

function updateWordsList() {
  const searchInput = document.getElementById('wordSearchInput');
  const resultsContainer = document.getElementById('wordsListResults');
  
  if (!resultsContainer) return;
  
  const searchQuery = searchInput ? searchInput.value.toLowerCase() : '';

  // Filter words based on search query
  const filteredWords = searchQuery
    ? currentFile.wordPairs.filter(pair => 
        pair.word.toLowerCase().includes(searchQuery) || 
        pair.translation.toLowerCase().includes(searchQuery)
      )
    : currentFile.wordPairs;

  resultsContainer.innerHTML = filteredWords.length > 0 
    ? filteredWords.map((pair) => {
        // Get the original index from the full word list
        const originalIndex = currentFile.wordPairs.indexOf(pair);
        return `
          <div
            class="word-checkbox-item"
            onclick="toggleWordSelection(${originalIndex})"
          >
            <div class="word-checkbox-text">
              ${pair.word} - ${pair.translation}
            </div>
              </div>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="empty-message">No words found</div>';
}

function toggleWordSelection(index) {
  const wordPair = currentFile.wordPairs[index];

  // In manually mode, select word and start studying immediately
  if (pickMode === 'manually') {
    selectedWords = [wordPair];
    closeSelectWordsModal();
    openStudyArea();
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
    
    renderWordsList();
    updateStartStudyButton();
  }
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
// ===== RESET ACCOUNT STATS =====
function showResetStatsModal() {
  document.getElementById('resetStatsModal').classList.add('active');
}

function confirmResetStats(shouldReset) {
  document.getElementById('resetStatsModal').classList.remove('active');
  
  if (shouldReset && currentAccount) {
    // Reset stats to zero
    currentAccount.stats.totalRepetitions = 0;
    currentAccount.stats.totalWords = 0;
    
    // Save to localStorage
    saveCurrentAccount();
    
    // Update in accounts array
    const accountIndex = accounts.findIndex(acc => acc.name === currentAccount.name);
    if (accountIndex !== -1) {
      accounts[accountIndex] = currentAccount;
      saveAccounts();
    }
    
    // Update UI
    updateAccountStatsUI();
    renderAccountsModal();
  }
}

// ===== FLEXIBLE ANSWER MATCHING =====
function normalizeAnswer(text) {
  // Convert to lowercase and trim
  let normalized = text.toLowerCase().trim();
  
  // Remove common prefixes
  normalized = normalized.replace(/^to\s+/, ''); // Remove "to " at start
  normalized = normalized.replace(/^a\s+/, '');  // Remove "a " at start
  normalized = normalized.replace(/^an\s+/, ''); // Remove "an " at start
  normalized = normalized.replace(/^the\s+/, ''); // Remove "the " at start
  
  return normalized;
}

function isAnswerCorrect(userInput, correctAnswer) {
  // Normalize user input (removes prefixes like "to", "the", "a", "an")
  const normalizedUser = normalizeAnswer(userInput);
  
  // Split the correct answer by common separators
  const separators = /[\/,;|]/; // slash, comma, semicolon, pipe
  const validAnswers = correctAnswer.split(separators).map(ans => ans.trim());
  
  console.log('User typed:', userInput, '? normalized:', normalizedUser);
  console.log('Valid answers:', validAnswers);
  
  // Check if user input matches any valid answer (with or without prefixes)
  for (const validAns of validAnswers) {
    const normalized = normalizeAnswer(validAns);
    console.log('Checking:', validAns, '? normalized:', normalized, '? match?', normalizedUser === normalized);
    
    // Direct match after normalization
    if (normalizedUser === normalized) {
      return true;
    }
  }
  
  return false;
}