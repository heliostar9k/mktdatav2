// Helper functions for UI
function formatResult(result) {
    if (!result) return '';
    
    return `
        <div class="mb-4 p-6 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <div class="text-xl font-bold text-gray-900">${result.ticker}</div>
                    <div class="text-sm text-gray-600">${result.company_name}</div>
                </div>
                <div class="flex gap-2">
                    ${result.live_status === 'Yes' 
                        ? '<span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">Live</span>' 
                        : ''}
                    <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                        Strength: ${result.pattern_strength}
                    </span>
                </div>
            </div>
            
            <div class="space-y-3">
                <div class="text-sm">
                    <div class="font-medium mb-1">Pattern Keywords:</div>
                    <div class="text-gray-700">${result.pattern_keywords || 'N/A'}</div>
                </div>
                <div class="text-sm">
                    <div class="font-medium mb-1">Description:</div>
                    <div class="text-gray-700 whitespace-pre-wrap">${result.pattern_description || 'N/A'}</div>
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
        results.innerHTML = '<div class="p-4 text-red-600 bg-red-50 rounded-lg">Please enter a query</div>';
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
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="p-4 bg-gray-50 rounded-lg">
                            <div class="font-medium mb-1">Query Type</div>
                            <div class="text-gray-700">${data.analysis.understanding.query_type}</div>
                        </div>
                        <div class="p-4 bg-gray-50 rounded-lg">
                            <div class="font-medium mb-1">Time Sensitive</div>
                            <div class="text-gray-700">${data.analysis.understanding.time_sensitive ? 'Yes' : 'No'}</div>
                        </div>
                        <div class="p-4 bg-gray-50 rounded-lg">
                            <div class="font-medium mb-1">Requires Live Data</div>
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
            resultsHtml = data.results.map(formatResult).join('');
        } else {
            resultsHtml = '<div class="p-4 text-yellow-600 bg-yellow-50 rounded-lg mb-4">No pattern matches found in database</div>';
        }

        // Add Perplexity insights if available
        if (data.additional_insights) {
            resultsHtml += `
                <div class="p-6 bg-blue-50 rounded-lg">
                    <div class="font-bold text-blue-900 mb-2">Additional Market Insights</div>
                    <div class="text-gray-800 whitespace-pre-wrap">${data.additional_insights}</div>
                </div>
            `;
        }
        
        results.innerHTML = resultsHtml;
        
    } catch (error) {
        console.error('Error:', error);
        results.innerHTML = `<div class="p-4 text-red-600 bg-red-50 rounded-lg">Error: ${error.message}</div>`;
        queryAnalysis.innerHTML = '<div class="p-4 text-red-600 bg-red-50 rounded-lg">Analysis failed</div>';
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
