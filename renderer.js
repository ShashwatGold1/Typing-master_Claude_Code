const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Global function to ensure accuracy displays are always correct
function ensureAccuracyDisplays() {
    console.log('=== DEBUG: ensureAccuracyDisplays called ===');

    // Debug: Check what objects are available
    console.log('Available objects:', {
        progressiveLessonSystem: !!window.progressiveLessonSystem,
        lessonData: !!window.lessonData,
        typingConfig: !!window.lessonData?.typingConfig
    });

    // Get current lesson ID from multiple sources for reliability
    let currentLessonId = 1; // Default fallback

    // Try to get from progressive lesson system first
    if (window.progressiveLessonSystem && window.progressiveLessonSystem.currentLesson) {
        currentLessonId = window.progressiveLessonSystem.currentLesson.id || window.progressiveLessonSystem.currentLesson;
        console.log('Got lesson ID from progressiveLessonSystem:', currentLessonId);
    }
    // Fallback to lesson data
    else if (window.lessonData && window.lessonData.currentLesson) {
        currentLessonId = window.lessonData.currentLesson;
        console.log('Got lesson ID from lessonData:', currentLessonId);
    }
    // Check if we can get it from the current lesson object
    else if (window.progressiveLessonSystem && window.progressiveLessonSystem.getCurrentLesson) {
        const currentLesson = window.progressiveLessonSystem.getCurrentLesson();
        if (currentLesson && currentLesson.id) {
            currentLessonId = currentLesson.id;
            console.log('Got lesson ID from getCurrentLesson:', currentLessonId);
        }
    }

    console.log('Final lesson ID:', currentLessonId);

    // Get target accuracy from config progression
    let targetAccuracy = 100; // Default fallback

    // Try to get accuracy from lessonData config
    if (window.lessonData && window.lessonData.getConfigAccuracy) {
        targetAccuracy = window.lessonData.getConfigAccuracy(currentLessonId);
        console.log(`Using config accuracy: ${targetAccuracy}% for character lesson ${currentLessonId}`);
    }
    // Fallback: try to get from lesson object itself
    else if (window.progressiveLessonSystem && window.progressiveLessonSystem.getCurrentLesson) {
        const currentLesson = window.progressiveLessonSystem.getCurrentLesson();
        if (currentLesson && currentLesson.targetAccuracy !== undefined) {
            targetAccuracy = currentLesson.targetAccuracy;
            console.log(`Using lesson accuracy: ${targetAccuracy}% for character lesson ${currentLessonId}`);
        } else {
            console.log(`Using fallback accuracy: ${targetAccuracy}% for character lesson ${currentLessonId}`);
        }
    } else {
        console.log(`Using default accuracy: ${targetAccuracy}% for character lesson ${currentLessonId}`);
    }

    console.log('Final target accuracy:', targetAccuracy);

    // Update both elements - only update if they show wrong values
    const mainDisplay = document.getElementById('target-accuracy-display');
    const popupDisplay = document.getElementById('target-accuracy-display-popup');

    if (mainDisplay) {
        const currentText = mainDisplay.textContent;
        const expectedText = `${targetAccuracy}%`;
        if (currentText !== expectedText && (currentText.includes('--') || currentText === '100%' || currentText !== expectedText)) {
            mainDisplay.textContent = expectedText;
            console.log(`Updated main accuracy display: ${currentText} -> ${expectedText} for lesson ${currentLessonId}`);
        }
    }
    if (popupDisplay) {
        const currentText = popupDisplay.textContent;
        const expectedText = `${targetAccuracy}%`;
        if (currentText !== expectedText && (currentText.includes('--') || currentText === '100%' || currentText !== expectedText)) {
            popupDisplay.textContent = expectedText;
            console.log(`Updated popup accuracy display: ${currentText} -> ${expectedText} for lesson ${currentLessonId}`);
        }
    }
}

// Global typing configuration
let typingConfig = null;

// Load typing configuration
function loadTypingConfig() {
    try {
        const configPath = path.join(__dirname, 'typing-config.json');
        const configData = fs.readFileSync(configPath, 'utf8');
        typingConfig = JSON.parse(configData);
        return typingConfig;
    } catch (error) {
        console.error('Error loading typing configuration:', error);
        // Fallback configuration
        typingConfig = {
            globalSettings: { maxDisplayWPM: null, enableWPMCapping: false },
            wordLessons: { defaultTargetAccuracy: 95 },
            quickTest: { defaultTargetAccuracy: 95, defaultTargetWPM: 40 }
        };
        return typingConfig;
    }
}

// Helper function to get WPM target from configuration
function getConfigWPM(lessonNumber) {
    if (!typingConfig) loadTypingConfig();

    const wpmProgression = typingConfig.characterLessons?.wpmProgression;
    if (wpmProgression && wpmProgression[lessonNumber.toString()]) {
        return wpmProgression[lessonNumber.toString()];
    }
    return 25; // fallback
}

// Helper function to get display WPM (no more capping)
function getDisplayWPM(lesson) {
    // Return actual target WPM without any capping
    return lesson.targetWPM;
}

// Helper function to get accuracy target from configuration
function getConfigAccuracy(lessonNumber, lessonType = 'character') {
    if (!typingConfig) loadTypingConfig();

    if (lessonType === 'character') {
        return 100; // Character lessons always use 100% accuracy
    } else if (lessonType === 'word') {
        return typingConfig.wordLessons?.defaultTargetAccuracy || 95;
    }
    return 95; // fallback
}

// Initialize configuration on load
loadTypingConfig();

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
        // If navigating to games page and a game is running, stop it
        if (page === 'games' && window.typingGames && window.typingGames.currentGame) {
            window.typingGames.exitGame();
        }

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
            // Reset any inline display styles set by games
            if (pageEl.id === 'game-play-page') {
                pageEl.style.display = '';
            }
        });
        document.getElementById(`${page}-page`).classList.add('active');

        this.currentPage = page;

        // Hide "New Text" button for character lessons only
        const newTextBtn = document.getElementById('generate-new-text-btn');
        if (newTextBtn) {
            if (page === 'character-lesson') {
                newTextBtn.style.display = 'none';
            } else {
                newTextBtn.style.display = 'block';
            }
        }

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
            // Don't show TypingTest popups when on character lesson page - let ProgressiveLessonSystem handle it
            const characterLessonPage = document.getElementById('character-lesson-page');
            if (characterLessonPage && characterLessonPage.classList.contains('active')) {
                console.log('TypingTest: Skipping popup on character lesson page - handled by ProgressiveLessonSystem');
                return;
            }
            
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
        // Load typing configuration for word lessons
        this.config = this.loadWordLessonConfig();
        this.lessons = [
            // Foundation - Home Row
            {
                id: 'home-row',
                title: 'Home Row Basics',
                description: 'Learn the foundation keys: A, S, D, F, J, K, L, ;',
                level: 'beginner',
                targetWPM: 15,
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
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
                targetAccuracy: 100,
                unlocked: false,
                icon: '📝',
                text: 'Introduction paragraph should clearly state the main thesis. Supporting paragraphs provide evidence and examples. The conclusion summarizes key points and reinforces the argument.'
            }
        ];

        // Apply configuration values to all lessons
        this.applyConfigurationToLessons();
        this.init();
    }

    // Load word lesson configuration
    loadWordLessonConfig() {
        if (typeof typingConfig !== 'undefined' && typingConfig) {
            return typingConfig;
        }
        // Fallback if config not loaded
        return {
            wordLessons: {
                defaultTargetAccuracy: 95,
                wpmTargets: {
                    'home-row': 15,
                    'home-row-words': 18,
                    'top-row': 20,
                    'numbers': 22,
                    'punctuation': 20,
                    'common-words': 25,
                    'sentences': 25,
                    'paragraphs': 28
                }
            }
        };
    }

    // Apply configuration values to lessons
    applyConfigurationToLessons() {
        console.log('Applying word lesson configuration...');
        console.log('Config:', this.config);
        this.lessons.forEach(lesson => {
            const originalWPM = lesson.targetWPM;
            const originalAccuracy = lesson.targetAccuracy;

            // Apply WPM from config
            if (this.config.wordLessons?.wpmTargets?.[lesson.id]) {
                lesson.targetWPM = this.config.wordLessons.wpmTargets[lesson.id];
            } else {
            }

            // Apply accuracy from config
            lesson.targetAccuracy = this.config.wordLessons?.defaultTargetAccuracy || 95;
        });
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
            // All lessons in the lesson manager use the lesson interface (word-based lessons)
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
            worstWPM: Infinity,
            totalTime: 0,
            totalKeystrokes: 0,
            testHistory: [], // Store last 30 tests
            dailyStats: {}, // Stats by date
            lessonStats: {}, // Stats by lesson type
            gameStats: {}, // Stats by game type
            characterLessonProgress: 0,
            wordLessonProgress: 0,
            achievedMilestones: []
        };
        this.maxHistoryLength = 30;
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
                // Ensure arrays exist
                if (!this.stats.testHistory) this.stats.testHistory = [];
                if (!this.stats.dailyStats) this.stats.dailyStats = {};
                if (!this.stats.lessonStats) this.stats.lessonStats = {};
                if (!this.stats.gameStats) this.stats.gameStats = {};
                if (!this.stats.achievedMilestones) this.stats.achievedMilestones = [];
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
        // Update main statistics overview
        this.updateStatisticsPage();
        this.updateProgressPage();
    }

    updateStatisticsPage() {
        const avgWpmEl = document.getElementById('stat-avg-wpm');
        const avgAccuracyEl = document.getElementById('stat-avg-accuracy');
        const testsCompletedEl = document.getElementById('stat-tests-completed');
        const bestWpmEl = document.getElementById('stat-best-wpm');
        const totalTimeEl = document.getElementById('stat-total-time');
        const totalKeystrokesEl = document.getElementById('stat-total-keystrokes');
        const charLessonProgressEl = document.getElementById('stat-char-lesson-progress');
        const wordLessonProgressEl = document.getElementById('stat-word-lesson-progress');

        if (avgWpmEl) avgWpmEl.textContent = this.stats.averageWPM || 0;
        if (avgAccuracyEl) avgAccuracyEl.textContent = `${this.stats.averageAccuracy || 0}%`;
        if (testsCompletedEl) testsCompletedEl.textContent = this.stats.totalTests || 0;
        if (bestWpmEl) bestWpmEl.textContent = this.stats.bestWPM || 0;

        // Format total time (seconds to hours:minutes)
        if (totalTimeEl) {
            const hours = Math.floor(this.stats.totalTime / 3600);
            const minutes = Math.floor((this.stats.totalTime % 3600) / 60);
            totalTimeEl.textContent = `${hours}h ${minutes}m`;
        }

        if (totalKeystrokesEl) {
            totalKeystrokesEl.textContent = this.formatNumber(this.stats.totalKeystrokes || 0);
        }

        // Update lesson progress
        if (charLessonProgressEl) {
            const charProgress = window.lessonData ?
                Math.round((window.lessonData.maxUnlockedLesson / 104) * 100) : 0;
            charLessonProgressEl.textContent = `${charProgress}%`;
        }

        if (wordLessonProgressEl) {
            const totalWordLessons = window.lessonManager ? window.lessonManager.lessons.length : 12;
            const completedWordLessons = Object.values(this.stats.lessonStats).filter(l => l.completed).length;
            const wordProgress = Math.round((completedWordLessons / totalWordLessons) * 100);
            wordLessonProgressEl.textContent = `${wordProgress}%`;
        }

        // Update charts
        this.updateWPMChart();
        this.updateAccuracyChart();
        this.updateActivityHeatmap();
    }

    updateProgressPage() {
        // Update lesson progress bars
        const charFillEl = document.getElementById('progress-char-fill');
        const charCurrentEl = document.getElementById('progress-char-current');
        const charTotalEl = document.getElementById('progress-char-total');
        const wordFillEl = document.getElementById('progress-word-fill');
        const wordCurrentEl = document.getElementById('progress-word-current');
        const wordTotalEl = document.getElementById('progress-word-total');

        // Character lessons progress
        if (window.lessonData) {
            const completedLessons = window.lessonData.maxUnlockedLesson || 1;
            const totalLessons = 104;
            const percentage = Math.round((completedLessons / totalLessons) * 100);

            if (charFillEl) charFillEl.style.width = `${percentage}%`;
            if (charCurrentEl) charCurrentEl.textContent = completedLessons;
            if (charTotalEl) charTotalEl.textContent = totalLessons;
        }

        // Word lessons progress
        if (window.lessonManager) {
            const totalWordLessons = window.lessonManager.lessons.length;
            const completedLessons = window.lessonManager.lessons.filter(l => l.unlocked).length;
            const percentage = Math.round((completedLessons / totalWordLessons) * 100);

            if (wordFillEl) wordFillEl.style.width = `${percentage}%`;
            if (wordCurrentEl) wordCurrentEl.textContent = completedLessons;
            if (wordTotalEl) wordTotalEl.textContent = totalWordLessons;
        }

        // Update WPM progress chart
        this.updateProgressWPMChart();
        this.updateProgressAccuracyChart();
        this.updateMilestones();
        this.updateRecentActivity();
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    recordTest(wpm, accuracy, timeSpent, testType = 'quick-test', lessonId = null) {
        const now = new Date();
        const dateKey = now.toISOString().split('T')[0]; // YYYY-MM-DD

        this.stats.totalTests++;
        this.stats.totalTime += timeSpent;
        this.stats.totalKeystrokes += Math.round((wpm / 60) * timeSpent * 5); // Estimate keystrokes

        // Update averages
        this.stats.averageWPM = Math.round(
            (this.stats.averageWPM * (this.stats.totalTests - 1) + wpm) / this.stats.totalTests
        );
        this.stats.averageAccuracy = Math.round(
            (this.stats.averageAccuracy * (this.stats.totalTests - 1) + accuracy) / this.stats.totalTests
        );

        // Update best/worst WPM
        if (wpm > this.stats.bestWPM) {
            this.stats.bestWPM = wpm;
        }
        if (wpm < this.stats.worstWPM) {
            this.stats.worstWPM = wpm;
        }

        // Add to test history
        this.stats.testHistory.push({
            timestamp: now.getTime(),
            wpm,
            accuracy,
            timeSpent,
            testType,
            lessonId
        });

        // Keep only last 30 tests
        if (this.stats.testHistory.length > this.maxHistoryLength) {
            this.stats.testHistory.shift();
        }

        // Update daily stats
        if (!this.stats.dailyStats[dateKey]) {
            this.stats.dailyStats[dateKey] = {
                tests: 0,
                totalWPM: 0,
                totalAccuracy: 0,
                totalTime: 0
            };
        }
        this.stats.dailyStats[dateKey].tests++;
        this.stats.dailyStats[dateKey].totalWPM += wpm;
        this.stats.dailyStats[dateKey].totalAccuracy += accuracy;
        this.stats.dailyStats[dateKey].totalTime += timeSpent;

        // Update lesson/game stats
        if (testType && testType !== 'quick-test') {
            if (!this.stats.lessonStats[testType]) {
                this.stats.lessonStats[testType] = {
                    attempts: 0,
                    bestWPM: 0,
                    bestAccuracy: 0,
                    completed: false
                };
            }
            this.stats.lessonStats[testType].attempts++;
            if (wpm > this.stats.lessonStats[testType].bestWPM) {
                this.stats.lessonStats[testType].bestWPM = wpm;
            }
            if (accuracy > this.stats.lessonStats[testType].bestAccuracy) {
                this.stats.lessonStats[testType].bestAccuracy = accuracy;
            }
        }

        // Check for milestones
        this.checkMilestones(wpm, accuracy);

        this.saveStats();
        this.updateDisplay();
    }

    checkMilestones(wpm, accuracy) {
        const milestones = [
            { id: 'first-test', name: 'First Steps', desc: 'Complete your first test', check: () => this.stats.totalTests >= 1 },
            { id: 'wpm-20', name: 'Speed Walker', desc: 'Reach 20 WPM', check: () => wpm >= 20 },
            { id: 'wpm-40', name: 'Speed Runner', desc: 'Reach 40 WPM', check: () => wpm >= 40 },
            { id: 'wpm-60', name: 'Speed Demon', desc: 'Reach 60 WPM', check: () => wpm >= 60 },
            { id: 'wpm-80', name: 'Speed Master', desc: 'Reach 80 WPM', check: () => wpm >= 80 },
            { id: 'wpm-100', name: 'Speed Legend', desc: 'Reach 100 WPM', check: () => wpm >= 100 },
            { id: 'accuracy-95', name: 'Precision Pro', desc: 'Achieve 95% accuracy', check: () => accuracy >= 95 },
            { id: 'accuracy-98', name: 'Accuracy Master', desc: 'Achieve 98% accuracy', check: () => accuracy >= 98 },
            { id: 'tests-10', name: 'Dedicated', desc: 'Complete 10 tests', check: () => this.stats.totalTests >= 10 },
            { id: 'tests-50', name: 'Committed', desc: 'Complete 50 tests', check: () => this.stats.totalTests >= 50 },
            { id: 'tests-100', name: 'Century Club', desc: 'Complete 100 tests', check: () => this.stats.totalTests >= 100 },
        ];

        milestones.forEach(milestone => {
            if (milestone.check() && !this.stats.achievedMilestones.includes(milestone.id)) {
                this.stats.achievedMilestones.push(milestone.id);
                this.showMilestoneNotification(milestone);
            }
        });
    }

    showMilestoneNotification(milestone) {
        // Show a subtle notification for milestone achievement
        console.log(`🏆 Milestone achieved: ${milestone.name} - ${milestone.desc}`);
    }

    updateWPMChart() {
        const canvas = document.getElementById('wpm-history-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth * 2;
        const height = canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        if (this.stats.testHistory.length === 0) {
            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No data yet', width / 4, height / 4);
            return;
        }

        // Draw chart
        const data = this.stats.testHistory.map(t => t.wpm);
        const maxWPM = Math.max(...data, 60);
        const padding = 40;
        const chartWidth = width / 2 - padding * 2;
        const chartHeight = height / 2 - padding * 2;

        // Draw grid lines
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width / 2 - padding, y);
            ctx.stroke();

            // Y-axis labels
            ctx.fillStyle = '#6b7280';
            ctx.font = '10px Inter';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxWPM * (5 - i) / 5), padding - 5, y + 4);
        }

        // Draw line
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        data.forEach((wpm, index) => {
            const x = padding + (chartWidth / (data.length - 1 || 1)) * index;
            const y = padding + chartHeight - (wpm / maxWPM) * chartHeight;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw points
        ctx.fillStyle = '#3b82f6';
        data.forEach((wpm, index) => {
            const x = padding + (chartWidth / (data.length - 1 || 1)) * index;
            const y = padding + chartHeight - (wpm / maxWPM) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    updateAccuracyChart() {
        const canvas = document.getElementById('accuracy-history-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth * 2;
        const height = canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);

        ctx.clearRect(0, 0, width, height);

        if (this.stats.testHistory.length === 0) {
            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No data yet', width / 4, height / 4);
            return;
        }

        const data = this.stats.testHistory.map(t => t.accuracy);
        const padding = 40;
        const chartWidth = width / 2 - padding * 2;
        const chartHeight = height / 2 - padding * 2;

        // Draw grid lines
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width / 2 - padding, y);
            ctx.stroke();

            // Y-axis labels
            ctx.fillStyle = '#6b7280';
            ctx.font = '10px Inter';
            ctx.textAlign = 'right';
            ctx.fillText(`${100 - (i * 20)}%`, padding - 5, y + 4);
        }

        // Draw area chart
        ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
        ctx.beginPath();
        data.forEach((accuracy, index) => {
            const x = padding + (chartWidth / (data.length - 1 || 1)) * index;
            const y = padding + chartHeight - (accuracy / 100) * chartHeight;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.lineTo(width / 2 - padding, padding + chartHeight);
        ctx.lineTo(padding, padding + chartHeight);
        ctx.closePath();
        ctx.fill();

        // Draw line
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        data.forEach((accuracy, index) => {
            const x = padding + (chartWidth / (data.length - 1 || 1)) * index;
            const y = padding + chartHeight - (accuracy / 100) * chartHeight;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    }

    updateActivityHeatmap() {
        const container = document.getElementById('activity-heatmap');
        if (!container) return;

        const today = new Date();
        const days = 84; // 12 weeks
        let html = '<div class="heatmap-grid">';

        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            const dayStats = this.stats.dailyStats[dateKey];
            const tests = dayStats ? dayStats.tests : 0;

            let intensity = 'empty';
            if (tests > 0) intensity = 'low';
            if (tests >= 3) intensity = 'medium';
            if (tests >= 5) intensity = 'high';
            if (tests >= 10) intensity = 'very-high';

            html += `<div class="heatmap-cell ${intensity}" title="${dateKey}: ${tests} tests"></div>`;
        }

        html += '</div>';
        container.innerHTML = html;
    }

    updateProgressWPMChart() {
        const canvas = document.getElementById('progress-wpm-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth * 2;
        const height = canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        if (this.stats.testHistory.length === 0) {
            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No data yet - complete some tests to see your progress!', width / 4, height / 4);
            return;
        }

        // Draw chart
        const data = this.stats.testHistory.map(t => t.wpm);
        const maxWPM = Math.max(...data, 60);
        const padding = 40;
        const chartWidth = width / 2 - padding * 2;
        const chartHeight = height / 2 - padding * 2;

        // Draw grid lines
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width / 2 - padding, y);
            ctx.stroke();

            // Y-axis labels
            ctx.fillStyle = '#6b7280';
            ctx.font = '10px Inter';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxWPM * (5 - i) / 5), padding - 5, y + 4);
        }

        // Draw line
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        data.forEach((wpm, index) => {
            const x = padding + (chartWidth / (data.length - 1 || 1)) * index;
            const y = padding + chartHeight - (wpm / maxWPM) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw points
        ctx.fillStyle = '#3b82f6';
        data.forEach((wpm, index) => {
            const x = padding + (chartWidth / (data.length - 1 || 1)) * index;
            const y = padding + chartHeight - (wpm / maxWPM) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    updateProgressAccuracyChart() {
        const canvas = document.getElementById('progress-accuracy-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width = canvas.offsetWidth * 2;
        const height = canvas.height = canvas.offsetHeight * 2;
        ctx.scale(2, 2);

        ctx.clearRect(0, 0, width, height);

        if (this.stats.testHistory.length === 0) {
            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No data yet - complete some tests to see your progress!', width / 4, height / 4);
            return;
        }

        const data = this.stats.testHistory.map(t => t.accuracy);
        const padding = 40;
        const chartWidth = width / 2 - padding * 2;
        const chartHeight = height / 2 - padding * 2;

        // Draw grid lines
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(width / 2 - padding, y);
            ctx.stroke();

            // Y-axis labels
            ctx.fillStyle = '#6b7280';
            ctx.font = '10px Inter';
            ctx.textAlign = 'right';
            ctx.fillText(`${100 - (i * 20)}%`, padding - 5, y + 4);
        }

        // Draw area chart
        ctx.fillStyle = 'rgba(139, 92, 246, 0.15)';
        ctx.beginPath();
        data.forEach((accuracy, index) => {
            const x = padding + (chartWidth / (data.length - 1 || 1)) * index;
            const y = padding + chartHeight - (accuracy / 100) * chartHeight;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.lineTo(padding + chartWidth, padding + chartHeight);
        ctx.lineTo(padding, padding + chartHeight);
        ctx.closePath();
        ctx.fill();

        // Draw line
        ctx.strokeStyle = '#8b5cf6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        data.forEach((accuracy, index) => {
            const x = padding + (chartWidth / (data.length - 1 || 1)) * index;
            const y = padding + chartHeight - (accuracy / 100) * chartHeight;

            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();

        // Draw points
        ctx.fillStyle = '#8b5cf6';
        data.forEach((accuracy, index) => {
            const x = padding + (chartWidth / (data.length - 1 || 1)) * index;
            const y = padding + chartHeight - (accuracy / 100) * chartHeight;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    updateMilestones() {
        const container = document.getElementById('milestones-container');
        if (!container) return;

        const allMilestones = [
            { id: 'first-test', name: 'First Steps', desc: 'Complete your first test', icon: '🎯' },
            { id: 'wpm-20', name: 'Speed Walker', desc: 'Reach 20 WPM', icon: '🚶' },
            { id: 'wpm-40', name: 'Speed Runner', desc: 'Reach 40 WPM', icon: '🏃' },
            { id: 'wpm-60', name: 'Speed Demon', desc: 'Reach 60 WPM', icon: '⚡' },
            { id: 'wpm-80', name: 'Speed Master', desc: 'Reach 80 WPM', icon: '🔥' },
            { id: 'wpm-100', name: 'Speed Legend', desc: 'Reach 100 WPM', icon: '👑' },
            { id: 'accuracy-95', name: 'Precision Pro', desc: 'Achieve 95% accuracy', icon: '🎯' },
            { id: 'accuracy-98', name: 'Accuracy Master', desc: 'Achieve 98% accuracy', icon: '💎' },
            { id: 'tests-10', name: 'Dedicated', desc: 'Complete 10 tests', icon: '📊' },
            { id: 'tests-50', name: 'Committed', desc: 'Complete 50 tests', icon: '📈' },
            { id: 'tests-100', name: 'Century Club', desc: 'Complete 100 tests', icon: '🏆' },
        ];

        let html = '<div class="milestones-grid">';
        allMilestones.forEach(milestone => {
            const achieved = this.stats.achievedMilestones.includes(milestone.id);
            html += `
                <div class="milestone-card ${achieved ? 'achieved' : 'locked'}">
                    <div class="milestone-icon">${milestone.icon}</div>
                    <div class="milestone-name">${milestone.name}</div>
                    <div class="milestone-desc">${milestone.desc}</div>
                </div>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    updateRecentActivity() {
        const container = document.getElementById('recent-activity-list');
        if (!container) return;

        if (this.stats.testHistory.length === 0) {
            container.innerHTML = '<p class="no-activity">Complete some tests to see your recent activity here!</p>';
            return;
        }

        // Get last 10 tests, reversed (most recent first)
        const recentTests = [...this.stats.testHistory].reverse().slice(0, 10);

        let html = '';
        recentTests.forEach(test => {
            const date = new Date(test.timestamp);
            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

            let testTypeName = 'Quick Test';
            if (test.testType === 'character-lesson') testTypeName = 'Character Lesson';
            else if (test.testType === 'word-lesson') testTypeName = 'Word Lesson';
            else if (test.testType.includes('game')) testTypeName = 'Typing Game';

            html += `
                <div class="activity-item">
                    <div class="activity-item-left">
                        <div class="activity-type">${testTypeName}</div>
                        <div class="activity-date">${dateStr} at ${timeStr}</div>
                    </div>
                    <div class="activity-stats">
                        <div class="activity-stat-item">
                            <span class="activity-stat-value">${test.wpm}</span>
                            <span class="activity-stat-label">WPM</span>
                        </div>
                        <div class="activity-stat-item">
                            <span class="activity-stat-value">${test.accuracy}%</span>
                            <span class="activity-stat-label">ACC</span>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    }

    resetStats() {
        if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
            localStorage.removeItem('typing-master-stats');
            this.stats = {
                totalTests: 0,
                averageWPM: 0,
                averageAccuracy: 0,
                bestWPM: 0,
                worstWPM: Infinity,
                totalTime: 0,
                totalKeystrokes: 0,
                testHistory: [],
                dailyStats: {},
                lessonStats: {},
                gameStats: {},
                characterLessonProgress: 0,
                wordLessonProgress: 0,
                achievedMilestones: []
            };
            this.updateDisplay();
        }
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
        const interactiveElements = document.querySelectorAll('.nav-item, .btn, .lesson-card, .character-lesson-card, .game-card, .stat-card');
        
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
        
        // Set content with better fallback handling
        if (typeof options.content === 'string') {
            this.content.innerHTML = `<p>${options.content}</p>`;
        } else if (options.content) {
            this.content.innerHTML = options.content;
        } else {
            // Enhanced fallback content based on popup type
            let fallbackContent = '<p>Operation completed successfully!</p>';
            if (options.type === 'success') {
                fallbackContent = '<p>Great job! You\'ve completed this successfully!</p>';
            } else if (options.type === 'warning') {
                fallbackContent = '<p>Keep practicing to improve your performance!</p>';
            } else if (options.type === 'info') {
                fallbackContent = '<p>Information displayed.</p>';
            }
            this.content.innerHTML = fallbackContent;
            
            // Log warning for debugging
            console.warn('PopupManager: No content provided, using fallback for type:', options.type);
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
    // Start the accuracy display fixer - debug mode with more frequent checks
    setInterval(() => {
        // Run more frequently for debugging
        ensureAccuracyDisplays();
    }, 2000); // Check every 2 seconds for debug

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
                // Backspace disabled in character lessons for learning purposes
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
        
        // Batch tracking for minimum practice requirement
        this.completedBatches = 0;
        this.minRequiredBatches = 5;
        this.batchCorrectChars = 0; // Track correct chars in current batch only
        this.totalCorrectChars = 0; // Track cumulative correct chars across all batches
        this.totalTypedChars = 0; // Track cumulative typed chars across all batches
        this.currentBatchSequence = ''; // Track current batch typing only
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
            this.batchProgressDisplay = document.getElementById('batch-progress-display');
            
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

            // Update accuracy display immediately when lesson is loaded
            this.updateAccuracyDisplay();
        } else {
            console.error('Failed to load current lesson from lessonData');
        }
    }

    updateAccuracyDisplay() {
        if (!this.currentLesson) return;

        // Get target accuracy for current lesson
        let targetAccuracy = this.currentLesson.targetAccuracy;

        // Character lessons always use 100% accuracy
        if (!targetAccuracy) {
            targetAccuracy = 100;
        }

        // Update both main display and popup display
        const mainDisplay = document.getElementById('target-accuracy-display');
        const popupDisplay = document.getElementById('target-accuracy-display-popup');

        if (mainDisplay) {
            mainDisplay.textContent = `${targetAccuracy}%`;
            console.log(`Set main accuracy display to ${targetAccuracy}% for lesson ${this.currentLesson.id}`);
        }
        if (popupDisplay) {
            popupDisplay.textContent = `${targetAccuracy}%`;
            console.log(`Set popup accuracy display to ${targetAccuracy}% for lesson ${this.currentLesson.id}`);
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
        
        // Update title with batch progress
        this.updateLessonTitleWithProgress();
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
            // Get target accuracy from config directly for reliability
            let targetAccuracy = this.currentLesson?.targetAccuracy;
            if ((targetAccuracy === null || targetAccuracy === undefined) && this.currentLesson?.id && window.lessonData) {
                targetAccuracy = window.lessonData.getConfigAccuracy(this.currentLesson.id);
            }
            // Double-check: if still no value, get from config progression directly
            if (targetAccuracy === null || targetAccuracy === undefined || isNaN(targetAccuracy)) {
                // Try multiple sources for lesson ID
                let lessonId = this.currentLesson?.id;
                if (!lessonId && window.progressiveLessonSystem && window.progressiveLessonSystem.currentLesson) {
                    lessonId = window.progressiveLessonSystem.currentLesson.id || window.progressiveLessonSystem.currentLesson;
                }
                if (!lessonId) {
                    lessonId = window.lessonData?.currentLesson || 1;
                }

                // Character lessons always use 100% accuracy
                targetAccuracy = 100;
                console.log(`Main display: Using fixed accuracy ${targetAccuracy}% for character lesson ${lessonId}`);
            }
            this.targetAccuracyDisplay.textContent = `${targetAccuracy}%`;
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
                if (window.lessonCompletionManager.isRetryMode) {
                    window.lessonCompletionManager.retryLesson();
                } else {
                    window.lessonCompletionManager.continueToNextLesson();
                }
                e.preventDefault();
                return;
            }
            
            // Handle typing
            if (e.key.length === 1) {
                this.handleKeyPress(e.key);
                e.preventDefault();
            } else if (e.key === 'Backspace') {
                // Backspace disabled in character lessons for learning purposes
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
        
        // Add character to current batch sequence and full sequence
        this.currentBatchSequence += key;
        this.typedSequence += key; // Still keep full sequence for other functionality
        this.currentIndex++;
        // Note: totalChars is now calculated in updateCharacterBoxes() to handle batches correctly
        
        // Update visual feedback
        this.updateCharacterBoxes();
        this.updateStats();
        
        // Check if we've completed current batch of 24 characters
        if (this.currentIndex >= displayedLength) {
            this.handleBatchCompletion();
        }
    }
    
    handleBackspace() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            // Note: totalChars is now calculated in updateCharacterBoxes() to handle batches correctly
            this.currentBatchSequence = this.currentBatchSequence.slice(0, -1);
            this.typedSequence = this.typedSequence.slice(0, -1);
            this.updateCharacterBoxes();
            this.updateStats();
        }
    }
    
    updateCharacterBoxes() {
        const boxes = document.querySelectorAll('.char-box');
        this.batchCorrectChars = 0; // Reset current batch counter only
        
        boxes.forEach((box, index) => {
            // Clear previous states
            box.classList.remove('correct', 'incorrect', 'next-key');
            
            if (index < this.currentIndex) {
                // Already typed in current batch
                const typedChar = this.currentBatchSequence[index];
                const expectedChar = box.textContent;
                
                if (typedChar === expectedChar) {
                    box.classList.add('correct');
                    this.batchCorrectChars++;
                } else {
                    box.classList.add('incorrect');
                }
            } else if (index === this.currentIndex) {
                // Current character
                box.classList.add('next-key');
                this.highlightFingerForNextCharacter(box.textContent);
            }
        });
        
        // Update cumulative correct chars (previous batches + current batch)
        this.correctChars = this.totalCorrectChars + this.batchCorrectChars;
        
        // Update cumulative total chars (previous batches + current batch position)  
        this.totalChars = this.totalTypedChars + this.currentIndex;
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
    
    handleBatchCompletion() {
        // Increment completed batches counter
        this.completedBatches++;
        
        // Calculate current stats
        const accuracy = this.totalChars > 0 ? Math.round((this.correctChars / this.totalChars) * 100) : 0;
        const wpm = this.calculateWPM();
        
        // Check if we've met the minimum requirements to potentially complete the lesson
        const requiredMinChars = Math.max(5, Math.floor(this.currentLesson.minChars * 0.5));
        const cappedTargetWPM = this.currentLesson.targetWPM;
        
        const passedAccuracy = accuracy >= this.currentLesson.targetAccuracy;
        const passedWPM = wpm >= cappedTargetWPM;
        const passedMinChars = this.correctChars >= requiredMinChars || 
                              (this.timeElapsed >= 8 && this.correctChars >= 5) ||
                              (this.timeElapsed >= 15 && this.correctChars >= 3);
        
        // NEW: Check minimum batch requirement
        const passedMinBatches = this.completedBatches >= this.minRequiredBatches;
        
        console.log('Batch completion check:', {
            lesson: this.currentLesson.id,
            completedBatches: this.completedBatches,
            minRequiredBatches: this.minRequiredBatches,
            accuracy: accuracy,
            wpm: wpm,
            correctChars: this.correctChars,
            requiredMinChars: requiredMinChars,
            passedAccuracy,
            passedWPM, 
            passedMinChars,
            passedMinBatches,
            canComplete: passedAccuracy && passedWPM && passedMinChars && passedMinBatches
        });
        
        // If minimum batches completed, check lesson completion (show appropriate popup)
        if (passedMinBatches) {
            this.checkLessonCompletion();
        } else {
            // Otherwise, generate new text and continue practicing
            console.log(`Must complete at least ${this.minRequiredBatches} batches. Current: ${this.completedBatches}`);
            this.generateNewTextAndContinue();
        }
    }
    
    generateNewTextAndContinue() {
        console.log('Generating new text to continue practicing...');
        
        // Save current batch stats to cumulative totals before starting new batch
        this.totalCorrectChars += this.batchCorrectChars;
        this.totalTypedChars += this.currentIndex;
        
        console.log('Batch completed - Stats saved:', {
            batchCorrectChars: this.batchCorrectChars,
            batchTotalChars: this.currentIndex,
            cumulativeCorrectChars: this.totalCorrectChars,
            cumulativeTotalChars: this.totalTypedChars,
            completedBatches: this.completedBatches
        });
        
        // Generate new practice text
        this.practiceText = window.lessonData.generatePracticeText(this.currentLesson);
        console.log('New practice text generated:', this.practiceText);
        
        // Reset current batch tracking only (keep cumulative stats)
        this.currentIndex = 0;
        this.batchCorrectChars = 0;
        this.currentBatchSequence = ''; // Reset current batch sequence for new batch
        // Note: Don't reset typedSequence here as it tracks the full session
        
        // Recreate character boxes with new text
        this.createCharacterBoxes();
        
        // Continue the test without resetting cumulative stats
        console.log('Continuing practice with new text batch');
    }
    
    checkLessonCompletion() {
        this.endTest();
        
        // Prevent completion check immediately after reset
        if (this.justReset) {
            console.log('Skipping completion check - lesson was just reset');
            return;
        }
        
        if (!this.currentLesson) {
            console.error('No current lesson to check completion for');
            return;
        }
        
        // Calculate final stats
        const accuracy = this.totalChars > 0 ? Math.round((this.correctChars / this.totalChars) * 100) : 0;
        const wpm = this.calculateWPM();
        
        const requiredMinChars = Math.max(5, Math.floor(this.currentLesson.minChars * 0.5)); // Require 50% of min chars, min 5
        const cappedTargetWPM = this.currentLesson.targetWPM; // Cap WPM at 25 for character lessons
        
        console.log('Lesson completion check:', {
            lesson: this.currentLesson.id,
            accuracy: accuracy,
            targetAccuracy: this.currentLesson.targetAccuracy,
            wpm: wpm,
            originalTargetWPM: this.currentLesson.targetWPM,
            cappedTargetWPM: cappedTargetWPM,
            correctChars: this.correctChars,
            originalMinChars: this.currentLesson.minChars,
            requiredMinChars: requiredMinChars
        });
        
        // Check if lesson requirements are met (strict target validation)
        const passedAccuracy = accuracy >= this.currentLesson.targetAccuracy; // Must meet exact target accuracy
        const passedWPM = wpm >= cappedTargetWPM; // Must meet exact target WPM (capped at 25)
        
        // Require BOTH accuracy AND WPM targets, with flexible character requirements:
        // Pass if character requirement is met through ANY of these conditions:
        // 1. Met the reduced min chars requirement (50% of original, min 5), OR  
        // 2. Practiced for 8+ seconds and typed at least 5 chars, OR
        // 3. Practiced for 15+ seconds and typed at least 3 chars
        const passedMinChars = this.correctChars >= requiredMinChars || 
                              (this.timeElapsed >= 8 && this.correctChars >= 5) ||
                              (this.timeElapsed >= 15 && this.correctChars >= 3);
        
        console.log('Lesson completion results:', {
            passedAccuracy,
            passedWPM,
            passedMinChars,
            wpmRequirement: `${wpm} >= ${cappedTargetWPM} (${passedWPM})`,
            condition1: `${this.correctChars} >= ${requiredMinChars} (${this.correctChars >= requiredMinChars})`,
            condition2: `${this.timeElapsed}s >= 8s && ${this.correctChars} >= 5 (${this.timeElapsed >= 8 && this.correctChars >= 5})`,
            condition3: `${this.timeElapsed}s >= 15s && ${this.correctChars} >= 3 (${this.timeElapsed >= 15 && this.correctChars >= 3})`
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
        console.log('=== LESSON COMPLETION DEBUG ===');
        console.log('Current lesson object:', this.currentLesson);
        console.log('Current lesson targetAccuracy:', this.currentLesson?.targetAccuracy);
        console.log('Lesson completion data:', this.currentLesson ? this.currentLesson.completion : 'No lesson');
        console.log('Performance - Accuracy:', accuracy, '%, WPM:', wpm);
        console.log('Time elapsed:', this.timeElapsed, 'seconds');
        
        if (window.lessonCompletionManager) {
            console.log('LessonCompletionManager found, calling showLessonComplete');
            window.lessonCompletionManager.showLessonComplete(
                this.currentLesson,
                accuracy,
                wpm,
                this.timeElapsed
            );
        } else {
            console.error('ERROR: LessonCompletionManager not found!');
        }
    }
    
    showLessonRetry(accuracy, wpm) {
        
        if (window.lessonCompletionManager) {
            window.lessonCompletionManager.showLessonRetry(
                this.currentLesson,
                accuracy,
                wpm,
                this.timeElapsed
            );
        } else {
            console.error('ERROR: LessonCompletionManager not found!');
        }
        console.log('=== END LESSON RETRY DEBUG ===');
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
        
        // Update batch progress indicator
        if (this.batchProgressDisplay) {
            const currentBatch = this.completedBatches + 1;
            this.batchProgressDisplay.textContent = `${currentBatch}/${this.minRequiredBatches}`;
        }
        
        // Update lesson title with batch progress
        this.updateLessonTitleWithProgress();
        
        // Log batch progress for debugging
        if (this.completedBatches > 0 || this.currentIndex > 0) {
            console.log('Batch Progress:', {
                currentBatch: this.completedBatches + 1,
                minRequired: this.minRequiredBatches,
                currentBatchProgress: `${this.currentIndex}/24`,
                cumulativeStats: `${this.correctChars}/${this.totalChars}`
            });
        }
    }
    
    updateLessonTitleWithProgress() {
        const titleElement = document.getElementById('lesson-title-display');
        if (titleElement && this.currentLesson) {
            const baseTitle = this.currentLesson.title;
            const currentBatch = this.completedBatches + 1;
            const progressTitle = `${baseTitle} - Batch ${currentBatch}/${this.minRequiredBatches}`;
            titleElement.textContent = progressTitle;
        }
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
        
        // Reset all batch tracking for new lesson attempt
        this.completedBatches = 0;
        this.batchCorrectChars = 0;
        this.totalCorrectChars = 0;
        this.totalTypedChars = 0;
        this.currentBatchSequence = '';
        
        // Add flag to prevent immediate completion check after reset
        this.justReset = true;
        setTimeout(() => {
            this.justReset = false;
            console.log('justReset flag cleared - ready for new input');
        }, 1000); // Allow 1 second for user to start typing
        
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
        console.log('=== ADVANCE TO NEXT LESSON DEBUG ===');
        console.log('Current lesson before advance:', window.lessonData.currentLesson);
        console.log('Max lesson:', window.lessonData.maxLesson);
        console.log('Can advance:', window.lessonData.canAdvance());
        
        if (window.lessonData.advanceLesson()) {
            console.log('Successfully advanced to lesson:', window.lessonData.currentLesson);
            console.log('Loading new lesson...');
            
            this.loadCurrentLesson();
            console.log('Lesson loaded, updating UI...');
            
            this.updateLessonUI();
            console.log('UI updated, creating character boxes...');
            
            this.createCharacterBoxes();
            console.log('Character boxes created, resetting test...');
            
            this.resetTest();
            console.log('Test reset complete');
            
            // Add a small delay to ensure UI is fully updated before allowing new input
            setTimeout(() => {
                console.log('New lesson ready for input');
            }, 100);
            
            // Character lessons and word lessons are now completely independent systems
            // No cross-system synchronization to avoid conflicts
            
            // Refresh lesson carousel to show new progress
            if (window.lessonCarousel) {
                console.log('Refreshing lesson carousel...');
                window.lessonCarousel.refresh();
                console.log('Carousel refreshed');
            }
            console.log('=== ADVANCE SUCCESSFUL ===');
            return true;
        } else {
            console.log('Cannot advance - reached end of lessons');
            console.log('=== ADVANCE FAILED ===');
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
        this.retryKeyListener = null;
        this.isRetryMode = false; // Track if showing retry instead of completion
        
        this.init();
    }
    
    init() {
        this.overlay = document.getElementById('lesson-completion-overlay');
        this.popup = document.getElementById('lesson-completion-popup');
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // New character lesson action button
        const actionBtn = document.getElementById('character-lesson-action-btn');
        if (actionBtn) {
            // Remove any existing listeners to avoid duplicates
            actionBtn.replaceWith(actionBtn.cloneNode(true));
            const newActionBtn = document.getElementById('character-lesson-action-btn');
            
            newActionBtn.addEventListener('click', () => {
                console.log('Action button clicked, retry mode:', this.isRetryMode);
                if (this.isRetryMode) {
                    this.retryCurrentLesson();
                } else {
                    this.continueToNextLesson();
                }
            });
            console.log('Character lesson action button event listener attached');
        } else {
            console.error('Character lesson action button not found!');
        }
        
        // Close on overlay click
        if (this.overlay) {
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    if (this.isRetryMode) {
                        this.retryLesson();
                    } else {
                        this.continueToNextLesson();
                    }
                }
            });
        }
    }
    
    showLessonComplete(lesson, accuracy, wpm, timeElapsed) {
        if (!this.overlay || !lesson) return;
        
        // Reset retry mode flag
        this.isRetryMode = false;
        
        // Add success state styling
        this.popup.className = 'lesson-completion-popup success';
        
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
        console.log('Lesson completion object:', lesson ? lesson.completion : 'No lesson provided');
        
        // Enhanced lesson data validation and fallback generation
        const lessonData = this.validateAndEnhanceLessonData(lesson, accuracy, wpm);
        
        // Update message
        const messageEl = document.getElementById('completion-message');
        if (messageEl) {
            messageEl.textContent = lessonData.message;
            console.log('Updated message:', lessonData.message);
        }
        
        // Update keys learned
        const keysLearnedEl = document.getElementById('keys-learned-display');
        if (keysLearnedEl) {
            keysLearnedEl.textContent = lessonData.keysLearned;
        }
        
        // Update final stats
        const finalAccuracyEl = document.getElementById('final-accuracy-display');
        const finalWpmEl = document.getElementById('final-wpm-display');
        const targetWpmEl = document.getElementById('target-wpm-display');
        const targetAccuracyEl = document.getElementById('target-accuracy-display-popup');
        const finalTimeEl = document.getElementById('final-time-display');
        
        if (finalAccuracyEl) finalAccuracyEl.textContent = `${accuracy}`;
        if (finalWpmEl) finalWpmEl.textContent = wpm;
        if (targetWpmEl) targetWpmEl.textContent = getDisplayWPM(lesson);
        if (targetAccuracyEl) {
            // Get target accuracy from config directly for reliability
            let targetAccuracy = lesson?.targetAccuracy;
            if ((targetAccuracy === null || targetAccuracy === undefined) && lesson?.id && window.lessonData) {
                targetAccuracy = window.lessonData.getConfigAccuracy(lesson.id);
            }
            // Double-check: if still no value, get from config progression directly
            if (targetAccuracy === null || targetAccuracy === undefined || isNaN(targetAccuracy)) {
                // Try multiple sources for lesson ID
                let lessonId = lesson?.id;
                if (!lessonId && window.progressiveLessonSystem && window.progressiveLessonSystem.currentLesson) {
                    lessonId = window.progressiveLessonSystem.currentLesson.id || window.progressiveLessonSystem.currentLesson;
                }
                if (!lessonId) {
                    lessonId = window.lessonData?.currentLesson || 1;
                }

                // Character lessons always use 100% accuracy
                targetAccuracy = 100;
                console.log(`Popup display: Using fixed accuracy ${targetAccuracy}% for character lesson ${lessonId}`);
            }
            targetAccuracyEl.textContent = `${targetAccuracy}%`;
        }
        if (finalTimeEl) {
            const minutes = Math.floor(timeElapsed / 60);
            const seconds = timeElapsed % 60;
            finalTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Update next lesson preview with enhanced data
        const nextLessonEl = document.getElementById('next-lesson-preview');
        if (nextLessonEl) {
            nextLessonEl.textContent = lessonData.nextPreview || 'Continue your typing journey!';
        }
        
        // Update overall progress
        const stats = this.getSafeStats();
        const overallProgressEl = document.getElementById('overall-progress-display');
        const completionProgressFillEl = document.getElementById('completion-progress-fill');
        
        if (overallProgressEl) {
            overallProgressEl.textContent = `${stats.percentComplete}%`;
        }
        if (completionProgressFillEl) {
            completionProgressFillEl.style.width = `${stats.percentComplete}%`;
        }
        
        // Update button for success mode
        const actionBtn = document.getElementById('character-lesson-action-btn');
        const btnIcon = actionBtn ? actionBtn.querySelector('.btn-icon') : null;
        const btnText = actionBtn ? actionBtn.querySelector('.btn-text') : null;
        
        if (btnIcon) btnIcon.textContent = '🎉';
        if (btnText) btnText.textContent = 'Continue';
        
        // Update instruction text
        const instructionEl = document.getElementById('action-instruction') || this.popup.querySelector('.action-instruction');
        if (instructionEl) {
            instructionEl.textContent = 'Press ENTER or click the button above';
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
    
    // Enhanced lesson data validation with intelligent fallbacks
    validateAndEnhanceLessonData(lesson, accuracy, wpm) {
        const result = {
            message: '',
            keysLearned: '',
            nextPreview: ''
        };
        
        // Check if lesson has valid completion data
        if (lesson && lesson.completion) {
            result.message = lesson.completion.message || this.generateFallbackMessage(lesson, accuracy, wpm);
            result.keysLearned = Array.isArray(lesson.completion.keysLearned) 
                ? lesson.completion.keysLearned.join(', ')
                : lesson.completion.keysLearned || this.generateFallbackKeysLearned(lesson);
            result.nextPreview = lesson.completion.nextPreview || this.generateNextLessonPreview(lesson.id);
        } else {
            // Generate complete fallback data
            result.message = this.generateFallbackMessage(lesson, accuracy, wpm);
            result.keysLearned = this.generateFallbackKeysLearned(lesson);
            result.nextPreview = this.generateNextLessonPreview(lesson.id);
            
            console.warn('LessonCompletionManager: No completion data found for lesson, using intelligent fallbacks');
        }
        
        return result;
    }
    
    // Success messages for character lessons
    getSuccessMessages() {
        return [
            "Your fingers are learning! Keep building that muscle memory.",
            "Muscle memory is developing nicely. Practice makes it automatic.",
            "You're doing great! Every practice session makes you better.",
            "Skills are growing! You're becoming a better typist daily.",
            "Keep practicing! You're getting better every single session.",
            "Progress made! Your typing abilities are steadily getting stronger.",
            "Foundation built! Now let's refine your speed and precision.",
            "Great work! Consistency is the secret to mastery.",
            "Each keystroke trains your fingers. Keep building those patterns!",
            "Nice effort! Practice is the key to improvement.",
            "Your hands are getting stronger. Muscle memory takes time.",
            "Technique improving! You're developing excellent typing form and rhythm.",
            "Keep going! Your dedication will pay off soon enough.",
            "Skills unlocked! Your typing journey is moving in right direction.",
            "Well done! Keep going to strengthen your technique."
        ];
    }
    
    // Failure messages for character lessons
    getFailureMessages() {
        return [
            "Muscle memory takes time. Keep training those fingers!",
            "Your fingers need more practice to learn patterns.",
            "Don't worry! Every expert was once a beginner.",
            "Keep trying! Progress happens one keystroke at a time.",
            "Learning happens through practice. Let's try again together!",
            "Each attempt teaches your fingers something new today.",
            "Persistence pays off! Let's practice this lesson again.",
            "You're building foundations! Rome wasn't built in a day.",
            "Try again! Practice makes perfect with time and patience.",
            "Keep going! You're learning something new every attempt.",
            "Stay positive! Learning takes patience and consistent practice.",
            "Mistakes are part of learning. Keep practicing patiently!",
            "Your brain is processing new patterns. Give it time.",
            "Each attempt trains your muscles. Keep building memory!",
            "Stay focused! Your dedication will lead to success."
        ];
    }
    
    // Generate enhanced next lesson preview
    generateNextLessonPreview(currentLessonId) {
        // Get lessons from available sources
        let lessons = [];
        if (window.lessonData && window.lessonData.lessonStructure) {
            lessons = window.lessonData.lessonStructure;
        } else if (window.lessonManager && window.lessonManager.lessons) {
            lessons = window.lessonManager.lessons;
        } else if (window.progressiveLesson && window.progressiveLesson.lessons) {
            lessons = window.progressiveLesson.lessons;
        }
        
        if (!lessons.length) return 'Continue your typing journey!';
        
        // Find current lesson index (handle both numeric and string IDs)
        const currentIndex = lessons.findIndex(lesson => lesson.id == currentLessonId);
        if (currentIndex === -1 || currentIndex >= lessons.length - 1) {
            return 'You\'ve completed all typing lessons! 🎉';
        }
        
        // Get next lesson
        const nextLesson = lessons[currentIndex + 1];
        if (!nextLesson) return 'Continue your typing journey!';
        
        // Extract keys from multiple sources
        let nextKeys = [];
        
        // First try completion.keysLearned
        if (nextLesson.completion && nextLesson.completion.keysLearned) {
            if (Array.isArray(nextLesson.completion.keysLearned)) {
                nextKeys = nextLesson.completion.keysLearned;
            } else if (typeof nextLesson.completion.keysLearned === 'string') {
                nextKeys = [nextLesson.completion.keysLearned];
            }
        }
        
        // Try lesson.keys array (from lesson-data.js format)
        if (!nextKeys.length && nextLesson.keys && Array.isArray(nextLesson.keys)) {
            nextKeys = nextLesson.keys.map(key => key === ' ' ? 'Space' : key.toUpperCase());
        }
        
        // Extract keys from lesson title as fallback
        if (!nextKeys.length && nextLesson.title) {
            const keyMatches = nextLesson.title.match(/([A-Z0-9\&\-\;\,\.\'\\/\[\]\\\\\\`\(\)\{\}\<\>\|\^\~\@\#\$\%\*\+\=]+)/g);
            if (keyMatches) {
                nextKeys = keyMatches.slice(-5); // Take last 5 key groups
            }
        }
        
        // Get target information
        const targetWPM = nextLesson.targetWPM ? nextLesson.targetWPM : 'TBD';
        const targetAccuracy = nextLesson.targetAccuracy || 'TBD';
        
        // Format the preview message with targets first, then keys
        if (nextKeys.length > 0) {
            const keyList = nextKeys.join(', ');
            return `Target: ${targetAccuracy}% accuracy, ${targetWPM} WPM | Next lesson keys: ${keyList}`;
        } else {
            // Fallback with just targets
            return `Target: ${targetAccuracy}% accuracy, ${targetWPM} WPM | Next: ${nextLesson.title || 'Continue your journey'}`;
        }
    }
    
    // Generate contextual fallback messages based on performance
    generateFallbackMessage(lesson, accuracy, wpm) {
        const successMessages = this.getSuccessMessages();
        const randomIndex = Math.floor(Math.random() * successMessages.length);
        return successMessages[randomIndex];
    }
    
    // Generate fallback keys learned text
    generateFallbackKeysLearned(lesson) {
        if (lesson && lesson.keys) {
            return Array.isArray(lesson.keys) ? lesson.keys.join(', ') : lesson.keys;
        }
        if (lesson && lesson.title) {
            // Extract keys from common lesson title patterns
            const keyMatch = lesson.title.match(/([A-Z0-9\&\-\;\,\.\'\\/\[\]\\\\\\`]+)/g);
            if (keyMatch) {
                return keyMatch.slice(-2).join(', '); // Take last 2 key groups from title
            }
        }
        return 'New Typing Skills';
    }
    
    // Safe stats getter with fallbacks
    getSafeStats() {
        try {
            if (window.lessonData && typeof window.lessonData.getLessonStats === 'function') {
                return window.lessonData.getLessonStats();
            }
        } catch (error) {
            console.warn('Error getting lesson stats:', error);
        }
        
        // Fallback stats
        return {
            percentComplete: 0,
            lessonsCompleted: 0,
            totalLessons: 41
        };
    }
    
    addCompletionKeyListener() {
        this.completionKeyListener = (e) => {
            if (e.key === 'Enter') {
                console.log('Enter key pressed for lesson completion');
                this.continueToNextLesson();
                e.preventDefault();
            }
        };
        document.addEventListener('keydown', this.completionKeyListener);
        console.log('Completion key listener added');
    }
    
    removeCompletionKeyListener() {
        if (this.completionKeyListener) {
            document.removeEventListener('keydown', this.completionKeyListener);
            this.completionKeyListener = null;
        }
    }
    
    addRetryKeyListener() {
        this.retryKeyListener = (e) => {
            if (e.key === 'Enter') {
                this.retryCurrentLesson();
                e.preventDefault();
            }
        };
        document.addEventListener('keydown', this.retryKeyListener);
    }
    
    removeRetryKeyListener() {
        if (this.retryKeyListener) {
            document.removeEventListener('keydown', this.retryKeyListener);
            this.retryKeyListener = null;
        }
    }
    
    continueToNextLesson() {
        console.log('=== CONTINUE TO NEXT LESSON DEBUG ===');
        console.log('Popup visible:', this.isVisible);
        console.log('Retry mode:', this.isRetryMode);
        console.log('Progressive lesson exists:', !!window.progressiveLesson);
        
        if (!this.isVisible) {
            console.log('Popup not visible, returning early');
            return;
        }
        
        this.hide();
        
        // Reset any retry mode flag (should not be set for successful lessons)
        this.isRetryMode = false;
        
        // Advance to next lesson (only called for successful completions)
        if (window.progressiveLesson) {
            console.log('Calling advanceToNextLesson...');
            const result = window.progressiveLesson.advanceToNextLesson();
            console.log('Advance result:', result);
        } else {
            console.error('ERROR: window.progressiveLesson not found!');
        }
        console.log('=== END CONTINUE TO NEXT LESSON DEBUG ===');
    }
    
    retryLesson() {
        if (!this.isVisible) return;
        
        this.hide();
        
        // Reset current lesson
        if (window.progressiveLesson) {
            window.progressiveLesson.resetTest();
        }
    }
    
    retryCurrentLesson() {
        if (!this.isVisible) return;
        
        this.hide();
        
        // Explicitly reset retry mode to prevent any advancement
        this.isRetryMode = false;
        
        // Reset current lesson without advancing
        if (window.progressiveLesson) {
            window.progressiveLesson.resetTest();
        }
    }

    showLessonRetry(lesson, accuracy, wpm, timeElapsed) {
        if (!this.overlay || !lesson) return;
        
        // Set retry mode flag
        this.isRetryMode = true;
        
        // Add retry state styling
        this.popup.className = 'lesson-completion-popup retry';
        
        // Update content for retry scenario
        this.updateRetryContent(lesson, accuracy, wpm, timeElapsed);
        
        // Show overlay
        this.overlay.classList.add('show');
        this.isVisible = true;
        
        // Add keyboard listener for Enter key (retry handler)
        this.addRetryKeyListener();
        
        // Add completion animation to body
        document.body.classList.add('completion-active');
    }

    updateRetryContent(lesson, accuracy, wpm, timeElapsed) {
        // Update header for retry
        const headerEl = this.popup.querySelector('.completion-header h2');
        if (headerEl) {
            headerEl.textContent = 'Keep Practicing!';
        }
        
        const iconEl = this.popup.querySelector('.completion-icon');
        if (iconEl) {
            iconEl.textContent = '💪';
        }
        
        // Update message for retry
        const messageEl = document.getElementById('completion-message');
        if (messageEl) {
            const failureMessages = this.getFailureMessages();
            const randomIndex = Math.floor(Math.random() * failureMessages.length);
            const retryMessage = failureMessages[randomIndex];
            messageEl.textContent = retryMessage;
        }
        
        // Update final stats with current performance
        const finalAccuracyEl = document.getElementById('final-accuracy-display');
        const finalWpmEl = document.getElementById('final-wpm-display');
        const targetWpmEl = document.getElementById('target-wpm-display');
        const finalTimeEl = document.getElementById('final-time-display');
        
        if (finalAccuracyEl) finalAccuracyEl.textContent = `${accuracy}`;
        if (finalWpmEl) finalWpmEl.textContent = wpm;
        if (targetWpmEl) targetWpmEl.textContent = getDisplayWPM(lesson);
        if (finalTimeEl) {
            const minutes = Math.floor(timeElapsed / 60);
            const seconds = timeElapsed % 60;
            finalTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // Update progress display
        if (window.lessonData) {
            const stats = window.lessonData.getLessonStats();
            const progressDisplayEl = document.getElementById('overall-progress-display');
            const progressFillEl = document.getElementById('completion-progress-fill');
            
            if (progressDisplayEl) {
                progressDisplayEl.textContent = `${stats.percentComplete}%`;
            }
            if (progressFillEl) {
                progressFillEl.style.width = `${stats.percentComplete}%`;
            }
        }
        
        // Update next lesson preview for retry - show "Try again current lesson"
        const nextLessonEl = document.getElementById('next-lesson-preview');
        if (nextLessonEl) {
            nextLessonEl.textContent = 'Try again current lesson';
        }
        
        // Update button for retry mode  
        const actionBtn = document.getElementById('character-lesson-action-btn');
        const btnIcon = actionBtn ? actionBtn.querySelector('.btn-icon') : null;
        const btnText = actionBtn ? actionBtn.querySelector('.btn-text') : null;
        
        if (btnIcon) btnIcon.textContent = '💪';
        if (btnText) btnText.textContent = 'Try Again';
        
        // Update instruction text for retry
        const instructionEl = document.querySelector('.action-instruction');
        if (instructionEl) {
            instructionEl.textContent = 'Let\'s practice more! Press ENTER or click above';
        }
    }
    
    hide() {
        if (!this.overlay) return;
        
        this.overlay.classList.remove('show');
        this.isVisible = false;
        
        // Remove keyboard listeners
        this.removeCompletionKeyListener();
        this.removeRetryKeyListener();
        
        // Remove completion animation from body
        document.body.classList.remove('completion-active');
        
        // Reset popup state classes
        if (this.popup) {
            this.popup.className = 'lesson-completion-popup';
        }
        
        // Reset retry mode when hiding
        this.isRetryMode = false;
    }
    
    isShowing() {
        return this.isVisible;
    }
    
    // Fallback method in case lessonCompletionEnhancements.js doesn't load
    validateAndEnhanceLessonData(lesson, accuracy, wpm) {
        const result = {
            message: '',
            keysLearned: '',
            nextPreview: ''
        };
        
        // Check if lesson has valid completion data
        if (lesson && lesson.completion) {
            result.message = lesson.completion.message || this.generateFallbackMessage(lesson, accuracy, wpm);
            result.keysLearned = Array.isArray(lesson.completion.keysLearned) 
                ? lesson.completion.keysLearned.join(', ')
                : lesson.completion.keysLearned || this.generateFallbackKeysLearned(lesson);
            result.nextPreview = lesson.completion.nextPreview || this.generateNextLessonPreview(lesson.id);
        } else {
            // Generate complete fallback data
            result.message = this.generateFallbackMessage(lesson, accuracy, wpm);
            result.keysLearned = this.generateFallbackKeysLearned(lesson);
            result.nextPreview = this.generateNextLessonPreview(lesson.id);
            
            console.warn('LessonCompletionManager: No completion data found for lesson, using fallbacks');
        }
        
        return result;
    }
    
    // Generate contextual fallback messages based on performance
    generateFallbackMessage(lesson, accuracy, wpm) {
        const successMessages = this.getSuccessMessages();
        const randomIndex = Math.floor(Math.random() * successMessages.length);
        return successMessages[randomIndex];
    }
    
    // Generate fallback keys learned text
    generateFallbackKeysLearned(lesson) {
        if (lesson && lesson.keys) {
            return Array.isArray(lesson.keys) ? lesson.keys.join(', ').toUpperCase() : lesson.keys.toUpperCase();
        }
        if (lesson && lesson.title) {
            // Extract keys from common lesson title patterns
            const keyMatch = lesson.title.match(/([A-Z0-9\&\-\;\,\.\'\\/\[\]\\\\\\`]+)/g);
            if (keyMatch) {
                return keyMatch.slice(-2).join(', '); // Take last 2 key groups from title
            }
        }
        return 'New Typing Skills';
    }
    
    // Safe stats getter with fallbacks
    getSafeStats() {
        try {
            if (window.lessonData && typeof window.lessonData.getLessonStats === 'function') {
                return window.lessonData.getLessonStats();
            }
        } catch (error) {
            console.warn('Error getting lesson stats:', error);
        }
        
        // Fallback stats
        return {
            percentComplete: 0,
            lessonsCompleted: 0,
            totalLessons: 41
        };
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
        
        // Monitor for numpad requirement based on lesson content only
        this.monitorLessonNumpadRequirement();
    }
    
    monitorLessonNumpadRequirement() {
        // Check if current practice sequence requires numpad based on lesson flag only
        this.numpadCheckInterval = setInterval(() => {
            const wordLesson = window.wordLesson;
            if (wordLesson) {
                // Use the explicit numpad flag from WordLesson
                const shouldShowNumpad = wordLesson.isNumpadSequence;
                this.toggleKeyboardSection('hide-numpad', shouldShowNumpad);
            }
        }, 500); // Check every 500ms
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
        card.className = 'character-lesson-card';
        card.dataset.lesson = lessonNumber;

        // Determine card status using max unlocked lesson
        const maxUnlocked = window.lessonData?.maxUnlockedLesson || 1;
        const current = window.lessonData?.currentLesson || 1;
        
        if (lessonNumber < current && lessonNumber <= maxUnlocked) {
            card.classList.add('completed');
        } else if (lessonNumber === current) {
            card.classList.add('current');
        } else if (lessonNumber <= maxUnlocked) {
            card.classList.add('available'); // Unlocked but not current
        } else {
            card.classList.add('locked');
        }

        // Get lesson keys for display
        const lessonKeys = lesson.keys ? lesson.keys.slice(0, 6).join(' ') : '';
        const moreKeys = lesson.keys && lesson.keys.length > 6 ? ` +${lesson.keys.length - 6}` : '';

        // Get WPM from config for this specific lesson
        let wpmTarget = 20; // fallback
        if (window.lessonData && window.lessonData.getConfigWPM) {
            wpmTarget = window.lessonData.getConfigWPM(lessonNumber);
        }

        card.innerHTML = `
            <div class="lesson-status"></div>
            <div class="lesson-number">${lessonNumber}</div>
            <div class="lesson-title">${lesson.title}</div>
            <div class="lesson-meta">
                <div class="lesson-phase">${lesson.phase}</div>
                <div class="lesson-target">${wpmTarget} WPM</div>
            </div>
            <div class="lesson-keys">${lessonKeys}${moreKeys}</div>
        `;

        // Add click handler for navigation (only for unlocked lessons)
        if (lessonNumber <= maxUnlocked) {
            const handler = () => this.selectLesson(lessonNumber);
            card.addEventListener('click', handler);
            card._clickHandler = handler; // Store reference for cleanup
        }

        return card;
    }

    selectLesson(lessonNumber) {
        // Check if lesson is unlocked using the new method
        if (!window.lessonData.isLessonUnlocked(lessonNumber)) return;

        // Set current lesson for practice (doesn't affect max unlocked)
        window.lessonData.setCurrentLessonForPractice(lessonNumber);

        // Update progressive lesson system
        if (window.progressiveLesson) {
            window.progressiveLesson.loadCurrentLesson();
            window.progressiveLesson.updateLessonUI();
            window.progressiveLesson.createCharacterBoxes();
            window.progressiveLesson.resetTest();
        }

        // Update carousel - use lesson data's current lesson
        this.currentLesson = window.lessonData.currentLesson;
        this.updateCarousel();
    }

    updateCarousel() {
        // Update card states using the new progress system
        const cards = this.cardsContainer.querySelectorAll('.character-lesson-card');
        const maxUnlocked = window.lessonData?.maxUnlockedLesson || 1;
        const current = window.lessonData?.currentLesson || 1;
        
        cards.forEach((card, index) => {
            const lessonNum = index + 1;
            card.className = 'character-lesson-card';
            
            // Update visual state
            if (lessonNum < current && lessonNum <= maxUnlocked) {
                card.classList.add('completed');
            } else if (lessonNum === current) {
                card.classList.add('current');
            } else if (lessonNum <= maxUnlocked) {
                card.classList.add('available'); // Unlocked but not current
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
        const currentCard = this.cardsContainer.querySelector('.character-lesson-card.current');
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

    // Method to refresh click handlers for all cards
    refreshClickHandlers() {
        const cards = this.cardsContainer.querySelectorAll('.character-lesson-card');
        const maxUnlocked = window.lessonData?.maxUnlockedLesson || 1;
        
        cards.forEach((card, index) => {
            const lessonNum = index + 1;
            
            // Remove existing handler
            const existingHandler = card._clickHandler;
            if (existingHandler) {
                card.removeEventListener('click', existingHandler);
                card._clickHandler = null;
            }
            
            // Add handler if lesson is unlocked
            if (lessonNum <= maxUnlocked) {
                const handler = () => this.selectLesson(lessonNum);
                card.addEventListener('click', handler);
                card._clickHandler = handler;
            }
        });
    }

    // Public method to refresh carousel when lesson advances
    refresh() {
        this.currentLesson = window.lessonData?.currentLesson || 1;
        // Update visual states and click handlers
        this.updateCarousel();
        // Ensure click handlers are properly set for newly unlocked lessons
        this.refreshClickHandlers();
    }
}

// ==================== TYPING GAMES SYSTEM ====================
class TypingGamesManager {
    constructor() {
        this.currentGame = null;
        this.gameInstances = {};
        this.initializeGames();
    }

    initializeGames() {
        // Add event listeners to game cards
        document.querySelectorAll('.game-start-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const gameType = btn.dataset.game;
                this.startGame(gameType);
            });
        });

        // Back button
        const backBtn = document.getElementById('game-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => this.exitGame());
        }

        // Game controls
        const pauseBtn = document.getElementById('game-pause-btn');
        const restartBtn = document.getElementById('game-restart-btn');
        const backToGamesBtn = document.getElementById('back-to-games-btn');

        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.pauseGame());
        }

        if (restartBtn) {
            restartBtn.addEventListener('click', () => this.restartGame());
        }

        if (backToGamesBtn) {
            backToGamesBtn.addEventListener('click', () => {
                this.exitGame();
            });
        }
    }

    startGame(gameType) {
        this.currentGame = gameType;

        // Hide games page, show game play page
        document.getElementById('games-page').style.display = 'none';
        document.getElementById('game-play-page').style.display = 'block';

        // Update game title
        const titles = {
            'word-blaster': 'Word Blaster',
            'speed-racer': 'Speed Racer',
            'zombie-typer': 'Zombie Typer',
            'letter-storm': 'Letter Storm'
        };

        document.getElementById('game-play-title').textContent = titles[gameType] || 'Game';

        // Initialize specific game
        if (!this.gameInstances[gameType]) {
            switch(gameType) {
                case 'word-blaster':
                    this.gameInstances[gameType] = new WordBlasterGame();
                    break;
                case 'speed-racer':
                    this.gameInstances[gameType] = new SpeedRacerGame();
                    break;
                case 'zombie-typer':
                    this.gameInstances[gameType] = new ZombieTyperGame();
                    break;
                case 'letter-storm':
                    this.gameInstances[gameType] = new LetterStormGame();
                    break;
            }
        }

        this.gameInstances[gameType].start();
    }

    pauseGame() {
        if (this.currentGame && this.gameInstances[this.currentGame]) {
            this.gameInstances[this.currentGame].pause();
        }
    }

    restartGame() {
        if (this.currentGame && this.gameInstances[this.currentGame]) {
            this.gameInstances[this.currentGame].restart();
        }
    }

    exitGame() {
        if (this.currentGame && this.gameInstances[this.currentGame]) {
            this.gameInstances[this.currentGame].stop();
        }

        document.getElementById('game-play-page').style.display = 'none';
        document.getElementById('games-page').style.display = 'block';
        this.currentGame = null;
    }
}

// Base Game Class
class BaseGame {
    constructor() {
        this.score = 0;
        this.lives = 3;
        this.time = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.canvas = document.getElementById('game-canvas');
        this.input = document.getElementById('game-input');
        this.scoreElement = document.getElementById('game-score');
        this.livesElement = document.getElementById('game-lives');
        this.timeElement = document.getElementById('game-time');
        this.words = this.getGameWords();
    }

    getGameWords() {
        return ['type', 'fast', 'quick', 'speed', 'word', 'game', 'blast', 'power', 'skill', 'focus',
                'react', 'think', 'learn', 'master', 'level', 'score', 'combo', 'bonus', 'super', 'mega'];
    }

    updateUI() {
        this.scoreElement.textContent = this.score;
        this.livesElement.textContent = this.lives > 0 ? '❤️'.repeat(this.lives) : '💀';
        this.timeElement.textContent = this.time + 's';
    }

    start() {
        this.score = 0;
        this.lives = 3;
        this.time = 0;
        this.isRunning = true;
        this.isPaused = false;
        this.canvas.innerHTML = '';
        this.input.value = '';
        this.input.focus();
        this.updateUI();
        this.gameLoop();
    }

    pause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('game-pause-btn');
        if (pauseBtn) {
            pauseBtn.textContent = this.isPaused ? 'Resume' : 'Pause';
        }

        // Pause/resume word animations
        if (this.isPaused) {
            this.pauseStartTime = Date.now();
            const fallingWords = this.canvas.querySelectorAll('.falling-word');
            fallingWords.forEach(word => {
                word.style.animationPlayState = 'paused';
            });

            // Clear all word removal timeouts
            if (this.fallingWords) {
                this.fallingWords.forEach(wordData => {
                    if (wordData.timeout) {
                        clearTimeout(wordData.timeout);
                    }
                });
            }

            // Show pause overlay
            this.showPauseOverlay();
        } else {
            // Track total paused time
            if (this.pauseStartTime) {
                this.totalPausedTime += Date.now() - this.pauseStartTime;
            }

            const fallingWords = this.canvas.querySelectorAll('.falling-word');
            fallingWords.forEach(word => {
                word.style.animationPlayState = 'running';
            });

            // Reschedule all word removals
            if (this.fallingWords) {
                this.fallingWords.forEach(wordData => {
                    this.scheduleWordRemoval(wordData);
                });
            }

            // Hide pause overlay
            this.hidePauseOverlay();
        }
    }

    showPauseOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'game-paused-overlay';
        overlay.innerHTML = `
            <div class="game-paused-message">
                <h2>PAUSED</h2>
                <p>Press Resume to continue</p>
            </div>
        `;
        this.canvas.appendChild(overlay);
    }

    hidePauseOverlay() {
        const overlay = this.canvas.querySelector('.game-paused-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    restart() {
        this.stop();
        this.start();
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        this.canvas.innerHTML = '';
    }

    gameLoop() {
        // Override in child classes
    }
}

// Word Blaster Game
class WordBlasterGame extends BaseGame {
    constructor() {
        super();
        this.fallingWords = [];
        this.wordSpeed = 10000;
        this.baseWordSpeed = 10000;
        this.speedIncreaseMultiplier = 0.08; // Start with 8% speed increase
        this.pauseStartTime = 0;
        this.totalPausedTime = 0;
    }

    get spawnInterval() {
        // Spawn interval adjusted to reduce words by 35% (0.20 / 0.65 ≈ 0.31)
        return this.wordSpeed * 0.31;
    }

    start() {
        super.start();
        this.pauseStartTime = 0;
        this.totalPausedTime = 0;
        this.setupInputListener();
        this.startSpawning();
        this.startTimer();
    }

    setupInputListener() {
        this.inputHandler = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (!this.isPaused) {
                    this.checkWord();
                }
                return false;
            }
        };
        this.input.addEventListener('keydown', this.inputHandler);
    }

    startSpawning() {
        this.spawnWord();
        const spawnNextWord = () => {
            if (!this.isPaused && this.isRunning) {
                this.spawnWord();
            }
            if (this.isRunning) {
                this.spawnTimer = setTimeout(spawnNextWord, this.spawnInterval);
            }
        };
        this.spawnTimer = setTimeout(spawnNextWord, this.spawnInterval);
    }

    startTimer() {
        this.timeTimer = setInterval(() => {
            if (!this.isPaused && this.isRunning) {
                this.time++;
                this.updateUI();
                // Increase speed every 10 seconds with progressive decay
                if (this.time % 10 === 0) {
                    // Reduce duration by current multiplier (speeds up the game)
                    this.wordSpeed = Math.max(2000, this.wordSpeed * (1 - this.speedIncreaseMultiplier));
                    // Decay the multiplier for next time (10% -> 9% -> 8.1% etc.)
                    this.speedIncreaseMultiplier = this.speedIncreaseMultiplier * 0.9;
                }
            }
        }, 1000);
    }

    spawnWord() {
        const word = this.words[Math.floor(Math.random() * this.words.length)];
        const wordElement = document.createElement('div');
        wordElement.className = 'falling-word';
        wordElement.textContent = word;

        // Calculate spawn position avoiding 10% margins on both sides
        const canvasWidth = this.canvas.offsetWidth;
        const margin = canvasWidth * 0.1;
        const spawnWidth = canvasWidth - (2 * margin) - 100; // 100px for word width
        const leftPosition = margin + (Math.random() * spawnWidth);

        wordElement.style.left = leftPosition + 'px';
        wordElement.style.animationDuration = this.wordSpeed + 'ms';

        this.canvas.appendChild(wordElement);

        const spawnTime = Date.now();
        const wordData = {
            element: wordElement,
            word: word,
            spawnTime: spawnTime,
            timeout: null
        };

        this.fallingWords.push(wordData);

        this.scheduleWordRemoval(wordData);
    }

    scheduleWordRemoval(wordData) {
        const elapsedTime = Date.now() - wordData.spawnTime;
        const remainingTime = Math.max(0, this.wordSpeed - elapsedTime);

        wordData.timeout = setTimeout(() => {
            // Check if word still exists in the array and hasn't been typed
            const stillExists = this.fallingWords.includes(wordData);
            if (!this.isPaused && stillExists && wordData.element.parentElement) {
                this.lives--;
                this.updateUI();
                wordData.element.remove();
                this.fallingWords = this.fallingWords.filter(w => w !== wordData);

                if (this.lives <= 0) {
                    this.gameOver();
                }
            } else if (this.isPaused && stillExists) {
                // If paused when timeout fires, reschedule
                this.scheduleWordRemoval(wordData);
            }
        }, remainingTime);
    }

    checkWord() {
        const typedWord = this.input.value.trim().toLowerCase();

        // Clear input immediately
        this.input.value = '';

        const matchIndex = this.fallingWords.findIndex(w => w.word === typedWord);
        if (matchIndex !== -1) {
            const matched = this.fallingWords[matchIndex];

            // Clear the timeout to prevent duplicate spawning
            if (matched.timeout) {
                clearTimeout(matched.timeout);
            }

            matched.element.remove();
            this.score += 10;
            this.updateUI();

            this.fallingWords.splice(matchIndex, 1);
        }
    }

    gameOver() {
        this.stop();
        if (this.spawnTimer) clearTimeout(this.spawnTimer);
        if (this.timeTimer) clearInterval(this.timeTimer);
        this.canvas.innerHTML = `
            <div style="text-align: center; width: 100%;">
                <h2 style="font-size: 42px; font-weight: 700; color: #2563eb; margin-bottom: 24px;">Game Over!</h2>
                <p style="font-size: 28px; font-weight: 600; color: #111827; margin-bottom: 12px;">Final Score: ${this.score}</p>
                <p style="font-size: 20px; color: #6b7280;">Time Survived: ${this.time}s</p>
            </div>
        `;
    }

    stop() {
        super.stop();
        if (this.spawnTimer) clearTimeout(this.spawnTimer);
        if (this.timeTimer) clearInterval(this.timeTimer);

        // Clear all word removal timeouts
        if (this.fallingWords) {
            this.fallingWords.forEach(wordData => {
                if (wordData.timeout) {
                    clearTimeout(wordData.timeout);
                }
            });
        }

        this.fallingWords = [];
    }
}

// Speed Racer Game
class SpeedRacerGame extends BaseGame {
    constructor() {
        super();
        this.timeLimit = 60;
        this.wordsTyped = 0;
        this.currentWord = '';
    }

    start() {
        super.start();
        this.wordsTyped = 0;
        this.time = this.timeLimit;
        this.updateUI();
        this.showNextWord();
        this.setupInputListener();
        this.startCountdown();
    }

    showNextWord() {
        this.currentWord = this.words[Math.floor(Math.random() * this.words.length)];
        this.canvas.innerHTML = `
            <div style="text-align: center; width: 100%;">
                <div style="font-size: 52px; font-weight: 700; color: #2563eb; margin-bottom: 32px; letter-spacing: 2px;">${this.currentWord}</div>
                <div style="font-size: 20px; color: #6b7280; font-weight: 500;">Words typed: <span style="color: #111827; font-weight: 600;">${this.wordsTyped}</span></div>
            </div>
        `;
        // Re-add pause overlay if game is paused
        if (this.isPaused) {
            this.showPauseOverlay();
        }
    }

    setupInputListener() {
        this.inputHandler = (e) => {
            if (e.key === 'Enter' && !this.isPaused) {
                this.checkWord();
            }
        };
        this.input.addEventListener('keydown', this.inputHandler);
    }

    checkWord() {
        const typedWord = this.input.value.trim().toLowerCase();

        if (typedWord === this.currentWord) {
            this.wordsTyped++;
            this.score += 15;
            this.updateUI();
            this.showNextWord();
        }
        this.input.value = '';
    }

    startCountdown() {
        this.countdown = setInterval(() => {
            if (!this.isPaused && this.isRunning) {
                this.time--;
                this.updateUI();

                if (this.time <= 0) {
                    this.gameOver();
                }
            }
        }, 1000);
    }

    gameOver() {
        this.stop();
        clearInterval(this.countdown);
        const wpm = Math.round((this.wordsTyped / 60) * 60);
        this.canvas.innerHTML = `
            <div style="text-align: center; width: 100%;">
                <h2 style="font-size: 42px; font-weight: 700; color: #0ea5e9; margin-bottom: 24px;">Time's Up!</h2>
                <p style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 12px;">Words Typed: <span style="color: #0ea5e9;">${this.wordsTyped}</span></p>
                <p style="font-size: 22px; font-weight: 600; color: #111827; margin-bottom: 12px;">WPM: <span style="color: #0ea5e9;">${wpm}</span></p>
                <p style="font-size: 20px; color: #6b7280;">Final Score: ${this.score}</p>
            </div>
        `;
    }

    stop() {
        super.stop();
        if (this.countdown) clearInterval(this.countdown);
        this.input.removeEventListener('keydown', this.inputHandler);
    }
}

// Zombie Typer Game
class ZombieTyperGame extends BaseGame {
    constructor() {
        super();
        this.level = 1;
        this.zombies = [];
        this.spawnRate = 3000;
    }

    start() {
        super.start();
        this.setupInputListener();
        this.startSpawning();
        this.renderGame();
    }

    setupInputListener() {
        this.inputHandler = (e) => {
            if (e.key === 'Enter' && !this.isPaused) {
                this.checkWord();
            }
        };
        this.input.addEventListener('keydown', this.inputHandler);
    }

    startSpawning() {
        this.spawnZombie();
        this.spawnTimer = setInterval(() => {
            if (!this.isPaused && this.isRunning) {
                this.spawnZombie();
            }
        }, this.spawnRate);
    }

    spawnZombie() {
        const word = this.words[Math.floor(Math.random() * this.words.length)];
        this.zombies.push({ word, health: 1 });
        this.renderGame();
    }

    renderGame() {
        this.canvas.innerHTML = `
            <div style="width: 100%;">
                <div style="text-align: center; margin-bottom: 32px;">
                    <h3 style="font-size: 28px; font-weight: 700; color: #10b981;">Level ${this.level}</h3>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; padding: 0 20px;">
                    ${this.zombies.map(zombie => `
                        <div style="background: #10b981; padding: 16px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            <div style="font-size: 28px; margin-bottom: 8px;">🧟</div>
                            <div style="font-size: 16px; font-weight: 600; color: white;">${zombie.word}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        // Re-add pause overlay if game is paused
        if (this.isPaused) {
            this.showPauseOverlay();
        }
    }

    checkWord() {
        const typedWord = this.input.value.trim().toLowerCase();
        this.input.value = '';

        const zombieIndex = this.zombies.findIndex(z => z.word === typedWord);
        if (zombieIndex !== -1) {
            this.zombies.splice(zombieIndex, 1);
            this.score += 20;
            this.updateUI();
            this.renderGame();

            if (this.zombies.length === 0) {
                this.levelUp();
            }
        }
    }

    levelUp() {
        this.level++;
        this.spawnRate = Math.max(1000, this.spawnRate - 200);
        clearInterval(this.spawnTimer);
        this.startSpawning();
    }

    stop() {
        super.stop();
        if (this.spawnTimer) clearInterval(this.spawnTimer);
        this.input.removeEventListener('keydown', this.inputHandler);
        this.zombies = [];
    }
}

// Letter Storm Game
class LetterStormGame extends BaseGame {
    constructor() {
        super();
        this.currentWord = '';
        this.targetWord = '';
        this.combo = 0;
    }

    start() {
        super.start();
        this.input.parentElement.style.display = 'none';
        this.showNewTarget();
        this.setupInputListener();
    }

    showNewTarget() {
        this.targetWord = this.words[Math.floor(Math.random() * this.words.length)];
        this.currentWord = '';
        this.renderGame();
    }

    setupInputListener() {
        this.inputHandler = (e) => {
            if (this.isPaused) return;

            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.checkWord();
            } else if (e.key.length === 1) {
                this.currentWord += e.key.toLowerCase();
                this.input.value = '';
                this.renderGame();
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                this.currentWord = this.currentWord.slice(0, -1);
                this.input.value = '';
                this.renderGame();
            }
        };
        this.input.addEventListener('keydown', this.inputHandler);
    }

    renderGame() {
        this.canvas.innerHTML = `
            <div style="text-align: center; width: 100%;">
                <h3 style="font-size: 24px; font-weight: 600; color: #6b7280; margin-bottom: 40px;">Type: <span style="color: #f59e0b; font-weight: 700;">${this.targetWord}</span></h3>
                <div style="font-size: 48px; font-weight: 700; color: #2563eb; margin-bottom: 24px; min-height: 60px; letter-spacing: 2px;">
                    ${this.currentWord || '—'}
                </div>
                <div style="font-size: 20px; color: #111827; font-weight: 600;">Combo: <span style="color: #f59e0b;">${this.combo}x</span></div>
            </div>
        `;
        // Re-add pause overlay if game is paused
        if (this.isPaused) {
            this.showPauseOverlay();
        }
    }

    checkWord() {
        if (this.currentWord === this.targetWord) {
            this.combo++;
            this.score += 10 * this.combo;
            this.updateUI();
            this.showNewTarget();
        } else {
            this.combo = 0;
            this.currentWord = '';
            this.renderGame();
        }
    }

    stop() {
        super.stop();
        this.input.parentElement.style.display = 'block';
        this.input.removeEventListener('keydown', this.inputHandler);
    }
}

// Code Warrior Game

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

        // Initialize typing games
        window.typingGames = new TypingGamesManager();

    }, 100); // Small delay to ensure typing tests are initialized
});

// Test function for key highlighting
window.testKeyHighlight = function(char) {
    console.log('Testing key highlight for:', char);
    const keyElement = window.keyboardAndHandEffects.findKeyElementByChar(char);
    if (keyElement) {
        console.log('Found key element:', keyElement);
        keyElement.classList.add('next-key-highlight');
        console.log('Added next-key-highlight class');

        // Remove highlight after 3 seconds for testing
        setTimeout(() => {
            keyElement.classList.remove('next-key-highlight');
            console.log('Removed next-key-highlight class');
        }, 3000);
    } else {
        console.log('Key element not found for character:', char);
    }
};

// Enhanced LessonCompletionManager methods added via prototype
