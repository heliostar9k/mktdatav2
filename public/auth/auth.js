// Initialize Supabase client
const supabase = supabase.createClient(
    'https://mjpdiadvjjpjfrlkyhez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcGRpYWR2ampwamZybGt5aGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwOTMwNjAsImV4cCI6MjA1MTY2OTA2MH0.PSUC_M0sc19QuIAU885xHwlzD-g-YsIzAhPuNFQPfmg'
);

// Auth state handler
class AuthHandler {
    constructor() {
        this.init();
    }

    async init() {
        // Check initial auth state
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            console.error('Error fetching user:', error.message);
            return;
        }
        
        if (user) {
            this.handleAuthenticatedState(user);
        } else {
            this.handleUnauthenticatedState();
        }

        // Set up auth state change listener
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN') {
                this.handleAuthenticatedState(session.user);
            } else if (event === 'SIGNED_OUT') {
                this.handleUnauthenticatedState();
            }
        });
    }

    async handleAuthenticatedState(user) {
        // Store user info
        localStorage.setItem('user', JSON.stringify(user));
        
        // Update UI based on current page
        const currentPath = window.location.pathname;
        if (currentPath.includes('/login.html')) {
            window.location.href = '/auth/dashboard.html';
        }
        
        // Load user-specific data if on dashboard
        if (currentPath.includes('/dashboard.html')) {
            await this.loadUserData(user);
        }
    }

    handleUnauthenticatedState() {
        // Clear stored data
        localStorage.removeItem('user');
        
        // Redirect to login if on protected page
        const currentPath = window.location.pathname;
        if (currentPath.includes('/dashboard.html')) {
            window.location.href = '/auth/login.html';
        }
    }

    async loadUserData(user) {
        try {
            // Load API key
            const { data: apiKeyData, error: apiKeyError } = await supabase
                .from('api_keys')
                .select('key')
                .eq('user_id', user.id)
                .single();

            if (apiKeyError) throw apiKeyError;

            // Update UI with API key
            const apiKeyElement = document.getElementById('apiKey');
            if (apiKeyElement) {
                apiKeyElement.value = apiKeyData?.key || 'No API key generated';
            }

            // Update user email display
            const userEmailElement = document.getElementById('userEmail');
            if (userEmailElement) {
                userEmailElement.textContent = user.email;
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showToast('Error loading user data', 'error');
        }
    }
}

// API Key Management
class APIKeyManager {
    async generateNewKey(userId) {
        try {
            // Generate random API key
            const apiKey = 'mk_' + Array.from(crypto.getRandomValues(new Uint8Array(32)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('')
                .substr(0, 32);

            // Save to database
            const { error } = await supabase
                .from('api_keys')
                .upsert({ 
                    user_id: userId,
                    key: apiKey,
                    created_at: new Date().toISOString(),
                    active: true
                }, {
                    onConflict: 'user_id'
                });

            if (error) throw error;

            // Update UI
            const apiKeyElement = document.getElementById('apiKey');
            if (apiKeyElement) {
                apiKeyElement.value = apiKey;
                this.showToast('New API key generated successfully', 'success');
            }
        } catch (error) {
            console.error('Error generating API key:', error);
            this.showToast('Error generating new API key', 'error');
        }
    }

    toggleVisibility() {
        const apiKeyInput = document.getElementById('apiKey');
        if (apiKeyInput) {
            apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
            apiKeyInput.classList.toggle('masked');
        }
    }

    async copyToClipboard() {
        const apiKeyInput = document.getElementById('apiKey');
        if (!apiKeyInput) return;

        try {
            await navigator.clipboard.writeText(apiKeyInput.value);
            this.showToast('API key copied to clipboard', 'success');
        } catch (error) {
            console.error('Error copying to clipboard:', error);
            this.showToast('Failed to copy API key', 'error');
        }
    }
}

// UI Helper Functions
class UIHelper {
    static showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        // Remove existing toast
        if (toast.classList.contains('show')) {
            toast.classList.remove('show');
            void toast.offsetWidth; // Trigger reflow
        }

        // Set toast content and style
        toast.textContent = message;
        toast.className = `toast fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg ${
            type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`;

        // Show toast
        toast.classList.add('show');

        // Hide after delay
        setTimeout(() => {
            toast.classList.add('hide');
        }, 3000);
    }

    static setLoading(element, isLoading) {
        if (!element) return;

        const originalContent = element.dataset.originalContent || element.innerHTML;
        
        if (isLoading) {
            element.dataset.originalContent = originalContent;
            element.innerHTML = '<div class="spinner"></div>';
            element.disabled = true;
        } else {
            element.innerHTML = originalContent;
            element.disabled = false;
        }
    }

    static validateForm(formData, rules) {
        const errors = {};
        
        for (const [field, value] of formData.entries()) {
            if (rules[field]) {
                const fieldRules = rules[field];
                
                if (fieldRules.required && !value) {
                    errors[field] = `${field} is required`;
                }
                
                if (fieldRules.minLength && value.length < fieldRules.minLength) {
                    errors[field] = `${field} must be at least ${fieldRules.minLength} characters`;
                }
                
                if (fieldRules.pattern && !fieldRules.pattern.test(value)) {
                    errors[field] = `${field} format is invalid`;
                }
            }
        }
        
        return Object.keys(errors).length === 0 ? null : errors;
    }
}

// Export instances
const auth = new AuthHandler();
const apiManager = new APIKeyManager();

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Set up logout handler
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await supabase.auth.signOut();
            window.location.href = '/';
        });
    }
});
