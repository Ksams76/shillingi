const BACKEND_URL = '/api/transactions';
const LAST_SYNC_KEY = 'shilingi_last_sync';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognitionSupported = !!SpeechRecognition;

window.addEventListener('online', updateSyncStatus);
window.addEventListener('offline', updateSyncStatus);
window.addEventListener('load', async () => {
    await loadApp();
});

async function loadApp() {
    await updateSyncStatus();
    await renderAllTransactions();
    await updateDashboard();
}

async function updateSyncStatus() {
    const isOnline = navigator.onLine;
    const statusIndicator = document.getElementById('syncStatus');
    const syncText = document.getElementById('syncText');
    const lastSync = document.getElementById('lastSync');

    if (isOnline) {
        try {
            const response = await fetch('/api/ping');
            if (response.ok) {
                statusIndicator.classList.remove('offline');
                syncText.textContent = 'Server ready';
                syncToCloud();
            } else {
                statusIndicator.classList.add('offline');
                syncText.textContent = 'Server unavailable';
            }
        } catch (error) {
            statusIndicator.classList.add('offline');
            syncText.textContent = 'Server unavailable';
        }
    } else {
        statusIndicator.classList.add('offline');
        syncText.textContent = 'Offline - server unavailable';
    }

    const lastSyncTime = localStorage.getItem(LAST_SYNC_KEY);
    if (lastSyncTime) {
        lastSync.textContent = `Last sync: ${new Date(lastSyncTime).toLocaleTimeString()}`;
    }
}

function syncToCloud() {
    if (!navigator.onLine) return;
    localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

function showSyncNotification() {
    const notification = document.getElementById('syncNotification');
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 3000);
}

async function addTransaction() {
    const type = document.getElementById('transactionType').value;
    const description = document.getElementById('description').value.trim();
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const date = document.getElementById('transactionDate').value;
    const notes = document.getElementById('notes').value.trim();

    if (!description || !amount || amount <= 0 || !date) {
        alert('Please fill in all required fields correctly.');
        return;
    }

    const transaction = {
        type,
        description,
        amount,
        category,
        date,
        notes,
        timestamp: new Date().toISOString()
    };

    try {
        await postTransaction(transaction);
        showSyncNotification();

        document.getElementById('description').value = '';
        document.getElementById('amount').value = '';
        document.getElementById('notes').value = '';
        document.getElementById('transactionDate').valueAsDate = new Date();

        await renderAllTransactions();
        await updateDashboard();
    } catch (error) {
        alert('Unable to save transaction. Please ensure the backend server is running.');
        console.error('Save error:', error);
    }
}

async function postTransaction(transaction) {
    const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(transaction)
    });

    if (!response.ok) {
        throw new Error('Failed to save transaction');
    }

    return response.json();
}

async function getTransactions() {
    const response = await fetch(BACKEND_URL);
    if (!response.ok) {
        throw new Error('Unable to load transactions from server');
    }
    return response.json();
}

async function deleteTransaction(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    const response = await fetch(`${BACKEND_URL}/${id}`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        alert('Unable to delete transaction. Please try again.');
        return;
    }

    await renderAllTransactions();
    await updateDashboard();
}

async function renderAllTransactions() {
    const allList = document.getElementById('transactionList');
    const incomeList = document.getElementById('incomeList');
    const expenseList = document.getElementById('expenseList');

    allList.innerHTML = '';
    incomeList.innerHTML = '';
    expenseList.innerHTML = '';

    try {
        const transactions = await getTransactions();

        if (transactions.length === 0) {
            allList.innerHTML = '<div class="empty-state"><p>No transactions yet. Add your first transaction to get started!</p></div>';
            incomeList.innerHTML = '<div class="empty-state"><p>No income transactions yet.</p></div>';
            expenseList.innerHTML = '<div class="empty-state"><p>No expense transactions yet.</p></div>';
            return;
        }

        transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        transactions.forEach(t => {
            const item = createTransactionItem(t);
            allList.appendChild(item.cloneNode(true));

            if (t.type === 'income') {
                incomeList.appendChild(createTransactionItem(t));
            } else {
                expenseList.appendChild(createTransactionItem(t));
            }
        });

        document.getElementById('transactionCount').textContent = `${transactions.length} Transaction${transactions.length !== 1 ? 's' : ''}`;
    } catch (error) {
        const errorHtml = '<div class="empty-state"><p>Unable to load transactions. Start the Python server and refresh the page.</p></div>';
        allList.innerHTML = errorHtml;
        incomeList.innerHTML = errorHtml;
        expenseList.innerHTML = errorHtml;
        console.error('Render error:', error);
    }
}

function createTransactionItem(transaction) {
    const item = document.createElement('div');
    item.className = `transaction-item ${transaction.type}`;

    const date = new Date(transaction.date).toLocaleDateString();
    const amountClass = transaction.type === 'income' ? 'income' : 'expense';
    const amountSign = transaction.type === 'income' ? '+' : '-';

    item.innerHTML = `
        <div class="transaction-info">
            <h4>${transaction.description}</h4>
            <p>${transaction.category} • ${date}${transaction.notes ? ` • ${transaction.notes}` : ''}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
            <div class="transaction-amount ${amountClass}">
                ${amountSign}KES ${transaction.amount.toFixed(2)}
            </div>
            <button class="delete-btn" onclick="deleteTransaction(${transaction.id})">Delete</button>
        </div>
    `;

    return item;
}

async function updateDashboard() {
    try {
        const transactions = await getTransactions();

        const totalIncome = transactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalExpense = transactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.amount, 0);

        const netProfit = totalIncome - totalExpense;

        document.getElementById('totalIncome').textContent = `KES ${totalIncome.toFixed(2)}`;
        document.getElementById('totalExpense').textContent = `KES ${totalExpense.toFixed(2)}`;
        document.getElementById('netProfit').textContent = `KES ${netProfit.toFixed(2)}`;
        document.getElementById('netProfit').parentElement.className = 'stat-box ' + (netProfit >= 0 ? 'income' : 'expense');

        const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;
        document.getElementById('profitMargin').textContent = `${profitMargin}%`;

        const uniqueDates = [...new Set(transactions.map(t => t.date))];
        const avgDailyRevenue = uniqueDates.length > 0 ? (totalIncome / uniqueDates.length).toFixed(0) : 0;
        document.getElementById('avgDailyRevenue').textContent = `KES ${avgDailyRevenue}`;

        document.getElementById('totalTransactions').textContent = transactions.length;

        updateProfitChart(totalIncome, totalExpense);
        updateHealthChart(transactions, netProfit);
        updateDailyChart(transactions);
    } catch (error) {
        console.error('Dashboard error:', error);
    }
}

function updateProfitChart(income, expense) {
    const ctx = document.getElementById('profitChart').getContext('2d');

    if (profitChart) profitChart.destroy();

    profitChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Income', 'Expenses'],
            datasets: [{
                data: [income, expense],
                backgroundColor: ['#28a745', '#dc3545'],
                borderColor: 'white',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function updateHealthChart(transactions, netProfit) {
    const dailyNet = transactions.reduce((agg, transaction) => {
        if (!agg[transaction.date]) agg[transaction.date] = 0;
        agg[transaction.date] += transaction.type === 'income' ? transaction.amount : -transaction.amount;
        return agg;
    }, {});

    const dates = Object.keys(dailyNet).sort();
    const values = dates.map(date => dailyNet[date]);
    const colors = values.map(value => value >= 0 ? '#28a745' : '#dc3545');

    const statusText = netProfit >= 0
        ? 'Healthy — you are making profit overall.'
        : 'Warning — current losses exceed income. Check your expenses.';
    document.getElementById('healthStatusText').textContent = statusText;

    const ctx = document.getElementById('healthChart').getContext('2d');
    if (healthChart) healthChart.destroy();

    healthChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [{
                label: 'Net Profit/Loss',
                data: values,
                backgroundColor: colors,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: context => {
                            const value = context.parsed.y;
                            return `KES ${value.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateDailyChart(transactions) {
    const dailyData = {};

    transactions.forEach(t => {
        if (!dailyData[t.date]) {
            dailyData[t.date] = { income: 0, expense: 0 };
        }
        if (t.type === 'income') {
            dailyData[t.date].income += t.amount;
        } else {
            dailyData[t.date].expense += t.amount;
        }
    });

    const dates = Object.keys(dailyData).sort().slice(-7);
    const incomeData = dates.map(d => dailyData[d].income);
    const expenseData = dates.map(d => dailyData[d].expense);

    const ctx = document.getElementById('dailyChart').getContext('2d');

    if (dailyChart) dailyChart.destroy();

    dailyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dates.map(d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
            datasets: [
                {
                    label: 'Income',
                    data: incomeData,
                    backgroundColor: '#28a745',
                    borderRadius: 5
                },
                {
                    label: 'Expenses',
                    data: expenseData,
                    backgroundColor: '#dc3545',
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(btn => btn.classList.remove('active'));

    const contentMap = {
        'all': 'allTab',
        'income': 'incomeTab',
        'expense': 'expenseTab'
    };

    document.getElementById(contentMap[tabName]).classList.add('active');
    event.target.classList.add('active');
}

async function exportData() {
    try {
        const transactions = await getTransactions();
        const dataStr = JSON.stringify(transactions, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `shilingi_ledger_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    } catch (error) {
        alert('Unable to export data. Please ensure the backend is running.');
        console.error('Export error:', error);
    }
}

async function clearAllData() {
    if (!confirm('⚠️ This will permanently delete all transactions. Are you sure?')) return;

    const response = await fetch(BACKEND_URL, {
        method: 'DELETE'
    });

    if (!response.ok) {
        alert('Unable to clear data. Please try again.');
        return;
    }

    await renderAllTransactions();
    await updateDashboard();
    alert('All data has been cleared.');
}

function startVoiceEntry() {
    const status = document.getElementById('voiceStatus');
    if (!recognitionSupported) {
        alert('Voice commands are not supported by your browser.');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    status.textContent = 'Listening... say a transaction like "Sold 2kg tomatoes for 200 shillings".';
    recognition.start();

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const parsed = parseVoiceTransaction(transcript);

        if (parsed.description) document.getElementById('description').value = parsed.description;
        if (parsed.amount) document.getElementById('amount').value = parsed.amount;
        if (parsed.type) document.getElementById('transactionType').value = parsed.type;
        if (parsed.category) document.getElementById('category').value = parsed.category;

        status.textContent = `Recognized: "${transcript}"`;
        if (!parsed.amount || !parsed.description) {
            status.textContent += ' Some details may need adjustment.';
        }
    };

    recognition.onerror = (event) => {
        status.textContent = 'Voice recognition error: ' + event.error;
    };

    recognition.onend = () => {
        if (status.textContent.startsWith('Listening')) {
            status.textContent = 'Voice listening ended. Try again or type the details.';
        }
    };
}

function parseVoiceTransaction(text) {
    const lower = text.toLowerCase();
    const transaction = {
        type: 'income',
        description: text,
        amount: null,
        category: 'General'
    };

    const amountMatch = lower.match(/([0-9]+(?:[.,][0-9]+)?)\s*(?:shillings|kes|ksh|sh|shs)?/);
    if (amountMatch) {
        transaction.amount = parseFloat(amountMatch[1].replace(',', '.'));
    }

    const categoryKeywords = [
        { keywords: ['tomato', 'tomatoes', 'vegetable', 'produce'], category: 'Produce' },
        { keywords: ['stock', 'supplier', 'wholesaler'], category: 'Stock' },
        { keywords: ['transport', 'taxi', 'delivery'], category: 'Transport' },
        { keywords: ['marketing', 'advertising', 'promo'], category: 'Marketing' }
    ];
    for (const item of categoryKeywords) {
        if (item.keywords.some(word => lower.includes(word))) {
            transaction.category = item.category;
            break;
        }
    }

    if (lower.includes('sold') || lower.includes('received') || lower.includes('income')) {
        transaction.type = 'income';
    } else if (lower.includes('bought') || lower.includes('paid') || lower.includes('cost') || lower.includes('expense')) {
        transaction.type = 'expense';
    }

    const cleanedDescription = text.replace(/for\s*[0-9]+(?:[.,][0-9]+)?\s*(?:shillings|kes|ksh|sh|shs)?/i, '').trim();
    if (cleanedDescription) {
        transaction.description = cleanedDescription;
    }

    return transaction;
}

function startReceiptScan() {
    const input = document.getElementById('receiptInput');
    input.value = '';
    input.click();
}

async function handleReceiptUpload(event) {
    const file = event.target.files[0];
    const status = document.getElementById('receiptStatus');

    if (!file) {
        status.textContent = 'No receipt image selected.';
        return;
    }

    status.textContent = 'Scanning receipt... please wait.';

    try {
        const { data: { text } } = await Tesseract.recognize(file, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    status.textContent = `Scanning receipt... ${Math.round(m.progress * 100)}%`;
                }
            }
        });

        const parsed = parseReceiptText(text);
        if (parsed.amount) document.getElementById('amount').value = parsed.amount;
        if (parsed.description) document.getElementById('description').value = parsed.description;
        if (parsed.category) document.getElementById('category').value = parsed.category;
        document.getElementById('transactionType').value = 'expense';
        if (parsed.date) document.getElementById('transactionDate').value = parsed.date;

        status.textContent = parsed.message;
    } catch (error) {
        status.textContent = 'Receipt scan failed. Try a clearer image.';
        console.error('Receipt OCR error:', error);
    }
}

function parseReceiptText(text) {
    const lower = text.toLowerCase();
    let amount = null;
    let date = null;
    let description = 'Receipt expense';
    let category = 'General';
    let message = 'Receipt scanned successfully. Verify the values before saving.';

    const totalMatch = lower.match(/(?:total|amount due|amount|sum|balance)[:\s]*([0-9]+(?:[.,][0-9]+)?)/);
    if (totalMatch) {
        amount = parseFloat(totalMatch[1].replace(',', '.'));
    } else {
        const allNumbers = [...lower.matchAll(/([0-9]+(?:[.,][0-9]+)?)/g)];
        if (allNumbers.length) {
            amount = parseFloat(allNumbers[allNumbers.length - 1][1].replace(',', '.'));
        }
    }

    const dateMatch = lower.match(/(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})|(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
    if (dateMatch) {
        const parsedDate = new Date(dateMatch[0]);
        if (!isNaN(parsedDate)) {
            date = parsedDate.toISOString().split('T')[0];
        }
    }

    const vendorMatch = text.split('\n').find(line => line.trim().length > 3 && /(?:shop|market|store|vendor|receipt|supermarket|restaurant|cafe)/i.test(line));
    if (vendorMatch) {
        description = vendorMatch.trim();
    }

    const categoryKeywords = [
        { keywords: ['market', 'vegetable', 'produce', 'tomato', 'farm'], category: 'Produce' },
        { keywords: ['supplier', 'stock', 'wholesaler', 'warehouse'], category: 'Stock' },
        { keywords: ['transport', 'taxi', 'delivery', 'fuel'], category: 'Transport' },
        { keywords: ['marketing', 'advertising', 'promo', 'signage'], category: 'Marketing' }
    ];
    for (const item of categoryKeywords) {
        if (item.keywords.some(word => lower.includes(word))) {
            category = item.category;
            break;
        }
    }

    if (!amount) {
        message = 'Could not find total amount in receipt. Please enter amount manually.';
    }

    return { amount, date, description, category, message };
}
