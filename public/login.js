// Initialize Supabase client
const supabase = createClient(
    'https://mjpdiadvjjpjfrlkyhez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcGRpYWR2ampwamZybGt5aGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwOTMwNjAsImV4cCI6MjA1MTY2OTA2MH0.PSUC_M0sc19QuIAU885xHwlzD-g-YsIzAhPuNFQPfmg'
);

// Toggle between login and registration forms
function toggleForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    if (loginForm.classList.contains('hidden')) {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    }
}

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (error) throw error;
        
        // Store session
        localStorage.setItem('userSession', JSON.stringify(data.session));
        
        // Redirect to dashboard
        window.location.href = '/dashboard.html';
    } catch (error) {
        alert('Error logging in: ' + error.message);
    }
});

// Handle registration form submission
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password
        });
        
        if (error) throw error;
        
        alert('Registration successful! Please check your email for verification.');
        toggleForm(); // Switch back to login form
    } catch (error) {
        alert('Error registering: ' + error.message);
    }
});

// Check if user is already logged in
window.addEventListener('DOMContentLoaded', async () => {
    const session = localStorage.getItem('userSession');
    if (session) {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (user && !error) {
            window.location.href = '/dashboard.html';
        }
    }
});
