import { wordlyLibrary } from './data/library.js?v=202603130002';
import { verifySpelling, isMeaningCorrect } from './utils/VerificationLogic.js?v=202603130002';
import { computeNextSrs, makeSrsKey, seedMastered } from './utils/SrsScheduler.js?v=202603130002';

const MANUAL_BOOK = 'Custom';
const MANUAL_CHAPTER = 'Manual';

class WordMaster {
    constructor() {
        this.words = [];
        this.currentIndex = 0;
        this.score = { correct: 0, incorrect: 0 };
        this.state = 'SETUP'; // SETUP, SPELLING, MEANING, FAILURE, RESULTS
        this.quizSource = 'QUIZ'; // QUIZ, REVIEW_INCORRECT, SRS

        this.initElements();
        this.initLibrary();
        this.initTheme();
        this.initVoices();
        this.attachEvents();
        lucide.createIcons();
        document.querySelectorAll('svg[data-lucide]').forEach(svg => svg.removeAttribute('data-lucide'));

        // Initialize persistence
        this.masteredWords = new Set(JSON.parse(localStorage.getItem('wordmaster-mastered') || '[]'));

        // Migrate old Set-based incorrect words to new Array format
        const storedIncorrect = localStorage.getItem('wordmaster-incorrect');
        let incorrectData = [];

        if (storedIncorrect) {
            try {
                const parsed = JSON.parse(storedIncorrect);
                if (Array.isArray(parsed)) {
                    // Check if it's already in new format (array of objects)
                    if (parsed.length > 0 && typeof parsed[0] === 'object' && parsed[0].word) {
                        incorrectData = parsed; // New format
                    } else {
                        // Old format: array of strings, migrate to new format without book/chapter
                        incorrectData = parsed.map(word => ({ word, book: null, chapter: null }));
                    }
                }
            } catch (e) {
                console.warn('Could not parse incorrect words, resetting:', e);
            }
        }

        this.incorrectWords = incorrectData;
        this.currentBook = null;
        this.currentChapter = null;

        this.srsData = this.loadSrsData();
        this.seedSrsIfNeeded();

        this.updateMasteryUI();
        this.updateReviewButtons(); // Initialize button state on load
    }

    initElements() {
        this.views = {
            setup: document.getElementById('setup-view'),
            quiz: document.getElementById('quiz-view'),
            results: document.getElementById('results-view'),
            settings: document.getElementById('settings-view'),
            reviewList: document.getElementById('review-list-view')
        };

        this.inputs = {
            library: document.getElementById('library-select'),
            paste: document.getElementById('word-paste'),
            spelling: document.getElementById('spelling-input'),
            meaning: document.getElementById('meaning-input'),
            meaningGroup: document.getElementById('meaning-group'),
            voiceSelect: document.getElementById('voice-select')
        };

        this.displays = {
            counter: document.getElementById('quiz-counter'),
            correct: document.getElementById('correct-count'),
            incorrect: document.getElementById('incorrect-count'),
            progress: document.getElementById('progress-fill'),
            feedback: document.getElementById('feedback'),
            score: document.getElementById('score-display'),
            stats: document.getElementById('stats-detail'),
            setupNotice: document.getElementById('setup-notice'),
            reviewWordsContainer: document.getElementById('review-words-container'),
            reviewListSubtitle: document.getElementById('review-list-subtitle')
        };

        this.btns = {
            start: document.getElementById('start-btn'),
            speak: document.getElementById('speak-btn'),
            check: document.getElementById('check-btn'),
            next: document.getElementById('next-btn'),
            restart: document.getElementById('restart-btn'),
            finalRestart: document.getElementById('final-restart-btn'),
            startReview: document.getElementById('review-btn'),
            startReviewDue: document.getElementById('review-due-btn'),
            themeToggle: document.getElementById('theme-toggle'),
            settings: document.getElementById('settings-btn'),
            saveSettings: document.getElementById('save-settings-btn'),
            previewVoice: document.getElementById('preview-voice-btn'),
            startReviewAction: document.getElementById('start-review-action-btn'),
            backToSetup: document.getElementById('back-to-setup-btn')
        };
    }

    initTheme() {
        // Load saved theme or default to dark
        const savedTheme = localStorage.getItem('wordmaster-theme') || 'dark';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('wordmaster-theme', theme);

        // Update Icon
        const iconName = theme === 'light' ? 'moon' : 'sun';
        this.btns.themeToggle.innerHTML = `<i data-lucide="${iconName}"></i>`;
        lucide.createIcons();
        document.querySelectorAll('svg[data-lucide]').forEach(svg => svg.removeAttribute('data-lucide'));
    }

    initVoices() {
        this.voices = [];
        this.selectedVoiceURI = localStorage.getItem('wordmaster-voice-uri') || '';

        const populateVoices = () => {
            this.voices = window.speechSynthesis.getVoices().filter(voice => {
                const lang = voice.lang.replace('_', '-');
                return lang.startsWith('en-US') || lang.startsWith('en-GB');
            });
            // preserve the "System Default" option
            this.inputs.voiceSelect.innerHTML = '<option value="">System Default</option>';

            this.voices.forEach(voice => {
                const opt = document.createElement('option');
                opt.value = voice.voiceURI;
                opt.textContent = `${voice.name} (${voice.lang})`;
                if (voice.voiceURI === this.selectedVoiceURI) {
                    opt.selected = true;
                }
                this.inputs.voiceSelect.appendChild(opt);
            });
        };

        populateVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = populateVoices;
        }
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        this.setTheme(next);
    }

    initLibrary() {
        this.wordMap = new Map();
        for (const book in wordlyLibrary) {
            for (const chapter in wordlyLibrary[book]) {
                const opt = document.createElement('option');
                opt.value = `${book}|${chapter}`;
                opt.textContent = `${book} - ${chapter} `;
                this.inputs.library.appendChild(opt);

                for (const item of wordlyLibrary[book][chapter]) {
                    const key = makeSrsKey(book, chapter, item.word);
                    this.wordMap.set(key, item);
                }
            }
        }
    }

    attachEvents() {
        this.btns.start.onclick = () => this.startQuiz();
        this.btns.startReview.onclick = () => this.startReviewQuiz();
        this.btns.startReviewDue.onclick = () => this.startSrsReviewQuiz();
        this.btns.speak.onclick = () => this.pronounceCurrent();
        this.btns.check.onclick = () => this.handleCheck();
        this.btns.next.onclick = () => this.handleNext();
        this.btns.restart.onclick = () => this.reset();
        this.btns.finalRestart.onclick = () => this.reset();
        this.btns.themeToggle.onclick = () => this.toggleTheme();
        this.btns.settings.onclick = () => this.showView('settings');
        this.btns.saveSettings.onclick = () => this.saveSettings();
        this.btns.previewVoice.onclick = () => this.previewVoice();
        this.btns.startReviewAction.onclick = () => this.startQuizCommon();
        this.btns.backToSetup.onclick = () => this.showView('setup');

        const quizModeRadios = document.querySelectorAll('input[name="quiz-mode"]');
        quizModeRadios.forEach(radio => {
            radio.onchange = () => this.updatePlaceholder();
        });

        // Keyboard Shortcuts
        document.addEventListener('keydown', (e) => {
            if (this.state === 'SETUP') {
                if (e.key === 'Enter' && !this.btns.start.disabled) {
                    this.startQuiz();
                }
                return;
            }

            if (this.state === 'QUIZ') {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleCheck();
                }
            } else if (this.state === 'FINISHED_WORD') {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleNext();
                }
            } else if (this.state === 'RESULTS') {
                // Determine which restart is visible or default to main reset
                if (e.key === 'Enter') {
                    this.reset();
                }
            }

            // Audio Replay (Ctrl/Cmd + Space)
            if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
                e.preventDefault();
                this.pronounceCurrent();
            }
        });

        // Make library and paste mutually exclusive (hide instead of clear)
        this.inputs.library.onchange = () => {
            if (this.inputs.library.value) {
                // Hide paste area when library is selected
                this.inputs.paste.closest('.input-group').classList.add('hidden');
                this.updateReviewButtons(); // Update review button visibility & count
            } else {
                // Show paste area when library is deselected
                this.inputs.paste.closest('.input-group').classList.remove('hidden');
                this.btns.startReview.classList.add('hidden'); // Hide review button when no book selected
                this.updateReviewButtons();
            }
        };

        this.inputs.paste.oninput = () => {
            if (this.inputs.paste.value.trim()) {
                // Hide library when user types in paste area
                this.inputs.library.closest('.input-group').classList.add('hidden');
            } else {
                // Show library when paste area is empty
                this.inputs.library.closest('.input-group').classList.remove('hidden');
            }
        };

        // Handle enter key
        this.inputs.spelling.onkeypress = (e) => {
            if (e.key === 'Enter') this.handleCheck();
        };
        this.inputs.meaning.onkeypress = (e) => { if (e.key === 'Enter') this.handleCheck(); };

        // Set initial placeholder
        this.updatePlaceholder();
    }

    updateMasteryUI() {
        const statsEl = document.getElementById('total-mastered');
        if (statsEl) {
            statsEl.textContent = this.masteredWords.size;
        }
    }

    showSetupNotice(message, isError = true) {
        if (!this.displays.setupNotice) return;
        this.displays.setupNotice.textContent = message;
        this.displays.setupNotice.classList.remove('hidden');
        this.displays.setupNotice.classList.toggle('error', isError);
    }

    clearSetupNotice() {
        if (!this.displays.setupNotice) return;
        this.displays.setupNotice.textContent = '';
        this.displays.setupNotice.classList.add('hidden');
        this.displays.setupNotice.classList.remove('error');
    }

    saveProgress() {
        localStorage.setItem('wordmaster-mastered', JSON.stringify([...this.masteredWords]));
        localStorage.setItem('wordmaster-incorrect', JSON.stringify(this.incorrectWords));
        this.updateMasteryUI();
    }

    loadSrsData() {
        const raw = localStorage.getItem('wordmaster-srs-v1');
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
            console.warn('Could not parse SRS data, resetting:', e);
            return {};
        }
    }

    saveSrsData() {
        localStorage.setItem('wordmaster-srs-v1', JSON.stringify(this.srsData));
    }

    seedSrsIfNeeded() {
        const alreadySeeded = localStorage.getItem('wordmaster-srs-seeded') === '1';
        const hasSrs = Object.keys(this.srsData).length > 0;
        if (alreadySeeded || hasSrs || this.masteredWords.size === 0) return;

        const entries = [];
        for (const book in wordlyLibrary) {
            for (const chapter in wordlyLibrary[book]) {
                for (const item of wordlyLibrary[book][chapter]) {
                    if (this.masteredWords.has(item.word)) {
                        entries.push({ word: item.word, book, chapter });
                    }
                }
            }
        }

        if (entries.length === 0) return;
        this.srsData = seedMastered(entries, Date.now());
        localStorage.setItem('wordmaster-srs-seeded', '1');
        this.saveSrsData();
    }

    ensureSrsEntry(word, book, chapter, wordObj = null) {
        const key = makeSrsKey(book, chapter, word);
        if (this.srsData[key]) return;
        const seeded = seedMastered([{ word, book, chapter }], Date.now());
        this.srsData[key] = seeded[key];

        if (wordObj && book === MANUAL_BOOK) {
            this.srsData[key].customData = {
                meaning: wordObj.meaning,
                definition: wordObj.definition,
                root: wordObj.root
            };
        }

        this.saveSrsData();
    }

    updateSrsOnAnswer(word, book, chapter, isCorrect) {
        const key = makeSrsKey(book, chapter, word);
        const current = this.srsData[key];
        const quality = isCorrect ? 5 : 2;
        this.srsData[key] = computeNextSrs(current, quality, Date.now());
        this.saveSrsData();
    }

    _getSrsWords(filterFn, limit = null) {
        const now = Date.now();
        let list = Object.entries(this.srsData)
            .map(([key, entry]) => {
                let wordObj = this.wordMap.get(key);
                if (!wordObj && entry.customData) {
                    const [book, chapter, word] = key.split('|');
                    wordObj = { word, ...entry.customData };
                }
                if (!wordObj) return null;
                const [book, chapter] = key.split('|');
                return { ...wordObj, entry, book, chapter };
            })
            .filter(mapped => mapped && filterFn(mapped.entry, now))
            .sort((a, b) => a.entry.nextDue - b.entry.nextDue);

        if (limit) {
            list = list.slice(0, limit);
        }

        return list;
    }

    getGlobalSrsDue() {
        return this._getSrsWords((entry, now) => entry.nextDue <= now);
    }

    getSrsSoon(count = 15) {
        return this._getSrsWords((entry, now) => entry.nextDue > now, count);
    }

    saveSettings() {
        const selectedURI = this.inputs.voiceSelect.value;
        this.selectedVoiceURI = selectedURI;
        localStorage.setItem('wordmaster-voice-uri', selectedURI);
        this.showView('setup');
    }

    previewVoice() {
        const selectedURI = this.inputs.voiceSelect.value;
        const utterance = new SpeechSynthesisUtterance("Apple, a round fruit with red or green skin and whitish interior.");
        utterance.lang = 'en-US';
        utterance.rate = 0.9;

        if (selectedURI) {
            const selectedVoice = this.voices.find(v => v.voiceURI === selectedURI);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                utterance.lang = selectedVoice.lang;
            }
        }

        window.speechSynthesis.cancel();
        window.currentUtterance = utterance; // Prevent GC in Safari
        window.speechSynthesis.speak(utterance);
    }

    getIncorrectCountForBook(book, chapter) {
        return this.incorrectWords.filter(item =>
            item.book === book && item.chapter === chapter
        ).length;
    }

    updateReviewButtons() {
        const libVal = this.inputs.library.value;

        if (libVal) {
            const [book, chapter] = libVal.split('|');
            const count = this.getIncorrectCountForBook(book, chapter);
            if (count === 0) {
                this.btns.startReview.classList.add('hidden');
            } else {
                this.btns.startReview.classList.remove('hidden');
                const btnText = this.btns.startReview.querySelector('.btn-text');
                if (btnText) btnText.textContent = `Review Incorrect (${count})`;
            }
        } else {
            this.btns.startReview.classList.add('hidden');
        }

        this.btns.startReviewDue.classList.remove('hidden');
        const srsText = this.btns.startReviewDue.querySelector('.btn-text');
        if (srsText) srsText.textContent = `Review`;
    }

    startReviewQuiz() {
        const libVal = this.inputs.library.value;
        this.clearSetupNotice();
        if (!libVal) {
            this.showSetupNotice("Please select a library item first.");
            return;
        }

        const [book, chapter] = libVal.split('|');
        const wrongWordSet = new Set(
            this.incorrectWords
                .filter(item => item.book === book && item.chapter === chapter)
                .map(item => item.word)
        );

        if (wrongWordSet.size === 0) {
            this.showSetupNotice("Great job! No incorrect words for this lesson.", false);
            return;
        }

        // Load full word objects from library
        const fullWords = wordlyLibrary[book][chapter].filter(w => wrongWordSet.has(w.word));

        this.words = [...fullWords].sort(() => Math.random() - 0.5);
        this.currentBook = book;
        this.currentChapter = chapter;
        this.quizSource = 'REVIEW_INCORRECT';
        this.startQuizCommon();
    }

    startSrsReviewQuiz() {
        let wordsToReview = this.getGlobalSrsDue();
        let isFallback = false;

        if (wordsToReview.length === 0) {
            wordsToReview = this.getSrsSoon(15);
            isFallback = true;
        }

        if (wordsToReview.length === 0) {
            this.showSetupNotice("No words in your review list yet. Master some words first!", false);
            return;
        }

        this.words = [...wordsToReview];
        this.currentBook = null;
        this.currentChapter = null;
        this.quizSource = 'SRS';

        this.showView('reviewList');
        this.renderReviewList(isFallback);
    }

    renderReviewList(isFallback) {
        const container = this.displays.reviewWordsContainer;
        const subtitle = this.displays.reviewListSubtitle;
        const startBtn = this.btns.startReviewAction;

        container.innerHTML = '';
        startBtn.disabled = this.words.length === 0;

        if (isFallback) {
            subtitle.textContent = `No words due! Reviewing ${this.words.length} words due soonest.`;
            subtitle.classList.remove('status-success');
        } else {
            subtitle.textContent = `You have ${this.words.length} words due for review.`;
            subtitle.classList.add('status-success');
        }

        const fragment = document.createDocumentFragment();
        this.words.forEach(item => {
            const div = document.createElement('div');
            div.className = 'review-word-item';

            const wordInfo = document.createElement('div');
            wordInfo.className = 'review-word-info';

            const wordSpan = document.createElement('span');
            wordSpan.className = 'review-word-text';
            wordSpan.textContent = item.word;

            const contextSpan = document.createElement('span');
            contextSpan.className = 'review-word-context';
            contextSpan.textContent = `${item.book} - ${item.chapter}`;

            wordInfo.appendChild(wordSpan);
            wordInfo.appendChild(contextSpan);

            const dueSpan = document.createElement('span');
            dueSpan.className = 'review-word-due';
            
            // Format date: "Mar 14" or "Today" if due now
            const now = new Date();
            const due = new Date(item.entry.nextDue);
            const isToday = due.toDateString() === now.toDateString();
            
            if (item.entry.nextDue <= Date.now()) {
                dueSpan.textContent = 'Due Now';
                dueSpan.style.color = 'var(--success)';
            } else {
                dueSpan.textContent = isToday ? 'Due Today' : due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            }

            div.appendChild(wordInfo);
            div.appendChild(dueSpan);
            fragment.appendChild(div);
        });
        container.appendChild(fragment);
    }

    updatePlaceholder() {
        const mode = document.querySelector('input[name="quiz-mode"]:checked')?.value;
        const label = document.querySelector('label[for="word-paste"], .input-group label');

        if (mode === 'spelling-only') {
            this.inputs.paste.placeholder = 'apple\nbanana\norange';
            if (label && label.textContent.includes('Paste')) {
                label.textContent = 'Paste Word List (one word per line)';
            }
        } else {
            this.inputs.paste.placeholder = 'apple: a red fruit\nbanana: a yellow long fruit';
            if (label && label.textContent.includes('Paste')) {
                label.textContent = 'Paste Word List (word: definition)';
            }
        }
    }

    startQuiz() {
        let selectedList = [];
        const libVal = this.inputs.library.value;
        this.clearSetupNotice();

        // Capture Quiz Mode
        const modeEl = document.querySelector('input[name="quiz-mode"]:checked');
        this.quizMode = modeEl ? modeEl.value : 'spelling-only';

        if (libVal) {
            const [book, chapter] = libVal.split('|');
            this.currentBook = book;
            this.currentChapter = chapter;
            selectedList = wordlyLibrary[book][chapter];
        } else {
            this.currentBook = null; // Paste mode
            this.currentChapter = null;
            selectedList = this.parsePaste(this.inputs.paste.value);
        }

        if (selectedList.length === 0) {
            this.showSetupNotice("Please select or enter some words first!");
            return;
        }

        this.words = [...selectedList].sort(() => Math.random() - 0.5);
        this.quizSource = 'QUIZ';
        this.startQuizCommon();
    }

    startQuizCommon() {
        if (!this.words || this.words.length === 0) return;
        this.clearSetupNotice();

        // Clear any previous feedback state at quiz start
        this.displays.feedback.classList.add('hidden');
        this.displays.feedback.innerHTML = '';

        this.currentIndex = 0;
        this.score = { correct: 0, incorrect: 0 };
        this.state = 'QUIZ';

        // Get selected mode
        const modeEl = document.querySelector('input[name="quiz-mode"]:checked');
        this.quizMode = modeEl ? modeEl.value : 'spelling-only';

        this.showView('quiz');

        this.updateInputVisibility();
        this.resetInputs();
        this.updateUI();

        // Call nextWord() to properly initialize the first word
        this.nextWord();
    }


    parsePaste(text) {
        return text.split('\n')
            .map(line => {
                const sepMatch = line.match(/[:\-\t]/);
                if (sepMatch) {
                    const idx = sepMatch.index;
                    return {
                        word: line.substring(0, idx).trim(),
                        meaning: line.substring(idx + 1).trim()
                    };
                }
                // No separator? Treat entire line as word.
                const word = line.trim();
                if (word) {
                    return { word: word, meaning: "" };
                }
                return null;
            })
            .filter(item => item && item.word);
    }

    showView(viewName) {
        Object.keys(this.views).forEach(v => this.views[v].classList.add('hidden'));
        this.views[viewName].classList.remove('hidden');
    }

    updateInputVisibility() {
        if (this.quizMode === 'spelling-only') {
            this.inputs.meaningGroup.classList.add('hidden');
        } else {
            this.inputs.meaningGroup.classList.remove('hidden');
        }
    }

    nextWord() {
        if (this.currentIndex >= this.words.length) {
            this.showResults();
            return;
        }

        this.state = 'QUIZ';
        this.updateUI();
        this.resetInputs();
        this.updateInputVisibility();

        this.displays.feedback.classList.add('hidden');
        this.btns.check.classList.remove('hidden');
        this.btns.next.classList.add('hidden');

        // Auto-pronounce when moving to next word
        setTimeout(() => this.pronounceCurrent(), 500);
    }

    resetInputs() {
        this.inputs.spelling.value = '';
        this.inputs.meaning.value = '';
        this.inputs.spelling.disabled = false;
        this.inputs.meaning.disabled = false;
        this.inputs.spelling.focus();
    }

    pronounceCurrent() {
        const word = this.words[this.currentIndex].word;
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        utterance.rate = 0.9; // Slightly slower for clarity

        if (this.selectedVoiceURI) {
            const selectedVoice = this.voices.find(v => v.voiceURI === this.selectedVoiceURI);
            if (selectedVoice) {
                utterance.voice = selectedVoice;
                utterance.lang = selectedVoice.lang;
            }
        }

        // visual feedback
        this.btns.speak.classList.add('speaking');
        utterance.onend = () => this.btns.speak.classList.remove('speaking');
        utterance.onerror = () => this.btns.speak.classList.remove('speaking');

        window.speechSynthesis.cancel(); // Cancel any current speech
        window.currentUtterance = utterance; // Prevent GC in Safari
        window.speechSynthesis.speak(utterance);
    }

    handleCheck() {
        const current = this.words[this.currentIndex];
        const book = current.book || this.currentBook || MANUAL_BOOK;
        const chapter = current.chapter || this.currentChapter || MANUAL_CHAPTER;

        if (this.state === 'QUIZ') {
            // Block submission if spelling field is empty
            if (!this.inputs.spelling.value.trim()) {
                this.inputs.spelling.classList.add('input-shake');
                this.inputs.spelling.addEventListener('animationend', () => {
                    this.inputs.spelling.classList.remove('input-shake');
                }, { once: true });
                return;
            }

            const isSpellingCorrect = verifySpelling(this.inputs.spelling.value, current.word);

            // Format feedback based on quiz mode
            let correctMsg, incorrectMsg;
            // Prefer real dictionary definition; fall back to hand-authored meaning
            const displayDef = current.definition || current.meaning;
            // Improved visibility: block display, standard text color, slightly larger
            const rootInfo = current.root ?
                `<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border); color: var(--text); font-size: 0.95em;">
    <strong>Root:</strong> ${current.root}
                </div>` : '';

            if (this.quizMode === 'spelling-only') {
                correctMsg = `Correct! ${displayDef}${rootInfo} `;
                incorrectMsg = `Incorrect. The word was "${current.word}". ${displayDef}${rootInfo} `;
            } else {
                correctMsg = `Correct! ${current.word}: ${displayDef}${rootInfo} `;
                incorrectMsg = `Incorrect. The word was "${current.word}": ${displayDef}${rootInfo} `;
            }

            if (isSpellingCorrect) {
                this.score.correct++;
                this.masteredWords.add(current.word);
                if (book && chapter) {
                    if (this.quizSource === 'SRS') {
                        this.updateSrsOnAnswer(current.word, book, chapter, true);
                    } else {
                        this.ensureSrsEntry(current.word, book, chapter, current);
                    }
                }
                // Remove from incorrect list (if present)
                this.incorrectWords = this.incorrectWords.filter(item => item.word !== current.word);
                this.showFeedback(true, correctMsg);
            } else {
                this.score.incorrect++;
                if (book && chapter && this.quizSource === 'SRS') {
                    this.updateSrsOnAnswer(current.word, book, chapter, false);
                }

                // Remove old entry if exists, then add new one with metadata
                this.incorrectWords = this.incorrectWords.filter(item => item.word !== current.word);

                if (book && chapter) {
                    this.incorrectWords.push({
                        word: current.word,
                        book,
                        chapter
                    });
                }

                this.showFeedback(false, incorrectMsg);
            }
            this.saveProgress();
            this.state = 'FINISHED_WORD';
            this.btns.check.classList.add('hidden');
            this.btns.next.classList.remove('hidden');
            this.inputs.spelling.disabled = true;
            this.inputs.meaning.disabled = true;
            this.updateUI();
            this.btns.next.focus();
        }
    }

    handleNext() {
        this.currentIndex++;
        this.nextWord();
    }

    showFeedback(isSuccess, message) {
        const f = this.displays.feedback;
        f.innerHTML = message;
        f.className = `feedback ${isSuccess ? 'status-correct' : 'status-incorrect'} `;
        f.classList.remove('hidden');
    }

    updateUI() {
        const progress = ((this.currentIndex) / this.words.length) * 100;
        this.displays.progress.style.width = `${progress}% `;
        this.displays.counter.textContent = `${this.currentIndex + 1} / ${this.words.length}`;
        this.displays.correct.textContent = this.score.correct;
        this.displays.incorrect.textContent = this.score.incorrect;
    }

    showResults() {
        this.showView('results');
        const percentage = Math.round((this.score.correct / this.words.length) * 100);
        this.displays.score.textContent = `${percentage}%`;
        this.displays.stats.innerHTML = `
            <div>Total Words: ${this.words.length}</div>
            <div style="color: var(--success)">Correct: ${this.score.correct}</div>
            <div style="color: var(--error)">Incorrect: ${this.score.incorrect}</div>
        `;
    }

    reset() {
        this.showView('setup');
        this.inputs.paste.value = '';
        this.clearSetupNotice();
        // User requested to keep the selected library item
        // this.inputs.library.selectedIndex = 0;
        this.updateReviewButtons(); // Update button visibility after reset

        // Clear feedback state to prevent old messages from persisting
        this.displays.feedback.classList.add('hidden');
        this.displays.feedback.innerHTML = '';
    }
}

// Start the app
window.onload = () => {
    window.app = new WordMaster();
};
