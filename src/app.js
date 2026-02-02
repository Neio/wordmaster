import { wordlyLibrary } from './data/library.js';
import { verifySpelling, isMeaningCorrect } from './utils/VerificationLogic.js';

class WordMaster {
    constructor() {
        this.words = [];
        this.currentIndex = 0;
        this.score = { correct: 0, incorrect: 0 };
        this.state = 'SETUP'; // SETUP, SPELLING, MEANING, FAILURE, RESULTS

        this.initElements();
        this.initLibrary();
        this.initTheme();
        this.attachEvents();
        lucide.createIcons();

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

        this.updateMasteryUI();
        this.updateReviewButton(); // Initialize button state on load
    }

    initElements() {
        this.views = {
            setup: document.getElementById('setup-view'),
            quiz: document.getElementById('quiz-view'),
            results: document.getElementById('results-view')
        };

        this.inputs = {
            library: document.getElementById('library-select'),
            paste: document.getElementById('word-paste'),
            spelling: document.getElementById('spelling-input'),
            meaning: document.getElementById('meaning-input'),
            meaningGroup: document.getElementById('meaning-group')
        };

        this.displays = {
            counter: document.getElementById('quiz-counter'),
            correct: document.getElementById('correct-count'),
            incorrect: document.getElementById('incorrect-count'),
            progress: document.getElementById('progress-fill'),
            feedback: document.getElementById('feedback'),
            score: document.getElementById('score-display'),
            stats: document.getElementById('stats-detail')
        };

        this.btns = {
            start: document.getElementById('start-btn'),
            speak: document.getElementById('speak-btn'),
            check: document.getElementById('check-btn'),
            next: document.getElementById('next-btn'),
            next: document.getElementById('next-btn'),
            restart: document.getElementById('restart-btn'),
            finalRestart: document.getElementById('final-restart-btn'),
            startReview: document.getElementById('review-btn'),
            themeToggle: document.getElementById('theme-toggle')
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
    }

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        this.setTheme(next);
    }

    initLibrary() {
        for (const book in wordlyLibrary) {
            for (const chapter in wordlyLibrary[book]) {
                const opt = document.createElement('option');
                opt.value = `${book}|${chapter}`;
                opt.textContent = `${book} - ${chapter} `;
                this.inputs.library.appendChild(opt);
            }
        }
    }

    attachEvents() {
        this.btns.start.onclick = () => this.startQuiz();
        this.btns.startReview.onclick = () => this.startReviewQuiz();
        this.btns.speak.onclick = () => this.pronounceCurrent();
        this.btns.check.onclick = () => this.handleCheck();
        this.btns.next.onclick = () => this.handleNext();
        this.btns.restart.onclick = () => this.reset();
        this.btns.finalRestart.onclick = () => this.reset();
        this.btns.themeToggle.onclick = () => this.toggleTheme();

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
                this.updateReviewButton(); // Update review button visibility & count
            } else {
                // Show paste area when library is deselected
                this.inputs.paste.closest('.input-group').classList.remove('hidden');
                this.btns.startReview.classList.add('hidden'); // Hide review button when no book selected
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

    saveProgress() {
        localStorage.setItem('wordmaster-mastered', JSON.stringify([...this.masteredWords]));
        localStorage.setItem('wordmaster-incorrect', JSON.stringify(this.incorrectWords));
        this.updateMasteryUI();
    }

    getIncorrectCountForBook(book, chapter) {
        return this.incorrectWords.filter(item =>
            item.book === book && item.chapter === chapter
        ).length;
    }

    updateReviewButton() {
        const libVal = this.inputs.library.value;

        if (!libVal) {
            // No library selected → hide button
            this.btns.startReview.classList.add('hidden');
            return;
        }

        const [book, chapter] = libVal.split('|');
        const count = this.getIncorrectCountForBook(book, chapter);

        if (count === 0) {
            this.btns.startReview.classList.add('hidden');
        } else {
            this.btns.startReview.classList.remove('hidden');
            this.btns.startReview.textContent = `Review Incorrect(${count})`;
        }
    }

    startReviewQuiz() {
        const libVal = this.inputs.library.value;
        if (!libVal) {
            alert("Please select a library item first.");
            return;
        }

        const [book, chapter] = libVal.split('|');
        const wrongWords = this.incorrectWords.filter(item =>
            item.book === book && item.chapter === chapter
        );

        if (wrongWords.length === 0) {
            alert("Great job! No incorrect words for this lesson.");
            return;
        }

        // Load full word objects from library
        const fullWords = wordlyLibrary[book][chapter].filter(w =>
            wrongWords.some(item => item.word === w.word)
        );

        this.words = [...fullWords].sort(() => Math.random() - 0.5);
        this.currentBook = book;
        this.currentChapter = chapter;
        this.startQuizCommon();
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
            alert("Please select or enter some words first!");
            return;
        }

        this.words = [...selectedList].sort(() => Math.random() - 0.5);
        this.startQuizCommon();
    }

    startQuizCommon() {
        if (!this.words || this.words.length === 0) return;

        // Clear any previous feedback state at quiz start
        this.displays.feedback.classList.add('hidden');
        this.displays.feedback.innerHTML = '';

        this.currentIndex = 0;
        this.score = { correct: 0, incorrect: 0 };
        this.state = 'QUIZ';

        // Get selected mode
        const modeEl = document.querySelector('input[name="quiz-mode"]:checked');
        this.quizMode = modeEl ? modeEl.value : 'spelling-only';

        this.views.setup.classList.add('hidden');
        this.views.results.classList.add('hidden');
        this.views.quiz.classList.remove('hidden');

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

        // visual feedback
        this.btns.speak.classList.add('speaking');
        utterance.onend = () => this.btns.speak.classList.remove('speaking');

        window.speechSynthesis.cancel(); // Cancel any current speech
        window.speechSynthesis.speak(utterance);
    }

    handleCheck() {
        const current = this.words[this.currentIndex];

        if (this.state === 'QUIZ') {
            const isSpellingCorrect = verifySpelling(this.inputs.spelling.value, current.word);

            // Format feedback based on quiz mode
            let correctMsg, incorrectMsg;
            // Improved visibility: block display, standard text color, slightly larger
            const rootInfo = current.root ?
                `<div style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid var(--border); color: var(--text); font-size: 0.95em;">
    <strong>Root:</strong> ${current.root}
                </div>` : '';

            if (this.quizMode === 'spelling-only') {
                correctMsg = `Correct! ${current.meaning}${rootInfo} `;
                incorrectMsg = `Incorrect.The word was "${current.word}".${current.meaning}${rootInfo} `;
            } else {
                correctMsg = `Correct! ${current.word}: ${current.meaning}${rootInfo} `;
                incorrectMsg = `Incorrect.The word was "${current.word}": ${current.meaning}${rootInfo} `;
            }

            if (isSpellingCorrect) {
                this.score.correct++;
                this.masteredWords.add(current.word);
                // Remove from incorrect list (if present)
                this.incorrectWords = this.incorrectWords.filter(item => item.word !== current.word);
                this.showFeedback(true, correctMsg);
            } else {
                this.score.incorrect++;

                // Remove old entry if exists, then add new one with metadata
                this.incorrectWords = this.incorrectWords.filter(item => item.word !== current.word);

                if (this.currentBook && this.currentChapter) {
                    this.incorrectWords.push({
                        word: current.word,
                        book: this.currentBook,
                        chapter: this.currentChapter
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
        // User requested to keep the selected library item
        // this.inputs.library.selectedIndex = 0;
        this.updateReviewButton(); // Update button visibility after reset

        // Clear feedback state to prevent old messages from persisting
        this.displays.feedback.classList.add('hidden');
        this.displays.feedback.innerHTML = '';
    }
}

// Start the app
window.onload = () => {
    window.app = new WordMaster();
};
