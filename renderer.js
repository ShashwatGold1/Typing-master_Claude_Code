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
        } else if (page === 'touch-typing') {
            // Initialize touch typing page when navigating to it
            setTimeout(() => {
                if (window.touchTypingManager) {
                    window.touchTypingManager.init();
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

// Touch Typing System
class TouchTypingManager {
    constructor() {
        this.currentLesson = 1;
        this.currentStep = 1;
        this.totalSteps = 4;
        this.isActive = false;
        this.currentIndex = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this.startTime = null;
        this.timer = null;
        
        this.lessons = {
            1: {
                title: "F & J Keys Foundation",
                steps: [
                    {
                        instruction: "Place your left index finger on F and right index finger on J. These are your anchor keys.",
                        text: "fff jjj fff jjj",
                        highlightKeys: ['f', 'j']
                    },
                    {
                        instruction: "Alternate between F and J keys. Keep your fingers anchored to their home positions.",
                        text: "fjf jfj fjf jfj",
                        highlightKeys: ['f', 'j']
                    },
                    {
                        instruction: "Practice smooth transitions. Feel the rhythm of your fingers returning to home position.",
                        text: "fjjf jffj fjjf jffj",
                        highlightKeys: ['f', 'j']
                    },
                    {
                        instruction: "Final challenge: Mix F and J keys with confidence and steady rhythm.",
                        text: "fjfj jfjf fjjf jffj fjfj",
                        highlightKeys: ['f', 'j']
                    }
                ]
            },
            2: {
                title: "Space Bar Mastery", 
                steps: [
                    {
                        instruction: "Place your right thumb over the space bar. Keep your fingers on F and J.",
                        text: "f j f j",
                        highlightKeys: ['f', 'j', 'space']
                    },
                    {
                        instruction: "Type letters and spaces. Use your thumb to hit the space bar with a quick, light touch.",
                        text: "f j f j f j",
                        highlightKeys: ['f', 'j', 'space']
                    },
                    {
                        instruction: "Practice word spacing. Each space should be clean and consistent.",
                        text: "fj fj jf jf fj",
                        highlightKeys: ['f', 'j', 'space']
                    },
                    {
                        instruction: "Master the rhythm of letters and spaces together.",
                        text: "fjf jfj fjf jfj",
                        highlightKeys: ['f', 'j', 'space']
                    }
                ]
            },
            3: {
                title: "D & K Keys Practice",
                steps: [
                    {
                        instruction: "Add your middle fingers. Left middle finger on D, right middle finger on K.",
                        text: "ddd kkk ddd kkk",
                        highlightKeys: ['d', 'k']
                    },
                    {
                        instruction: "Combine D and K with your anchor keys F and J.",
                        text: "df jk df jk",
                        highlightKeys: ['d', 'f', 'j', 'k']
                    },
                    {
                        instruction: "Practice flowing between all four keys smoothly.",
                        text: "dfk jdf kfj dkj",
                        highlightKeys: ['d', 'f', 'j', 'k']
                    },
                    {
                        instruction: "Master all learned keys with spaces for real word formation.",
                        text: "fad jak fed jek",
                        highlightKeys: ['d', 'f', 'j', 'k', 'space']
                    }
                ]
            },
            4: {
                title: "Foundation Review",
                steps: [
                    {
                        instruction: "Review all learned keys: F, J, D, K, and Space.",
                        text: "fjdk fjdk fjdk",
                        highlightKeys: ['f', 'j', 'd', 'k', 'space']
                    },
                    {
                        instruction: "Type simple words using your foundation keys.",
                        text: "dad jak fed jed",
                        highlightKeys: ['f', 'j', 'd', 'k', 'space']
                    },
                    {
                        instruction: "Build confidence with longer combinations.",
                        text: "jade fade jaded fade jade",
                        highlightKeys: ['f', 'j', 'd', 'k', 'space']
                    },
                    {
                        instruction: "Final mastery test with varied patterns and rhythm.",
                        text: "fjdk jfkd dkfj kdjf jade fade",
                        highlightKeys: ['f', 'j', 'd', 'k', 'space']
                    }
                ]
            },
            5: {
                title: "Speed & Accuracy",
                steps: [
                    {
                        instruction: "Focus on speed while maintaining accuracy. Build your confidence.",
                        text: "jade fade jaded",
                        highlightKeys: ['f', 'j', 'd', 'k', 'space']
                    },
                    {
                        instruction: "Challenge yourself with rapid-fire letter combinations.",
                        text: "fjdk jfkd fjdk jfkd fjdk",
                        highlightKeys: ['f', 'j', 'd', 'k']
                    },
                    {
                        instruction: "Type meaningful words with confidence and flow.",
                        text: "jade fade jaded fade jade fade",
                        highlightKeys: ['f', 'j', 'd', 'k', 'space']
                    },
                    {
                        instruction: "Final challenge: Maintain rhythm and accuracy at speed.",
                        text: "jaded jade fade fjdk jfkd jade fade jaded",
                        highlightKeys: ['f', 'j', 'd', 'k', 'space']
                    }
                ]
            }
        };
        
        this.progress = {
            completedLessons: 0,
            overallProgress: 0,
            currentStage: "Foundation"
        };
        
        this.loadProgress();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateProgressDisplay();
    }

    setupEventListeners() {
        // Lesson card click handlers
        document.querySelectorAll('.touch-lesson-card.available .lesson-btn').forEach((btn, index) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const lessonCard = btn.closest('.touch-lesson-card');
                const lessonNumber = parseInt(lessonCard.getAttribute('data-lesson'));
                this.startLesson(lessonNumber);
            });
        });

        // Interface controls
        const backBtn = document.getElementById('back-to-overview');
        const resetBtn = document.getElementById('reset-lesson');
        const nextBtn = document.getElementById('next-step');

        if (backBtn) {
            backBtn.addEventListener('click', () => this.backToOverview());
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetCurrentStep());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
        }

        // Typing input handler
        const typingInput = document.getElementById('touch-typing-input');
        if (typingInput) {
            typingInput.addEventListener('input', (e) => this.handleInput(e));
            typingInput.addEventListener('focus', () => {
                if (!this.isActive && this.currentLesson && this.currentStep) {
                    this.startStep();
                }
            });
        }
    }

    startLesson(lessonNumber) {
        this.currentLesson = lessonNumber;
        this.currentStep = 1;
        
        // Show interface, hide overview
        document.querySelector('.touch-typing-grid').style.display = 'none';
        document.querySelector('.progress-overview').style.display = 'none';
        document.getElementById('touch-typing-interface').style.display = 'block';
        
        this.loadStep();
    }

    loadStep() {
        const lesson = this.lessons[this.currentLesson];
        const step = lesson.steps[this.currentStep - 1];
        
        // Update interface
        document.getElementById('current-lesson-title').textContent = lesson.title;
        document.getElementById('lesson-step').textContent = `Step ${this.currentStep} of ${this.totalSteps}`;
        document.getElementById('instruction-text').textContent = step.instruction;
        document.getElementById('touch-text-content').textContent = step.text;
        
        // Update step indicators
        document.querySelectorAll('.step').forEach((stepEl, index) => {
            stepEl.classList.remove('active', 'completed');
            if (index < this.currentStep - 1) {
                stepEl.classList.add('completed');
            } else if (index === this.currentStep - 1) {
                stepEl.classList.add('active');
            }
        });
        
        // Update hand position highlights
        this.updateHandGuide(step.highlightKeys);
        
        // Reset input and stats
        const typingInput = document.getElementById('touch-typing-input');
        typingInput.value = '';
        typingInput.placeholder = `Type: ${step.text}`;
        
        this.resetStats();
        this.renderText();
        
        // Focus input
        setTimeout(() => {
            typingInput.focus();
        }, 100);
    }

    updateHandGuide(highlightKeys) {
        // Reset all highlights
        document.querySelectorAll('.finger-pos, .spacebar').forEach(el => {
            el.classList.remove('highlight');
        });
        
        // Add highlights for current keys
        highlightKeys.forEach(key => {
            if (key === 'space') {
                document.querySelector('.spacebar').classList.add('highlight');
            } else {
                const keyEl = document.querySelector(`[data-key="${key}"]`);
                if (keyEl) {
                    keyEl.classList.add('highlight');
                }
            }
        });
        
        // Also highlight fingers in the new hand effects system
        if (window.touchTypingKeyboardEffects) {
            window.touchTypingKeyboardEffects.highlightLessonFingers(highlightKeys);
        }
    }

    handleInput(e) {
        if (!this.isActive) {
            this.startStep();
        }
        
        const inputValue = e.target.value;
        const targetText = this.lessons[this.currentLesson].steps[this.currentStep - 1].text;
        
        // Limit input length
        if (inputValue.length > targetText.length) {
            e.target.value = inputValue.substring(0, targetText.length);
            return;
        }
        
        // Trigger keyboard effects for the last typed character
        if (inputValue.length > 0 && window.touchTypingKeyboardEffects) {
            const lastChar = inputValue[inputValue.length - 1];
            window.touchTypingKeyboardEffects.handleKeyPress(lastChar);
        }
        
        this.currentIndex = inputValue.length;
        this.totalChars = inputValue.length;
        
        // Calculate correct characters
        this.correctChars = 0;
        for (let i = 0; i < inputValue.length; i++) {
            if (inputValue[i] === targetText[i]) {
                this.correctChars++;
            }
        }
        
        this.renderText();
        this.updateStats();
        
        // Check completion
        if (inputValue.length >= targetText.length && this.correctChars === targetText.length) {
            this.completeStep();
        }
    }

    startStep() {
        this.isActive = true;
        this.startTime = Date.now();
        
        this.timer = setInterval(() => {
            this.updateStats();
        }, 1000);
    }

    completeStep() {
        this.isActive = false;
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // Enable next button
        const nextBtn = document.getElementById('next-step');
        nextBtn.disabled = false;
        nextBtn.textContent = this.currentStep < this.totalSteps ? 'Next Step' : 'Complete Lesson';
        
        // Show completion feedback
        if (window.popupManager) {
            const accuracy = Math.round((this.correctChars / this.totalChars) * 100);
            window.popupManager.success(
                'Step Complete! 🎉',
                `Great job! You completed this step with ${accuracy}% accuracy.`,
                {
                    showCancel: false,
                    confirmText: 'Continue',
                    onConfirm: () => {
                        if (this.currentStep < this.totalSteps) {
                            this.nextStep();
                        } else {
                            this.completeLesson();
                        }
                    }
                }
            );
        }
    }

    nextStep() {
        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.loadStep();
            
            // Disable next button until step completion
            document.getElementById('next-step').disabled = true;
            document.getElementById('next-step').textContent = 'Next Step';
        } else {
            this.completeLesson();
        }
    }

    completeLesson() {
        // Update progress
        if (this.currentLesson > this.progress.completedLessons) {
            this.progress.completedLessons = this.currentLesson;
            this.progress.overallProgress = (this.currentLesson / 5) * 100;
            
            // Update stage
            if (this.currentLesson <= 2) {
                this.progress.currentStage = "Foundation";
            } else if (this.currentLesson <= 4) {
                this.progress.currentStage = "Building";
            } else {
                this.progress.currentStage = "Mastery";
            }
            
            this.saveProgress();
        }
        
        // Unlock next lesson
        if (this.currentLesson < 5) {
            this.unlockLesson(this.currentLesson + 1);
        }
        
        // Show completion message
        if (window.popupManager) {
            const message = this.currentLesson < 5 ? 
                'Lesson complete! The next lesson has been unlocked.' :
                'Congratulations! You\'ve completed all touch typing foundation lessons!';
                
            window.popupManager.success(
                'Lesson Complete! 🎯',
                message,
                {
                    showCancel: false,
                    confirmText: 'Back to Overview',
                    onConfirm: () => this.backToOverview()
                }
            );
        }
    }

    unlockLesson(lessonNumber) {
        const lessonCard = document.querySelector(`[data-lesson="${lessonNumber}"]`);
        if (lessonCard) {
            lessonCard.classList.remove('locked');
            lessonCard.classList.add('available');
            
            const statusIcon = lessonCard.querySelector('.status-icon');
            const button = lessonCard.querySelector('.lesson-btn');
            
            statusIcon.textContent = '🔓';
            button.textContent = 'Start Lesson';
            button.classList.remove('btn-disabled');
            button.classList.add('btn-primary');
            
            // Add click handler
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.startLesson(lessonNumber);
            });
        }
    }

    resetCurrentStep() {
        this.isActive = false;
        this.currentIndex = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this.startTime = null;
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // Reset input and display
        document.getElementById('touch-typing-input').value = '';
        document.getElementById('next-step').disabled = true;
        document.getElementById('next-step').textContent = 'Next Step';
        
        this.resetStats();
        this.renderText();
        
        // Focus input
        setTimeout(() => {
            document.getElementById('touch-typing-input').focus();
        }, 100);
    }

    backToOverview() {
        // Hide interface, show overview
        document.getElementById('touch-typing-interface').style.display = 'none';
        document.querySelector('.touch-typing-grid').style.display = 'grid';
        document.querySelector('.progress-overview').style.display = 'block';
        
        // Reset state
        this.isActive = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        this.updateProgressDisplay();
    }

    renderText() {
        const targetText = this.lessons[this.currentLesson].steps[this.currentStep - 1].text;
        const typedText = document.getElementById('touch-typing-input').value;
        const textContent = document.getElementById('touch-text-content');
        
        const chars = targetText.split('');
        textContent.innerHTML = chars.map((char, index) => {
            let className = 'char';
            if (index < typedText.length) {
                const typedChar = typedText[index];
                className += typedChar === char ? ' correct' : ' incorrect';
            } else if (index === typedText.length) {
                className += ' current';
            }
            return `<span class="${className}">${char === ' ' ? '&nbsp;' : char}</span>`;
        }).join('');
    }

    updateStats() {
        let wpm = 0;
        if (this.isActive && this.startTime) {
            const timeElapsedSeconds = (Date.now() - this.startTime) / 1000;
            if (timeElapsedSeconds >= 1) {
                const timeElapsedMinutes = timeElapsedSeconds / 60;
                const wordsTyped = this.correctChars / 5;
                wpm = Math.round(wordsTyped / timeElapsedMinutes);
            }
        }
        
        const accuracy = this.totalChars > 0 ? Math.round((this.correctChars / this.totalChars) * 100) : 100;
        const completion = this.totalChars > 0 ? Math.round((this.totalChars / this.lessons[this.currentLesson].steps[this.currentStep - 1].text.length) * 100) : 0;
        
        document.getElementById('touch-wpm').textContent = wpm;
        document.getElementById('touch-accuracy').textContent = `${accuracy}%`;
        document.getElementById('lesson-completion').textContent = `${completion}%`;
    }

    resetStats() {
        document.getElementById('touch-wpm').textContent = '0';
        document.getElementById('touch-accuracy').textContent = '100%';
        document.getElementById('lesson-completion').textContent = '0%';
    }

    updateProgressDisplay() {
        document.getElementById('overall-progress').textContent = `${Math.round(this.progress.overallProgress)}%`;
        document.getElementById('progress-fill').style.width = `${this.progress.overallProgress}%`;
        document.getElementById('completed-lessons').textContent = `${this.progress.completedLessons}/5`;
        document.getElementById('current-stage').textContent = this.progress.currentStage;
    }

    loadProgress() {
        try {
            const savedProgress = localStorage.getItem('touch-typing-progress');
            if (savedProgress) {
                this.progress = { ...this.progress, ...JSON.parse(savedProgress) };
                
                // Unlock completed lessons
                for (let i = 1; i <= this.progress.completedLessons + 1 && i <= 5; i++) {
                    if (i > 1) {
                        this.unlockLesson(i);
                    }
                }
            }
        } catch (error) {
            console.error('Error loading touch typing progress:', error);
        }
    }

    saveProgress() {
        try {
            localStorage.setItem('touch-typing-progress', JSON.stringify(this.progress));
        } catch (error) {
            console.error('Error saving touch typing progress:', error);
        }
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

// Touch Typing Keyboard and Hand Effects System
class TouchTypingKeyboardEffects {
    constructor() {
        this.keyboardScale = 0.7;
        this.handScale = 0.8;
        this.keyboardContainer = null;
        this.handsWrapper = null;
        this.activeFingers = new Set();
        
        // Complete finger mapping based on proper touch typing technique
        this.keyToFingerMap = {
            // Function keys and system keys
            'Escape': 'left-pinky',
            'F1': 'left-pinky', 'F2': 'left-ring', 'F3': 'left-middle', 'F4': 'left-index',
            'F5': 'right-index', 'F6': 'right-middle', 'F7': 'right-ring', 'F8': 'right-pinky',
            'F9': 'right-index', 'F10': 'right-middle', 'F11': 'right-ring', 'F12': 'right-pinky',
            'PrintScreen': 'right-index', 'ScrollLock': 'right-middle', 'Pause': 'right-ring',
            
            // Number row
            '`': 'left-pinky', '1': 'left-pinky', '2': 'left-ring', '3': 'left-middle', 
            '4': 'left-index', '5': 'left-index', '6': 'right-index', '7': 'right-index',
            '8': 'right-middle', '9': 'right-ring', '0': 'right-pinky', '-': 'right-pinky', 
            '=': 'right-pinky', 'Backspace': 'right-pinky',
            
            // Symbols with shift (same finger as base key)
            '~': 'left-pinky', '!': 'left-pinky', '@': 'left-ring', '#': 'left-middle',
            '$': 'left-index', '%': 'left-index', '^': 'right-index', '&': 'right-index',
            '*': 'right-middle', '(': 'right-ring', ')': 'right-pinky', '_': 'right-pinky', '+': 'right-pinky',
            
            // QWERTY row
            'Tab': 'left-pinky',
            'q': 'left-pinky', 'w': 'left-ring', 'e': 'left-middle', 'r': 'left-index', 't': 'left-index',
            'y': 'right-index', 'u': 'right-index', 'i': 'right-middle', 'o': 'right-ring', 'p': 'right-pinky',
            '[': 'right-pinky', ']': 'right-pinky', '\\': 'right-pinky',
            
            // Capital letters (same finger as lowercase)
            'Q': 'left-pinky', 'W': 'left-ring', 'E': 'left-middle', 'R': 'left-index', 'T': 'left-index',
            'Y': 'right-index', 'U': 'right-index', 'I': 'right-middle', 'O': 'right-ring', 'P': 'right-pinky',
            '{': 'right-pinky', '}': 'right-pinky', '|': 'right-pinky',
            
            // ASDF row (home row)
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
            ' ': 'left-thumb', // Space - can be either thumb
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
        // Wait for touch typing interface to be available
        setTimeout(() => {
            this.setupElements();
            this.setupScaleControls();
            this.setupKeyboardInteraction();
            console.log('✅ TouchTypingKeyboardEffects (FULL KEYBOARD) initialized successfully');
        }, 100);
    }
    
    setupElements() {
        this.keyboardContainer = document.querySelector('.touch-keyboard-container');
        this.handsWrapper = document.querySelector('.touch-hands-container .hands-wrapper');
        
        console.log('🔧 Keyboard container found:', !!this.keyboardContainer);
        console.log('🔧 Hands wrapper found:', !!this.handsWrapper);
        
        if (this.keyboardContainer) {
            this.applyKeyboardScale(this.keyboardScale);
            console.log('⚙️ Keyboard scale applied:', this.keyboardScale);
        }
        
        if (this.handsWrapper) {
            this.applyHandScale(this.handScale);
            console.log('⚙️ Hand scale applied:', this.handScale);
        }
    }
    
    setupScaleControls() {
        // Keyboard scale control
        const keyboardScaleSlider = document.getElementById('touch-scale-slider');
        const keyboardScaleDisplay = document.getElementById('touch-scale-display');
        
        if (keyboardScaleSlider && keyboardScaleDisplay) {
            keyboardScaleSlider.addEventListener('input', (e) => {
                const scale = parseFloat(e.target.value);
                this.setKeyboardScale(scale);
                keyboardScaleDisplay.textContent = `${(scale * 100).toFixed(0)}%`;
            });
            
            keyboardScaleDisplay.textContent = `${(this.keyboardScale * 100).toFixed(0)}%`;
            keyboardScaleSlider.value = this.keyboardScale;
        }
        
        // Hand scale control
        const handScaleSlider = document.getElementById('touch-hand-scale-slider');
        const handScaleDisplay = document.getElementById('touch-hand-scale-display');
        
        if (handScaleSlider && handScaleDisplay) {
            handScaleSlider.addEventListener('input', (e) => {
                const scale = parseFloat(e.target.value);
                this.setHandScale(scale);
                handScaleDisplay.textContent = `${(scale * 100).toFixed(0)}%`;
            });
            
            handScaleDisplay.textContent = `${(this.handScale * 100).toFixed(0)}%`;
            handScaleSlider.value = this.handScale;
        }
    }
    
    setupKeyboardInteraction() {
        // Add click listeners to keyboard keys
        const keys = document.querySelectorAll('.touch-keyboard-container .key');
        console.log('🎹 Found keyboard keys:', keys.length);
        
        keys.forEach(key => {
            key.addEventListener('click', (e) => {
                const keyValue = key.dataset.key;
                console.log('🎯 Key clicked:', keyValue);
                this.simulateKeyPress(key, keyValue);
            });
        });
    }
    
    setKeyboardScale(scale) {
        this.keyboardScale = scale;
        this.applyKeyboardScale(scale);
    }
    
    applyKeyboardScale(scale) {
        if (this.keyboardContainer) {
            this.keyboardContainer.style.transform = `scale(${scale})`;
        }
    }
    
    setHandScale(scale) {
        this.handScale = scale;
        this.applyHandScale(scale);
    }
    
    applyHandScale(scale) {
        if (this.handsWrapper) {
            this.handsWrapper.style.transform = `scale(${scale})`;
        }
    }
    
    // Handle key press from typing input
    handleKeyPress(keyValue, keyCode = null) {
        // Find the corresponding keyboard key element
        const keyElement = this.findKeyElement(keyValue, keyCode);
        
        if (keyElement) {
            this.simulateKeyPress(keyElement, keyValue);
        }
        
        // Highlight the finger for this key
        this.highlightFingerForKey(keyValue);
    }
    
    findKeyElement(keyValue, keyCode = null) {
        // Try direct match first
        let keyElement = document.querySelector(`.touch-keyboard-container .key[data-key="${keyValue}"]`);
        
        if (!keyElement && keyCode) {
            // Try with keyCode for special keys
            keyElement = document.querySelector(`.touch-keyboard-container .key[data-key="${keyCode}"]`);
        }
        
        return keyElement;
    }
    
    simulateKeyPress(keyElement, keyValue) {
        // Add pressed class for visual feedback
        keyElement.classList.add('pressed');
        
        // Remove pressed class after animation
        setTimeout(() => {
            keyElement.classList.remove('pressed');
        }, 200);
        
        // Highlight corresponding finger
        this.highlightFingerForKey(keyValue);
    }
    
    highlightFingerForKey(keyValue) {
        // Clear previous highlights first for single-key highlighting
        this.clearAllFingerHighlights();
        
        // Get the finger for this key
        const fingerId = this.getFingerForKey(keyValue);
        
        if (fingerId) {
            this.activateFingerImage(fingerId);
            this.activeFingers.add(fingerId);
            
            // Keep finger highlighted for a short duration
            setTimeout(() => {
                this.deactivateFingerImage(fingerId);
                this.activeFingers.delete(fingerId);
            }, 800);
        }
    }
    
    getFingerForKey(keyValue) {
        // Handle space key - alternate between thumbs
        if (keyValue === ' ') {
            return Math.random() > 0.5 ? 'left-thumb' : 'right-thumb';
        }
        
        // Direct lookup in the finger mapping
        return this.keyToFingerMap[keyValue] || null;
    }
    
    activateFingerImage(fingerId) {
        const fingerImg = document.getElementById(`touch-${fingerId}-img`);
        if (fingerImg) {
            fingerImg.classList.add('active');
        }
    }
    
    deactivateFingerImage(fingerId) {
        const fingerImg = document.getElementById(`touch-${fingerId}-img`);
        if (fingerImg) {
            fingerImg.classList.remove('active');
        }
    }
    
    clearAllFingerHighlights() {
        const activeFingerImages = document.querySelectorAll('.touch-hands-container .finger-image.active');
        activeFingerImages.forEach(img => img.classList.remove('active'));
        this.activeFingers.clear();
    }
    
    // Method to highlight specific fingers for lesson guidance
    highlightLessonFingers(keys) {
        this.clearAllFingerHighlights();
        
        keys.forEach(key => {
            // Convert 'space' to proper key value
            const keyValue = key === 'space' ? ' ' : key;
            const fingerId = this.getFingerForKey(keyValue);
            if (fingerId) {
                this.activateFingerImage(fingerId);
                this.activeFingers.add(fingerId);
            }
        });
        
        // For lesson guidance, keep fingers highlighted persistently (no auto-clear timeout)
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
        window.touchTypingManager = new TouchTypingManager();
        window.touchTypingKeyboardEffects = new TouchTypingKeyboardEffects();
        
        // Test integration after a small delay
        setTimeout(() => {
            if (window.touchTypingKeyboardEffects && 
                window.touchTypingKeyboardEffects.keyboardContainer && 
                window.touchTypingKeyboardEffects.handsWrapper) {
                console.log('🎉 Integration test PASSED: All systems ready!');
            } else {
                console.warn('⚠️ Integration test FAILED: Some elements missing');
            }
        }, 200);

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

