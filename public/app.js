// Helper functions for UI
function formatResult(result) {
    if (!result) return '';
    
    const strengthClass = 
        Math.abs(result.pattern_strength) > 0.7 ? 'high' :
        Math.abs(result.pattern_strength) > 0.4 ? 'medium' : 'low';
    
    return `
        <div class="p-4 border rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start">
                <div>
                    <div class="font-bold text-lg">${result.ticker}</div>
                    <div class="text-sm text-gray-600">${result.company_name}</div>
                </div>
                <div class="flex gap-2">
                    ${result.live_status === 'Yes' 
                        ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">Live</span>' 
                        : ''}
                    <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                        Strength: ${(result.pattern_strength * 100).toFixed(1)}%
                    </span>
                </div>
            </div>
            
            <div class="mt-4 space-y-2">
                <div class="text-sm">
                    <span class="font-semibold">Pattern Keywords:</span> 
                    <span class="text-gray-700">${result.pattern_keywords || 'N/A'}</span>
                </div>
                <div class="text-sm">
                    <span class="font-semibold">Description:</span> 
                    <span class="text-gray-700">${result.pattern_description || 'N/A'}</span>
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
        results.innerHTML = '<div class="p-4 text-red-500 bg-red-50 rounded-lg">Please enter a query</div>';
        return;
    }
    
    try {
        // Show loading states
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
                <div class="p-4 space-y-2">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="p-3 bg-gray-50 rounded-lg">
                            <div class="font-semibold">Query Type</div>
                            <div class="text-gray-700">${data.analysis.understanding.query_type}</div>
                        </div>
                        <div class="p-3 bg-gray-50 rounded-lg">
                            <div class="font-semibold">Time Sensitive</div>
                            <div class="text-gray-700">${data.analysis.understanding.time_sensitive ? 'Yes' : 'No'}</div>
                        </div>
                        <div class="p-3 bg-gray-50 rounded-lg">
                            <div class="font-semibold">Requires Live Data</div>
                            <div class="text-gray-700">${data.analysis.understanding.requires_live_data ? 'Yes' : 'No'}</div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            queryAnalysis.innerHTML = '<div class="p-4 text-yellow-600 bg-yellow-50 rounded-lg">No analysis available</div>';
        }
        
        // Display Results
        let resultsHtml = '';
        
        if (data.results && data.results.length > 0) {
            resultsHtml = `
                <div class="space-y-4">
                    ${data.results.map(formatResult).join('')}
                </div>
            `;
        } else {
            resultsHtml = '<div class="p-4 text-yellow-600 bg-yellow-50 rounded-lg">No pattern matches found in database</div>';
        }

        // Add Perplexity insights if available
        if (data.additional_insights) {
            resultsHtml += `
                <div class="mt-6 p-4 bg-blue-50 rounded-lg">
                    <div class="font-semibold text-blue-800 mb-2">Additional Market Insights</div>
                    <div class="text-gray-700">${data.additional_insights}</div>
                </div>
            `;
        }
        
        results.innerHTML = resultsHtml;
        
    } catch (error) {
        console.error('Error:', error);
        results.innerHTML = `
            <div class="p-4 text-red-600 bg-red-50 rounded-lg">
                Error: ${error.message}
            </div>
        `;
        queryAnalysis.innerHTML = '<div class="p-4 text-red-600 bg-red-50 rounded-lg">Analysis failed</div>';
    }
}

function setQuery(query) {
    document.getElementById('queryInput').value = query;
    sendQuery();
}

// Handle Enter key press
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
