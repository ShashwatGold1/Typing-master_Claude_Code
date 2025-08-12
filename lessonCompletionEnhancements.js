// Enhanced LessonCompletionManager Methods
// This file contains the enhanced methods for better lesson completion handling

// Add enhanced methods to LessonCompletionManager
if (typeof LessonCompletionManager !== 'undefined') {
    // Enhanced lesson data validation with intelligent fallbacks
    LessonCompletionManager.prototype.validateAndEnhanceLessonData = function(lesson, accuracy, wpm) {
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
            result.nextPreview = lesson.completion.nextPreview || '';
        } else {
            // Generate complete fallback data
            result.message = this.generateFallbackMessage(lesson, accuracy, wpm);
            result.keysLearned = this.generateFallbackKeysLearned(lesson);
            result.nextPreview = 'Continue your typing journey!';
            
            console.warn('LessonCompletionManager: No completion data found for lesson, using intelligent fallbacks');
        }
        
        return result;
    };
    
    // Generate contextual fallback messages based on performance
    LessonCompletionManager.prototype.generateFallbackMessage = function(lesson, accuracy, wpm) {
        const lessonTitle = lesson && lesson.title ? lesson.title : 'lesson';
        
        // Character lesson friendly WPM thresholds (capped at 25 WPM max)
        if (accuracy >= 95 && wpm >= 20) {
            return `Outstanding performance! You've mastered the ${lessonTitle} with excellent speed and accuracy.`;
        } else if (accuracy >= 90) {
            return `Great job! You've completed the ${lessonTitle} with strong accuracy. Keep building speed!`;
        } else if (wpm >= 15) {
            return `Good progress! You've completed the ${lessonTitle} with solid speed. Focus on accuracy next!`;
        } else {
            return `Lesson completed! You've successfully finished the ${lessonTitle}. Practice makes perfect!`;
        }
    };
    
    // Generate fallback keys learned text
    LessonCompletionManager.prototype.generateFallbackKeysLearned = function(lesson) {
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
    };
    
    // Safe stats getter with fallbacks
    LessonCompletionManager.prototype.getSafeStats = function() {
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
    };
}