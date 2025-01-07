// Initialize Supabase client
const supabase = createClient(
    'https://mjpdiadvjjpjfrlkyhez.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1qcGRpYWR2ampwamZybGt5aGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwOTMwNjAsImV4cCI6MjA1MTY2OTA2MH0.PSUC_M0sc19QuIAU885xHwlzD-g-YsIzAhPuNFQPfmg'
);

// Check authentication status on page load
async function checkAuth() {
    const session = localStorage.getItem('userSession');
    if (!session) {
        window.location.href = '/login.html';
        return;
    }

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
        localStorage.removeItem('userSession');
        window.location.href = '/login.html';
        return;
    }

    // Load user's API key
    loadApiKey();
}

// Load user's API key
async function loadApiKey() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('api_keys')
            .select('key')
            .eq('user_id', user.id)
            .single();

        if (error) throw error;

        const apiKeyInput = document.getElementById('apiKey');
        apiKeyInput.value = data ? data.key : 'No API key generated';
    } catch (error) {
        console.error('Error loading API key:', error);
        document.getElementById('apiKey').value = 'Error loading API key';
    }
}

// Generate new API key
async function generateNewKey() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // Generate a random API key
        const apiKey = 'mk_' + [...Array(32)].map(() => Math.random().toString(36)[2]).join('');
        
        // Store in database
        const { error } = await supabase
            .from('api_keys')
            .upsert({ 
                user_id: user.id,
                key: apiKey,
                created_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (error) throw error;

        // Update display
        document.getElementById('apiKey').value = apiKey;
        
    } catch (error) {
        console.error('Error generating API key:', error);
        alert('Error generating new API key');
    }
}

// Handle logout
document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await supabase.auth.signOut();
        localStorage.removeItem('userSession');
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Error logging out:', error);
        alert('Error logging out');
    }
});

// Initialize page
checkAuth();
