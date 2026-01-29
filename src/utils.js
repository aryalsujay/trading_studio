export function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
    }).format(amount);
}

export function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
    }).format(date);
}

export function formatPercent(value) {
    return `${value.toFixed(2)}%`;
}

export function formatNumber(num) {
    return new Intl.NumberFormat('en-IN').format(num);
}

export function getTodayDate() {
    const today = new Date();
    return today.toISOString().split('T')[0];
}
