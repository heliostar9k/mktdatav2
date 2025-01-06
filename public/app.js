// Helper function to safely format a result
function formatResult(result) {
    if (!result) return '';
    
    // Convert pattern strength to decimal if it's in percentage form
    const strengthValue = result.pattern_strength.toString().includes('%') 
        ? parseFloat(result.pattern_strength) / 100 
        : result.pattern_strength;
    
    return `
        <div class="bg-white rounded-xl shadow-md p-6 mb-4 hover:shadow-lg transition-all">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="text-xl font-bold text-gray-900">${result.ticker || 'N/A'}</h3>
                    <p class="text-sm text-gray-600">${result.company_name || 'N/A'}</p>
                </div>
                <div class="flex gap-2">
                    ${result.live_status === 'Yes' 
                        ? '<span class="px-2.5 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Live</span>' 
                        : ''}
                    <span class="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                        Strength: ${strengthValue.toFixed(2)}
                    </span>
                </div>
            </div>
            
            <div class="space-y-3">
                <div>
                    <h4 class="text-sm font-semibold text-gray-700 mb-1">Pattern Keywords:</h4>
                    <p class="text-sm text-gray-600">${result.pattern_keywords || 'N/A'}</p>
                </div>
                <div>
                    <h4 class="text-sm font-semibold text-gray-700 mb-1">Description:</h4>
                    <p class="text-sm text-gray-600 whitespace-pre-wrap">${result.pattern_description || 'N/A'}</p>
                </div>
            </div>
        </div>
    `;
}

async function sendQuery() {
    const queryInput = document.getElementById('queryInput');
    const results = document.getElementById('results');
    const queryAnalysis = document.getElementById('queryAnalysis');
    
    if (!queryInput.value.trim()) {
        results.innerHTML = '<div class="p-4 bg-red-50 text-red-600 rounded-lg">Please enter a query</div>';
        return;
    }
    
    try {
        results.innerHTML = '<div class="p-4 text-blue-600 animate-pulse">Searching patterns...</div>';
        queryAnalysis.innerHTML = '<div class="p-4 text-blue-600 animate-pulse">Analyzing query...</div>';
        
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: queryInput.value })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Display Analysis
        if (data.analysis) {
            queryAnalysis.innerHTML = `
                <div class="space-y-4">
                    <div class="grid grid-cols-1 gap-4">
                        <div class="bg-gray-50 rounded-lg p-4">
                            <h4 class="font-semibold text-gray-700 mb-2">Query Type</h4>
                            <p class="text-gray-600 capitalize">${data.analysis.understanding.query_type}</p>
                        </div>
                        <div class="bg-gray-50 rounded-lg p-4">
                            <h4 class="font-semibold text-gray-700 mb-2">Time Sensitive</h4>
                            <p class="text-gray-600">${data.analysis.understanding.time_sensitive ? 'Yes' : 'No'}</p>
                        </div>
                        <div class="bg-gray-50 rounded-lg p-4">
                            <h4 class="font-semibold text-gray-700 mb-2">Requires Live Data</h4>
                            <p class="text-gray-600">${data.analysis.understanding.requires_live_data ? 'Yes' : 'No'}</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            queryAnalysis.innerHTML = '<div class="p-4 bg-yellow-50 text-yellow-600 rounded-lg">No analysis available</div>';
        }
        
        // Display Results
        let resultsHtml = '';
        
        if (data.results && data.results.length > 0) {
            resultsHtml = data.results.map(formatResult).join('');
        } else {
            resultsHtml = '<div class="p-4 bg-yellow-50 text-yellow-600 rounded-lg mb-4">No pattern matches found in database</div>';
        }

        // Add Perplexity insights if available
        if (data.additional_insights) {
            resultsHtml += `
                <div class="mt-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <h3 class="text-lg font-semibold text-blue-900 mb-3">Additional Market Insights</h3>
                    <div class="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">${data.additional_insights}</div>
                </div>
            `;
        }
        
        results.innerHTML = resultsHtml;
        
    } catch (error) {
        console.error('Error:', error);
        results.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded-lg">Error: ${error.message}</div>`;
        queryAnalysis.innerHTML = '<div class="p-4 bg-red-50 text-red-600 rounded-lg">Analysis failed</div>';
    }
}

function setQuery(query) {
    document.getElementById('queryInput').value = query;
    sendQuery();
}

// Handle Enter key
document.addEventListener('DOMContentLoaded', () => {
    const queryInput = document.getElementById('queryInput');
    if (queryInput) {
        queryInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendQuery();
            }
        });
    }
});
