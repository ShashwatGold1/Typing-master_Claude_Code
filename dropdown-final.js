// FINAL WORKING DROPDOWN CODE
// Copy this code to replace your current dropdown function

function initDropdown() {
    console.log('=== FINAL WORKING DROPDOWN ===');
    
    const selected = document.getElementById('dropdown-selected');
    const options = document.getElementById('dropdown-options');
    const dropdown = document.getElementById('time-dropdown');
    
    if (!selected || !options) {
        console.log('❌ Elements not found!');
        return;
    }
    
    let dropdownOpen = false;
    
    // 1. Click to toggle dropdown
    selected.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('🖱️ Toggle clicked, open:', dropdownOpen);
        
        if (dropdownOpen) {
            // Close
            options.classList.remove('show');
            selected.classList.remove('active');
            dropdownOpen = false;
            console.log('📁 Closed');
        } else {
            // Open
            options.classList.add('show');
            selected.classList.add('active');
            dropdownOpen = true;
            console.log('📂 Opened');
        }
    });
    
    // 2. Click options to select
    const optionElements = options.querySelectorAll('.dropdown-option');
    optionElements.forEach(function(option) {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            console.log('🎯 Option selected:', this.textContent);
            
            // Update display text
            const selectedText = selected.querySelector('.selected-text');
            if (selectedText) {
                selectedText.textContent = this.textContent;
            }
            
            // Close dropdown
            options.classList.remove('show');
            selected.classList.remove('active');
            dropdownOpen = false;
            console.log('📁 Closed after selection');
        });
    });
    
    // 3. Click outside to close (reliable method)
    document.addEventListener('click', function(e) {
        if (dropdownOpen && !dropdown.contains(e.target)) {
            console.log('🌐 Clicked outside - closing');
            options.classList.remove('show');
            selected.classList.remove('active');
            dropdownOpen = false;
        }
    });
    
    console.log('✅ Dropdown ready with all features');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDropdown);
} else {
    initDropdown();
}