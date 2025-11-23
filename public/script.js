class TinyLinkApp {
    constructor() {
        this.links = [];
        this.filteredLinks = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadLinks();
        this.handleRoute();
    }

    bindEvents() {
        // Form submission
        document.getElementById('linkForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createLink();
        });

        // Search functionality
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.filterLinks(e.target.value);
        });

        // Real-time validation
        document.getElementById('url').addEventListener('input', (e) => {
            this.validateUrl(e.target.value);
        });

        document.getElementById('customCode').addEventListener('input', (e) => {
            this.validateCustomCode(e.target.value);
        });
    }

    handleRoute() {
        const path = window.location.pathname;
        if (path.startsWith('/code/')) {
            const code = path.split('/')[2];
            this.showLinkStats(code);
        }
    }

    async loadLinks() {
        this.showLoading();

        try {
            const response = await fetch('/api/links');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            this.links = await response.json();
            this.filteredLinks = [...this.links];
            this.renderLinks();
            this.updateLinksCount();
        } catch (error) {
            this.showError('Failed to load links: ' + error.message);
        }
    }

    async createLink() {
        const url = document.getElementById('url').value;
        const customCode = document.getElementById('customCode').value;
        const submitBtn = document.getElementById('submitBtn');

        // Validate form
        if (!this.validateUrl(url) || !this.validateCustomCode(customCode, true)) {
            return;
        }

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating...';

        try {
            const response = await fetch('/api/links', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: url,
                    customCode: customCode || undefined
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}`);
            }

            // Reset form
            document.getElementById('linkForm').reset();
            this.clearErrors();

            // Show success with short URL
            const shortUrl = `${window.location.origin}/${data.short_code}`;
            this.showToast(`Link created: ${shortUrl}`, 'success');

            // Reload links
            await this.loadLinks();
        } catch (error) {
            this.showToast('Error: ' + error.message, 'error');
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Shorten URL';
        }
    }

    async deleteLink(code) {
        if (!confirm('Are you sure you want to delete this link?')) {
            return;
        }

        try {
            const response = await fetch(`/api/links/${code}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to delete link');
            }

            this.showToast('Link deleted successfully!', 'success');
            await this.loadLinks();
        } catch (error) {
            this.showToast('Failed to delete link: ' + error.message, 'error');
        }
    }

    filterLinks(searchTerm) {
        if (!searchTerm) {
            this.filteredLinks = [...this.links];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredLinks = this.links.filter(link =>
                link.short_code.toLowerCase().includes(term) ||
                link.original_url.toLowerCase().includes(term)
            );
        }
        this.renderLinks();
        this.updateLinksCount();
    }

    renderLinks() {
        const tableBody = document.getElementById('linksTableBody');
        const tableContainer = document.getElementById('tableContainer');
        const emptyState = document.getElementById('emptyState');
        const loadingState = document.getElementById('loadingState');

        // Hide loading state
        loadingState.classList.add('hidden');

        if (this.filteredLinks.length === 0) {
            tableContainer.classList.add('hidden');
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        tableContainer.classList.remove('hidden');

        tableBody.innerHTML = this.filteredLinks.map(link => `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center space-x-2">
                        <code class="font-mono text-sm bg-gray-100 px-2 py-1 rounded border text-gray-800">
                            ${this.escapeHtml(link.short_code)}
                        </code>
                        <button 
                            onclick="app.copyToClipboard('${this.escapeHtml(link.short_code)}', this)"
                            class="copy-btn text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors"
                            title="Copy short URL"
                        >
                            Copy
                        </button>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <a href="${this.escapeHtml(link.original_url)}" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       class="text-blue-600 hover:text-blue-800 truncate-url block max-w-xs transition-colors"
                       title="${this.escapeHtml(link.original_url)}">
                        ${this.escapeHtml(link.original_url)}
                    </a>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        ${link.clicks}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${link.last_clicked_at ? new Date(link.last_clicked_at).toLocaleDateString() + ' ' + new Date(link.last_clicked_at).toLocaleTimeString() : 'Never'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button onclick="app.showLinkStats('${this.escapeHtml(link.short_code)}')" 
                          class="text-blue-600 hover:text-blue-900 mr-3 transition-colors">Stats</button>
                    <button 
                        onclick="app.deleteLink('${this.escapeHtml(link.short_code)}')"
                        class="text-red-600 hover:text-red-900 transition-colors">Delete</button>
                </td>
            </tr>
        `).join('');
    }

    async showLinkStats(code) {
        try {
            const response = await fetch(`/api/links/${code}`);
            if (!response.ok) throw new Error('Link not found');

            const link = await response.json();

            // Create a modal to show stats
            const statsHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg max-w-md w-full max-h-96 overflow-auto">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold">Stats for: ${this.escapeHtml(code)}</h3>
                            <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                                ✕
                            </button>
                        </div>
                        
                        <div class="space-y-3">
                            <div>
                                <strong class="block text-sm font-medium text-gray-700 mb-1">Original URL:</strong> 
                                <a href="${this.escapeHtml(link.original_url)}" target="_blank" class="text-blue-600 hover:text-blue-800 break-all text-sm">
                                    ${this.escapeHtml(link.original_url)}
                                </a>
                            </div>
                            
                            <div class="flex justify-between items-center">
                                <strong class="text-sm font-medium text-gray-700">Clicks:</strong> 
                                <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">${link.clicks}</span>
                            </div>
                            
                            <div class="flex justify-between items-center">
                                <strong class="text-sm font-medium text-gray-700">Created:</strong> 
                                <span class="text-gray-600 text-sm">${new Date(link.created_at).toLocaleString()}</span>
                            </div>
                            
                            <div class="flex justify-between items-center">
                                <strong class="text-sm font-medium text-gray-700">Last Clicked:</strong> 
                                <span class="text-gray-600 text-sm">${link.last_clicked_at ? new Date(link.last_clicked_at).toLocaleString() : 'Never'}</span>
                            </div>
                            
                            <div class="pt-4 border-t">
                                <strong class="block text-sm font-medium text-gray-700 mb-2">Short URL:</strong>
                                <div class="flex items-center space-x-2">
                                    <code class="flex-1 bg-gray-100 px-3 py-2 rounded text-sm border break-all">${window.location.origin}/${this.escapeHtml(code)}</code>
                                    <button onclick="app.copyShortUrl('${this.escapeHtml(code)}', this)" 
                                            class="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors whitespace-nowrap">
                                        Copy
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

            // Add to document
            document.body.insertAdjacentHTML('beforeend', statsHtml);
        } catch (error) {
            this.showToast('Error loading stats: ' + error.message, 'error');
        }
    }

    async copyShortUrl(code, button) {
        const fullUrl = `${window.location.origin}/${code}`;
        await this.copyToClipboard(code, button);
    }

    updateLinksCount() {
        const countElement = document.getElementById('linksCount');
        const total = this.links.length;
        const filtered = this.filteredLinks.length;

        if (total === filtered) {
            countElement.textContent = `${total} link${total !== 1 ? 's' : ''}`;
        } else {
            countElement.textContent = `${filtered} of ${total} links`;
        }
    }

    async copyToClipboard(text, button) {
        const fullUrl = `${window.location.origin}/${text}`;
        
        try {
            await navigator.clipboard.writeText(fullUrl);
            this.showToast(' Short URL copied to clipboard!', 'success');

            // Visual feedback on button
            if (button) {
                const originalText = button.textContent;
                button.textContent = 'Copied!';
                button.classList.add('copied');

                setTimeout(() => {
                    button.textContent = originalText;
                    button.classList.remove('copied');
                }, 2000);
            }
        } catch (error) {
            console.error('Copy failed:', error);
            this.showToast('Failed to copy to clipboard', 'error');
        }
    }

    validateUrl(url) {
        const urlInput = document.getElementById('url');
        const errorElement = document.getElementById('urlError');

        if (!url) {
            this.hideError(errorElement);
            urlInput.classList.remove('input-error', 'input-success');
            return false;
        }

        try {
            new URL(url);
            this.hideError(errorElement);
            urlInput.classList.remove('input-error');
            urlInput.classList.add('input-success');
            return true;
        } catch {
            this.showErrorElement(errorElement, 'Please enter a valid URL with http:// or https://');
            urlInput.classList.remove('input-success');
            urlInput.classList.add('input-error');
            return false;
        }
    }

    validateCustomCode(code, forSubmit = false) {
        const codeInput = document.getElementById('customCode');
        const errorElement = document.getElementById('codeError');

        if (!code) {
            this.hideError(errorElement);
            codeInput.classList.remove('input-error', 'input-success');
            return true;
        }

        if (!/^[A-Za-z0-9]{6,8}$/.test(code)) {
            const message = forSubmit
                ? 'Custom code must be 6-8 characters and contain only letters and numbers'
                : '6-8 characters, letters and numbers only';
            this.showErrorElement(errorElement, message);
            codeInput.classList.remove('input-success');
            codeInput.classList.add('input-error');
            return false;
        }

        this.hideError(errorElement);
        codeInput.classList.remove('input-error');
        codeInput.classList.add('input-success');
        return true;
    }

    showLoading() {
        document.getElementById('loadingState').classList.remove('hidden');
        document.getElementById('tableContainer').classList.add('hidden');
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('errorState').classList.add('hidden');
    }

    showError(message) {
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('tableContainer').classList.add('hidden');
        document.getElementById('emptyState').classList.add('hidden');

        const errorState = document.getElementById('errorState');
        const errorMessage = document.getElementById('errorMessage');

        errorMessage.textContent = message;
        errorState.classList.remove('hidden');
    }

    showToast(message, type = 'info', duration = 3000) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        const toastIcon = document.getElementById('toastIcon');

        // Set icon based on type
        const icons = {
            success: '',
            error: '',
            info: ''
        };

        toastIcon.textContent = icons[type] || '';
        toastMessage.textContent = message;

        // Set style
        toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg border hidden max-w-sm z-50 transition-all duration-300 transform ${'toast-' + type}`;

        // Show toast
        toast.classList.remove('hidden', 'translate-x-full');
        toast.classList.add('translate-x-0');

        // Auto hide
        if (duration > 0) {
            setTimeout(() => {
                this.hideToast();
            }, duration);
        }
    }

    hideToast() {
        const toast = document.getElementById('toast');
        toast.classList.remove('translate-x-0');
        toast.classList.add('translate-x-full');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }

    showErrorElement(element, message) {
        element.textContent = message;
        element.classList.remove('hidden');
    }

    hideError(element) {
        element.classList.add('hidden');
    }

    clearErrors() {
        document.getElementById('urlError').classList.add('hidden');
        document.getElementById('codeError').classList.add('hidden');

        document.getElementById('url').classList.remove('input-error', 'input-success');
        document.getElementById('customCode').classList.remove('input-error', 'input-success');
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TinyLinkApp();
});