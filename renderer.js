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
        }
    }
}

// Typing Test System
class TypingTest {
    constructor(textDisplayId = 'text-display', typingInputId = 'typing-input', wpmValueId = 'wpm-value', accuracyValueId = 'accuracy-value', timeValueId = 'time-value', resultsBannerId = 'results-banner', finalWpmId = 'final-wpm', finalAccuracyId = 'final-accuracy', finalTimeId = 'final-time') {
        this.textToType = "Cooking is both an art and a science. It involves understanding ingredients, mastering techniques, and creating delicious meals that nourish the body and bring joy to those who share them.";
        this.currentIndex = 0;
        this.correctChars = 0;
        this.totalChars = 0;
        this.startTime = null;
        this.isActive = false;
        this.timer = null;
        this.timeLimit = 30;
        this.timeRemaining = 30;
        
        // Store element IDs
        this.elementIds = {
            textDisplay: textDisplayId,
            typingInput: typingInputId,
            wpmValue: wpmValueId,
            accuracyValue: accuracyValueId,
            timeValue: timeValueId,
            resultsBanner: resultsBannerId,
            finalWpm: finalWpmId,
            finalAccuracy: finalAccuracyId,
            finalTime: finalTimeId
        };
        
        this.init();
    }

    init() {
        this.textDisplay = document.getElementById(this.elementIds.textDisplay);
        this.typingInput = document.getElementById(this.elementIds.typingInput);
        this.wpmValue = document.getElementById(this.elementIds.wpmValue);
        this.accuracyValue = document.getElementById(this.elementIds.accuracyValue);
        this.timeValue = document.getElementById(this.elementIds.timeValue);
        this.resetBtn = document.getElementById('reset-btn'); // Default reset button for quick-test
        // Dropdown handled by standalone component
        this.resultsBanner = document.getElementById(this.elementIds.resultsBanner);

        // Set initial time display
        this.updateTimeDisplay();
        
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
        const value = e.target.value;
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
        this.timeRemaining = this.timeLimit;
        
        this.timer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimeDisplay();
            
            if (this.timeRemaining <= 0) {
                this.endTest();
            }
        }, 1000);
    }

    endTest() {
        this.isActive = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
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
        this.timeRemaining = this.timeLimit;
        
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // Clear the input and hide results banner
        this.typingInput.value = '';
        this.hideResultsBanner();
        
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
        // Calculate WPM
        let wpm = 0;
        if (this.isActive && this.startTime) {
            const timeElapsed = (Date.now() - this.startTime) / 1000 / 60; // in minutes
            const wordsTyped = this.correctChars / 5; // standard: 5 characters = 1 word
            wpm = Math.round(wordsTyped / timeElapsed);
        }

        // Calculate accuracy
        const accuracy = this.totalChars > 0 ? Math.round((this.correctChars / this.totalChars) * 100) : 100;

        this.wpmValue.textContent = wpm;
        this.accuracyValue.textContent = `${accuracy}%`;
    }

    updateTimeDisplay() {
        if (this.timeValue) {
            this.timeValue.textContent = this.timeRemaining;
        }
    }

    showResults() {
        // Show non-blocking results banner instead of alert
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
        
        this.showResultsBanner(`Test Complete! WPM: ${wpm}, Accuracy: ${accuracy}`);
        
        // Keep input ready for next test
        setTimeout(() => {
            this.forceInputFocus();
        }, 100);
    }

    showResultsBanner(message) {
        const banner = document.getElementById(this.elementIds.resultsBanner);
        const text = document.getElementById('results-text');
        const closeBtn = document.getElementById('results-close');
        
        if (banner && text) {
            text.textContent = message;
            banner.style.display = 'block';
            
            // Auto-hide after 5 seconds
            const hideTimeout = setTimeout(() => {
                this.hideResultsBanner();
            }, 5000);
            
            // Close button handler
            closeBtn.onclick = () => {
                clearTimeout(hideTimeout);
                this.hideResultsBanner();
            };
        }
    }

    hideResultsBanner() {
        const banner = document.getElementById(this.elementIds.resultsBanner);
        if (banner) {
            banner.style.display = 'none';
        }
        // Ensure input stays focused
        this.forceInputFocus();
    }
}

// Lesson System
class LessonManager {
    constructor() {
        this.lessons = [
            {
                id: 'home-row',
                title: 'Home Row Basics',
                description: 'Learn the foundation keys: A, S, D, F, J, K, L, ;',
                level: 'beginner',
                targetWPM: 15,
                targetAccuracy: 90,
                unlocked: true,
                text: 'asdf jkl; asdf jkl; sad lad ask dad flask glass'
            },
            {
                id: 'top-row',
                title: 'Top Row Introduction',
                description: 'Add the top row keys Q, W, E, R, T, Y, U, I, O, P',
                level: 'beginner',
                targetWPM: 20,
                targetAccuracy: 85,
                unlocked: false,
                text: 'qwer tyui op qwer tyui op quest water power quote'
            }
        ];
        this.init();
    }

    init() {
        this.setupLessonCards();
    }

    setupLessonCards() {
        const lessonCards = document.querySelectorAll('.lesson-card');
        lessonCards.forEach((card, index) => {
            const button = card.querySelector('.btn');
            if (button && !button.classList.contains('btn-disabled')) {
                button.addEventListener('click', () => {
                    this.startLesson(index);
                });
            }
        });
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
                
                // Initialize lesson typing test
                lessonTypingTest.textToType = lesson.text;
                lessonTypingTest.resetTest();
                
                // Ensure input is ready for typing
                lessonTypingTest.forceInputFocus();
            }, 150);
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
        // Load settings from localStorage
        const savedSettings = localStorage.getItem('typing-master-settings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
        }
        this.applySettings();
    }

    saveSettings() {
        localStorage.setItem('typing-master-settings', JSON.stringify(this.settings));
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
                this.settings.theme = e.target.value;
                this.applySettings();
                this.saveSettings();
            });
        }

        // Sound effects checkbox
        const soundCheckbox = document.querySelector('#settings-page input[type="checkbox"]');
        if (soundCheckbox) {
            soundCheckbox.addEventListener('change', (e) => {
                this.settings.soundEffects = e.target.checked;
                this.saveSettings();
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
        const savedStats = localStorage.getItem('typing-master-stats');
        if (savedStats) {
            this.stats = { ...this.stats, ...JSON.parse(savedStats) };
        }
    }

    saveStats() {
        localStorage.setItem('typing-master-stats', JSON.stringify(this.stats));
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

// Dropdown functionality removed - now just static display

// Initialize all managers when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Small delay to ensure all elements are ready
    setTimeout(() => {
        // Initialize all components
        window.navigationManager = new NavigationManager();
        window.typingTest = new TypingTest();
        window.lessonTypingTest = new TypingTest('lesson-text-display', 'lesson-typing-input', 'lesson-wpm-value', 'lesson-accuracy-value', 'lesson-time-value', 'lesson-results-banner', 'lesson-final-wpm', 'lesson-final-accuracy', 'lesson-final-time');
        window.lessonManager = new LessonManager();
        window.settingsManager = new SettingsManager();
        window.statisticsManager = new StatisticsManager();
        window.animationManager = new AnimationManager();
        window.inputMonitor = new InputFieldMonitor();
        // Dropdown removed

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