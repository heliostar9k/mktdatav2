// Helper function to safely format a result
function formatResult(result) {
    if (!result) return '';
    
    return `
        <div class="result-card">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h3 class="text-lg font-bold">${result.ticker || 'N/A'}</h3>
                    <p class="text-sm text-gray-600">${result.company_name || 'N/A'}</p>
                </div>
                <div>
                    <span class="badge ${result.live_status === 'Yes' ? 'badge-live' : 'badge-inactive'}">
                        ${result.live_status || 'N/A'}
                    </span>
                </div>
            </div>
            <div class="mb-3">
                <p><strong>Pattern Strength:</strong> ${result.pattern_strength || 'N/A'}</p>
                <p><strong>Factors:</strong> ${result.pattern_keywords || 'N/A'}</p>
                <p><strong>Description:</strong> ${result.pattern_description || 'N/A'}</p>
            </div>
        </div>
    `;
}

async function sendQuery() {
    const queryInput = document.getElementById('queryInput');
    const results = document.getElementById('results');
    const queryAnalysis = document.getElementById('queryAnalysis');
    
    if (!queryInput.value.trim()) {
        results.innerHTML = '<div class="text-red-500">Please enter a query</div>';
        return;
    }
    
    try {
        results.innerHTML = '<div class="loading">Processing query...</div>';
        queryAnalysis.innerHTML = '<div class="loading">Analyzing...</div>';
        
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: queryInput.value })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Display analysis
        if (data.analysis) {
            queryAnalysis.innerHTML = `
                <div>
                    <h4 class="font-semibold">Query Type: ${data.analysis.understanding.query_type || 'N/A'}</h4>
                    <p>Time Sensitive: ${data.analysis.understanding.time_sensitive}</p>
                    <p>Requires Live Data: ${data.analysis.understanding.requires_live_data}</p>
                </div>
            `;
        } else {
            queryAnalysis.innerHTML = '<div class="text-yellow-500">No analysis available</div>';
        }
        
        // Display results
        if (data.results && data.results.length > 0) {
            results.innerHTML = data.results.map(formatResult).join('');
        } else {
            results.innerHTML = '<div class="text-yellow-500">No results found</div>';
        }
        
    } catch (error) {
        console.error('Error:', error);
        results.innerHTML = `<div class="text-red-500">Error: ${error.message}</div>`;
        queryAnalysis.innerHTML = '<div class="text-red-500">Analysis failed</div>';
    }
}

function setQuery(query) {
    document.getElementById('queryInput').value = query;
    sendQuery();
}

// Handle Enter key
document.getElementById('queryInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendQuery();
    }
});
