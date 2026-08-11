// src/services/share/webShare.js
async function shareOrCopy({ title, text, url }, fallbackText, onFallbackCopied) {
  try {
    if (navigator.share) {
      await navigator.share(url ? { title, text, url } : { title, text });
    } else {
      copyToClipboard(fallbackText);
      if (onFallbackCopied) onFallbackCopied();
    }
  } catch {
  }
}

