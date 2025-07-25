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
    constructor(textDisplayId = 'text-display', typingInputId = 'typing-input', wpmValueId = 'wpm-value', accuracyValueId = 'accuracy-value', timeValueId = 'time-value', finalWpmId = 'final-wpm', finalAccuracyId = 'final-accuracy', finalTimeId = 'final-time', virtualKeyboard = null) {
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
        this.virtualKeyboard = virtualKeyboard; // Virtual keyboard integration
        
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
        
        // Update virtual keyboard highlighting
        if (this.virtualKeyboard && this.virtualKeyboard.isVisible) {
            const nextChar = this.textToType[this.currentIndex];
            if (nextChar) {
                this.virtualKeyboard.highlightKey(nextChar);
            } else {
                this.virtualKeyboard.clearHighlights();
            }
        }
    }

    handleInput(e) {
        let value = e.target.value;
        
        // Limit input to the length of the practice text
        if (value.length > this.textToType.length) {
            value = value.substring(0, this.textToType.length);
            e.target.value = value; // Update the input field value
        }
        
        // Check for virtual keyboard feedback on last typed character
        if (this.virtualKeyboard && this.virtualKeyboard.isVisible && value.length > 0) {
            const lastTypedChar = value[value.length - 1];
            const expectedChar = this.textToType[value.length - 1];
            const isCorrect = lastTypedChar === expectedChar;
            
            // Only show feedback if this is a new character (not backspace)
            if (value.length > this.currentIndex) {
                this.virtualKeyboard.showFeedback(lastTypedChar, isCorrect);
            }
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
        
        // Reset virtual keyboard
        if (this.virtualKeyboard) {
            this.virtualKeyboard.reset();
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
        if (this.isActive && this.startTime) {
            const timeElapsedSeconds = (Date.now() - this.startTime) / 1000; // in seconds
            
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
                text: 'asdf jkl; asdf jkl; sad lad ask dad flask glass; ask lads; glad flask; dad said; flask ask; lads glass'
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
                text: 'ask dad lad sad flask glass fads lads asks glass flasks dads lads sad ask glass dad flask'
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
                text: 'qwer tyui op qwer tyui op quest water power quote riot type pretty output'
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
                text: 'fast port sweet trade power quest after pretty tools; sister poetry water trade'
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
                text: 'zxcv bnm zxcv bnm zoom box cave vibe mango number maze carbon vitamin'
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
                text: 'the quick brown fox jumps over lazy dog; amazingly complex words; zero maximum boxes; every junction'
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
                text: 'Apple Box Cat Dog Eagle Fish Great Hope Jack King Lion Mouse Name Open'
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
                text: 'The Quick Brown Fox. Every Good Dog Jumps High. Amazing Views From Mountain Tops.'
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
                text: '12345 12345 123 234 345 12 23 34 45 51 52 53 54 55 numbers dates'
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
                text: '1234567890 0987654321 dates like 2024 year 1995 phone 555123 address 42nd street'
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
                text: 'Hello, world. How are you? Fine, thanks. What time is it? Around noon, I think.'
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
                text: 'Hello! How are you? Fine, thanks... What\'s new? "Nothing much," she said. @email.com #hashtag'
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
                text: 'email@domain.com #hashtag $100 50% savings AT&T 2*3=6 1+1=2 100% success'
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
                text: '[brackets] {curly} <angle> forward/slash back\\slash pipe|symbol ^caret ~tilde'
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
                text: 'function() { return true; } if (x == 5) { print("hello"); } array[0] = "value";'
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
                text: 'the and for you that with have this will been from they know want been'
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
                text: 'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.'
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
                text: 'Advanced typing requires consistent practice and proper technique. Focus on accuracy first, then gradually increase speed while maintaining precision.'
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
                text: 'barn born burn; form from firm; calm clam claim; trail trial tribal; angle ankle'
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
                text: 'minimum aluminum millennium; statistical statistical; unprecedented unprecedented; accommodate accommodate'
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

// Virtual Keyboard Component
class VirtualKeyboard {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.keyboard = null;
        this.keys = new Map();
        this.currentKey = null;
        this.isVisible = false;
        this.showFunctionKeys = false;
        this.showNumpad = false;
        this.shiftPressed = false;
        this.fingerMap = {};
        
        // Special character mapping for shift combinations
        this.specialCharMap = {
            '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
            '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
            '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\',
            ':': ';', '"': "'", '<': ',', '>': '.', '?': '/'
        };
        
        // Character to key mapping (including special characters)
        this.charToKeyMap = {
            // Numbers
            '1': 'key-1', '2': 'key-2', '3': 'key-3', '4': 'key-4', '5': 'key-5',
            '6': 'key-6', '7': 'key-7', '8': 'key-8', '9': 'key-9', '0': 'key-0',
            
            // Letters
            'a': 'key-a', 'b': 'key-b', 'c': 'key-c', 'd': 'key-d', 'e': 'key-e',
            'f': 'key-f', 'g': 'key-g', 'h': 'key-h', 'i': 'key-i', 'j': 'key-j',
            'k': 'key-k', 'l': 'key-l', 'm': 'key-m', 'n': 'key-n', 'o': 'key-o',
            'p': 'key-p', 'q': 'key-q', 'r': 'key-r', 's': 'key-s', 't': 'key-t',
            'u': 'key-u', 'v': 'key-v', 'w': 'key-w', 'x': 'key-x', 'y': 'key-y', 'z': 'key-z',
            
            // Special characters
            ' ': 'key-space', '.': 'key-period', ',': 'key-comma', ';': 'key-semicolon',
            "'": 'key-apostrophe', '/': 'key-slash', '\\': 'key-backslash',
            '[': 'key-leftbracket', ']': 'key-rightbracket', '-': 'key-minus', '=': 'key-equals',
            '`': 'key-backtick'
        };
        
        this.init();
    }

    init() {
        if (!this.container) {
            console.error(`Virtual keyboard container with id "${this.containerId}" not found`);
            return;
        }
        
        this.setupFingerMapping();
        this.createKeyboard();
        this.setupEventListeners();
    }

    setupFingerMapping() {
        // Left hand finger assignments
        const leftPinky = ['q', 'a', 'z', '1', 'backtick', 'tab', 'capslock', 'shift-left', 'ctrl-left'];
        const leftRing = ['w', 's', 'x', '2'];
        const leftMiddle = ['e', 'd', 'c', '3'];
        const leftIndex = ['r', 't', 'f', 'g', 'v', 'b', '4', '5'];
        
        // Right hand finger assignments
        const rightIndex = ['y', 'h', 'n', 'u', 'j', 'm', '6', '7'];
        const rightMiddle = ['i', 'k', '8', 'comma'];
        const rightRing = ['o', 'l', '9', 'period'];
        const rightPinky = ['p', '0', 'minus', 'equals', 'semicolon', 'apostrophe', 'slash', 
                            'leftbracket', 'rightbracket', 'backslash', 'enter', 'shift-right', 'backspace'];
        
        // Thumbs
        const thumbs = ['space', 'alt-left', 'alt-right', 'win-left'];

        // Assign finger classes
        leftPinky.forEach(key => this.fingerMap[key] = 'finger-pinky-left');
        leftRing.forEach(key => this.fingerMap[key] = 'finger-ring-left');
        leftMiddle.forEach(key => this.fingerMap[key] = 'finger-middle-left');
        leftIndex.forEach(key => this.fingerMap[key] = 'finger-index-left');
        
        rightIndex.forEach(key => this.fingerMap[key] = 'finger-index-right');
        rightMiddle.forEach(key => this.fingerMap[key] = 'finger-middle-right');
        rightRing.forEach(key => this.fingerMap[key] = 'finger-ring-right');
        rightPinky.forEach(key => this.fingerMap[key] = 'finger-pinky-right');
        
        thumbs.forEach(key => this.fingerMap[key] = 'finger-thumb');
        
        // Numpad finger assignments (right hand focused)
        const numpadKeys = {
            'numlock': 'finger-index-right',
            'numpad-divide': 'finger-middle-right',
            'numpad-multiply': 'finger-ring-right',
            'numpad-minus': 'finger-pinky-right',
            'numpad-7': 'finger-index-right',
            'numpad-8': 'finger-middle-right',
            'numpad-9': 'finger-ring-right',
            'numpad-plus': 'finger-pinky-right',
            'numpad-4': 'finger-index-right',
            'numpad-5': 'finger-middle-right',
            'numpad-6': 'finger-ring-right',
            'numpad-1': 'finger-index-right',
            'numpad-2': 'finger-middle-right',
            'numpad-3': 'finger-ring-right',
            'numpad-enter': 'finger-pinky-right',
            'numpad-0': 'finger-thumb',
            'numpad-decimal': 'finger-ring-right'
        };
        
        Object.entries(numpadKeys).forEach(([key, fingerClass]) => {
            this.fingerMap[key] = fingerClass;
        });
    }

    createKeyboard() {
        if (!this.container) return;
        
        this.keyboard = this.container.querySelector('.virtual-keyboard');
        if (!this.keyboard) return;
        
        this.keyboard.innerHTML = `
            <div class="keyboard-controls">
                <h4 class="keyboard-title">Virtual Keyboard</h4>
                <div class="keyboard-toggles">
                    <button class="keyboard-toggle" data-toggle="function">F-Keys</button>
                    <button class="keyboard-toggle" data-toggle="numpad">Numpad</button>
                </div>
            </div>
            
            ${this.createFunctionRow()}
            
            <div class="keyboard-main">
                <div class="keyboard-left">
                    ${this.createNumberRow()}
                    ${this.createTopRow()}
                    ${this.createHomeRow()}
                    ${this.createBottomRow()}
                    ${this.createSpaceRow()}
                </div>
                ${this.createNumpad()}
            </div>
            
            <div class="keyboard-legend">
                <div class="legend-item">
                    <div class="legend-color" style="background: #ec4899;"></div>
                    <span>Pinky</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #8b5cf6;"></div>
                    <span>Ring</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #3b82f6;"></div>
                    <span>Middle</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #10b981;"></div>
                    <span>Index</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #f59e0b;"></div>
                    <span>Thumb</span>
                </div>
            </div>
        `;
        
        this.mapKeys();
        this.setupKeyboardEventListeners();
    }

    createFunctionRow() {
        const functionKeys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
        const specialKeys = ['Esc', 'PrtSc', 'ScrLk', 'Pause'];
        
        return `
            <div class="keyboard-row function-row" style="display: ${this.showFunctionKeys ? 'flex' : 'none'};">
                ${functionKeys.map(key => 
                    `<button class="keyboard-key key-function" data-key="${key.toLowerCase()}">${key}</button>`
                ).join('')}
                <div style="width: 20px;"></div>
                ${specialKeys.map(key => 
                    `<button class="keyboard-key key-function key-special" data-key="${key.toLowerCase()}">${key}</button>`
                ).join('')}
            </div>
        `;
    }

    createNumberRow() {
        const keys = [
            { key: 'backtick', char: '`', shift: '~' },
            { key: '1', char: '1', shift: '!' },
            { key: '2', char: '2', shift: '@' },
            { key: '3', char: '3', shift: '#' },
            { key: '4', char: '4', shift: '$' },
            { key: '5', char: '5', shift: '%' },
            { key: '6', char: '6', shift: '^' },
            { key: '7', char: '7', shift: '&' },
            { key: '8', char: '8', shift: '*' },
            { key: '9', char: '9', shift: '(' },
            { key: '0', char: '0', shift: ')' },
            { key: 'minus', char: '-', shift: '_' },
            { key: 'equals', char: '=', shift: '+' },
            { key: 'backspace', char: 'Backspace' }
        ];
        
        return `
            <div class="keyboard-row number-row">
                ${keys.map(keyData => {
                    const fingerClass = this.fingerMap[keyData.key] || '';
                    const keyClass = keyData.key === 'backspace' ? 'key-backspace' : 'key-number';
                    const displayText = keyData.shift ? `${keyData.shift}<br><small>${keyData.char}</small>` : keyData.char;
                    
                    return `<button class="keyboard-key ${keyClass} ${fingerClass}" 
                                    data-key="${keyData.key}" 
                                    data-char="${keyData.char}"
                                    ${keyData.shift ? `data-shift="${keyData.shift}"` : ''}>
                                ${displayText}
                            </button>`;
                }).join('')}
            </div>
        `;
    }

    createTopRow() {
        const keys = [
            { key: 'tab', char: 'Tab' },
            { key: 'q', char: 'q' }, { key: 'w', char: 'w' }, { key: 'e', char: 'e' },
            { key: 'r', char: 'r' }, { key: 't', char: 't' }, { key: 'y', char: 'y' },
            { key: 'u', char: 'u' }, { key: 'i', char: 'i' }, { key: 'o', char: 'o' },
            { key: 'p', char: 'p' },
            { key: 'leftbracket', char: '[', shift: '{' },
            { key: 'rightbracket', char: ']', shift: '}' },
            { key: 'backslash', char: '\\', shift: '|' }
        ];
        
        return `
            <div class="keyboard-row top-row">
                ${this.createRowKeys(keys)}
            </div>
        `;
    }

    createHomeRow() {
        const keys = [
            { key: 'capslock', char: 'Caps' },
            { key: 'a', char: 'a' }, { key: 's', char: 's' }, { key: 'd', char: 'd' },
            { key: 'f', char: 'f' }, { key: 'g', char: 'g' }, { key: 'h', char: 'h' },
            { key: 'j', char: 'j' }, { key: 'k', char: 'k' }, { key: 'l', char: 'l' },
            { key: 'semicolon', char: ';', shift: ':' },
            { key: 'apostrophe', char: "'", shift: '"' },
            { key: 'enter', char: 'Enter' }
        ];
        
        return `
            <div class="keyboard-row home-row">
                ${this.createRowKeys(keys)}
            </div>
        `;
    }

    createBottomRow() {
        const keys = [
            { key: 'shift-left', char: 'Shift' },
            { key: 'z', char: 'z' }, { key: 'x', char: 'x' }, { key: 'c', char: 'c' },
            { key: 'v', char: 'v' }, { key: 'b', char: 'b' }, { key: 'n', char: 'n' },
            { key: 'm', char: 'm' },
            { key: 'comma', char: ',', shift: '<' },
            { key: 'period', char: '.', shift: '>' },
            { key: 'slash', char: '/', shift: '?' },
            { key: 'shift-right', char: 'Shift' }
        ];
        
        return `
            <div class="keyboard-row bottom-row">
                ${this.createRowKeys(keys)}
                ${this.createArrowKeys()}
            </div>
        `;
    }

    createArrowKeys() {
        return `
            <div class="arrow-cluster">
                <button class="keyboard-key key-arrow key-arrow-up" data-key="arrow-up">↑</button>
                <button class="keyboard-key key-arrow key-arrow-left" data-key="arrow-left">←</button>
                <button class="keyboard-key key-arrow key-arrow-down" data-key="arrow-down">↓</button>
                <button class="keyboard-key key-arrow key-arrow-right" data-key="arrow-right">→</button>
            </div>
        `;
    }


    createRowKeys(keys) {
        return keys.map(keyData => {
            const fingerClass = this.fingerMap[keyData.key] || '';
            let keyClass = 'key-letter';
            
            // Determine key class based on key type
            if (['tab', 'capslock', 'enter'].includes(keyData.key)) {
                keyClass = `key-${keyData.key} key-modifier`;
            } else if (keyData.key === 'shift-left') {
                keyClass = 'key-shift key-modifier';
            } else if (keyData.key === 'shift-right') {
                keyClass = 'key-shift key-shift-right key-modifier';
            } else if (['leftbracket', 'rightbracket', 'backslash', 'semicolon', 'apostrophe', 'comma', 'period', 'slash'].includes(keyData.key)) {
                keyClass = 'key-special';
            }
            
            const displayText = keyData.shift ? 
                `${keyData.shift}<br><small>${keyData.char}</small>` : 
                keyData.char;
            
            return `<button class="keyboard-key ${keyClass} ${fingerClass}" 
                            data-key="${keyData.key}" 
                            data-char="${keyData.char}"
                            ${keyData.shift ? `data-shift="${keyData.shift}"` : ''}>
                        ${displayText}
                    </button>`;
        }).join('');
    }

    createSpaceRow() {
        const keys = [
            { key: 'ctrl-left', char: 'Ctrl' },
            { key: 'win-left', char: 'Win' },
            { key: 'alt-left', char: 'Alt' },
            { key: 'space', char: 'Space' },
            { key: 'alt-right', char: 'Alt' },
            { key: 'win-right', char: 'Win' },
            { key: 'ctrl-right', char: 'Ctrl' }
        ];
        
        return `
            <div class="keyboard-row space-row">
                <div class="space-section">
                    ${keys.map(keyData => {
                        const fingerClass = this.fingerMap[keyData.key] || '';
                        let keyClass = keyData.key === 'space' ? 'key-spacebar' : 'key-modifier';
                        
                        // Add specific classes for left/right variants
                        if (keyData.key.includes('left')) {
                            keyClass += ` key-${keyData.key}`;
                        } else if (keyData.key.includes('right')) {
                            keyClass += ` key-${keyData.key}`;
                        }
                        
                        return `<button class="keyboard-key ${keyClass} ${fingerClass}" 
                                        data-key="${keyData.key}" 
                                        data-char="${keyData.char}">
                                    ${keyData.char}
                                </button>`;
                    }).join('')}
                </div>
            </div>
        `;
    }

    createNumpad() {
        const numpadKeys = [
            // Row 1: NumLock, /, *, -
            { key: 'numlock', char: 'Num', position: { col: 1, row: 1 } },
            { key: 'numpad-divide', char: '/', position: { col: 2, row: 1 } },
            { key: 'numpad-multiply', char: '*', position: { col: 3, row: 1 } },
            { key: 'numpad-minus', char: '-', position: { col: 4, row: 1 } },
            
            // Row 2: 7, 8, 9, +
            { key: 'numpad-7', char: '7', position: { col: 1, row: 2 } },
            { key: 'numpad-8', char: '8', position: { col: 2, row: 2 } },
            { key: 'numpad-9', char: '9', position: { col: 3, row: 2 } },
            { key: 'numpad-plus', char: '+', position: { col: 4, row: 2 }, span: 'row' },
            
            // Row 3: 4, 5, 6
            { key: 'numpad-4', char: '4', position: { col: 1, row: 3 } },
            { key: 'numpad-5', char: '5', position: { col: 2, row: 3 } },
            { key: 'numpad-6', char: '6', position: { col: 3, row: 3 } },
            
            // Row 4: 1, 2, 3, Enter
            { key: 'numpad-1', char: '1', position: { col: 1, row: 4 } },
            { key: 'numpad-2', char: '2', position: { col: 2, row: 4 } },
            { key: 'numpad-3', char: '3', position: { col: 3, row: 4 } },
            { key: 'numpad-enter', char: 'Enter', position: { col: 4, row: 4 }, span: 'row' },
            
            // Row 5: 0, .
            { key: 'numpad-0', char: '0', position: { col: 1, row: 5 }, span: 'col' },
            { key: 'numpad-decimal', char: '.', position: { col: 3, row: 5 } }
        ];
        
        return `
            <div class="numpad" style="display: ${this.showNumpad ? 'grid' : 'none'};">
                ${numpadKeys.map(keyData => {
                    const fingerClass = this.fingerMap[keyData.key] || 'finger-index-right';
                    let keyClass = 'keyboard-key key-numpad';
                    
                    if (keyData.key === 'numpad-enter') {
                        keyClass += ' key-numpad-enter';
                    } else if (keyData.key === 'numpad-0') {
                        keyClass += ' key-numpad-zero';
                    } else if (keyData.key === 'numpad-plus') {
                        keyClass += ' key-numpad-plus';
                    }
                    
                    const gridStyle = keyData.span === 'row' ? 
                        `grid-row: ${keyData.position.row} / ${keyData.position.row + 2};` :
                        keyData.span === 'col' ?
                        `grid-column: ${keyData.position.col} / ${keyData.position.col + 2};` :
                        '';
                    
                    return `<button class="${keyClass} ${fingerClass}" 
                                    data-key="${keyData.key}" 
                                    data-char="${keyData.char}"
                                    style="grid-column: ${keyData.position.col}; grid-row: ${keyData.position.row}; ${gridStyle}">
                                ${keyData.char}
                            </button>`;
                }).join('')}
            </div>
        `;
    }

    mapKeys() {
        this.keys.clear();
        const keyElements = this.keyboard.querySelectorAll('.keyboard-key[data-key]');
        keyElements.forEach(keyEl => {
            const keyName = keyEl.getAttribute('data-key');
            this.keys.set(keyName, keyEl);
            
            // Also map by character for easy lookup
            const char = keyEl.getAttribute('data-char');
            if (char && char.length === 1) {
                this.keys.set(`char-${char.toLowerCase()}`, keyEl);
            }
            
            // Map shift combinations
            const shiftChar = keyEl.getAttribute('data-shift');
            if (shiftChar) {
                this.keys.set(`char-${shiftChar.toLowerCase()}`, keyEl);
            }
        });
    }

    setupEventListeners() {
        // Toggle button listeners
        const toggleKeyboardBtn = document.getElementById('toggle-keyboard-btn');
        const toggleLessonKeyboardBtn = document.getElementById('toggle-lesson-keyboard-btn');
        
        if (toggleKeyboardBtn) {
            toggleKeyboardBtn.addEventListener('click', () => this.toggle());
        }
        
        if (toggleLessonKeyboardBtn) {
            toggleLessonKeyboardBtn.addEventListener('click', () => this.toggle());
        }
    }

    setupKeyboardEventListeners() {
        if (!this.keyboard) return;
        
        // Keyboard control toggles
        const toggleButtons = this.keyboard.querySelectorAll('.keyboard-toggle');
        toggleButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const toggle = e.target.getAttribute('data-toggle');
                this.handleToggle(toggle, e.target);
            });
        });
        
        // Key click handlers for visual feedback
        const keyElements = this.keyboard.querySelectorAll('.keyboard-key');
        keyElements.forEach(keyEl => {
            keyEl.addEventListener('click', (e) => {
                const keyName = e.target.getAttribute('data-key');
                this.simulateKeyPress(keyName);
            });
        });
    }

    handleToggle(toggleType, button) {
        switch (toggleType) {
            case 'function':
                this.showFunctionKeys = !this.showFunctionKeys;
                const functionRow = this.keyboard.querySelector('.function-row');
                if (functionRow) {
                    functionRow.style.display = this.showFunctionKeys ? 'flex' : 'none';
                }
                button.classList.toggle('active', this.showFunctionKeys);
                break;
                
            case 'numpad':
                this.showNumpad = !this.showNumpad;
                const numpad = this.keyboard.querySelector('.numpad');
                if (numpad) {
                    numpad.style.display = this.showNumpad ? 'grid' : 'none';
                }
                button.classList.toggle('active', this.showNumpad);
                break;
        }
    }

    simulateKeyPress(keyName) {
        const keyEl = this.keys.get(keyName);
        if (keyEl) {
            keyEl.classList.add('active');
            setTimeout(() => {
                keyEl.classList.remove('active');
            }, 150);
        }
    }

    highlightKey(char) {
        this.clearHighlights();
        this.currentKey = char;
        
        if (!char) return;
        
        const isShiftRequired = this.isShiftRequired(char);
        
        if (isShiftRequired) {
            const shiftKeys = this.keyboard.querySelectorAll('[data-key="shift-left"], [data-key="shift-right"]');
            shiftKeys.forEach(key => key.classList.add('next-key'));
            this.keyboard.classList.add('shift-active');
        } else {
            this.keyboard.classList.remove('shift-active');
        }
        
        const keyEl = this.getKeyForCharacter(char);
        if (keyEl) {
            keyEl.classList.add('active', 'next-key');
        }
    }

    showFeedback(char, isCorrect) {
        const keyEl = this.getKeyForCharacter(char);
        if (keyEl) {
            keyEl.classList.remove('active', 'next-key', 'correct', 'incorrect');
            keyEl.classList.add(isCorrect ? 'correct' : 'incorrect');
            
            setTimeout(() => {
                keyEl.classList.remove('correct', 'incorrect');
            }, 500);
        }
        
        if (this.isShiftRequired(char)) {
            const shiftKeys = this.keyboard.querySelectorAll('[data-key="shift-left"], [data-key="shift-right"]');
            shiftKeys.forEach(key => {
                key.classList.remove('next-key');
                key.classList.add(isCorrect ? 'correct' : 'incorrect');
                setTimeout(() => {
                    key.classList.remove('correct', 'incorrect');
                }, 500);
            });
            this.keyboard.classList.remove('shift-active');
        }
    }

    getKeyForCharacter(char) {
        if (!char) return null;
        
        const directKey = this.keys.get(`char-${char.toLowerCase()}`);
        if (directKey) return directKey;
        
        const baseChar = this.getBaseCharacter(char);
        if (baseChar) {
            return this.keys.get(`char-${baseChar.toLowerCase()}`);
        }
        
        if (this.charToKeyMap[char.toLowerCase()]) {
            const keyName = this.charToKeyMap[char.toLowerCase()].replace('key-', '');
            return this.keys.get(keyName);
        }
        
        return null;
    }

    getBaseCharacter(char) {
        const shiftMap = {
            '!': '1', '@': '2', '#': '3', '$': '4', '%': '5',
            '^': '6', '&': '7', '*': '8', '(': '9', ')': '0',
            '_': '-', '+': '=', '{': '[', '}': ']', '|': '\\',
            ':': ';', '"': "'", '<': ',', '>': '.', '?': '/',
            '~': '`'
        };
        
        return shiftMap[char] || null;
    }

    isShiftRequired(char) {
        const shiftChars = '!@#$%^&*()_+{}|:"<>?~';
        return shiftChars.includes(char) || (char >= 'A' && char <= 'Z');
    }

    clearHighlights() {
        if (!this.keyboard) return;
        
        const highlightedKeys = this.keyboard.querySelectorAll('.active, .next-key, .correct, .incorrect');
        highlightedKeys.forEach(key => {
            key.classList.remove('active', 'next-key', 'correct', 'incorrect');
        });
        
        this.keyboard.classList.remove('shift-active');
    }

    reset() {
        this.clearHighlights();
        this.currentKey = null;
        this.shiftPressed = false;
    }

    toggle() {
        if (!this.container) return;
        
        this.isVisible = !this.isVisible;
        this.container.classList.toggle('visible', this.isVisible);
        
        const toggleBtn = document.getElementById('toggle-keyboard-btn');
        const lessonToggleBtn = document.getElementById('toggle-lesson-keyboard-btn');
        
        const buttonText = this.isVisible ? 'Hide Keyboard' : 'Show Keyboard';
        if (toggleBtn && this.containerId === 'virtual-keyboard-container') {
            toggleBtn.textContent = buttonText;
        }
        if (lessonToggleBtn && this.containerId === 'lesson-virtual-keyboard-container') {
            lessonToggleBtn.textContent = buttonText;
        }
    }

    show() {
        if (!this.isVisible) {
            this.toggle();
        }
    }

    hide() {
        if (this.isVisible) {
            this.toggle();
        }
    }
}

// Initialize virtual keyboards and integrate with typing tests
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // Create virtual keyboard instances
        window.virtualKeyboard = new VirtualKeyboard('virtual-keyboard-container');
        window.lessonVirtualKeyboard = new VirtualKeyboard('lesson-virtual-keyboard-container');
        
        // Connect virtual keyboards with typing tests
        if (window.typingTest && window.virtualKeyboard) {
            window.typingTest.virtualKeyboard = window.virtualKeyboard;
        }
        
        if (window.lessonTypingTest && window.lessonVirtualKeyboard) {
            window.lessonTypingTest.virtualKeyboard = window.lessonVirtualKeyboard;
        }
        
        // Initial render to highlight first character if keyboards are visible
        if (window.typingTest && window.virtualKeyboard.isVisible) {
            window.typingTest.renderText();
        }
        
        if (window.lessonTypingTest && window.lessonVirtualKeyboard.isVisible) {
            window.lessonTypingTest.renderText();
        }
    }, 100); // Small delay to ensure typing tests are initialized
});