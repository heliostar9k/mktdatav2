// Helper functions for UI
function formatResult(result) {
    const strengthClass = 
        Math.abs(result.pattern_strength) > 0.7 ? 'high' :
        Math.abs(result.pattern_strength) > 0.4 ? 'medium' : 'low';
    
    return `
        <div class="result-card">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h3 class="text-lg font-bold text-white">${result.ticker}</h3>
                    <p class="text-sm text-gray-400">${result.company_name}</p>
                </div>
                <div class="flex gap-2">
                    ${result.live_status === 'Yes' ? 
                        '<span class="badge badge-live">Live</span>' : ''}
                    <span class="badge badge-strength-${strengthClass}">
                        Strength: ${(result.pattern_strength * 100).toFixed(1)}%
                    </span>
                </div>
            </div>
            <div class="mb-3">
                <div class="text-sm text-gray-300 mb-2">
                    <strong>Pattern Keywords:</strong> ${result.pattern_keywords}
                </div>
                <div class="text-sm text-gray-300">
                    <strong>Description:</strong> ${result.pattern_description}
                </div>
            </div>
            <div class="text-xs text-gray-500">
                Created: ${new Date(result.created_at).toLocaleDateString()}
            </div>
        </div>
    `;
}

function formatAnalysis(analysis) {
    return `
        <div class="mb-4">
            <h3 class="font-semibold mb-2">Query Understanding:</h3>
            <div class="text-sm">
                <p>Type: ${analysis.strategy.query_intent.primary_type}</p>
                <p>Requires Live Data: ${analysis.strategy.query_intent.requires_live}</p>
                <p>Strength Focus: ${analysis.strategy.query_intent.strength_focus}</p>
            </div>
        </div>
        <div>
            <h3 class="font-semibold mb-2">Search Terms:</h3>
            <div class="text-sm">
                <p>Exact Matches: ${JSON.stringify(analysis.strategy.exact_matches)}</p>
                <p>Related Terms: ${JSON.stringify(analysis.strategy.related_terms)}</p>
            </div>
        </div>
    `;
}

async function sendQuery() {
    const queryInput = document.getElementById('queryInput');
    const results = document.getElementById('results');
    const queryAnalysis = document.getElementById('queryAnalysis');
    const resultCount = document.getElementById('resultCount');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    if (!queryInput.value.trim()) {
        results.innerHTML = '<div class="text-yellow-500">Please enter a query</div>';
        return;
    }
    
    try {
        // Show loading states
        loadingIndicator.classList.remove('hidden');
        results.innerHTML = '<div class="loading">Processing query...</div>';
        queryAnalysis.innerHTML = '<div class="loading">Analyzing...</div>';
        resultCount.innerText = 'Searching...';
        
        const response = await fetch('https://mktdata-production.up.railway.app/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: queryInput.value })
        });
        
        const data = await response.json();
        
        // Update analysis section
        if (data.analysis) {
            queryAnalysis.innerHTML = formatAnalysis(data.analysis);
        }
        
        // Update results section
        if (data.results && data.results.length > 0) {
            results.innerHTML = data.results.map(formatResult).join('');
            resultCount.innerHTML = `<span class="text-green-500">Found ${data.results.length} results</span>`;
        } else {
            results.innerHTML = '<div class="text-yellow-500">No results found</div>';
            resultCount.innerHTML = '<span class="text-yellow-500">No results</span>';
        }
    } catch (error) {
        results.innerHTML = `<div class="text-red-500">Error: ${error.message}</div>`;
        resultCount.innerHTML = '<span class="text-red-500">Error occurred</span>';
    } finally {
        loadingIndicator.classList.add('hidden');
    }
}

function setQuery(query) {
    document.getElementById('queryInput').value = query;
    sendQuery();
}

// Handle Enter key in search input
document.getElementById('queryInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendQuery();
    }
});
