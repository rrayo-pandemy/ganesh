/* ============================================
   API CONFIGURATION (Shared)
   ============================================ */

(function initApiConfig() {
  'use strict';

  function getApiBaseCandidates() {
    const candidates = [];
    const addCandidate = (value) => {
      if (typeof value !== 'string') return;
      const normalized = value.trim().replace(/\/$/, '');
      if (!normalized && normalized !== '') return;
      if (!candidates.includes(normalized)) candidates.push(normalized);
    };

    if (typeof window.API_BASE === 'string' && window.API_BASE.trim()) {
      addCandidate(window.API_BASE);
    }

    if (window.location.port === '8000') {
      addCandidate(window.location.protocol + '//' + window.location.hostname + ':5000');
    }
    addCandidate('');
    return candidates;
  }

  function buildApiUrl(base, path) {
    if (/^https?:\/\//i.test(path)) return path;
    return base ? `${base}${path}` : path;
  }

  window.ApiConfig = {
    getBaseCandidates: getApiBaseCandidates,
    buildUrl: buildApiUrl,
  };
})();
