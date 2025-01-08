// Initialize Supabase client
const supabase = supabase.createClient(
    'https://mjpdiadvjjpjfrlkyhez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcGRpYWR2ampwamZybGt5aGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwOTMwNjAsImV4cCI6MjA1MTY2OTA2MH0.PSUC_M0sc19QuIAU885xHwlzD-g-YsIzAhPuNFQPfmg'
);

// Auth state management
let currentUser = null;

// Check auth state on page load
async function checkAuth() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        
        currentUser = user;
        updateUIForAuthState();
        
    } catch (error) {
        console.error('Auth error:', error);
        currentUser = null;
        updateUIForAuthState();
    }
}

// Update UI based on auth state
function updateUIForAuthState() {
    // Navigation elements
    const loginBtn = document.getElementById('loginBtn');
    const dashboardBtn = document.getElementById('dashboardBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const queryInput = document.getElementById('queryInput');
    const getApiBtn = document.getElementById('getApiBtn');

    if (currentUser) {
        // User is logged in
        if (loginBtn) loginBtn.style.display = 'none';
        if (dashboardBtn) dashboardBtn.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (queryInput) queryInput.removeAttribute('readonly');
        if (getApiBtn) getApiBtn.textContent = 'Go to Dashboard';
        
        // If on login page, redirect to dashboard
        if (window.location.pathname.includes('/auth/login.html')) {
            window.location.href = '/auth/dashboard.html';
        }
    } else {
        // User is logged out
        if (loginBtn) loginBtn.style.display = 'block';
        if (dashboardBtn) dashboardBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (queryInput) queryInput.setAttribute('readonly', true);
        if (getApiBtn) getApiBtn.textContent = 'Get API Access';
        
        // If on dashboard, redirect to login
        if (window.location.pathname.includes('/auth/dashboard.html')) {
            window.location.href = '/auth/login.html';
        }
    }
}

// Handle login
async function handleLogin(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        currentUser = data.user;
        window.location.href = '/auth/dashboard.html';
    } catch (error) {
        throw error;
    }
}

// Handle registration
async function handleRegister(email, password) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });

        if (error) throw error;

        showMessage('Registration successful! Please check your email for verification.', 'success');
        toggleForm('login'); // Switch back to login form
    } catch (error) {
        throw error;
    }
}

// Handle logout
async function handleLogout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        
        currentUser = null;
        window.location.href = '/';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Show message to user
function showMessage(message, type = 'success') {
    const alertDiv = document.getElementById('alertMessage');
    if (!alertDiv) return;

    alertDiv.textContent = message;
    alertDiv.className = `alert alert-${type} mb-4`;
    alertDiv.style.display = 'block';

    setTimeout(() => {
        alertDiv.style.display = 'none';
    }, 5000);
}

// Initialize listeners
document.addEventListener('DOMContentLoaded', () => {
    // Check auth state immediately
    checkAuth();

    // Set up auth state change listener
    supabase.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        updateUIForAuthState();
    });
});

// Expose necessary functions
window.handleLogin = handleLogin;
window.handleRegister = handleRegister;
window.handleLogout = handleLogout;
window.showMessage = showMessage;
