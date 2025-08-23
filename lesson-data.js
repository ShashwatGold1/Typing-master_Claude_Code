// Dynamic Character Lesson Data - 104 Key Progressive System
// This file contains the complete lesson structure for progressive touch typing

class LessonData {
    constructor() {
        this.lessonStructure = this.initializeLessonStructure();
        const progress = this.loadProgress();
        this.currentLesson = progress.currentLesson || 1;
        this.maxUnlockedLesson = progress.maxUnlockedLesson || 1;
        this.maxLesson = this.lessonStructure.length;
    }

    // Load progress from localStorage
    loadProgress() {
        const saved = localStorage.getItem('progressive-lesson-progress');
        if (saved) {
            try {
                const progress = JSON.parse(saved);
                // Handle both old format (number) and new format (object)
                if (typeof progress === 'number') {
                    return { currentLesson: progress, maxUnlockedLesson: progress };
                }
                return progress;
            } catch (error) {
                console.warn('Error parsing lesson progress, using defaults:', error);
            }
        }
        return { currentLesson: 1, maxUnlockedLesson: 1 };
    }

    // Save progress to localStorage
    saveProgress() {
        const progress = {
            currentLesson: this.currentLesson,
            maxUnlockedLesson: this.maxUnlockedLesson
        };
        localStorage.setItem('progressive-lesson-progress', JSON.stringify(progress));
    }

    // Get current lesson data
    getCurrentLesson() {
        return this.lessonStructure[this.currentLesson - 1] || null;
    }

    // Check if can advance to next lesson
    canAdvance() {
        return this.currentLesson < this.maxLesson;
    }

    // Advance to next lesson
    advanceLesson() {
        if (this.canAdvance()) {
            this.currentLesson++;
            // Update max unlocked lesson if we've progressed further than before
            if (this.currentLesson > this.maxUnlockedLesson) {
                this.maxUnlockedLesson = this.currentLesson;
            }
            this.saveProgress();
            return true;
        }
        return false;
    }

    // Reset to lesson 1
    resetProgress() {
        this.currentLesson = 1;
        this.maxUnlockedLesson = 1;
        this.saveProgress();
    }

    // Set current lesson for practice (doesn't affect max unlocked)
    setCurrentLessonForPractice(lessonNumber) {
        if (lessonNumber >= 1 && lessonNumber <= this.maxUnlockedLesson) {
            this.currentLesson = lessonNumber;
            this.saveProgress();
            return true;
        }
        return false;
    }

    // Check if a lesson is unlocked
    isLessonUnlocked(lessonNumber) {
        return lessonNumber <= this.maxUnlockedLesson;
    }

    // Get new keys introduced in current lesson
    getNewKeysForLesson(lesson) {
        if (lesson.id === 1) return lesson.keys.filter(k => k !== ' '); // First lesson, all keys except space are new
        
        const currentKeys = new Set(lesson.keys);
        const previousLesson = this.lessonStructure[lesson.id - 2]; // -2 because array is 0-indexed
        const previousKeys = new Set(previousLesson ? previousLesson.keys : []);
        
        return lesson.keys.filter(key => !previousKeys.has(key) && key !== ' ');
    }

    // Get previously learned keys (excluding space)
    getLearnedKeysForLesson(lesson) {
        if (lesson.id === 1) return []; // First lesson, no previously learned keys
        
        const previousLesson = this.lessonStructure[lesson.id - 2];
        const previousKeys = new Set(previousLesson ? previousLesson.keys : []);
        
        return lesson.keys.filter(key => previousKeys.has(key) && key !== ' ');
    }

    // Generate random word length with bias toward average of 5
    getRandomWordLength() {
        const weights = [1, 2, 4, 5, 4, 2]; // Weights for lengths 3,4,5,6,7,8
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < weights.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return 3 + i; // Return length 3-8
            }
        }
        
        return 5; // Fallback to average
    }

    // Generate practice text for a lesson
    generatePracticeText(lesson) {
        const textLength = lesson.textLength || 50;
        const newKeys = this.getNewKeysForLesson(lesson);
        const learnedKeys = this.getLearnedKeysForLesson(lesson);
        const hasSpace = lesson.keys.includes(' ');
        
        // Character distribution percentages
        const NEW_KEY_PERCENTAGE = 0.4;
        
        let practiceText = '';
        let currentWordLength = 0;
        let targetWordLength = this.getRandomWordLength();
        let charactersAdded = 0;
        
        while (charactersAdded < textLength) {
            // Decide whether to add space or character
            if (currentWordLength >= targetWordLength && hasSpace && practiceText.length > 0) {
                practiceText += ' ';
                charactersAdded++;
                currentWordLength = 0;
                targetWordLength = this.getRandomWordLength();
            } else {
                // Choose character based on 40/60 distribution
                const useNewKey = Math.random() < NEW_KEY_PERCENTAGE && newKeys.length > 0;
                const keyPool = useNewKey ? newKeys : learnedKeys;
                
                // Fallback to all non-space keys if no appropriate pool
                const finalKeyPool = keyPool.length > 0 ? keyPool : lesson.keys.filter(k => k !== ' ');
                
                if (finalKeyPool.length > 0) {
                    const randomKey = finalKeyPool[Math.floor(Math.random() * finalKeyPool.length)];
                    practiceText += randomKey;
                    charactersAdded++;
                    currentWordLength++;
                }
            }
        }
        
        return practiceText.trim();
    }

    // Initialize complete 104-key lesson structure
    initializeLessonStructure() {
        return [
            // Phase 1: Foundation (Home Row)
            {
                id: 1,
                title: "Foundation Keys - F & J",
                description: "Master the home position with index fingers on F and J",
                phase: "Foundation",
                keys: ['f', 'j'],
                targetAccuracy: 100,
                targetWPM: 5,
                minChars: 30,
                textLength: 40,
                completion: {
                    message: "Excellent! You've mastered the foundation keys F and J.",
                    keysLearned: ['F', 'J'],
                    nextPreview: "Next: Adding the spacebar for word spacing"
                }
            },
            {
                id: 2,
                title: "Foundation Keys + Spacebar",
                description: "Add spacebar with your thumbs while maintaining F and J",
                phase: "Foundation",
                keys: ['f', 'j', ' '],
                targetAccuracy: 100,
                targetWPM: 8,
                minChars: 40,
                textLength: 50,
                completion: {
                    message: "Great progress! F, J, and spacebar are now under control.",
                    keysLearned: ['F', 'J', 'Spacebar'],
                    nextPreview: "Next: Expanding with D and K keys"
                }
            },
            {
                id: 3,
                title: "Home Row Extension - D & K",
                description: "Add middle fingers to D and K keys",
                phase: "Foundation", 
                keys: ['f', 'j', ' ', 'd', 'k'],
                targetAccuracy: 100,
                targetWPM: 10,
                minChars: 50,
                textLength: 60,
                completion: {
                    message: "Fantastic! Your home row foundation is growing strong.",
                    keysLearned: ['F', 'J', 'D', 'K', 'Spacebar'],
                    nextPreview: "Next: Adding ring fingers with S and L"
                }
            },
            {
                id: 4,
                title: "Home Row Extension - S & L", 
                description: "Add ring fingers to S and L keys",
                phase: "Foundation",
                keys: ['f', 'j', ' ', 'd', 'k', 's', 'l'],
                targetAccuracy: 100,
                targetWPM: 12,
                minChars: 60,
                textLength: 70,
                completion: {
                    message: "Excellent finger control! Six home row keys mastered.",
                    keysLearned: ['F', 'J', 'D', 'K', 'S', 'L', 'Spacebar'],
                    nextPreview: "Next: Completing home row with A and semicolon"
                }
            },
            {
                id: 5,
                title: "Home Row Complete - A & ;",
                description: "Complete home row with pinky fingers on A and semicolon",
                phase: "Foundation",
                keys: ['f', 'j', ' ', 'd', 'k', 's', 'l', 'a', ';'],
                targetAccuracy: 100,
                targetWPM: 15,
                minChars: 70,
                textLength: 80,
                completion: {
                    message: "Outstanding! Complete home row mastery achieved.",
                    keysLearned: ['A', 'S', 'D', 'F', 'J', 'K', 'L', ';', 'Spacebar'],
                    nextPreview: "Next: Home row review session"
                }
            },
            {
                id: 6,
                title: "Home Row Review",
                description: "Master all home row keys with fluid typing",
                phase: "Foundation",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' '],
                targetAccuracy: 100,
                targetWPM: 18,
                minChars: 80,
                textLength: 100,
                completion: {
                    message: "Perfect! Home row foundation is rock solid. Ready for upper row!",
                    keysLearned: ['Complete Home Row'],
                    nextPreview: "Next: Extending to upper row with R and U"
                }
            },

            // Phase 2: Upper Row Extension
            {
                id: 7,
                title: "Upper Row - R & U",
                description: "Extend index fingers up to R and U keys",
                phase: "Upper Extension",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'r', 'u'],
                targetAccuracy: 100,
                targetWPM: 20,
                minChars: 80,
                textLength: 90,
                completion: {
                    message: "Great reach! R and U keys are now in your control.",
                    keysLearned: ['R', 'U'],
                    nextPreview: "Next: Adding E and I with middle fingers"
                }
            },
            {
                id: 8,
                title: "Upper Row - E & I",
                description: "Add middle finger reach to E and I keys",
                phase: "Upper Extension",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'r', 'u', 'e', 'i'],
                targetAccuracy: 100,
                targetWPM: 22,
                minChars: 90,
                textLength: 100,
                completion: {
                    message: "Excellent extension! E and I keys mastered.",
                    keysLearned: ['E', 'I'],
                    nextPreview: "Next: Ring finger reach to W and O"
                }
            },
            {
                id: 9,
                title: "Upper Row - W & O",
                description: "Extend ring fingers to W and O keys",
                phase: "Upper Extension", 
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'r', 'u', 'e', 'i', 'w', 'o'],
                targetAccuracy: 100,
                targetWPM: 24,
                minChars: 90,
                textLength: 110,
                completion: {
                    message: "Superb reach! W and O keys are under control.",
                    keysLearned: ['W', 'O'],
                    nextPreview: "Next: Final upper row keys Q and P"
                }
            },
            {
                id: 10,
                title: "Upper Row - Q & P",
                description: "Complete upper row with pinky reach to Q and P",
                phase: "Upper Extension",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'r', 'u', 'e', 'i', 'w', 'o', 'q', 'p'],
                targetAccuracy: 100,
                targetWPM: 26,
                minChars: 100,
                textLength: 120,
                completion: {
                    message: "Amazing! Complete upper row extension achieved.",
                    keysLearned: ['Q', 'P'],
                    nextPreview: "Next: Upper row review session"
                }
            },
            {
                id: 11,
                title: "Upper Row Review",
                description: "Master home and upper rows combined",
                phase: "Upper Extension",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p'],
                targetAccuracy: 100,
                targetWPM: 28,
                minChars: 110,
                textLength: 130,
                completion: {
                    message: "Outstanding! Two complete rows mastered. Ready for lower row!",
                    keysLearned: ['Complete Upper Row'],
                    nextPreview: "Next: Lower row integration with V and M"
                }
            },

            // Phase 3: Lower Row Integration
            {
                id: 12,
                title: "Lower Row - V & M",
                description: "Drop index fingers down to V and M keys",
                phase: "Lower Integration",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'v', 'm'],
                targetAccuracy: 100,
                targetWPM: 30,
                minChars: 110,
                textLength: 130,
                completion: {
                    message: "Perfect reach! V and M keys integrated successfully.",
                    keysLearned: ['V', 'M'],
                    nextPreview: "Next: Adding C and comma with middle fingers"
                }
            },
            {
                id: 13,
                title: "Lower Row - C & Comma",
                description: "Extend middle fingers to C and comma keys",
                phase: "Lower Integration",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'v', 'm', 'c', ','],
                targetAccuracy: 100,
                targetWPM: 32,
                minChars: 120,
                textLength: 140,
                completion: {
                    message: "Excellent! C and comma keys are now natural.",
                    keysLearned: ['C', ','],
                    nextPreview: "Next: Ring finger extension to X and period"
                }
            },
            {
                id: 14,
                title: "Lower Row - X & Period",
                description: "Drop ring fingers to X and period keys",
                phase: "Lower Integration",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'v', 'm', 'c', ',', 'x', '.'],
                targetAccuracy: 100,
                targetWPM: 34,
                minChars: 120,
                textLength: 150,
                completion: {
                    message: "Great control! X and period keys mastered.",
                    keysLearned: ['X', '.'],
                    nextPreview: "Next: Final lower row keys Z and slash"
                }
            },
            {
                id: 15,
                title: "Lower Row - Z & Slash",
                description: "Complete lower row with pinky reach to Z and slash",
                phase: "Lower Integration",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'v', 'm', 'c', ',', 'x', '.', 'z', '/'],
                targetAccuracy: 100,
                targetWPM: 36,
                minChars: 130,
                textLength: 160,
                completion: {
                    message: "Fantastic! Complete lower row integration achieved.",
                    keysLearned: ['Z', '/'],
                    nextPreview: "Next: Three-row mastery review"
                }
            },
            {
                id: 16,
                title: "Three-Row Mastery Review",
                description: "Master all three letter rows with fluid typing",
                phase: "Lower Integration",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/'],
                targetAccuracy: 100,
                targetWPM: 38,
                minChars: 140,
                textLength: 170,
                completion: {
                    message: "Incredible! Complete three-row alphabet mastery achieved!",
                    keysLearned: ['All Letters'],
                    nextPreview: "Next: Numbers and symbols expansion"
                }
            },

            // Phase 4: Numbers & Symbols (Progressive Addition)
            {
                id: 17,
                title: "Numbers - 1",
                description: "Add number 1 key with left pinky",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1'],
                targetAccuracy: 100,
                targetWPM: 35,
                minChars: 100,
                textLength: 120,
                completion: {
                    message: "Great start! Number 1 key integrated successfully.",
                    keysLearned: ['1'],
                    nextPreview: "Next: Adding number 2"
                }
            },
            {
                id: 18,
                title: "Numbers - 2",
                description: "Add number 2 key with left ring finger",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2'],
                targetAccuracy: 100,
                targetWPM: 35,
                minChars: 100,
                textLength: 120,
                completion: {
                    message: "Excellent! Number 2 key mastered.",
                    keysLearned: ['2'],
                    nextPreview: "Next: Adding number 3"
                }
            },
            {
                id: 19,
                title: "Numbers - 3",
                description: "Add number 3 key with left middle finger",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3'],
                targetAccuracy: 100,
                targetWPM: 36,
                minChars: 110,
                textLength: 130,
                completion: {
                    message: "Perfect! Number 3 key integrated.",
                    keysLearned: ['3'],
                    nextPreview: "Next: Adding number 4"
                }
            },
            {
                id: 20,
                title: "Numbers - 4",
                description: "Add number 4 key with left index finger",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4'],
                targetAccuracy: 100,
                targetWPM: 36,
                minChars: 110,
                textLength: 130,
                completion: {
                    message: "Great progress! Number 4 key mastered.",
                    keysLearned: ['4'],
                    nextPreview: "Next: Adding number 5"
                }
            },
            {
                id: 21,
                title: "Numbers - 5",
                description: "Add number 5 key with left index finger",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5'],
                targetAccuracy: 100,
                targetWPM: 37,
                minChars: 110,
                textLength: 130,
                completion: {
                    message: "Excellent! Number 5 key integrated.",
                    keysLearned: ['5'],
                    nextPreview: "Next: Switching to right hand with number 6"
                }
            },
            {
                id: 22,
                title: "Numbers - 6",
                description: "Add number 6 key with right index finger",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6'],
                targetAccuracy: 100,
                targetWPM: 37,
                minChars: 120,
                textLength: 140,
                completion: {
                    message: "Perfect! Number 6 key mastered.",
                    keysLearned: ['6'],
                    nextPreview: "Next: Adding number 7"
                }
            },
            {
                id: 23,
                title: "Numbers - 7",
                description: "Add number 7 key with right index finger",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7'],
                targetAccuracy: 100,
                targetWPM: 38,
                minChars: 120,
                textLength: 140,
                completion: {
                    message: "Great! Number 7 key integrated successfully.",
                    keysLearned: ['7'],
                    nextPreview: "Next: Adding number 8"
                }
            },
            {
                id: 24,
                title: "Numbers - 8",
                description: "Add number 8 key with right middle finger",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8'],
                targetAccuracy: 100,
                targetWPM: 38,
                minChars: 120,
                textLength: 140,
                completion: {
                    message: "Excellent! Number 8 key mastered.",
                    keysLearned: ['8'],
                    nextPreview: "Next: Adding number 9"
                }
            },
            {
                id: 25,
                title: "Numbers - 9",
                description: "Add number 9 key with right ring finger",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
                targetAccuracy: 100,
                targetWPM: 39,
                minChars: 130,
                textLength: 150,
                completion: {
                    message: "Perfect! Number 9 key integrated.",
                    keysLearned: ['9'],
                    nextPreview: "Next: Completing numbers with 0"
                }
            },
            {
                id: 26,
                title: "Numbers - 0",
                description: "Complete numbers with 0 key using right pinky",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
                targetAccuracy: 100,
                targetWPM: 40,
                minChars: 130,
                textLength: 150,
                completion: {
                    message: "Outstanding! Complete number row mastered!",
                    keysLearned: ['0', 'All Numbers'],
                    nextPreview: "Next: Basic punctuation with apostrophe"
                }
            },

            // Continue with punctuation and special characters...
            {
                id: 27,
                title: "Punctuation - Apostrophe",
                description: "Add apostrophe key for contractions",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'"],
                targetAccuracy: 100,
                targetWPM: 40,
                minChars: 130,
                textLength: 150,
                completion: {
                    message: "Great! Apostrophe key integrated for contractions.",
                    keysLearned: ["'"],
                    nextPreview: "Next: Adding hyphen/dash"
                }
            },
            {
                id: 28,
                title: "Punctuation - Hyphen",
                description: "Add hyphen key for compound words",
                phase: "Numbers & Symbols", 
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-'],
                targetAccuracy: 100,
                targetWPM: 41,
                minChars: 140,
                textLength: 160,
                completion: {
                    message: "Perfect! Hyphen key mastered for compound words.",
                    keysLearned: ['-'],
                    nextPreview: "Next: Adding equals sign"
                }
            },
            {
                id: 29,
                title: "Punctuation - Equals",
                description: "Add equals sign for mathematical expressions",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '='],
                targetAccuracy: 100,
                targetWPM: 42,
                minChars: 140,
                textLength: 160,
                completion: {
                    message: "Excellent! Equals sign mastered.",
                    keysLearned: ['='],
                    nextPreview: "Next: Adding square brackets"
                }
            },
            {
                id: 30,
                title: "Brackets - Square Brackets",
                description: "Add left and right square brackets",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']'],
                targetAccuracy: 100,
                targetWPM: 42,
                minChars: 150,
                textLength: 170,
                completion: {
                    message: "Great! Square brackets [ ] mastered.",
                    keysLearned: ['[', ']'],
                    nextPreview: "Next: Adding backslash"
                }
            },
            {
                id: 31,
                title: "Special - Backslash",
                description: "Add backslash key for paths and escapes",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\'],
                targetAccuracy: 100,
                targetWPM: 43,
                minChars: 150,
                textLength: 170,
                completion: {
                    message: "Perfect! Backslash key integrated.",
                    keysLearned: ['\\'],
                    nextPreview: "Next: Adding backtick/grave accent"
                }
            },
            {
                id: 32,
                title: "Special - Backtick",
                description: "Add backtick/grave accent key",
                phase: "Numbers & Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`'],
                targetAccuracy: 100,
                targetWPM: 44,
                minChars: 160,
                textLength: 180,
                completion: {
                    message: "Excellent! Backtick key mastered.",
                    keysLearned: ['`'],
                    nextPreview: "Next: Shifted symbols exclamation and at"
                }
            },
            
            // Modifier Keys continue
            {
                id: 33,
                title: "Modifier Keys - Tab & Enter",
                description: "Master Tab and Enter keys with precision",
                phase: "Modifier Keys",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter'],
                targetAccuracy: 100,
                targetWPM: 45,
                minChars: 160,
                textLength: 180,
                completion: {
                    message: "Excellent! Tab and Enter keys mastered for navigation.",
                    keysLearned: ['Tab', 'Enter'],
                    nextPreview: "Next: Shift key mastery"
                }
            },
            {
                id: 34,
                title: "Modifier Keys - Shift Keys",
                description: "Master both left and right Shift keys",
                phase: "Modifier Keys",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift'],
                targetAccuracy: 100,
                targetWPM: 46,
                minChars: 170,
                textLength: 190,
                completion: {
                    message: "Outstanding! Both Shift keys mastered for capitalization.",
                    keysLearned: ['Shift'],
                    nextPreview: "Next: Control key mastery"
                }
            },
            {
                id: 35,
                title: "Control Keys - Ctrl",
                description: "Master Control key combinations",
                phase: "Modifier Keys",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl'],
                targetAccuracy: 100,
                targetWPM: 40,
                minChars: 150,
                textLength: 170,
                completion: {
                    message: "Great! Control key mastery achieved.",
                    keysLearned: ['Ctrl'],
                    nextPreview: "Next: Alt key integration"
                }
            },
            {
                id: 36,
                title: "Modifier Keys - Alt",
                description: "Add Alt key for advanced combinations",
                phase: "Modifier Keys",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt'],
                targetAccuracy: 100,
                targetWPM: 41,
                minChars: 160,
                textLength: 180,
                completion: {
                    message: "Perfect! Alt key integrated successfully.",
                    keysLearned: ['Alt'],
                    nextPreview: "Next: CapsLock mastery"
                }
            },
            {
                id: 37,
                title: "Special Keys - CapsLock",
                description: "Master CapsLock toggle functionality",
                phase: "Modifier Keys", 
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock'],
                targetAccuracy: 100,
                targetWPM: 42,
                minChars: 160,
                textLength: 180,
                completion: {
                    message: "Excellent! CapsLock mastery achieved.",
                    keysLearned: ['CapsLock'],
                    nextPreview: "Next: Home row capital letters"
                }
            },
            
            // Capitalization Lessons Phase
            {
                id: 38,
                title: "Capitalization - Home Row Capitals",
                description: "Master uppercase home row letters using Shift",
                phase: "Capitalization",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', 'A', 'S', 'D', 'F', 'J', 'K', 'L'],
                targetAccuracy: 100,
                targetWPM: 25,
                minChars: 80,
                textLength: 100,
                completion: {
                    message: "Excellent! Home row capital letters mastered with Shift.",
                    keysLearned: ['A', 'S', 'D', 'F', 'J', 'K', 'L'],
                    nextPreview: "Next: Upper row capital letters"
                }
            },
            {
                id: 39,
                title: "Capitalization - Upper Row Capitals",
                description: "Master uppercase upper row letters using Shift",
                phase: "Capitalization",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', 'A', 'S', 'D', 'F', 'J', 'K', 'L', 'Q', 'W', 'E', 'R', 'U', 'I', 'O', 'P'],
                targetAccuracy: 100,
                targetWPM: 27,
                minChars: 90,
                textLength: 110,
                completion: {
                    message: "Perfect! Upper row capital letters integrated.",
                    keysLearned: ['Q', 'W', 'E', 'R', 'U', 'I', 'O', 'P'],
                    nextPreview: "Next: Lower row capital letters"
                }
            },
            {
                id: 40,
                title: "Capitalization - Lower Row Capitals", 
                description: "Master uppercase lower row letters using Shift",
                phase: "Capitalization",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', 'A', 'S', 'D', 'F', 'J', 'K', 'L', 'Q', 'W', 'E', 'R', 'U', 'I', 'O', 'P', 'Z', 'X', 'C', 'V', 'M'],
                targetAccuracy: 100,
                targetWPM: 30,
                minChars: 100,
                textLength: 120,
                completion: {
                    message: "Great! Lower row capital letters mastered.",
                    keysLearned: ['Z', 'X', 'C', 'V', 'M'],
                    nextPreview: "Next: Complete alphabet capitalization review"
                }
            },
            {
                id: 41,
                title: "Capitalization - Complete Alphabet Review",
                description: "Master all uppercase letters A-Z with fluid typing",
                phase: "Capitalization",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', 'A', 'S', 'D', 'F', 'J', 'K', 'L', 'Q', 'W', 'E', 'R', 'U', 'I', 'O', 'P', 'Z', 'X', 'C', 'V', 'M', 'N', 'B', 'G', 'H', 'T', 'Y'],
                targetAccuracy: 100,
                targetWPM: 33,
                minChars: 120,
                textLength: 140,
                completion: {
                    message: "Excellent! Complete uppercase alphabet mastery achieved!",
                    keysLearned: ['All Uppercase Letters A-Z'],
                    nextPreview: "Next: Proper capitalization in sentences"
                }
            },
            {
                id: 42,
                title: "Capitalization - Sentence Capitalization",
                description: "Practice proper capitalization in sentences and proper nouns",
                phase: "Capitalization",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', 'A', 'S', 'D', 'F', 'J', 'K', 'L', 'Q', 'W', 'E', 'R', 'U', 'I', 'O', 'P', 'Z', 'X', 'C', 'V', 'M', 'N', 'B', 'G', 'H', 'T', 'Y'],
                targetAccuracy: 100,
                targetWPM: 35,
                minChars: 150,
                textLength: 180,
                completion: {
                    message: "Perfect! Sentence capitalization and proper noun skills mastered.",
                    keysLearned: ['Proper Capitalization Rules'],
                    nextPreview: "Next: Shifted symbols exclamation and at"
                }
            },

            // Shifted Number Row Symbols
            {
                id: 43,
                title: "Symbols - Exclamation & At",
                description: "Master ! (Shift+1) and @ (Shift+2) symbols",
                phase: "Shifted Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@'],
                targetAccuracy: 100,
                targetWPM: 38,
                minChars: 140,
                textLength: 160,
                completion: {
                    message: "Great! Exclamation and At symbols mastered.",
                    keysLearned: ['!', '@'],
                    nextPreview: "Next: Adding hash and dollar symbols"
                }
            },
            {
                id: 44,
                title: "Symbols - Hash & Dollar",
                description: "Master # (Shift+3) and $ (Shift+4) symbols",
                phase: "Shifted Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$'],
                targetAccuracy: 100,
                targetWPM: 39,
                minChars: 150,
                textLength: 170,
                completion: {
                    message: "Perfect! Hash and Dollar symbols integrated.",
                    keysLearned: ['#', '$'],
                    nextPreview: "Next: Adding percent and caret symbols"
                }
            },
            {
                id: 45,
                title: "Symbols - Percent & Caret",
                description: "Master % (Shift+5) and ^ (Shift+6) symbols",
                phase: "Shifted Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^'],
                targetAccuracy: 100,
                targetWPM: 40,
                minChars: 150,
                textLength: 170,
                completion: {
                    message: "Excellent! Percent and Caret symbols mastered.",
                    keysLearned: ['%', '^'],
                    nextPreview: "Next: Adding ampersand and asterisk"
                }
            },
            {
                id: 46,
                title: "Symbols - Ampersand & Asterisk",
                description: "Master & (Shift+7) and * (Shift+8) symbols",
                phase: "Shifted Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*'],
                targetAccuracy: 100,
                targetWPM: 40,
                minChars: 160,
                textLength: 180,
                completion: {
                    message: "Great! Ampersand and Asterisk symbols integrated.",
                    keysLearned: ['&', '*'],
                    nextPreview: "Next: Adding parentheses"
                }
            },
            {
                id: 47,
                title: "Symbols - Parentheses",
                description: "Master ( (Shift+9) and ) (Shift+0) parentheses",
                phase: "Shifted Symbols",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')'],
                targetAccuracy: 100,
                targetWPM: 41,
                minChars: 160,
                textLength: 180,
                completion: {
                    message: "Perfect! Parentheses mastered for grouping.",
                    keysLearned: ['(', ')'],
                    nextPreview: "Next: Additional punctuation with quotes"
                }
            },

            // Additional Punctuation
            {
                id: 48,
                title: "Punctuation - Double Quote",
                description: "Master \" (Shift+') double quote symbol",
                phase: "Additional Punctuation",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"'],
                targetAccuracy: 100,
                targetWPM: 42,
                minChars: 160,
                textLength: 180,
                completion: {
                    message: "Great! Double quote symbol mastered.",
                    keysLearned: ['"'],
                    nextPreview: "Next: Adding colon symbol"
                }
            },
            {
                id: 49,
                title: "Punctuation - Colon",
                description: "Master : (Shift+;) colon symbol",
                phase: "Additional Punctuation",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':'],
                targetAccuracy: 100,
                targetWPM: 42,
                minChars: 170,
                textLength: 190,
                completion: {
                    message: "Excellent! Colon symbol integrated.",
                    keysLearned: [':'],
                    nextPreview: "Next: Adding less than and greater than"
                }
            },
            {
                id: 50,
                title: "Symbols - Less Than & Greater Than",
                description: "Master < (Shift+,) and > (Shift+.) symbols",
                phase: "Additional Punctuation",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>'],
                targetAccuracy: 100,
                targetWPM: 43,
                minChars: 170,
                textLength: 190,
                completion: {
                    message: "Perfect! Less than and Greater than symbols mastered.",
                    keysLearned: ['<', '>'],
                    nextPreview: "Next: Adding question mark"
                }
            },
            {
                id: 51,
                title: "Punctuation - Question Mark",
                description: "Master ? (Shift+/) question mark symbol",
                phase: "Additional Punctuation",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?'],
                targetAccuracy: 100,
                targetWPM: 44,
                minChars: 180,
                textLength: 200,
                completion: {
                    message: "Great! Question mark symbol mastered.",
                    keysLearned: ['?'],
                    nextPreview: "Next: Adding curly braces"
                }
            },
            {
                id: 52,
                title: "Brackets - Curly Braces",
                description: "Master { (Shift+[) and } (Shift+]) curly braces",
                phase: "Additional Punctuation",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}'],
                targetAccuracy: 100,
                targetWPM: 44,
                minChars: 180,
                textLength: 200,
                completion: {
                    message: "Excellent! Curly braces mastered for programming.",
                    keysLearned: ['{', '}'],
                    nextPreview: "Next: Adding pipe symbol"
                }
            },
            {
                id: 53,
                title: "Symbols - Pipe",
                description: "Master | (Shift+\\) pipe symbol",
                phase: "Additional Punctuation",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|'],
                targetAccuracy: 100,
                targetWPM: 45,
                minChars: 180,
                textLength: 200,
                completion: {
                    message: "Perfect! Pipe symbol mastered.",
                    keysLearned: ['|'],
                    nextPreview: "Next: Adding tilde symbol"
                }
            },
            {
                id: 54,
                title: "Symbols - Tilde",
                description: "Master ~ (Shift+`) tilde symbol",
                phase: "Additional Punctuation",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~'],
                targetAccuracy: 100,
                targetWPM: 45,
                minChars: 190,
                textLength: 210,
                completion: {
                    message: "Outstanding! Tilde symbol mastered.",
                    keysLearned: ['~'],
                    nextPreview: "Next: Special keys Escape and Backspace"
                }
            },

            // Special Keys
            {
                id: 55,
                title: "Special Keys - Escape",
                description: "Master Escape key functionality",
                phase: "Special Keys",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~', 'Escape'],
                targetAccuracy: 100,
                targetWPM: 40,
                minChars: 140,
                textLength: 160,
                completion: {
                    message: "Great! Escape key mastered for cancellation.",
                    keysLearned: ['Escape'],
                    nextPreview: "Next: Adding Backspace key"
                }
            },
            {
                id: 56,
                title: "Special Keys - Backspace",
                description: "Master Backspace key for deletion",
                phase: "Special Keys",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~', 'Escape', 'Backspace'],
                targetAccuracy: 100,
                targetWPM: 42,
                minChars: 150,
                textLength: 170,
                completion: {
                    message: "Perfect! Backspace key mastered for editing.",
                    keysLearned: ['Backspace'],
                    nextPreview: "Next: Numpad numbers 0-4"
                }
            },

            // Numpad Keys
            {
                id: 57,
                title: "Numpad - Numbers 0-4",
                description: "Master numpad numbers 0, 1, 2, 3, 4",
                phase: "Numpad Keys",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~', 'Escape', 'Backspace', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4'],
                targetAccuracy: 100,
                targetWPM: 38,
                minChars: 130,
                textLength: 150,
                completion: {
                    message: "Great! First numpad numbers 0-4 mastered.",
                    keysLearned: ['Numpad 0-4'],
                    nextPreview: "Next: Numpad numbers 5-9"
                }
            },
            {
                id: 58,
                title: "Numpad - Numbers 5-9",
                description: "Master numpad numbers 5, 6, 7, 8, 9",
                phase: "Numpad Keys",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~', 'Escape', 'Backspace', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9'],
                targetAccuracy: 100,
                targetWPM: 39,
                minChars: 140,
                textLength: 160,
                completion: {
                    message: "Excellent! All numpad numbers 5-9 mastered.",
                    keysLearned: ['Numpad 5-9'],
                    nextPreview: "Next: Numpad operators plus and minus"
                }
            },
            {
                id: 59,
                title: "Numpad - Plus & Minus",
                description: "Master numpad + (plus) and - (minus) operators",
                phase: "Numpad Keys",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~', 'Escape', 'Backspace', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd', 'NumpadSubtract'],
                targetAccuracy: 100,
                targetWPM: 40,
                minChars: 150,
                textLength: 170,
                completion: {
                    message: "Perfect! Numpad plus and minus operators mastered.",
                    keysLearned: ['Numpad +', 'Numpad -'],
                    nextPreview: "Next: Numpad multiply and divide"
                }
            },
            {
                id: 60,
                title: "Numpad - Multiply & Divide",
                description: "Master numpad * (multiply) and / (divide) operators",
                phase: "Numpad Keys",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~', 'Escape', 'Backspace', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide'],
                targetAccuracy: 100,
                targetWPM: 41,
                minChars: 160,
                textLength: 180,
                completion: {
                    message: "Great! Numpad multiply and divide operators mastered.",
                    keysLearned: ['Numpad *', 'Numpad /'],
                    nextPreview: "Next: Numpad Enter and decimal"
                }
            },
            {
                id: 61,
                title: "Numpad - Enter & Decimal",
                description: "Master numpad Enter and . (decimal) keys",
                phase: "Numpad Keys",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~', 'Escape', 'Backspace', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide', 'NumpadEnter', 'NumpadDecimal'],
                targetAccuracy: 100,
                targetWPM: 42,
                minChars: 170,
                textLength: 190,
                completion: {
                    message: "Excellent! Numpad Enter and decimal keys mastered.",
                    keysLearned: ['Numpad Enter', 'Numpad .'],
                    nextPreview: "Next: NumLock key"
                }
            },
            {
                id: 62,
                title: "Numpad - NumLock",
                description: "Master NumLock toggle key",
                phase: "Numpad Keys",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~', 'Escape', 'Backspace', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide', 'NumpadEnter', 'NumpadDecimal', 'NumLock'],
                targetAccuracy: 100,
                targetWPM: 40,
                minChars: 140,
                textLength: 160,
                completion: {
                    message: "Perfect! NumLock key mastered for numpad control.",
                    keysLearned: ['NumLock'],
                    nextPreview: "Next: Additional modifier keys"
                }
            },

            // Additional Modifier Keys
            {
                id: 63,
                title: "Modifier Keys - Windows Key",
                description: "Master Windows/Meta key functionality",
                phase: "Additional Modifiers",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~', 'Escape', 'Backspace', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide', 'NumpadEnter', 'NumpadDecimal', 'NumLock', 'MetaLeft'],
                targetAccuracy: 100,
                targetWPM: 35,
                minChars: 120,
                textLength: 140,
                completion: {
                    message: "Great! Windows/Meta key mastered for shortcuts.",
                    keysLearned: ['Windows Key'],
                    nextPreview: "Next: Context Menu key"
                }
            },
            {
                id: 64,
                title: "Modifier Keys - Context Menu",
                description: "Master Context Menu (right-click menu) key",
                phase: "Additional Modifiers",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~', 'Escape', 'Backspace', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide', 'NumpadEnter', 'NumpadDecimal', 'NumLock', 'MetaLeft', 'ContextMenu'],
                targetAccuracy: 100,
                targetWPM: 36,
                minChars: 130,
                textLength: 150,
                completion: {
                    message: "Perfect! Context Menu key mastered.",
                    keysLearned: ['Context Menu'],
                    nextPreview: "Next: Right-side modifier keys"
                }
            },
            {
                id: 65,
                title: "Modifier Keys - Right Ctrl & Alt",
                description: "Master right-side Control and Alt keys",
                phase: "Additional Modifiers",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~', 'Escape', 'Backspace', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide', 'NumpadEnter', 'NumpadDecimal', 'NumLock', 'MetaLeft', 'ContextMenu', 'ControlRight', 'AltRight'],
                targetAccuracy: 100,
                targetWPM: 37,
                minChars: 140,
                textLength: 160,
                completion: {
                    message: "Excellent! Right-side Control and Alt keys mastered.",
                    keysLearned: ['Right Ctrl', 'Right Alt'],
                    nextPreview: "Next: Ultimate typing mastery challenge"
                }
            },

            // Ultimate Final Mastery
            {
                id: 66,
                title: "Ultimate Typing Mastery Challenge", 
                description: "Demonstrate complete mastery of all essential keyboard keys",
                phase: "Complete Mastery",
                keys: ['a', 's', 'd', 'f', 'j', 'k', 'l', ';', ' ', 'q', 'w', 'e', 'r', 'u', 'i', 'o', 'p', 'z', 'x', 'c', 'v', 'm', ',', '.', '/', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', "'", '-', '=', '[', ']', '\\', '`', 'Tab', 'Enter', 'Shift', 'Ctrl', 'Alt', 'CapsLock', 'A', 'S', 'D', 'F', 'J', 'K', 'L', 'Q', 'W', 'E', 'R', 'U', 'I', 'O', 'P', 'Z', 'X', 'C', 'V', 'M', 'N', 'B', 'G', 'H', 'T', 'Y', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '"', ':', '<', '>', '?', '{', '}', '|', '~', 'Escape', 'Backspace', 'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9', 'NumpadAdd', 'NumpadSubtract', 'NumpadMultiply', 'NumpadDivide', 'NumpadEnter', 'NumpadDecimal', 'NumLock', 'MetaLeft', 'ContextMenu', 'ControlRight', 'AltRight'],
                targetAccuracy: 100,
                targetWPM: 60,
                minChars: 300,
                textLength: 400,
                completion: {
                    message: "🎉 ULTIMATE ACHIEVEMENT UNLOCKED! 🎉 You have mastered all essential keyboard keys! You are now a TRUE TYPING KING with complete typing mastery! This is the pinnacle of typing excellence!",
                    keysLearned: ['ALL ESSENTIAL KEYBOARD KEYS'],
                    nextPreview: "CONGRATULATIONS! You have completed the ultimate typing mastery journey!"
                }
            }
        ];
    }

    // Get lesson statistics
    getLessonStats() {
        return {
            current: this.currentLesson,
            maxUnlocked: this.maxUnlockedLesson,
            total: this.maxLesson,
            percentComplete: Math.round((this.maxUnlockedLesson / this.maxLesson) * 100),
            phase: this.getCurrentLesson()?.phase || "Unknown"
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LessonData;
} else {
    window.LessonData = LessonData;
}