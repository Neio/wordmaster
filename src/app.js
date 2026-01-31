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
                opt.textContent = `${book} - ${chapter}`;
                this.inputs.library.appendChild(opt);
            }
        }
    }

    attachEvents() {
        this.btns.start.onclick = () => this.startQuiz();
        this.btns.speak.onclick = () => this.pronounceCurrent();
        this.btns.check.onclick = () => this.handleCheck();
        this.btns.next.onclick = () => this.handleNext();
        this.btns.restart.onclick = () => this.reset();
        this.btns.finalRestart.onclick = () => this.reset();
        this.btns.themeToggle.onclick = () => this.toggleTheme();

        // Handle quiz mode change
        const quizModeRadios = document.querySelectorAll('input[name="quiz-mode"]');
        quizModeRadios.forEach(radio => {
            radio.onchange = () => this.updatePlaceholder();
        });

        // Make library and paste mutually exclusive (hide instead of clear)
        this.inputs.library.onchange = () => {
            if (this.inputs.library.value) {
                // Hide paste area when library is selected
                this.inputs.paste.closest('.input-group').classList.add('hidden');
            } else {
                // Show paste area when library is deselected
                this.inputs.paste.closest('.input-group').classList.remove('hidden');
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
            selectedList = wordlyLibrary[book][chapter];
        } else {
            selectedList = this.parsePaste(this.inputs.paste.value);
        }

        if (selectedList.length === 0) {
            alert("Please select or enter some words first!");
            return;
        }

        this.words = [...selectedList].sort(() => Math.random() - 0.5);
        this.currentIndex = 0;
        this.score = { correct: 0, incorrect: 0 };
        this.showView('quiz');
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

    nextWord() {
        if (this.currentIndex >= this.words.length) {
            this.showResults();
            return;
        }

        this.state = 'QUIZ';
        this.updateUI();
        this.resetInputs();

        // Handle Quiz Mode Visibility
        if (this.quizMode === 'spelling-only') {
            this.inputs.meaningGroup.classList.add('hidden');
        } else {
            this.inputs.meaningGroup.classList.remove('hidden');
        }

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
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
    }

    handleCheck() {
        const current = this.words[this.currentIndex];

        if (this.state === 'QUIZ') {
            const isSpellingCorrect = verifySpelling(this.inputs.spelling.value, current.word);

            // Format feedback based on quiz mode
            let correctMsg, incorrectMsg;
            const rootInfo = current.root ? ` <br><span style="font-style: italic; color: var(--text-muted); font-size: 0.9em;">Root: ${current.root}</span>` : '';

            if (this.quizMode === 'spelling-only') {
                correctMsg = `Correct! ${current.meaning}${rootInfo}`;
                incorrectMsg = `Incorrect. The word was "${current.word}". ${current.meaning}${rootInfo}`;
            } else {
                correctMsg = `Correct! ${current.word}: ${current.meaning}${rootInfo}`;
                incorrectMsg = `Incorrect. The word was "${current.word}": ${current.meaning}${rootInfo}`;
            }

            if (isSpellingCorrect) {
                this.score.correct++;
                this.showFeedback(true, correctMsg);
            } else {
                this.score.incorrect++;
                this.showFeedback(false, incorrectMsg);
            }
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
        f.className = `feedback ${isSuccess ? 'status-correct' : 'status-incorrect'}`;
        f.classList.remove('hidden');
    }

    updateUI() {
        const progress = ((this.currentIndex) / this.words.length) * 100;
        this.displays.progress.style.width = `${progress}%`;
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
        this.inputs.library.selectedIndex = 0;
    }
}

// Start the app
window.onload = () => new WordMaster();
