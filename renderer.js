const { ipcRenderer } = require('electron');

// Title bar controls
document.getElementById('minimize-btn').addEventListener('click', () => {
    ipcRenderer.send('window-minimize');
});

document.getElementById('maximize-btn').addEventListener('click', () => {
    ipcRenderer.send('window-maximize');
});

document.getElementById('close-btn').addEventListener('click', () => {
    ipcRenderer.send('window-close');
});

// Navigation system
class NavigationManager {
    constructor() {
        this.currentPage = 'quick-test';
        this.sidebarCollapsed = false;
        this.init();
    }

    init() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.getAttribute('data-page');
                this.navigateTo(page);
            });
        });
        
        // Initialize sidebar toggle
        this.initSidebarToggle();
        
        // Initialize logo click handler
        this.initLogoClick();
    }
    
    initSidebarToggle() {
        const toggleButton = document.getElementById('sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');
        
        if (toggleButton && sidebar) {
            // Load saved sidebar state
            const savedState = localStorage.getItem('sidebar-collapsed');
            if (savedState === 'true') {
                this.sidebarCollapsed = true;
                sidebar.classList.add('collapsed');
                toggleButton.classList.add('collapsed');
            }
            
            toggleButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleSidebar();
            });
        }
    }
    
    initLogoClick() {
        const logo = document.getElementById('app-logo');
        if (logo) {
            logo.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.navigateTo('quick-test');
            });
            
            // Add cursor pointer style
            logo.style.cursor = 'pointer';
        }
    }
    
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const toggleButton = document.getElementById('sidebar-toggle');
        
        if (sidebar && toggleButton) {
            this.sidebarCollapsed = !this.sidebarCollapsed;
            
            if (this.sidebarCollapsed) {
                sidebar.classList.add('collapsed');
                toggleButton.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
                toggleButton.classList.remove('collapsed');
            }
            
            // Save state to localStorage
            localStorage.setItem('sidebar-collapsed', this.sidebarCollapsed);
        }
    }

    navigateTo(page) {
        // Update active nav item (only for pages with nav items)
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        const navItem = document.querySelector(`[data-page="${page}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }

        // Update active page
        document.querySelectorAll('.page').forEach(pageEl => {
            pageEl.classList.remove('active');
        });
        document.getElementById(`${page}-page`).classList.add('active');

        this.currentPage = page;

        // Focus on typing input when navigating to typing pages
        if (page === 'quick-test') {
            setTimeout(() => {
                if (window.typingTest) {
                    window.typingTest.forceInputFocus();
                }
            }, 100);
        } else if (page === 'character-lesson') {
            setTimeout(() => {
                if (window.progressiveLesson) {
                    window.progressiveLesson.forceInputFocus();
                    // Ensure the first character is highlighted when navigating to character lesson
                    window.progressiveLesson.updateCharacterBoxes();
                }
            }, 100);
        } else if (page === 'lesson-interface') {
            setTimeout(() => {
                if (window.lessonTypingTest) {
                    window.lessonTypingTest.forceInputFocus();
                }
            }, 100);
        } else if (page === 'lessons') {
            // Update lesson cards when navigating to lessons page
            setTimeout(() => {
                if (window.lessonManager) {
                    window.lessonManager.updateAllLessonCards();
                }
            }, 100);
        }
    }
}

// Typing Test System
class TypingTest {
    constructor(textDisplayId = 'text-display', typingInputId = 'typing-input', wpmValueId = 'wpm-value', accuracyValueId = 'accuracy-value', timeValueId = 'time-value', finalWpmId = 'final-wpm', finalAccuracyId = 'final-accuracy', finalTimeId = 'final-time') {
        this.textToType = "Cooking is both an art and a science. It involves understanding ingredients, mastering techniques, and creating delicious meals that nourish the body and bring joy to those who share them.";
        this.currentIndex = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this.startTime = null;
        this.isActive = false;
        this.timer = null;
        this.wpmUpdateTimer = null; // Timer for real-time WPM updates
        this.timeLimit = 300; // 5 minutes maximum
        this.timeElapsed = 0; // Count upward from 0
        
        // Store element IDs
        this.elementIds = {
            textDisplay: textDisplayId,
            typingInput: typingInputId,
            wpmValue: wpmValueId,
            accuracyValue: accuracyValueId,
            timeValue: timeValueId,
            finalWpm: finalWpmId,
            finalAccuracy: finalAccuracyId,
            finalTime: finalTimeId
        };
        
        this.init();
    }

    // Custom rounding function: 0.1-0.5 rounds down, 0.6-0.9 rounds up
    customRound(value) {
        const decimal = value - Math.floor(value);
        if (decimal >= 0.6) {
            return Math.ceil(value);
        } else {
            return Math.floor(value);
        }
    }

    init() {
        this.textDisplay = document.getElementById(this.elementIds.textDisplay);
        this.typingInput = document.getElementById(this.elementIds.typingInput);
        this.wpmValue = document.getElementById(this.elementIds.wpmValue);
        this.accuracyValue = document.getElementById(this.elementIds.accuracyValue);
        this.timeValue = document.getElementById(this.elementIds.timeValue);
        this.resetBtn = document.getElementById('reset-btn'); // Default reset button for quick-test
        // Dropdown handled by standalone component

        // Set initial time display
        this.updateTimeDisplay();
        
        // Set input character limit based on practice text length
        if (this.typingInput && this.textToType) {
            this.typingInput.setAttribute('maxlength', this.textToType.length);
        }
        
        this.setupEventListeners();
        this.renderText();
        this.updateStats();
    }

    setupEventListeners() {
        this.typingInput.addEventListener('input', (e) => {
            if (!this.isActive) {
                this.startTest();
            }
            this.handleInput(e);
        });

        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => {
                this.resetTest();
            });
        }

        // Dropdown functionality moved to standalone component

        this.typingInput.addEventListener('focus', () => {
            this.typingInput.style.borderColor = '#2563eb';
        });

        this.typingInput.addEventListener('blur', () => {
            this.typingInput.style.borderColor = '#e5e7eb';
        });

        // Simplified click handlers for input focus
        const typingArea = document.querySelector('.typing-area');
        if (typingArea) {
            typingArea.addEventListener('click', (e) => {
                // Only prevent default if not clicking directly on input
                if (e.target !== this.typingInput) {
                    e.preventDefault();
                }
                this.forceInputFocus();
            });
        }

        this.textDisplay.addEventListener('click', (e) => {
            e.preventDefault();
            this.forceInputFocus();
        });

        // Don't prevent default on direct input clicks
        this.typingInput.addEventListener('click', (e) => {
            this.forceInputFocus();
        });

        this.typingInput.addEventListener('mousedown', (e) => {
            this.forceInputFocus();
        });
    }

    // Dropdown methods removed - handled by standalone component

    forceInputFocus() {
        // Ensure input is enabled and ready
        this.typingInput.removeAttribute('disabled');
        this.typingInput.removeAttribute('readonly');
        this.typingInput.disabled = false;
        this.typingInput.readOnly = false;
        this.typingInput.style.pointerEvents = 'auto';
        
        // Clear any existing timeouts to prevent conflicts
        if (this.focusTimeout) {
            clearTimeout(this.focusTimeout);
        }
        
        // Use immediate focus first
        this.typingInput.focus();
        
        // Backup focus attempt
        this.focusTimeout = setTimeout(() => {
            this.typingInput.focus();
            this.typingInput.click();
        }, 10);
    }

    renderText() {
        const chars = this.textToType.split('');
        const textToTypeSpan = this.textDisplay.querySelector('.text-to-type');
        
        textToTypeSpan.innerHTML = chars.map((char, index) => {
            let className = 'char';
            if (index < this.currentIndex) {
                const typedChar = this.typingInput.value[index];
                className += typedChar === char ? ' correct' : ' incorrect';
            } else if (index === this.currentIndex) {
                className += ' current';
            }
            return `<span class="${className}">${char === ' ' ? '&nbsp;' : char}</span>`;
        }).join('');
    }

    handleInput(e) {
        let value = e.target.value;
        
        // Limit input to the length of the practice text
        if (value.length > this.textToType.length) {
            value = value.substring(0, this.textToType.length);
            e.target.value = value; // Update the input field value
        }
        
        this.currentIndex = value.length;
        this.totalChars = value.length;

        // Calculate correct characters
        this.correctChars = 0;
        for (let i = 0; i < value.length; i++) {
            if (value[i] === this.textToType[i]) {
                this.correctChars++;
            }
        }

        this.renderText();
        this.updateStats();

        // Check if test is complete
        if (value.length >= this.textToType.length) {
            this.endTest();
        }
    }

    startTest() {
        this.isActive = true;
        this.startTime = Date.now();
        this.timeElapsed = 0;
        
        this.timer = setInterval(() => {
            this.timeElapsed++;
            this.updateTimeDisplay();
            
            if (this.timeElapsed >= this.timeLimit) {
                this.endTest();
            }
        }, 1000);

        // Start real-time WPM updates every second
        this.wpmUpdateTimer = setInterval(() => {
            this.updateStats();
        }, 1000);
    }

    endTest() {
        this.isActive = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.wpmUpdateTimer) {
            clearInterval(this.wpmUpdateTimer);
            this.wpmUpdateTimer = null;
        }
        // Don't disable input - just show results
        this.showResults();
    }

    resetTest() {
        this.isActive = false;
        this.currentIndex = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this.startTime = null;
        this.timeElapsed = 0;
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.wpmUpdateTimer) {
            clearInterval(this.wpmUpdateTimer);
            this.wpmUpdateTimer = null;
        }
        
        // Clear the input
        this.typingInput.value = '';
        
        // Set input character limit based on practice text length
        if (this.typingInput && this.textToType) {
            this.typingInput.setAttribute('maxlength', this.textToType.length);
        }
        
        // Re-render everything
        this.renderText();
        this.updateStats();
        this.updateTimeDisplay();
        
        // Use the robust focus method
        setTimeout(() => {
            this.forceInputFocus();
        }, 50);
    }

    updateStats() {
        // Calculate WPM using correct formula: (Total characters - errors) ÷ 5 ÷ time in minutes
        let wpm = 0;
        if (this.startTime) {
            // Use frozen timeElapsed if test is inactive, otherwise use real-time calculation
            let timeElapsedSeconds;
            if (this.isActive) {
                timeElapsedSeconds = (Date.now() - this.startTime) / 1000;
            } else {
                timeElapsedSeconds = this.timeElapsed;
            }
            
            // Only calculate WPM if at least 1 second has elapsed to avoid unrealistic values
            if (timeElapsedSeconds >= 1) {
                const timeElapsedMinutes = timeElapsedSeconds / 60; // convert to minutes
                const errors = this.totalChars - this.correctChars;
                const effectiveChars = this.totalChars - errors;
                const wordsTyped = effectiveChars / 5; // standard: 5 characters = 1 word
                wpm = this.customRound(wordsTyped / timeElapsedMinutes);
            }
        }

        // Calculate accuracy
        const accuracy = this.totalChars > 0 ? Math.round((this.correctChars / this.totalChars) * 100) : 100;

        this.wpmValue.textContent = wpm;
        this.accuracyValue.textContent = `${accuracy}%`;
    }

    updateTimeDisplay() {
        if (this.timeValue) {
            this.timeValue.textContent = this.timeElapsed;
        }
    }

    showResults() {
        const wpm = this.wpmValue.textContent;
        const accuracy = this.accuracyValue.textContent;
        const time = this.timeValue.textContent;
        
        // Update final results if elements exist
        const finalWpmElement = document.getElementById(this.elementIds.finalWpm);
        const finalAccuracyElement = document.getElementById(this.elementIds.finalAccuracy);
        const finalTimeElement = document.getElementById(this.elementIds.finalTime);
        
        if (finalWpmElement) finalWpmElement.textContent = wpm;
        if (finalAccuracyElement) finalAccuracyElement.textContent = accuracy;
        if (finalTimeElement) finalTimeElement.textContent = time;
        
        // Show results popup with performance feedback
        const accuracyNum = parseInt(accuracy);
        const wpmNum = parseInt(wpm);
        
        let popupType = 'info';
        let title = 'Test Complete!';
        let message = `Your Results:\n• Speed: ${wpm} WPM\n• Accuracy: ${accuracy}\n• Time: ${time}`;
        
        // Determine popup type and message based on performance
        if (accuracyNum >= 95 && wpmNum >= 40) {
            popupType = 'success';
            title = 'Excellent Performance! 🎉';
            message = `Outstanding results!\n• Speed: ${wpm} WPM\n• Accuracy: ${accuracy}\n• Time: ${time}\n\nYou're typing like a pro!`;
        } else if (accuracyNum >= 85 && wpmNum >= 25) {
            popupType = 'success';
            title = 'Great Job! 👏';
            message = `Good progress!\n• Speed: ${wpm} WPM\n• Accuracy: ${accuracy}\n• Time: ${time}\n\nKeep practicing to improve further!`;
        } else if (accuracyNum < 70) {
            popupType = 'warning';
            title = 'Focus on Accuracy';
            message = `Your Results:\n• Speed: ${wpm} WPM\n• Accuracy: ${accuracy}\n• Time: ${time}\n\nTry typing slower to improve accuracy.`;
        }
        
        // Show popup if popupManager is available
        if (window.popupManager) {
            // Check if this is a lesson completion
            if (this.currentLesson && this.lessonIndex !== undefined) {
                this.handleLessonCompletion(wpmNum, accuracyNum, popupType, title, message);
            } else {
                // Regular typing test completion
                window.popupManager.show({
                    title: title,
                    content: message.replace(/\n/g, '<br>'),
                    type: popupType,
                    showCancel: false,
                    confirmText: 'Try Again',
                    onConfirm: () => {
                        this.resetTest();
                    }
                });
            }
        }
        
        // Keep input ready for next test
        setTimeout(() => {
            this.forceInputFocus();
        }, 100);
    }

    handleLessonCompletion(wpm, accuracy, popupType, title, message) {
        const lesson = this.currentLesson;
        const targetMet = wpm >= lesson.targetWPM && accuracy >= lesson.targetAccuracy;
        
        let completionTitle, completionMessage, completionType;
        
        if (targetMet) {
            completionType = 'success';
            completionTitle = `${lesson.title} Complete! 🎉`;
            completionMessage = `Congratulations! You've successfully completed this lesson.<br><br>
                <strong>Your Results:</strong><br>
                • Speed: ${wpm} WPM (Target: ${lesson.targetWPM})<br>
                • Accuracy: ${accuracy}% (Target: ${lesson.targetAccuracy}%)<br><br>
                You're ready to move on to the next lesson!`;
            
            // Unlock next lesson if available
            if (window.lessonManager && this.lessonIndex < window.lessonManager.lessons.length - 1) {
                const nextLessonIndex = this.lessonIndex + 1;
                window.lessonManager.lessons[nextLessonIndex].unlocked = true;
                
                // Save lesson progress
                window.lessonManager.saveLessonProgress();
                
                // Update the UI to show the unlocked lesson
                window.lessonManager.updateLessonCardUI(nextLessonIndex);
            }
        } else {
            completionType = 'warning';
            completionTitle = 'Keep Practicing!';
            completionMessage = `You've completed the lesson, but haven't quite reached the targets yet.<br><br>
                <strong>Your Results:</strong><br>
                • Speed: ${wpm} WPM (Target: ${lesson.targetWPM})<br>
                • Accuracy: ${accuracy}% (Target: ${lesson.targetAccuracy}%)<br><br>
                Don't worry - practice makes perfect! Try again to improve your scores.`;
        }
        
        window.popupManager.show({
            title: completionTitle,
            content: completionMessage,
            type: completionType,
            showCancel: targetMet,
            confirmText: targetMet ? 'Next Lesson' : 'Try Again',
            cancelText: 'Back to Lessons',
            onConfirm: () => {
                if (targetMet && this.lessonIndex < window.lessonManager.lessons.length - 1) {
                    // Start next lesson
                    window.lessonManager.startLesson(this.lessonIndex + 1);
                } else if (targetMet) {
                    // All lessons complete
                    window.navigationManager.navigateTo('lessons');
                } else {
                    // Try again
                    this.resetTest();
                }
            },
            onCancel: () => {
                window.navigationManager.navigateTo('lessons');
            }
        });
    }

}

// Lesson System
class LessonManager {
    constructor() {
        this.lessons = [
            // Foundation - Home Row
            {
                id: 'home-row',
                title: 'Home Row Basics',
                description: 'Learn the foundation keys: A, S, D, F, J, K, L, ;',
                level: 'beginner',
                targetWPM: 15,
                targetAccuracy: 90,
                unlocked: true,
                icon: '🏠',
                text: 'asdf jkl; asdf jkl; sad lad ask dad flask glass; ask lads; glad flask; dad said; flask ask; lads glass',
                completion: {
                    message: "Excellent! You've mastered the home row foundation keys.",
                    keysLearned: ['A', 'S', 'D', 'F', 'J', 'K', 'L', ';'],
                    nextPreview: "Next: Practice common words using home row keys"
                }
            },
            {
                id: 'home-row-words',
                title: 'Home Row Words',
                description: 'Practice common words using only home row keys',
                level: 'beginner',
                targetWPM: 18,
                targetAccuracy: 88,
                unlocked: false,
                icon: '🎯',
                text: 'ask dad lad sad flask glass fads lads asks glass flasks dads lads sad ask glass dad flask',
                completion: {
                    message: "Perfect! You can now form words with home row keys.",
                    keysLearned: ['Home Row Words'],
                    nextPreview: "Next: Expand to the top row keys"
                }
            },

            // Top Row Introduction
            {
                id: 'top-row',
                title: 'Top Row Introduction',
                description: 'Add the top row keys Q, W, E, R, T, Y, U, I, O, P',
                level: 'beginner',
                targetWPM: 20,
                targetAccuracy: 85,
                unlocked: false,
                icon: '⬆️',
                text: 'qwer tyui op qwer tyui op quest water power quote riot type pretty output',
                completion: {
                    message: "Fantastic! Top row keys are now under your control.",
                    keysLearned: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                    nextPreview: "Next: Combine top and home rows"
                }
            },
            {
                id: 'top-row-combo',
                title: 'Top Row Combinations',
                description: 'Combine top row with home row keys',
                level: 'beginner',
                targetWPM: 22,
                targetAccuracy: 85,
                unlocked: false,
                icon: '🔗',
                text: 'fast port sweet trade power quest after pretty tools; sister poetry water trade',
                completion: {
                    message: "Excellent! You're mastering multi-row combinations.",
                    keysLearned: ['Top + Home Row Combos'],
                    nextPreview: "Next: Complete the alphabet with bottom row"
                }
            },

            // Bottom Row
            {
                id: 'bottom-row',
                title: 'Bottom Row Mastery',
                description: 'Complete the alphabet with Z, X, C, V, B, N, M',
                level: 'beginner',
                targetWPM: 20,
                targetAccuracy: 85,
                unlocked: false,
                icon: '⬇️',
                text: 'zxcv bnm zxcv bnm zoom box cave vibe mango number maze carbon vitamin',
                completion: {
                    message: "Great job! Bottom row keys mastered completely.",
                    keysLearned: ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
                    nextPreview: "Next: Practice with the complete alphabet"
                }
            },
            {
                id: 'full-alphabet',
                title: 'Complete Alphabet',
                description: 'Practice all letters with smooth transitions',
                level: 'beginner',
                targetWPM: 25,
                targetAccuracy: 88,
                unlocked: false,
                icon: '🔤',
                text: 'the quick brown fox jumps over lazy dog; amazingly complex words; zero maximum boxes; every junction',
                completion: {
                    message: "Outstanding! Complete alphabet mastery achieved.",
                    keysLearned: ['All Letters A-Z'],
                    nextPreview: "Next: Learn capital letters with Shift"
                }
            },

            // Capital Letters & Shift
            {
                id: 'capital-letters',
                title: 'Capital Letters',
                description: 'Learn to use the Shift key for capital letters',
                level: 'beginner',
                targetWPM: 25,
                targetAccuracy: 90,
                unlocked: false,
                icon: '🆙',
                text: 'Apple Box Cat Dog Eagle Fish Great Hope Jack King Lion Mouse Name Open',
                completion: {
                    message: "Brilliant! You've mastered the Shift key for capitals.",
                    keysLearned: ['Capital Letters', 'Shift Key'],
                    nextPreview: "Next: Advanced capitalization in sentences"
                }
            },
            {
                id: 'shift-practice',
                title: 'Shift Key Mastery',
                description: 'Advanced capitalization and sentence structure',
                level: 'intermediate',
                targetWPM: 28,
                targetAccuracy: 90,
                unlocked: false,
                icon: '⇧',
                text: 'The Quick Brown Fox. Every Good Dog Jumps High. Amazing Views From Mountain Tops.',
                completion: {
                    message: "Perfect! Advanced shift key combinations mastered.",
                    keysLearned: ['Advanced Capitalization'],
                    nextPreview: "Next: Learn numbers 1-5"
                }
            },

            // Numbers Row
            {
                id: 'numbers-basic',
                title: 'Numbers 1-5',
                description: 'Learn the left side number keys',
                level: 'intermediate',
                targetWPM: 20,
                targetAccuracy: 85,
                unlocked: false,
                icon: '🔢',
                text: '12345 12345 123 234 345 12 23 34 45 51 52 53 54 55 numbers dates',
                completion: {
                    message: "Great start! Left-hand numbers 1-5 mastered.",
                    keysLearned: ['1', '2', '3', '4', '5'],
                    nextPreview: "Next: Complete the number row 0-9"
                }
            },
            {
                id: 'numbers-full',
                title: 'Complete Number Row',
                description: 'Master all numbers 0-9',
                level: 'intermediate',
                targetWPM: 25,
                targetAccuracy: 85,
                unlocked: false,
                icon: '🔟',
                text: '1234567890 0987654321 dates like 2024 year 1995 phone 555123 address 42nd street',
                completion: {
                    message: "Excellent! Complete number row mastery achieved.",
                    keysLearned: ['All Numbers 0-9'],
                    nextPreview: "Next: Learn basic punctuation"
                }
            },

            // Common Punctuation
            {
                id: 'basic-punctuation',
                title: 'Basic Punctuation',
                description: 'Period, comma, and question mark',
                level: 'intermediate',
                targetWPM: 30,
                targetAccuracy: 88,
                unlocked: false,
                icon: '❓',
                text: 'Hello, world. How are you? Fine, thanks. What time is it? Around noon, I think.',
                completion: {
                    message: "Perfect! Basic punctuation mastered beautifully.",
                    keysLearned: ['.', ',', '?'],
                    nextPreview: "Next: Master all punctuation marks"
                }
            },
            {
                id: 'full-punctuation',
                title: 'Full Punctuation',
                description: 'All punctuation marks and symbols',
                level: 'intermediate',
                targetWPM: 28,
                targetAccuracy: 85,
                unlocked: false,
                icon: '💯',
                text: 'Hello! How are you? Fine, thanks... What\'s new? "Nothing much," she said. @email.com #hashtag',
                completion: {
                    message: "Outstanding! Complete punctuation mastery achieved.",
                    keysLearned: ['All Punctuation'],
                    nextPreview: "Next: Learn common symbols"
                }
            },

            // Advanced Symbols
            {
                id: 'symbols-basic',
                title: 'Common Symbols',
                description: 'Learn @, #, $, %, &, *, +, =',
                level: 'advanced',
                targetWPM: 25,
                targetAccuracy: 82,
                unlocked: false,
                icon: '💰',
                text: 'email@domain.com #hashtag $100 50% savings AT&T 2*3=6 1+1=2 100% success',
                completion: {
                    message: "Excellent! Common symbols are now second nature.",
                    keysLearned: ['@', '#', '$', '%', '&', '*', '+', '='],
                    nextPreview: "Next: Advanced symbol combinations"
                }
            },
            {
                id: 'symbols-advanced',
                title: 'Advanced Symbols',
                description: 'Master brackets, slashes, and special characters',
                level: 'advanced',
                targetWPM: 23,
                targetAccuracy: 80,
                unlocked: false,
                icon: '⚡',
                text: '[brackets] {curly} <angle> forward/slash back\\slash pipe|symbol ^caret ~tilde',
                completion: {
                    message: "Amazing! Advanced symbols conquered completely.",
                    keysLearned: ['[]', '{}', '<>', '/', '\\', '|', '^', '~'],
                    nextPreview: "Next: Programming syntax patterns"
                }
            },

            // Programming Basics
            {
                id: 'programming-syntax',
                title: 'Programming Syntax',
                description: 'Common programming symbols and patterns',
                level: 'advanced',
                targetWPM: 30,
                targetAccuracy: 85,
                unlocked: false,
                icon: '💻',
                text: 'function() { return true; } if (x == 5) { print("hello"); } array[0] = "value";',
                completion: {
                    message: "Brilliant! Programming syntax mastery achieved.",
                    keysLearned: ['Programming Symbols'],
                    nextPreview: "Next: Speed building with common words"
                }
            },

            // Speed Building
            {
                id: 'speed-builder-1',
                title: 'Speed Builder I',
                description: 'Common words for speed development',
                level: 'intermediate',
                targetWPM: 35,
                targetAccuracy: 90,
                unlocked: false,
                icon: '🏃',
                text: 'the and for you that with have this will been from they know want been',
                completion: {
                    message: "Fantastic speed! Common words flow naturally now.",
                    keysLearned: ['Speed Typing I'],
                    nextPreview: "Next: Advanced speed building with sentences"
                }
            },
            {
                id: 'speed-builder-2',
                title: 'Speed Builder II',
                description: 'Fast-paced sentence practice',
                level: 'advanced',
                targetWPM: 40,
                targetAccuracy: 88,
                unlocked: false,
                icon: '🚀',
                text: 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.',
                completion: {
                    message: "Incredible speed! You're becoming a typing rocket.",
                    keysLearned: ['Speed Typing II'],
                    nextPreview: "Next: Master race for ultimate speed"
                }
            },
            {
                id: 'speed-builder-3',
                title: 'Speed Builder III',
                description: 'Advanced speed training with complex text',
                level: 'advanced',
                targetWPM: 45,
                targetAccuracy: 85,
                unlocked: false,
                icon: '⚡',
                text: 'Advanced typing requires consistent practice and proper technique. Focus on accuracy first, then gradually increase speed while maintaining precision.',
                completion: {
                    message: "Lightning fast! You've achieved advanced speed mastery.",
                    keysLearned: ['Advanced Speed'],
                    nextPreview: "Next: Focus on accuracy training"
                }
            },

            // Accuracy Drills
            {
                id: 'accuracy-drill-1',
                title: 'Accuracy Focus I',
                description: 'Precision training with similar letters',
                level: 'intermediate',
                targetWPM: 25,
                targetAccuracy: 95,
                unlocked: false,
                icon: '🎯',
                text: 'barn born burn; form from firm; calm clam claim; trail trial tribal; angle ankle',
                completion: {
                    message: "Bullseye! Your precision is outstanding.",
                    keysLearned: ['Precision Typing'],
                    nextPreview: "Next: Advanced accuracy challenges"
                }
            },
            {
                id: 'accuracy-drill-2',
                title: 'Accuracy Focus II',
                description: 'Advanced precision with complex patterns',
                level: 'advanced',
                targetWPM: 30,
                targetAccuracy: 93,
                unlocked: false,
                icon: '🏹',
                text: 'minimum aluminum millennium; statistical statistical; unprecedented unprecedented; accommodate accommodate',
                completion: {
                    message: "Perfect aim! Advanced accuracy mastery achieved.",
                    keysLearned: ['Advanced Accuracy'],
                    nextPreview: "You've completed all essential typing skills!"
                }
            },

            // Real-World Applications
            {
                id: 'email-writing',
                title: 'Email Composition',
                description: 'Practice professional email formatting',
                level: 'advanced',
                targetWPM: 35,
                targetAccuracy: 88,
                unlocked: false,
                icon: '📧',
                text: 'Subject: Meeting Request. Dear John, I hope this email finds you well. Could we schedule a meeting for next Tuesday? Best regards, Sarah'
            },
            {
                id: 'essay-writing',
                title: 'Essay & Articles',
                description: 'Long-form writing with proper structure',
                level: 'advanced',
                targetWPM: 40,
                targetAccuracy: 90,
                unlocked: false,
                icon: '📝',
                text: 'Introduction paragraph should clearly state the main thesis. Supporting paragraphs provide evidence and examples. The conclusion summarizes key points and reinforces the argument.'
            }
        ];
        this.init();
    }

    init() {
        this.loadLessonProgress();
        this.setupLessonCards();
        // Initialize lesson card UI based on current lesson states
        this.updateAllLessonCards();
    }

    loadLessonProgress() {
        try {
            const savedProgress = localStorage.getItem('typing-master-lesson-progress');
            if (savedProgress) {
                const progress = JSON.parse(savedProgress);
                // Update lesson unlock status based on saved progress
                this.lessons.forEach((lesson, index) => {
                    if (progress[lesson.id] && progress[lesson.id].unlocked) {
                        lesson.unlocked = true;
                    }
                });
            }
        } catch (error) {
            console.error('Error loading lesson progress:', error);
            if (window.popupManager) {
                window.popupManager.error(
                    'Progress Error',
                    'There was an issue loading your lesson progress. Some lessons may appear locked.',
                    { showCancel: false, confirmText: 'OK' }
                );
            }
        }
    }

    saveLessonProgress() {
        try {
            const progress = {};
            this.lessons.forEach(lesson => {
                progress[lesson.id] = {
                    unlocked: lesson.unlocked
                };
            });
            localStorage.setItem('typing-master-lesson-progress', JSON.stringify(progress));
        } catch (error) {
            console.error('Error saving lesson progress:', error);
            if (window.popupManager) {
                window.popupManager.error(
                    'Save Error',
                    'Unable to save your lesson progress. Your progress may not be preserved.',
                    { showCancel: false, confirmText: 'OK' }
                );
            }
        }
    }

    setupLessonCards() {
        const lessonsGrid = document.getElementById('lessons-grid');
        if (!lessonsGrid) return;

        lessonsGrid.innerHTML = '';

        this.lessons.forEach((lesson, index) => {
            const card = document.createElement('div');
            card.className = lesson.unlocked ? 'lesson-card available' : 'lesson-card locked';

            card.innerHTML = `
                <div class="lesson-header">
                    <span class="lesson-icon">${lesson.icon || '📝'}</span>
                    <div class="lesson-badge ${lesson.level}">${lesson.level.toUpperCase()}</div>
                </div>
                <h3>${lesson.title}</h3>
                <p>${lesson.description}</p>
                <div class="lesson-stats">
                    <span>Target WPM: <strong>${lesson.targetWPM}</strong></span>
                    <span>Target Accuracy: <strong>${lesson.targetAccuracy}%</strong></span>
                </div>
                <button class="btn ${lesson.unlocked ? 'btn-primary' : 'btn-disabled'}">${lesson.unlocked ? 'Start Lesson' : 'Locked'}</button>
            `;

            if (lesson.unlocked) {
                const button = card.querySelector('.btn');
                button.addEventListener('click', () => {
                    this.startLesson(index);
                });
            }

            lessonsGrid.appendChild(card);
        });
    }

    updateLessonCardUI(lessonIndex) {
        // Simply regenerate all cards since they're dynamic
        this.setupLessonCards();
    }

    updateAllLessonCards() {
        // Simply regenerate all cards since they're dynamic
        this.setupLessonCards();
    }

    startLesson(lessonIndex) {
        const lesson = this.lessons[lessonIndex];
        if (lesson && lesson.unlocked) {
            // Switch to lesson interface page
            navigationManager.navigateTo('lesson-interface');
            
            // Small delay to ensure page is loaded before setting lesson
            setTimeout(() => {
                // Update lesson header and description
                document.getElementById('lesson-title').textContent = lesson.title;
                document.getElementById('lesson-description').textContent = lesson.description;
                
                // Initialize lesson typing test with lesson completion handler
                lessonTypingTest.textToType = lesson.text;
                lessonTypingTest.currentLesson = lesson;
                lessonTypingTest.lessonIndex = lessonIndex;
                lessonTypingTest.resetTest();
                
                // Ensure input is ready for typing
                lessonTypingTest.forceInputFocus();
            }, 150);
        } else if (lesson && !lesson.unlocked && window.popupManager) {
            // Show locked lesson popup
            window.popupManager.warning(
                'Lesson Locked',
                'Complete the previous lessons to unlock this one. Practice makes perfect!',
                {
                    showCancel: false,
                    confirmText: 'Got it'
                }
            );
        }
    }
}

// Settings Manager
class SettingsManager {
    constructor() {
        this.settings = {
            theme: 'light',
            soundEffects: true,
            fontSize: 'medium',
            keyboardLayout: 'qwerty'
        };
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
    }

    loadSettings() {
        try {
            // Load settings from localStorage
            const savedSettings = localStorage.getItem('typing-master-settings');
            if (savedSettings) {
                this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
            }
            this.applySettings();
        } catch (error) {
            console.error('Error loading settings:', error);
            if (window.popupManager) {
                window.popupManager.error(
                    'Settings Error',
                    'There was an issue loading your saved settings. Default settings will be used.',
                    { showCancel: false, confirmText: 'OK' }
                );
            }
        }
    }

    saveSettings() {
        try {
            localStorage.setItem('typing-master-settings', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Error saving settings:', error);
            if (window.popupManager) {
                window.popupManager.error(
                    'Save Error',
                    'Unable to save your settings. Please check if your browser has sufficient storage space.',
                    { showCancel: false, confirmText: 'OK' }
                );
            }
        }
    }

    applySettings() {
        // Apply theme
        if (this.settings.theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }

        // Update UI elements
        const themeSelect = document.querySelector('#settings-page select');
        const soundCheckbox = document.querySelector('#settings-page input[type="checkbox"]');
        
        if (themeSelect) themeSelect.value = this.settings.theme;
        if (soundCheckbox) soundCheckbox.checked = this.settings.soundEffects;
    }

    setupEventListeners() {
        // Theme selector
        const themeSelect = document.querySelector('#settings-page select');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => {
                const newTheme = e.target.value;
                
                if (window.popupManager && this.settings.theme !== newTheme) {
                    window.popupManager.confirm(
                        'Change Theme?',
                        `Are you sure you want to change the theme to ${newTheme}? This will refresh the appearance of the app.`,
                        {
                            confirmText: 'Change Theme',
                            cancelText: 'Keep Current',
                            onConfirm: () => {
                                this.settings.theme = newTheme;
                                this.applySettings();
                                this.saveSettings();
                                
                                // Show success message
                                setTimeout(() => {
                                    window.popupManager.success(
                                        'Theme Changed!',
                                        `Successfully changed to ${newTheme} theme.`,
                                        { showCancel: false, confirmText: 'Great!' }
                                    );
                                }, 300);
                            },
                            onCancel: () => {
                                // Reset the select to previous value
                                themeSelect.value = this.settings.theme;
                            }
                        }
                    );
                } else {
                    this.settings.theme = newTheme;
                    this.applySettings();
                    this.saveSettings();
                }
            });
        }

        // Sound effects checkbox
        const soundCheckbox = document.querySelector('#settings-page input[type="checkbox"]');
        if (soundCheckbox) {
            soundCheckbox.addEventListener('change', (e) => {
                const newSetting = e.target.checked;
                
                if (window.popupManager) {
                    const action = newSetting ? 'enable' : 'disable';
                    window.popupManager.confirm(
                        `${action.charAt(0).toUpperCase() + action.slice(1)} Sound Effects?`,
                        `Are you sure you want to ${action} sound effects during typing?`,
                        {
                            confirmText: action.charAt(0).toUpperCase() + action.slice(1),
                            cancelText: 'Cancel',
                            onConfirm: () => {
                                this.settings.soundEffects = newSetting;
                                this.saveSettings();
                                
                                // Show success message
                                setTimeout(() => {
                                    window.popupManager.success(
                                        'Settings Updated!',
                                        `Sound effects have been ${newSetting ? 'enabled' : 'disabled'}.`,
                                        { showCancel: false, confirmText: 'Got it' }
                                    );
                                }, 300);
                            },
                            onCancel: () => {
                                // Reset checkbox to previous value
                                soundCheckbox.checked = this.settings.soundEffects;
                            }
                        }
                    );
                } else {
                    this.settings.soundEffects = newSetting;
                    this.saveSettings();
                }
            });
        }
    }
}

// Statistics Manager
class StatisticsManager {
    constructor() {
        this.stats = {
            totalTests: 0,
            averageWPM: 0,
            averageAccuracy: 0,
            bestWPM: 0,
            totalTime: 0
        };
        this.init();
    }

    init() {
        this.loadStats();
        this.updateDisplay();
    }

    loadStats() {
        try {
            const savedStats = localStorage.getItem('typing-master-stats');
            if (savedStats) {
                this.stats = { ...this.stats, ...JSON.parse(savedStats) };
            }
        } catch (error) {
            console.error('Error loading statistics:', error);
            if (window.popupManager) {
                window.popupManager.error(
                    'Statistics Error',
                    'There was an issue loading your typing statistics. Your stats will be reset.',
                    { showCancel: false, confirmText: 'OK' }
                );
            }
        }
    }

    saveStats() {
        try {
            localStorage.setItem('typing-master-stats', JSON.stringify(this.stats));
        } catch (error) {
            console.error('Error saving statistics:', error);
            if (window.popupManager) {
                window.popupManager.error(
                    'Save Error',
                    'Unable to save your typing statistics. Your progress may not be preserved.',
                    { showCancel: false, confirmText: 'OK' }
                );
            }
        }
    }

    updateDisplay() {
        // Update statistics display
        const statCards = document.querySelectorAll('#statistics-page .stat-card');
        if (statCards.length >= 3) {
            statCards[0].querySelector('.stat-value').textContent = this.stats.averageWPM;
            statCards[1].querySelector('.stat-value').textContent = `${this.stats.averageAccuracy}%`;
            statCards[2].querySelector('.stat-value').textContent = this.stats.totalTests;
        }
    }

    recordTest(wpm, accuracy, timeSpent) {
        this.stats.totalTests++;
        this.stats.totalTime += timeSpent;
        
        // Update averages
        this.stats.averageWPM = Math.round(
            (this.stats.averageWPM * (this.stats.totalTests - 1) + wpm) / this.stats.totalTests
        );
        this.stats.averageAccuracy = Math.round(
            (this.stats.averageAccuracy * (this.stats.totalTests - 1) + accuracy) / this.stats.totalTests
        );
        
        // Update best WPM
        if (wpm > this.stats.bestWPM) {
            this.stats.bestWPM = wpm;
        }
        
        this.saveStats();
        this.updateDisplay();
    }
}

// Animation and Visual Effects
class AnimationManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupHoverEffects();
        this.setupTransitions();
    }

    setupHoverEffects() {
        // Add smooth hover effects to interactive elements
        const interactiveElements = document.querySelectorAll('.nav-item, .btn, .lesson-card, .game-card, .stat-card');
        
        interactiveElements.forEach(element => {
            element.addEventListener('mouseenter', () => {
                element.style.transform = 'translateY(-2px)';
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.transform = 'translateY(0)';
            });
        });
    }

    setupTransitions() {
        // Page transition effects
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => {
            page.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        });
    }

    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            element.style.transition = `opacity ${duration}ms ease, transform ${duration}ms ease`;
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, 10);
    }

    slideIn(element, direction = 'left', duration = 300) {
        const translateValue = direction === 'left' ? '-100%' : '100%';
        element.style.transform = `translateX(${translateValue})`;
        
        setTimeout(() => {
            element.style.transition = `transform ${duration}ms ease`;
            element.style.transform = 'translateX(0)';
        }, 10);
    }
}

// Input Field Monitor - ensures input is always ready
class InputFieldMonitor {
    constructor() {
        this.inputElement = null;
        this.checkInterval = null;
        this.init();
    }

    init() {
        // Wait for DOM to be ready
        setTimeout(() => {
            this.inputElement = document.getElementById('typing-input');
            this.startMonitoring();
        }, 100);
    }

    startMonitoring() {
        if (!this.inputElement) return;
        
        // Check every 500ms if input is ready
        this.checkInterval = setInterval(() => {
            this.ensureInputReady();
        }, 500);

        // Also add mutation observer to catch any DOM changes
        const observer = new MutationObserver(() => {
            this.ensureInputReady();
        });

        observer.observe(this.inputElement, {
            attributes: true,
            attributeFilter: ['disabled', 'readonly']
        });
    }

    ensureInputReady() {
        if (!this.inputElement || navigationManager.currentPage !== 'quick-test') return;
        
        // Force enable the input
        this.inputElement.removeAttribute('disabled');
        this.inputElement.disabled = false;
        this.inputElement.readOnly = false;
        this.inputElement.style.pointerEvents = 'auto';
        this.inputElement.style.userSelect = 'text';
    }

    stopMonitoring() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}

// Popup Manager
class PopupManager {
    constructor() {
        this.overlay = null;
        this.popup = null;
        this.title = null;
        this.content = null;
        this.footer = null;
        this.closeBtn = null;
        this.cancelBtn = null;
        this.confirmBtn = null;
        this.currentOptions = null;
        this.init();
    }

    init() {
        this.overlay = document.getElementById('popup-overlay');
        this.popup = document.getElementById('popup');
        this.title = document.getElementById('popup-title');
        this.content = document.getElementById('popup-content');
        this.footer = document.getElementById('popup-footer');
        this.closeBtn = document.getElementById('popup-close');
        this.cancelBtn = document.getElementById('popup-cancel');
        this.confirmBtn = document.getElementById('popup-confirm');

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close popup when clicking overlay
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Close button
        this.closeBtn.addEventListener('click', () => {
            this.close();
        });

        // Cancel button
        this.cancelBtn.addEventListener('click', () => {
            if (this.currentOptions && this.currentOptions.onCancel) {
                this.currentOptions.onCancel();
            }
            this.close();
        });

        // Confirm button
        this.confirmBtn.addEventListener('click', () => {
            if (this.currentOptions && this.currentOptions.onConfirm) {
                this.currentOptions.onConfirm();
            }
            this.close();
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('active')) {
                this.close();
            }
        });
    }

    show(options = {}) {
        this.currentOptions = options;
        
        // Set title
        this.title.textContent = options.title || 'Message';
        
        // Set content
        if (typeof options.content === 'string') {
            this.content.innerHTML = `<p>${options.content}</p>`;
        } else {
            this.content.innerHTML = options.content || '<p>No content provided</p>';
        }
        
        // Set popup type/variant
        this.popup.className = 'popup';
        if (options.type) {
            this.popup.classList.add(options.type);
        }
        
        // Configure buttons
        this.setupButtons(options);
        
        // Show popup
        this.overlay.classList.add('active');
        
        // Focus management
        setTimeout(() => {
            if (options.focusConfirm !== false) {
                this.confirmBtn.focus();
            }
        }, 100);
        
        return this;
    }

    setupButtons(options) {
        // Hide footer if no buttons needed
        if (options.showButtons === false) {
            this.footer.style.display = 'none';
            return;
        }
        
        this.footer.style.display = 'flex';
        
        // Configure cancel button
        if (options.showCancel === false) {
            this.cancelBtn.style.display = 'none';
        } else {
            this.cancelBtn.style.display = 'inline-flex';
            this.cancelBtn.textContent = options.cancelText || 'Cancel';
        }
        
        // Configure confirm button
        this.confirmBtn.textContent = options.confirmText || 'OK';
        
        // Button styling based on type
        if (options.type === 'error') {
            this.confirmBtn.className = 'btn btn-primary';
            this.confirmBtn.style.background = 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)';
        } else if (options.type === 'warning') {
            this.confirmBtn.className = 'btn btn-primary';
            this.confirmBtn.style.background = 'linear-gradient(135deg, #d97706 0%, #b45309 100%)';
        } else if (options.type === 'success') {
            this.confirmBtn.className = 'btn btn-primary';
            this.confirmBtn.style.background = 'linear-gradient(135deg, #059669 0%, #047857 100%)';
        } else {
            this.confirmBtn.className = 'btn btn-primary';
            this.confirmBtn.style.background = '';
        }
    }

    close() {
        this.overlay.classList.remove('active');
        this.currentOptions = null;
        
        // Reset button styles
        this.confirmBtn.style.background = '';
        
        return this;
    }

    // Convenience methods for different popup types
    alert(title, content, options = {}) {
        return this.show({
            title,
            content,
            type: 'info',
            showCancel: false,
            confirmText: 'OK',
            ...options
        });
    }

    confirm(title, content, options = {}) {
        return this.show({
            title,
            content,
            type: 'warning',
            showCancel: true,
            confirmText: 'Confirm',
            cancelText: 'Cancel',
            ...options
        });
    }

    success(title, content, options = {}) {
        return this.show({
            title,
            content,
            type: 'success',
            showCancel: false,
            confirmText: 'Great!',
            ...options
        });
    }

    error(title, content, options = {}) {
        return this.show({
            title,
            content,
            type: 'error',
            showCancel: false,
            confirmText: 'OK',
            ...options
        });
    }

    warning(title, content, options = {}) {
        return this.show({
            title,
            content,
            type: 'warning',
            showCancel: true,
            confirmText: 'Proceed',
            cancelText: 'Cancel',
            ...options
        });
    }
}

// Initialize all managers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure all elements are ready
    setTimeout(() => {
        // Initialize all components
        window.navigationManager = new NavigationManager();
        // Create typing tests with virtual keyboard integration
        // Note: Virtual keyboards will be assigned after they're created
        window.typingTest = new TypingTest();
        window.lessonTypingTest = new TypingTest('lesson-text-display', 'lesson-typing-input', 'lesson-wpm-value', 'lesson-accuracy-value', 'lesson-time-value', 'lesson-final-wpm', 'lesson-final-accuracy', 'lesson-final-time');
        window.lessonManager = new LessonManager();
        window.settingsManager = new SettingsManager();
        window.statisticsManager = new StatisticsManager();
        window.animationManager = new AnimationManager();
        window.inputMonitor = new InputFieldMonitor();
        window.popupManager = new PopupManager();

        // Add lesson interface event listeners
        const lessonResetBtn = document.getElementById('lesson-reset-btn');
        const backToLessonsBtn = document.getElementById('back-to-lessons-btn');
        const lessonTryAgainBtn = document.getElementById('lesson-try-again-btn');
        const lessonNextBtn = document.getElementById('lesson-next-btn');

        if (lessonResetBtn) {
            lessonResetBtn.addEventListener('click', () => {
                lessonTypingTest.resetTest();
            });
        }

        if (backToLessonsBtn) {
            backToLessonsBtn.addEventListener('click', () => {
                navigationManager.navigateTo('lessons');
            });
        }

        if (lessonTryAgainBtn) {
            lessonTryAgainBtn.addEventListener('click', () => {
                lessonTypingTest.resetTest();
                lessonTypingTest.hideResultsBanner();
            });
        }

        if (lessonNextBtn) {
            lessonNextBtn.addEventListener('click', () => {
                // Logic for next lesson - placeholder for now
                navigationManager.navigateTo('lessons');
            });
        }

        // Add some initial animations
        const pageHeader = document.querySelector('.page-header');
        const statsContainer = document.querySelector('.stats-container');
        
        if (pageHeader) {
            animationManager.fadeIn(pageHeader);
        }
        
        if (statsContainer) {
            setTimeout(() => {
                animationManager.fadeIn(statsContainer);
            }, 200);
        }

        // Focus on typing input when quick test is active
        if (document.getElementById('quick-test-page').classList.contains('active')) {
            setTimeout(() => {
                typingTest.forceInputFocus();
            }, 300);
        }

    }, 50);
});

// Handle window resize for responsive behavior
window.addEventListener('resize', () => {
    // Adjust layout if needed
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    
    if (window.innerWidth < 768) {
        sidebar.style.width = '100%';
        mainContent.style.flexDirection = 'column';
    } else {
        sidebar.style.width = '240px';
        mainContent.style.flexDirection = 'row';
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // F12 to toggle developer mode
    if (e.key === 'F12') {
        e.preventDefault();
        ipcRenderer.send('toggle-devtools');
    }
    
    // ESC to reset current test
    if (e.key === 'Escape' && navigationManager.currentPage === 'quick-test') {
        typingTest.resetTest();
    }
    
    // Ctrl/Cmd + Number keys for quick navigation
    if ((e.ctrlKey || e.metaKey) && !isNaN(parseInt(e.key))) {
        e.preventDefault();
        const pageMap = {
            '1': 'quick-test',
            '2': 'lessons',
            '3': 'games',
            '4': 'statistics',
            '5': 'progress',
            '6': 'settings'
        };
        
        if (pageMap[e.key]) {
            navigationManager.navigateTo(pageMap[e.key]);
        }
    }
});

// Word Lesson System
class WordLesson {
    constructor() {
        this.practiceSequence = 'fffffjjjfffjjfjjffjjfjjffjf';
        this.isNumpadSequence = false; // Flag to indicate if current sequence requires numpad
        this.typingTest = null;
        
        // Stats tracking similar to TypingTest
        this.currentIndex = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this.startTime = null;
        this.isActive = false;
        this.timer = null;
        this.wpmUpdateTimer = null;
        this.timeElapsed = 0;
        this.timeLimit = 300; // 5 minutes maximum
        
        // Store element references
        this.wpmValue = null;
        this.accuracyValue = null;
        this.timeValue = null;
        
        this.init();
    }
    
    // Get the maximum number of characters allowed in char-container
    getMaxCharacterLimit() {
        return 24;
    }
    
    // Custom rounding function: 0.1-0.5 rounds down, 0.6-0.9 rounds up
    customRound(value) {
        const decimal = value - Math.floor(value);
        if (decimal >= 0.6) {
            return Math.ceil(value);
        } else {
            return Math.floor(value);
        }
    }
    
    init() {
        // Get element references
        this.wpmValue = document.getElementById('char-wpm-value');
        this.accuracyValue = document.getElementById('char-accuracy-value');
        this.timeValue = document.getElementById('char-time-value');
        
        this.setupEventListeners();
        this.createCharacterBoxes();
        this.setupKeyboardListeners();
        this.updateStats();
        this.updateTimeDisplay();
        
        // Initialize typed sequence
        this.typedSequence = '';
    }
    
    createCharacterBoxes() {
        const container = document.getElementById('char-container');
        if (!container) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        // Limit to maximum allowed characters
        const maxChars = this.getMaxCharacterLimit();
        const charactersToShow = this.practiceSequence.slice(0, maxChars);
        
        // Create character boxes
        charactersToShow.split('').forEach(char => {
            const div = document.createElement('div');
            div.classList.add('char-box');
            div.textContent = char;
            container.appendChild(div);
        });
        
        // Highlight the first character and show finger guidance
        // Add a small delay to ensure KeyboardAndHandEffects is initialized
        setTimeout(() => {
            this.updateCharacterBoxes();
        }, 100);
    }
    
    setupKeyboardListeners() {
        // Listen for keyboard events to update character boxes
        document.addEventListener('keydown', (e) => {
            // Only handle keys when on character lesson page
            const characterLessonPage = document.getElementById('character-lesson-page');
            if (!characterLessonPage || !characterLessonPage.classList.contains('active')) {
                return;
            }
            
            // Handle typing without input field - just visual feedback
            if (e.key.length === 1) { // Single character keys
                this.handleKeyPress(e.key);
                e.preventDefault();
            } else if (e.key === 'Backspace') {
                this.handleBackspace();
                e.preventDefault();
            }
        });
    }
    
    handleKeyPress(key) {
        if (!this.isActive) {
            this.startTest();
        }
        
        // Don't allow typing beyond the maximum character limit
        const maxChars = this.getMaxCharacterLimit();
        const displayedLength = Math.min(this.practiceSequence.length, maxChars);
        if (this.currentIndex >= displayedLength) {
            return;
        }
        
        // Add the character to our virtual input
        this.typedSequence = (this.typedSequence || '') + key;
        this.currentIndex++;
        this.totalChars++;
        
        // Update visual feedback
        this.updateCharacterBoxes();
        this.updateStats();
        
        // Check if test is complete
        if (this.currentIndex >= displayedLength) {
            this.endTest();
        }
    }
    
    handleBackspace() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.totalChars = Math.max(0, this.totalChars - 1);
            this.typedSequence = (this.typedSequence || '').slice(0, -1);
            this.updateCharacterBoxes();
            this.updateStats();
        }
    }
    
    updateCharacterBoxes() {
        const boxes = document.querySelectorAll('.char-box');
        this.correctChars = 0;
        
        boxes.forEach((box, index) => {
            // Clear all previous states
            box.classList.remove('correct', 'incorrect', 'next-key');
            
            if (index < this.currentIndex) {
                // Already typed characters
                const typedChar = this.typedSequence[index];
                const expectedChar = box.textContent;
                
                if (typedChar === expectedChar) {
                    box.classList.add('correct');
                    this.correctChars++;
                } else {
                    box.classList.add('incorrect');
                }
            } else if (index === this.currentIndex) {
                // Current character to type - highlight it
                box.classList.add('next-key');
                
                // Show finger animation for the next character
                const nextChar = box.textContent;
                this.highlightFingerForNextCharacter(nextChar);
            }
        });
    }
    
    highlightFingerForNextCharacter(char) {
        // Use the keyboard and hand effects to show which finger to use
        if (window.keyboardAndHandEffects) {
            // Clear all previous highlights
            window.keyboardAndHandEffects.clearAllFingerHighlights();
            window.keyboardAndHandEffects.clearAllKeyboardHighlights();
            
            // Highlight the finger for the next character (persistent)
            window.keyboardAndHandEffects.highlightFingerForKey(char, true);
            
            // Also highlight the keyboard key (persistent until correct key is pressed)
            const keyElement = window.keyboardAndHandEffects.findKeyElementByChar(char);
            if (keyElement) {
                keyElement.classList.add('next-key-highlight');
            }
        }
    }
    
    startTest() {
        this.isActive = true;
        this.startTime = Date.now();
        this.timeElapsed = 0;
        
        // Timer for elapsed time display
        this.timer = setInterval(() => {
            this.timeElapsed++;
            this.updateTimeDisplay();
            if (this.timeElapsed >= this.timeLimit) {
                this.endTest();
            }
        }, 1000);
        
        // Real-time WPM updates every second
        this.wpmUpdateTimer = setInterval(() => {
            this.updateStats();
        }, 1000);
    }
    
    endTest() {
        this.isActive = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.wpmUpdateTimer) {
            clearInterval(this.wpmUpdateTimer);
            this.wpmUpdateTimer = null;
        }
        
        this.updateStats(); // Final update
        
        // Start fade-out animation for completed text
        this.animateTextTransition();
    }
    
    updateStats() {
        // Calculate WPM using correct formula: (Total characters - errors) ÷ 5 ÷ time in minutes
        let wpm = 0;
        if (this.startTime) {
            // Use frozen timeElapsed if test is inactive, otherwise use real-time calculation
            let timeElapsedSeconds;
            if (this.isActive) {
                timeElapsedSeconds = (Date.now() - this.startTime) / 1000;
            } else {
                timeElapsedSeconds = this.timeElapsed;
            }
            
            // Only calculate WPM if at least 1 second has elapsed to avoid unrealistic values
            if (timeElapsedSeconds >= 1) {
                const timeElapsedMinutes = timeElapsedSeconds / 60; // convert to minutes
                const errors = this.totalChars - this.correctChars;
                const effectiveChars = this.totalChars - errors;
                const wordsTyped = effectiveChars / 5; // standard: 5 characters = 1 word
                wpm = this.customRound(wordsTyped / timeElapsedMinutes);
            }
        }
        
        // Calculate accuracy
        const accuracy = this.totalChars > 0 ? Math.round((this.correctChars / this.totalChars) * 100) : 100;
        
        // Update display elements
        if (this.wpmValue) this.wpmValue.textContent = wpm;
        if (this.accuracyValue) this.accuracyValue.textContent = `${accuracy}%`;
    }
    
    updateTimeDisplay() {
        if (this.timeValue) {
            this.timeValue.textContent = this.timeElapsed;
        }
    }
    
    resetTest() {
        // Clear timers
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.wpmUpdateTimer) {
            clearInterval(this.wpmUpdateTimer);
            this.wpmUpdateTimer = null;
        }
        
        // Reset all tracking variables
        this.isActive = false;
        this.startTime = null;
        this.currentIndex = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this.timeElapsed = 0;
        
        // Clear typed sequence
        this.typedSequence = '';
        
        // Clear all character box states and keyboard highlights
        const boxes = document.querySelectorAll('.char-box');
        boxes.forEach(box => {
            box.classList.remove('correct', 'incorrect', 'next-key');
        });
        
        // Clear all highlights
        if (window.keyboardAndHandEffects) {
            window.keyboardAndHandEffects.clearAllFingerHighlights();
            window.keyboardAndHandEffects.clearAllKeyboardHighlights();
        }
        
        // Reset display and highlight first character
        this.updateStats();
        this.updateTimeDisplay();
        this.updateCharacterBoxes();
    }
    
    setupEventListeners() {
        // Reset button
        const resetBtn = document.getElementById('char-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetTest();
            });
        }
        
        // Generate new text button
        const generateBtn = document.getElementById('generate-new-text-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                // If test is active, end it first to trigger animation
                if (this.isActive) {
                    this.endTest();
                } else {
                    // If test is not active, start animation directly
                    this.animateTextTransition();
                }
            });
        }
    }
    
    generateNewSequence() {
        // Generate a random sequence - mix of letters and numpad practice
        const sequences = [
            // Regular letter sequences
            { text: 'fffffjjjfffjjfjjffjjfjjffjf', isNumpad: false },
            { text: 'jjjjjffffjjffjjffjffjffjjf', isNumpad: false },
            { text: 'ffjjffjjffjjffjjffjjffjjff', isNumpad: false },
            { text: 'fjfjfjfjfjfjfjfjfjfjfjfjfj', isNumpad: false },
            { text: 'ffffjjjjfffffjjjjjfffffjjj', isNumpad: false },
            { text: 'jffjjjffffjffjjjffffjfjfj', isNumpad: false },
            // Regular number row sequences (not numpad) - these use main keyboard
            { text: '1234567890123456789012345', isNumpad: false },
            { text: '12312312312312312312312', isNumpad: false },
            { text: '456456456456456456456456', isNumpad: false },
            { text: '789789789789789789789789', isNumpad: false },
            { text: '1472583690147258369014725', isNumpad: false },
            { text: '12345123451234512345123', isNumpad: false },
            // Actual numpad practice sequences (these will show numpad) - display same numbers but flag as numpad
            { text: '123123123123123123123123', isNumpad: true },
            { text: '456456456456456456456456', isNumpad: true },
            { text: '789789789789789789789789', isNumpad: true },
            { text: '000...000...000...000...', isNumpad: true },
            { text: '++--**//++--**//++--**', isNumpad: true },
            { text: '1472583690147258369014', isNumpad: true }
        ];
        
        const randomSequence = sequences[Math.floor(Math.random() * sequences.length)];
        this.practiceSequence = randomSequence.text;
        this.isNumpadSequence = randomSequence.isNumpad;
        this.createCharacterBoxesWithAnimation();
        this.resetTest();
    }
    
    animateTextTransition() {
        const boxes = document.querySelectorAll('.char-box');
        
        if (!boxes.length) return;
        
        // Fade out all boxes
        boxes.forEach((box) => {
            box.classList.add('fade-out');
        });
        
        // After fade-out, generate new sequence
        setTimeout(() => {
            this.generateNewSequence();
        }, 300); // Wait for fade-out to complete
    }
    
    createCharacterBoxesWithAnimation() {
        const container = document.getElementById('char-container');
        if (!container) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        // Limit to maximum allowed characters
        const maxChars = this.getMaxCharacterLimit();
        const charactersToShow = this.practiceSequence.slice(0, maxChars);
        
        // Create character boxes with fade-in animation
        charactersToShow.split('').forEach((char) => {
            const div = document.createElement('div');
            div.classList.add('char-box', 'fade-in');
            div.textContent = char;
            container.appendChild(div);
        });
        
        // Fade in all boxes and then highlight first character
        setTimeout(() => {
            const boxes = document.querySelectorAll('.char-box.fade-in');
            boxes.forEach((box) => {
                box.classList.remove('fade-in');
            });
            
            // Highlight the first character after animation
            // Add a small delay to ensure KeyboardAndHandEffects is initialized
            setTimeout(() => {
                this.updateCharacterBoxes();
            }, 50);
        }, 50);
    }
    
    forceInputFocus() {
        // No input field to focus - character lesson works without input now
        // Visual feedback is provided through keyboard and character boxes
        // Ensure highlighting is active when focus is called
        setTimeout(() => {
            this.updateCharacterBoxes();
        }, 50);
    }
}

// Keyboard and Hand Effects for Character Lesson
// Progressive Lesson System - Enhanced WordLesson with 104-key progression
class ProgressiveLessonSystem {
    constructor() {
        this.currentLesson = null;
        this.practiceText = '';
        this.typedSequence = '';
        
        // Stats tracking
        this.currentIndex = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this.startTime = null;
        this.isActive = false;
        this.timer = null;
        this.wpmUpdateTimer = null;
        this.timeElapsed = 0;
        this.timeLimit = 600; // 10 minutes maximum
        
        // Element references
        this.wpmValue = null;
        this.accuracyValue = null;
        this.timeValue = null;
        this.targetAccuracyDisplay = null;
        
        this.init();
    }
    
    // Get maximum characters to display
    getMaxCharacterLimit() {
        return 24;
    }
    
    // Custom rounding function
    customRound(value) {
        const decimal = value - Math.floor(value);
        if (decimal >= 0.6) {
            return Math.ceil(value);
        } else {
            return Math.floor(value);
        }
    }
    
    init() {
        // Wait for lessonData to be available
        const initializeSystem = () => {
            if (!window.lessonData) {
                setTimeout(initializeSystem, 50);
                return;
            }
            
            // Get element references
            this.wpmValue = document.getElementById('char-wpm-value');
            this.accuracyValue = document.getElementById('char-accuracy-value');
            this.timeValue = document.getElementById('char-time-value');
            this.targetAccuracyDisplay = document.getElementById('target-accuracy-display');
            
            // Load current lesson
            this.loadCurrentLesson();
            this.setupEventListeners();
            this.setupKeyboardListeners();
            this.updateLessonUI();
            this.createCharacterBoxes();
            this.updateStats();
            this.updateTimeDisplay();
        };
        
        initializeSystem();
    }
    
    loadCurrentLesson() {
        this.currentLesson = window.lessonData.getCurrentLesson();
        console.log('Loaded current lesson:', this.currentLesson);
        if (this.currentLesson) {
            this.practiceText = window.lessonData.generatePracticeText(this.currentLesson);
            console.log('Generated practice text:', this.practiceText);
        } else {
            console.error('Failed to load current lesson from lessonData');
        }
    }
    
    updateLessonUI() {
        if (!this.currentLesson) return;
        
        // Update lesson title and description
        const titleDisplay = document.getElementById('lesson-title-display');
        const descriptionDisplay = document.getElementById('lesson-description-display');
        const currentLessonDisplay = document.getElementById('current-lesson-display');
        const currentPhaseDisplay = document.getElementById('current-phase-display');
        const lessonProgressDisplay = document.getElementById('lesson-progress-display');
        const progressFill = document.getElementById('lesson-progress-fill');
        
        if (titleDisplay) titleDisplay.textContent = this.currentLesson.title;
        if (descriptionDisplay) descriptionDisplay.textContent = this.currentLesson.description;
        if (currentLessonDisplay) currentLessonDisplay.textContent = `Lesson ${this.currentLesson.id}`;
        if (currentPhaseDisplay) currentPhaseDisplay.textContent = this.currentLesson.phase;
        
        // Update progress
        const stats = window.lessonData.getLessonStats();
        if (lessonProgressDisplay) {
            lessonProgressDisplay.textContent = `${stats.current} / ${stats.total}`;
        }
        if (progressFill) {
            progressFill.style.width = `${stats.percentComplete}%`;
        }
        
        // Update target accuracy display
        if (this.targetAccuracyDisplay) {
            this.targetAccuracyDisplay.textContent = `${this.currentLesson.targetAccuracy}%`;
        }
    }
    
    createCharacterBoxes() {
        const container = document.getElementById('char-container');
        if (!container || !this.practiceText) return;
        
        // Clear existing content
        container.innerHTML = '';
        
        // Limit to maximum allowed characters
        const maxChars = this.getMaxCharacterLimit();
        const charactersToShow = this.practiceText.slice(0, maxChars);
        
        // Create character boxes
        charactersToShow.split('').forEach(char => {
            const div = document.createElement('div');
            div.classList.add('char-box');
            div.textContent = char;
            container.appendChild(div);
        });
        
        // Add transition class for animations
        container.classList.add('lesson-transition');
        setTimeout(() => {
            container.classList.remove('lesson-transition');
            this.updateCharacterBoxes();
        }, 100);
    }
    
    setupKeyboardListeners() {
        // Listen for keyboard events
        document.addEventListener('keydown', (e) => {
            // Only handle keys when on character lesson page
            const characterLessonPage = document.getElementById('character-lesson-page');
            if (!characterLessonPage || !characterLessonPage.classList.contains('active')) {
                return;
            }
            
            // Handle Enter key for lesson completion continuation
            if (e.key === 'Enter' && window.lessonCompletionManager && window.lessonCompletionManager.isShowing()) {
                window.lessonCompletionManager.continueToNextLesson();
                e.preventDefault();
                return;
            }
            
            // Handle typing
            if (e.key.length === 1) {
                this.handleKeyPress(e.key);
                e.preventDefault();
            } else if (e.key === 'Backspace') {
                this.handleBackspace();
                e.preventDefault();
            }
        });
    }
    
    handleKeyPress(key) {
        if (!this.isActive) {
            this.startTest();
        }
        
        // Check if test is complete
        const maxChars = this.getMaxCharacterLimit();
        const displayedLength = Math.min(this.practiceText.length, maxChars);
        if (this.currentIndex >= displayedLength) {
            return;
        }
        
        // Add character to typed sequence
        this.typedSequence += key;
        this.currentIndex++;
        this.totalChars++;
        
        // Update visual feedback
        this.updateCharacterBoxes();
        this.updateStats();
        
        // Check if lesson is complete
        if (this.currentIndex >= displayedLength) {
            this.checkLessonCompletion();
        }
    }
    
    handleBackspace() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.totalChars = Math.max(0, this.totalChars - 1);
            this.typedSequence = this.typedSequence.slice(0, -1);
            this.updateCharacterBoxes();
            this.updateStats();
        }
    }
    
    updateCharacterBoxes() {
        const boxes = document.querySelectorAll('.char-box');
        this.correctChars = 0;
        
        boxes.forEach((box, index) => {
            // Clear previous states
            box.classList.remove('correct', 'incorrect', 'next-key');
            
            if (index < this.currentIndex) {
                // Already typed
                const typedChar = this.typedSequence[index];
                const expectedChar = box.textContent;
                
                if (typedChar === expectedChar) {
                    box.classList.add('correct');
                    this.correctChars++;
                } else {
                    box.classList.add('incorrect');
                }
            } else if (index === this.currentIndex) {
                // Current character
                box.classList.add('next-key');
                this.highlightFingerForNextCharacter(box.textContent);
            }
        });
    }
    
    highlightFingerForNextCharacter(char) {
        if (window.keyboardAndHandEffects) {
            window.keyboardAndHandEffects.clearAllFingerHighlights();
            window.keyboardAndHandEffects.clearAllKeyboardHighlights();
            window.keyboardAndHandEffects.highlightFingerForKey(char, true);
            
            const keyElement = window.keyboardAndHandEffects.findKeyElementByChar(char);
            if (keyElement) {
                keyElement.classList.add('next-key-highlight');
            }
        }
    }
    
    startTest() {
        this.isActive = true;
        this.startTime = Date.now();
        this.timeElapsed = 0;
        
        // Timer for elapsed time display
        this.timer = setInterval(() => {
            this.timeElapsed++;
            this.updateTimeDisplay();
            if (this.timeElapsed >= this.timeLimit) {
                this.endTest();
            }
        }, 1000);
        
        // Real-time WPM updates
        this.wpmUpdateTimer = setInterval(() => {
            this.updateStats();
        }, 1000);
    }
    
    endTest() {
        this.isActive = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.wpmUpdateTimer) {
            clearInterval(this.wpmUpdateTimer);
            this.wpmUpdateTimer = null;
        }
        this.updateStats();
    }
    
    checkLessonCompletion() {
        this.endTest();
        
        if (!this.currentLesson) {
            console.error('No current lesson to check completion for');
            return;
        }
        
        // Calculate final stats
        const accuracy = this.totalChars > 0 ? Math.round((this.correctChars / this.totalChars) * 100) : 0;
        const wpm = this.calculateWPM();
        
        console.log('Lesson completion check:', {
            lesson: this.currentLesson.id,
            accuracy: accuracy,
            targetAccuracy: this.currentLesson.targetAccuracy,
            wpm: wpm,
            targetWPM: this.currentLesson.targetWPM,
            correctChars: this.correctChars,
            minChars: this.currentLesson.minChars
        });
        
        // Check if lesson requirements are met (with some flexibility for testing)
        const passedAccuracy = accuracy >= Math.max(80, this.currentLesson.targetAccuracy - 10); // Allow 10% flexibility
        const passedWPM = wpm >= Math.max(5, this.currentLesson.targetWPM - 5); // Allow 5 WPM flexibility
        const passedMinChars = this.correctChars >= Math.max(10, this.currentLesson.minChars - 10); // Reduce min chars requirement
        
        console.log('Lesson completion results:', {
            passedAccuracy,
            passedWPM,
            passedMinChars
        });
        
        if (passedAccuracy && passedWPM && passedMinChars) {
            // Lesson passed - show completion popup
            console.log('Lesson passed! Showing completion popup');
            this.showLessonCompletion(accuracy, wpm);
        } else {
            // Lesson failed - show retry message
            console.log('Lesson not passed - showing retry message');
            this.showLessonRetry(accuracy, wpm);
        }
    }
    
    showLessonCompletion(accuracy, wpm) {
        console.log('ProgressiveLessonSystem - showing completion for lesson:', this.currentLesson);
        console.log('ProgressiveLessonSystem - lesson has completion?', this.currentLesson && !!this.currentLesson.completion);
        
        if (window.lessonCompletionManager) {
            window.lessonCompletionManager.showLessonComplete(
                this.currentLesson,
                accuracy,
                wpm,
                this.timeElapsed
            );
        }
    }
    
    showLessonRetry(accuracy, wpm) {
        if (window.popupManager) {
            const message = `Lesson not quite complete yet!\n\nYour performance:\n• Accuracy: ${accuracy}% (Need: ${this.currentLesson.targetAccuracy}%)\n• WPM: ${wpm} (Need: ${this.currentLesson.targetWPM})\n\nKeep practicing - you're getting better!`;
            window.popupManager.show('info', 'Keep Practicing!', message, 'Try Again', () => {
                this.resetTest();
            });
        }
    }
    
    calculateWPM() {
        let wpm = 0;
        if (this.startTime) {
            // Use frozen timeElapsed if test is inactive, otherwise use real-time calculation
            let timeElapsedSeconds;
            if (this.isActive) {
                timeElapsedSeconds = (Date.now() - this.startTime) / 1000;
            } else {
                timeElapsedSeconds = this.timeElapsed;
            }
            
            if (timeElapsedSeconds >= 1) {
                const timeElapsedMinutes = timeElapsedSeconds / 60;
                const errors = this.totalChars - this.correctChars;
                const effectiveChars = this.totalChars - errors;
                const wordsTyped = effectiveChars / 5;
                wpm = this.customRound(wordsTyped / timeElapsedMinutes);
            }
        }
        return wpm;
    }
    
    updateStats() {
        const wpm = this.calculateWPM();
        const accuracy = this.totalChars > 0 ? Math.round((this.correctChars / this.totalChars) * 100) : 100;
        
        if (this.wpmValue) this.wpmValue.textContent = wpm;
        if (this.accuracyValue) this.accuracyValue.textContent = `${accuracy}%`;
    }
    
    updateTimeDisplay() {
        if (this.timeValue) {
            this.timeValue.textContent = this.timeElapsed;
        }
    }
    
    resetTest() {
        // Clear timers
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        if (this.wpmUpdateTimer) {
            clearInterval(this.wpmUpdateTimer);
            this.wpmUpdateTimer = null;
        }
        
        // Reset tracking
        this.isActive = false;
        this.startTime = null;
        this.currentIndex = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this.timeElapsed = 0;
        this.typedSequence = '';
        
        // Clear visual states
        const boxes = document.querySelectorAll('.char-box');
        boxes.forEach(box => {
            box.classList.remove('correct', 'incorrect', 'next-key');
        });
        
        // Clear keyboard highlights
        if (window.keyboardAndHandEffects) {
            window.keyboardAndHandEffects.clearAllFingerHighlights();
            window.keyboardAndHandEffects.clearAllKeyboardHighlights();
        }
        
        // Reset display
        this.updateStats();
        this.updateTimeDisplay();
        this.updateCharacterBoxes();
    }
    
    setupEventListeners() {
        // Reset button
        const resetBtn = document.getElementById('char-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetTest();
            });
        }
        
        // New text button - now generates next lesson practice
        const generateBtn = document.getElementById('generate-new-text-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                if (this.currentLesson) {
                    this.practiceText = window.lessonData.generatePracticeText(this.currentLesson);
                    this.createCharacterBoxes();
                    this.resetTest();
                }
            });
        }
    }
    
    // Advance to next lesson
    advanceToNextLesson() {
        if (window.lessonData.advanceLesson()) {
            console.log('Advanced to lesson:', window.lessonData.currentLesson);
            this.loadCurrentLesson();
            this.updateLessonUI();
            this.createCharacterBoxes();
            this.resetTest();
            
            // Refresh lesson carousel to show new progress
            if (window.lessonCarousel) {
                window.lessonCarousel.refresh();
            }
            return true;
        } else {
            console.log('Cannot advance - reached end of lessons');
            return false;
        }
    }
    
    forceInputFocus() {
        // Ensure highlighting is active
        setTimeout(() => {
            this.updateCharacterBoxes();
        }, 50);
    }
}

// Lesson Completion Manager - Handles lesson completion popups
class LessonCompletionManager {
    constructor() {
        this.overlay = null;
        this.popup = null;
        this.isVisible = false;
        this.completionKeyListener = null;
        
        this.init();
    }
    
    init() {
        this.overlay = document.getElementById('lesson-completion-overlay');
        this.popup = document.getElementById('lesson-completion-popup');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Continue button
        const continueBtn = document.getElementById('continue-lesson-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                this.continueToNextLesson();
            });
        }
        
        // Retry button
        const retryBtn = document.getElementById('lesson-retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                this.retryLesson();
            });
        }
        
        // Close on overlay click
        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.continueToNextLesson();
                }
            });
        }
    }
    
    showLessonComplete(lesson, accuracy, wpm, timeElapsed) {
        if (!this.overlay || !lesson) return;
        
        // Update completion content
        this.updateCompletionContent(lesson, accuracy, wpm, timeElapsed);
        
        // Show overlay
        this.overlay.classList.add('show');
        this.isVisible = true;
        
        // Add keyboard listener for Enter key
        this.addCompletionKeyListener();
        
        // Add completion animation to body
        document.body.classList.add('completion-active');
        
        // Create celebration particles
        this.createCelebrationParticles();
    }
    
    updateCompletionContent(lesson, accuracy, wpm, timeElapsed) {
        console.log('Updating completion content for lesson:', lesson);
        console.log('Lesson has completion?', lesson && !!lesson.completion);
        console.log('Lesson completion data:', lesson && lesson.completion);
        
        // Update message
        const messageEl = document.getElementById('completion-message');
        if (messageEl && lesson && lesson.completion) {
            messageEl.textContent = lesson.completion.message;
            console.log('Updated message:', lesson.completion.message);
        } else {
            console.log('Missing lesson completion data:', lesson);
            console.log('MessageEl exists?', !!messageEl);
            console.log('Lesson exists?', !!lesson);
            console.log('Lesson.completion exists?', lesson && !!lesson.completion);
            
            // Fallback message for debugging
            if (messageEl) {
                messageEl.textContent = 'Lesson completed successfully!';
            }
        }
        
        // Update keys learned
        const keysLearnedEl = document.getElementById('keys-learned-display');
        if (keysLearnedEl && lesson && lesson.completion && lesson.completion.keysLearned) {
            keysLearnedEl.textContent = lesson.completion.keysLearned.join(', ');
        } else if (keysLearnedEl) {
            keysLearnedEl.textContent = 'New Skills Mastered';
        }
        
        // Update final stats
        const finalAccuracyEl = document.getElementById('final-accuracy-display');
        const finalWpmEl = document.getElementById('final-wpm-display');
        const finalTimeEl = document.getElementById('final-time-display');
        
        if (finalAccuracyEl) finalAccuracyEl.textContent = `${accuracy}%`;
        if (finalWpmEl) finalWpmEl.textContent = wpm;
        if (finalTimeEl) {
            const minutes = Math.floor(timeElapsed / 60);
            const seconds = timeElapsed % 60;
            finalTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Update overall progress
        const stats = window.lessonData.getLessonStats();
        const overallProgressEl = document.getElementById('overall-progress-display');
        const completionProgressFillEl = document.getElementById('completion-progress-fill');
        
        if (overallProgressEl) {
            overallProgressEl.textContent = `${stats.percentComplete}%`;
        }
        if (completionProgressFillEl) {
            completionProgressFillEl.style.width = `${stats.percentComplete}%`;
        }
        
        // Update next lesson preview
        const nextLessonEl = document.getElementById('next-lesson-preview');
        if (nextLessonEl) {
            nextLessonEl.textContent = lesson.completion.nextPreview;
        }
    }
    
    createCelebrationParticles() {
        if (!this.popup) return;
        
        // Create particle container
        const particleContainer = document.createElement('div');
        particleContainer.className = 'completion-particles';
        this.popup.appendChild(particleContainer);
        
        // Create particles
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 3 + 's';
                particleContainer.appendChild(particle);
                
                // Remove particle after animation
                setTimeout(() => {
                    if (particle.parentNode) {
                        particle.parentNode.removeChild(particle);
                    }
                }, 3000);
            }, i * 100);
        }
        
        // Remove particle container after all particles are done
        setTimeout(() => {
            if (particleContainer.parentNode) {
                particleContainer.parentNode.removeChild(particleContainer);
            }
        }, 6000);
    }
    
    addCompletionKeyListener() {
        this.completionKeyListener = (e) => {
            if (e.key === 'Enter') {
                this.continueToNextLesson();
                e.preventDefault();
            }
        };
        document.addEventListener('keydown', this.completionKeyListener);
    }
    
    removeCompletionKeyListener() {
        if (this.completionKeyListener) {
            document.removeEventListener('keydown', this.completionKeyListener);
            this.completionKeyListener = null;
        }
    }
    
    continueToNextLesson() {
        if (!this.isVisible) return;
        
        this.hide();
        
        // Advance to next lesson
        if (window.progressiveLesson) {
            window.progressiveLesson.advanceToNextLesson();
        }
    }
    
    retryLesson() {
        if (!this.isVisible) return;
        
        this.hide();
        
        // Reset current lesson
        if (window.progressiveLesson) {
            window.progressiveLesson.resetTest();
        }
    }
    
    hide() {
        if (!this.overlay) return;
        
        this.overlay.classList.remove('show');
        this.isVisible = false;
        
        // Remove keyboard listener
        this.removeCompletionKeyListener();
        
        // Remove completion animation from body
        document.body.classList.remove('completion-active');
    }
    
    isShowing() {
        return this.isVisible;
    }
}

class KeyboardAndHandEffects {
    constructor() {
        this.keys = document.querySelectorAll('.key');
        this.shiftPressed = false;
        this.capsLock = false;
        this.scale = 1;
        this.handScale = 1;
        this.keyboardLayout = document.querySelector('.keyboard-layout');
        this.handsWrapper = document.querySelector('.hands-wrapper');
        this.handSections = document.querySelectorAll('.hand-section');
        this.handEffectsEnabled = true;
        this.activeFingers = new Set();
        
        // Complete finger mapping
        this.keyToFingerMap = {
            // Function keys and system keys
            'Escape': 'left-pinky',
            'F1': 'left-pinky', 'F2': 'left-ring', 'F3': 'left-middle', 'F4': 'left-index',
            'F5': 'right-index', 'F6': 'right-middle', 'F7': 'right-ring', 'F8': 'right-pinky',
            'F9': 'right-index', 'F10': 'right-middle', 'F11': 'right-ring', 'F12': 'right-pinky',
            'PrintScreen': 'right-index', 'ScrollLock': 'right-middle', 'Pause': 'right-ring',
            
            // Number row
            '`': 'left-pinky', '1': 'left-pinky', '2': 'left-ring', '3': 'left-middle', '4': 'left-index', '5': 'left-index',
            '6': 'right-index', '7': 'right-index', '8': 'right-middle', '9': 'right-ring', '0': 'right-pinky',
            '-': 'right-pinky', '=': 'right-pinky', 'Backspace': 'right-pinky',
            
            // Symbols with shift
            '~': 'left-pinky', '!': 'left-pinky', '@': 'left-ring', '#': 'left-middle', '$': 'left-index', '%': 'left-index',
            '^': 'right-index', '&': 'right-index', '*': 'right-middle', '(': 'right-ring', ')': 'right-pinky',
            '_': 'right-pinky', '+': 'right-pinky',
            
            // QWERTY row
            'Tab': 'left-pinky',
            'q': 'left-pinky', 'w': 'left-ring', 'e': 'left-middle', 'r': 'left-index', 't': 'left-index',
            'y': 'right-index', 'u': 'right-index', 'i': 'right-middle', 'o': 'right-ring', 'p': 'right-pinky',
            '[': 'right-pinky', ']': 'right-pinky', '\\': 'right-pinky',
            
            // Capital letters
            'Q': 'left-pinky', 'W': 'left-ring', 'E': 'left-middle', 'R': 'left-index', 'T': 'left-index',
            'Y': 'right-index', 'U': 'right-index', 'I': 'right-middle', 'O': 'right-ring', 'P': 'right-pinky',
            '{': 'right-pinky', '}': 'right-pinky', '|': 'right-pinky',
            
            // ASDF row
            'CapsLock': 'left-pinky',
            'a': 'left-pinky', 's': 'left-ring', 'd': 'left-middle', 'f': 'left-index', 'g': 'left-index',
            'h': 'right-index', 'j': 'right-index', 'k': 'right-middle', 'l': 'right-ring',
            ';': 'right-pinky', "'": 'right-pinky', 'Enter': 'right-pinky',
            
            // Capital letters
            'A': 'left-pinky', 'S': 'left-ring', 'D': 'left-middle', 'F': 'left-index', 'G': 'left-index',
            'H': 'right-index', 'J': 'right-index', 'K': 'right-middle', 'L': 'right-ring',
            ':': 'right-pinky', '"': 'right-pinky',
            
            // ZXCV row
            'ShiftLeft': 'left-pinky',
            'z': 'left-pinky', 'x': 'left-ring', 'c': 'left-middle', 'v': 'left-index', 'b': 'left-index',
            'n': 'right-index', 'm': 'right-index', ',': 'right-middle', '.': 'right-ring', '/': 'right-pinky',
            'ShiftRight': 'right-pinky',
            
            // Capital letters
            'Z': 'left-pinky', 'X': 'left-ring', 'C': 'left-middle', 'V': 'left-index', 'B': 'left-index',
            'N': 'right-index', 'M': 'right-index', '<': 'right-middle', '>': 'right-ring', '?': 'right-pinky',
            
            // Bottom row
            'ControlLeft': 'left-pinky', 'MetaLeft': 'left-pinky', 'AltLeft': 'left-pinky',
            ' ': 'left-thumb',
            'AltRight': 'right-pinky', 'MetaRight': 'right-pinky', 'ContextMenu': 'right-pinky', 'ControlRight': 'right-pinky',
            
            // Navigation cluster
            'Insert': 'right-index', 'Delete': 'right-index', 'Home': 'right-middle', 'End': 'right-middle',
            'PageUp': 'right-ring', 'PageDown': 'right-ring',
            
            // Arrow keys 
            'ArrowUp': 'right-middle', 'ArrowDown': 'right-middle', 'ArrowLeft': 'right-index', 'ArrowRight': 'right-ring',
            
            // Numpad
            'NumLock': 'right-index', 'NumpadDivide': 'right-middle', 'NumpadMultiply': 'right-ring', 'NumpadSubtract': 'right-pinky',
            'Numpad7': 'right-index', 'Numpad8': 'right-middle', 'Numpad9': 'right-ring', 'NumpadAdd': 'right-pinky',
            'Numpad4': 'right-index', 'Numpad5': 'right-middle', 'Numpad6': 'right-ring',
            'Numpad1': 'right-index', 'Numpad2': 'right-middle', 'Numpad3': 'right-ring', 'NumpadEnter': 'right-pinky',
            'Numpad0': 'right-index', 'NumpadDecimal': 'right-ring'
        };
        
        this.init();
    }

    init() {
        this.setupKeyboardToggleControls();
        this.applyScale(this.scale);
        this.applyHandScale(this.handScale);
        
        // Add click listeners to keys
        this.keys.forEach(key => {
            key.addEventListener('click', (e) => this.handleKeyClick(e));
        });

        // Physical keyboard listeners
        this.setupPhysicalKeyboardListeners();
    }

    setupPhysicalKeyboardListeners() {
        document.addEventListener('keydown', (e) => {
            this.handleKeyDown(e);
        });

        document.addEventListener('keyup', (e) => {
            this.handleKeyUp(e);
        });
    }


    setupKeyboardToggleControls() {
        // Automatically detect numpad usage and show/hide numpad
        this.setupAutomaticNumpadDetection();
    }
    
    setupAutomaticNumpadDetection() {
        // Initially hide the numpad
        this.toggleKeyboardSection('hide-numpad', false);
        
        // Monitor for numpad keys in the character container
        this.monitorCharContainerForNumpadKeys();
    }
    
    monitorCharContainerForNumpadKeys() {
        // Define numpad keys that should trigger numpad display
        const numpadKeys = [
            'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 
            'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9',
            'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide',
            'NumpadDecimal', 'NumpadEnter', 'NumLock'
        ];
        
        // Check if current practice sequence requires numpad
        this.numpadCheckInterval = setInterval(() => {
            const wordLesson = window.wordLesson;
            if (wordLesson) {
                // Use the explicit numpad flag from WordLesson instead of text analysis
                const shouldShowNumpad = wordLesson.isNumpadSequence;
                this.toggleKeyboardSection('hide-numpad', shouldShowNumpad);
            }
        }, 500); // Check every 500ms
        
        // Also listen for physical numpad key presses to show numpad temporarily
        document.addEventListener('keydown', (e) => {
            const characterLessonPage = document.getElementById('character-lesson-page');
            if (!characterLessonPage || !characterLessonPage.classList.contains('active')) {
                return;
            }
            
            if (numpadKeys.includes(e.code) || e.code.startsWith('Numpad')) {
                // Show numpad immediately when numpad key is pressed (override WordLesson flag temporarily)
                this.toggleKeyboardSection('hide-numpad', true);
                
                // Keep it visible for a while
                if (this.numpadHideTimeout) {
                    clearTimeout(this.numpadHideTimeout);
                }
                
                // Auto-hide after 10 seconds and return to WordLesson control
                this.numpadHideTimeout = setTimeout(() => {
                    const wordLesson = window.wordLesson;
                    if (wordLesson) {
                        // Return to using WordLesson's numpad flag
                        this.toggleKeyboardSection('hide-numpad', wordLesson.isNumpadSequence);
                    }
                }, 10000);
            }
        });
    }
    
    // Removed checkIfShouldHideNumpad - now using explicit numpad flag from WordLesson

    toggleKeyboardSection(className, isVisible) {
        if (!this.keyboardLayout) return;
        
        if (isVisible) {
            this.keyboardLayout.classList.remove(className);
        } else {
            this.keyboardLayout.classList.add(className);
        }
        
        // Apply scaling for character lesson page when numpad visibility changes
        if (className === 'hide-numpad') {
            const characterLessonPage = document.getElementById('character-lesson-page');
            if (characterLessonPage && characterLessonPage.classList.contains('active')) {
                // Scale to 0.92 when numpad is visible, back to 1 when hidden
                const scale = isVisible ? 0.92 : 1;
                this.applyScale(scale);
            }
        }
    }

    setScale(scale) {
        this.scale = scale;
        this.applyScale(scale);
    }

    applyScale(scale) {
        if (this.keyboardLayout) {
            this.keyboardLayout.style.transform = `scale(${scale})`;
        }
    }

    setHandScale(scale) {
        this.handScale = scale;
        this.applyHandScale(scale);
    }

    applyHandScale(scale) {
        if (this.handSections) {
            this.handSections.forEach(handSection => {
                handSection.style.transform = `scale(${scale})`;
            });
        }
    }

    handleKeyClick(event) {
        const key = event.currentTarget;
        const keyValue = key.dataset.key;
        this.pressKey(key, keyValue);
    }

    handleKeyDown(event) {
        // Only handle keys when on character lesson page
        const characterLessonPage = document.getElementById('character-lesson-page');
        if (!characterLessonPage || !characterLessonPage.classList.contains('active')) {
            return;
        }

        const keyElement = this.findKeyElement(event.code || event.key);
        if (keyElement) {
            const keyValue = keyElement.dataset.key;
            this.pressKey(keyElement, keyValue, event.code);
        }
        // Removed automatic finger highlighting on key press - this is now handled by WordLesson class
        
        if (['Tab', 'F5', 'F12'].includes(event.key)) {
            event.preventDefault();
        }
    }

    handleKeyUp(event) {
        const keyElement = this.findKeyElement(event.code || event.key);
        if (keyElement) {
            keyElement.classList.remove('pressed');
        }
    }

    findKeyElement(code) {
        // Direct match first
        let found = Array.from(this.keys).find(key => {
            return key.dataset.key === code;
        });
        
        if (found) return found;
        
        // Key mappings for physical keyboard
        const keyMappings = {
            'KeyA': 'a', 'KeyB': 'b', 'KeyC': 'c', 'KeyD': 'd', 'KeyE': 'e',
            'KeyF': 'f', 'KeyG': 'g', 'KeyH': 'h', 'KeyI': 'i', 'KeyJ': 'j',
            'KeyK': 'k', 'KeyL': 'l', 'KeyM': 'm', 'KeyN': 'n', 'KeyO': 'o',
            'KeyP': 'p', 'KeyQ': 'q', 'KeyR': 'r', 'KeyS': 's', 'KeyT': 't',
            'KeyU': 'u', 'KeyV': 'v', 'KeyW': 'w', 'KeyX': 'x', 'KeyY': 'y', 'KeyZ': 'z',
            'Digit1': '1', 'Digit2': '2', 'Digit3': '3', 'Digit4': '4', 'Digit5': '5',
            'Digit6': '6', 'Digit7': '7', 'Digit8': '8', 'Digit9': '9', 'Digit0': '0',
            'Space': ' ', 'Enter': 'Enter', 'Backspace': 'Backspace', 'Tab': 'Tab', 'Escape': 'Escape',
            'ShiftLeft': 'ShiftLeft', 'ShiftRight': 'ShiftRight', 'ControlLeft': 'ControlLeft', 'ControlRight': 'ControlRight',
            'AltLeft': 'AltLeft', 'AltRight': 'AltRight', 'MetaLeft': 'MetaLeft', 'MetaRight': 'MetaRight',
            'Semicolon': ';', 'Quote': "'", 'Comma': ',', 'Period': '.', 'Slash': '/',
            'Backslash': '\\', 'BracketLeft': '[', 'BracketRight': ']', 'Minus': '-', 'Equal': '=', 'Backquote': '`'
        };
        
        if (keyMappings[code]) {
            found = Array.from(this.keys).find(key => {
                return key.dataset.key === keyMappings[code];
            });
        }
        
        return found;
    }

    findKeyElementByChar(char) {
        // Find keyboard element by character (for visual highlighting)
        const wordLesson = window.wordLesson;
        const isNumpadSequence = wordLesson ? wordLesson.isNumpadSequence : false;
        
        // Refresh keys collection to ensure we have all keys including numpad
        this.refreshKeys();
        
        let foundKey = null;
        
        // Search through all keys
        for (const key of this.keys) {
            const keyData = key.dataset.key;
            
            // Handle numbers first - prioritize based on sequence type
            if (char.match(/[0-9]/)) {
                if (isNumpadSequence) {
                    // For numpad sequences, prefer numpad keys
                    if (keyData === `Numpad${char}`) {
                        foundKey = key;
                        break; // Prefer numpad keys when in numpad mode
                    }
                } else {
                    // For regular sequences, prefer number row keys (exclude numpad)
                    if (keyData === char && !keyData.startsWith('Numpad')) {
                        foundKey = key;
                        break; // Use regular number row for non-numpad sequences
                    }
                }
            }
            
            // Handle numpad symbols when in numpad mode
            else if (isNumpadSequence) {
                const symbolMap = {
                    '+': 'NumpadAdd',
                    '-': 'NumpadSubtract', 
                    '*': 'NumpadMultiply',
                    '/': 'NumpadDivide',
                    '.': 'NumpadDecimal'
                };
                
                if (symbolMap[char] && keyData === symbolMap[char]) {
                    foundKey = key;
                    break; // Use numpad symbols when in numpad mode
                }
            }
            
            // Direct match for other characters (letters, regular symbols)
            else if (keyData === char) {
                foundKey = key;
                break; // Direct match for non-numeric characters
            }
        }
        
        // Fallback: if numpad key not found, try regular key for numbers
        if (!foundKey && char.match(/[0-9]/)) {
            for (const key of this.keys) {
                if (key.dataset.key === char) {
                    foundKey = key;
                    break;
                }
            }
        }
        
        return foundKey;
    }
    
    refreshKeys() {
        // Refresh the keys collection to ensure we have all keys including hidden numpad keys
        this.keys = document.querySelectorAll('.key');
    }

    pressKey(keyElement, keyValue, keyCode = null) {
        keyElement.classList.add('pressed');
        
        setTimeout(() => {
            keyElement.classList.remove('pressed');
        }, 150);

        // Finger highlighting is now handled by WordLesson class for next-character guidance
        // Removed automatic finger highlighting on key press to avoid conflicts

        // Handle special keys
        switch(keyValue) {
            case 'CapsLock':
                this.capsLock = !this.capsLock;
                if (this.capsLock) {
                    keyElement.classList.add('caps-lock-active');
                } else {
                    keyElement.classList.remove('caps-lock-active');
                }
                break;
        }
    }

    // Hand effects integration  
    highlightFingerForKey(keyValue, persistent = false, keyCode = null, keyElement = null) {
        if (!this.handEffectsEnabled) return;
        
        let fingerId = null;
        
        // First try to get finger from HTML element attributes
        if (keyElement && keyElement.dataset.finger && keyElement.dataset.hand) {
            fingerId = `${keyElement.dataset.hand}-${keyElement.dataset.finger}`;
        } else {
            // Fall back to JavaScript mapping
            fingerId = this.getFingerForKey(keyValue, keyCode);
        }
        
        if (fingerId) {
            // Clear all previous finger highlights if this is a persistent highlight
            if (persistent) {
                this.clearAllFingerHighlights();
            }
            
            this.activateFingerImage(fingerId);
            this.activeFingers.add(fingerId);
        }
    }

    getFingerForKey(keyValue, keyCode = null) {
        // Handle space key - can be either thumb
        if (keyValue === ' ') {
            return Math.random() > 0.5 ? 'left-thumb' : 'right-thumb';
        }
        
        // Check if we're in numpad mode
        const wordLesson = window.wordLesson;
        const isNumpadSequence = wordLesson ? wordLesson.isNumpadSequence : false;
        
        // Handle numbers and symbols based on whether we're using numpad or regular keys
        if (keyValue.match(/[0-9]/)) {
            if (isNumpadSequence) {
                // Use numpad finger mapping
                const numpadKey = `Numpad${keyValue}`;
                if (this.keyToFingerMap[numpadKey]) {
                    return this.keyToFingerMap[numpadKey];
                }
            } else {
                // Use regular number key mapping
                if (this.keyToFingerMap[keyValue]) {
                    return this.keyToFingerMap[keyValue];
                }
            }
        }
        
        // Handle numpad symbols when in numpad mode
        if (isNumpadSequence) {
            const symbolMap = {
                '+': 'NumpadAdd',
                '-': 'NumpadSubtract', 
                '*': 'NumpadMultiply',
                '/': 'NumpadDivide',
                '.': 'NumpadDecimal'
            };
            
            if (symbolMap[keyValue] && this.keyToFingerMap[symbolMap[keyValue]]) {
                return this.keyToFingerMap[symbolMap[keyValue]];
            }
        }
        
        // First try keyCode for special keys
        if (keyCode && this.keyToFingerMap[keyCode]) {
            return this.keyToFingerMap[keyCode];
        }
        
        // Direct lookup in the finger mapping
        if (this.keyToFingerMap[keyValue]) {
            return this.keyToFingerMap[keyValue];
        }
        
        return null;
    }

    activateFingerImage(fingerId) {
        const fingerImg = document.getElementById(`${fingerId}-img`);
        if (fingerImg) {
            fingerImg.classList.add('active');
        }
    }

    deactivateFingerImage(fingerId) {
        const fingerImg = document.getElementById(`${fingerId}-img`);
        if (fingerImg) {
            fingerImg.classList.remove('active');
        }
    }

    clearAllFingerHighlights() {
        const activeFingerImages = document.querySelectorAll('.finger-image.active');
        activeFingerImages.forEach(img => img.classList.remove('active'));
        this.activeFingers.clear();
    }
    
    clearAllKeyboardHighlights() {
        const highlightedKeys = document.querySelectorAll('.key.next-key-highlight');
        highlightedKeys.forEach(key => key.classList.remove('next-key-highlight'));
    }
}

// Initialize progressive lesson system
// Lesson Carousel Manager
class LessonCarousel {
    constructor() {
        this.currentLesson = 1;
        this.totalLessons = 0;
        this.carousel = null;
        this.cardsContainer = null;
        this.prevBtn = null;
        this.nextBtn = null;
        this.cardWidth = 292; // 280px + 12px gap
        this.init();
    }

    init() {
        // Wait for DOM and lesson data to be ready
        const initCarousel = () => {
            if (!window.lessonData || !document.getElementById('lesson-carousel')) {
                setTimeout(initCarousel, 50);
                return;
            }
            this.setupElements();
            this.generateLessonCards();
            this.attachEventListeners();
            this.updateCarousel();
        };
        initCarousel();
    }

    setupElements() {
        this.carousel = document.getElementById('lesson-carousel');
        this.cardsContainer = document.getElementById('lesson-cards');
        this.prevBtn = document.getElementById('lesson-prev');
        this.nextBtn = document.getElementById('lesson-next');
        this.totalLessons = window.lessonData.maxLesson;
        this.currentLesson = window.lessonData.currentLesson;
    }

    generateLessonCards() {
        if (!this.cardsContainer || !window.lessonData) return;

        this.cardsContainer.innerHTML = '';
        
        for (let i = 1; i <= this.totalLessons; i++) {
            const lesson = window.lessonData.lessonStructure[i - 1];
            if (!lesson) continue;

            const card = this.createLessonCard(lesson, i);
            this.cardsContainer.appendChild(card);
        }
    }

    createLessonCard(lesson, lessonNumber) {
        const card = document.createElement('div');
        card.className = 'lesson-card';
        card.dataset.lesson = lessonNumber;

        // Determine card status
        if (lessonNumber < this.currentLesson) {
            card.classList.add('completed');
        } else if (lessonNumber === this.currentLesson) {
            card.classList.add('current');
        } else {
            card.classList.add('locked');
        }

        // Get lesson keys for display
        const lessonKeys = lesson.keys ? lesson.keys.slice(0, 6).join(' ') : '';
        const moreKeys = lesson.keys && lesson.keys.length > 6 ? ` +${lesson.keys.length - 6}` : '';

        card.innerHTML = `
            <div class="lesson-status"></div>
            <div class="lesson-number">${lessonNumber}</div>
            <div class="lesson-title">${lesson.title}</div>
            <div class="lesson-meta">
                <div class="lesson-phase">${lesson.phase}</div>
                <div class="lesson-target">${lesson.targetWPM} WPM</div>
            </div>
            <div class="lesson-keys">${lessonKeys}${moreKeys}</div>
        `;

        // Add click handler for navigation (only for unlocked lessons)
        if (lessonNumber <= this.currentLesson) {
            card.addEventListener('click', () => {
                this.selectLesson(lessonNumber);
            });
        }

        return card;
    }

    selectLesson(lessonNumber) {
        if (lessonNumber > this.currentLesson) return; // Can't select locked lessons

        // Update lesson data
        window.lessonData.currentLesson = lessonNumber;
        window.lessonData.saveProgress();

        // Update progressive lesson system
        if (window.progressiveLesson) {
            window.progressiveLesson.loadCurrentLesson();
            window.progressiveLesson.updateLessonUI();
            window.progressiveLesson.createCharacterBoxes();
            window.progressiveLesson.resetTest();
        }

        // Update carousel
        this.currentLesson = lessonNumber;
        this.updateCarousel();
    }

    updateCarousel() {
        // Update card states
        const cards = this.cardsContainer.querySelectorAll('.lesson-card');
        cards.forEach((card, index) => {
            const lessonNum = index + 1;
            card.className = 'lesson-card';
            
            if (lessonNum < this.currentLesson) {
                card.classList.add('completed');
            } else if (lessonNum === this.currentLesson) {
                card.classList.add('current');
            } else {
                card.classList.add('locked');
            }
        });

        // Scroll current lesson into view
        this.scrollToCurrentLesson();
        
        // Update navigation buttons
        this.updateNavigationButtons();
    }

    scrollToCurrentLesson() {
        const currentCard = this.cardsContainer.querySelector('.lesson-card.current');
        if (currentCard && this.carousel) {
            const cardRect = currentCard.getBoundingClientRect();
            const carouselRect = this.carousel.getBoundingClientRect();
            
            if (cardRect.left < carouselRect.left || cardRect.right > carouselRect.right) {
                const scrollLeft = currentCard.offsetLeft - (this.carousel.clientWidth / 2) + (this.cardWidth / 2);
                this.carousel.scrollTo({
                    left: Math.max(0, scrollLeft),
                    behavior: 'smooth'
                });
            }
        }
    }

    updateNavigationButtons() {
        if (!this.prevBtn || !this.nextBtn || !this.carousel) return;

        const maxScroll = this.carousel.scrollWidth - this.carousel.clientWidth;
        const currentScroll = this.carousel.scrollLeft;

        this.prevBtn.disabled = currentScroll <= 0;
        this.nextBtn.disabled = currentScroll >= maxScroll - 1;
    }

    attachEventListeners() {
        // Navigation buttons
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => {
                this.carousel.scrollBy({
                    left: -this.cardWidth * 2,
                    behavior: 'smooth'
                });
            });
        }

        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => {
                this.carousel.scrollBy({
                    left: this.cardWidth * 2,
                    behavior: 'smooth'
                });
            });
        }

        // Scroll event for button updates
        if (this.carousel) {
            this.carousel.addEventListener('scroll', () => {
                this.updateNavigationButtons();
            });
        }

        // Keyboard navigation
        if (this.carousel) {
            this.carousel.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    this.carousel.scrollBy({
                        left: -this.cardWidth,
                        behavior: 'smooth'
                    });
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    this.carousel.scrollBy({
                        left: this.cardWidth,
                        behavior: 'smooth'
                    });
                }
            });
        }
    }

    // Public method to refresh carousel when lesson advances
    refresh() {
        this.currentLesson = window.lessonData?.currentLesson || 1;
        this.updateCarousel();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // Initialize lesson data system
        window.lessonData = new LessonData();
        
        // Initialize lesson completion manager
        window.lessonCompletionManager = new LessonCompletionManager();
        
        // Create progressive lesson system (replaces wordLesson)
        window.progressiveLesson = new ProgressiveLessonSystem();
        
        // Character lesson now uses its own canvas system
        // TypingTest is disabled for character lesson to use character canvas instead
        window.charTypingTest = null;
        
        // Initialize keyboard and hand effects (only for character lesson page)
        window.keyboardAndHandEffects = new KeyboardAndHandEffects();

        // Initialize lesson carousel
        window.lessonCarousel = new LessonCarousel();
        
    }, 100); // Small delay to ensure typing tests are initialized
});