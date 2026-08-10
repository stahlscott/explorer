/**
 * Inlined into every artifact. No external URLs and no webfonts: the document
 * has to open from file:// with the network denied and lose nothing.
 */
export const PAGE_SCRIPT = `
(function () {
  var toast = document.querySelector('.toast');
  var toastTimer;

  function flash(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 1600);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // file:// without an async clipboard still has the synchronous path.
    var scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    scratch.style.position = 'fixed';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    scratch.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(scratch); }
    return Promise.resolve();
  }

  document.addEventListener('click', function (event) {
    var ask = event.target.closest('.ask');
    if (ask) {
      copy(ask.getAttribute('data-ask') || '')
        .then(function () { flash('prompt copied'); })
        .catch(function () { flash('could not copy'); });
      return;
    }

    var more = event.target.closest('.cite-more');
    if (!more) return;

    var figure = more.closest('figure.cite');
    // Context opens inside the figure, above the cited lines. Anchor on the
    // first cited line rather than the figure: the figure's top does not move,
    // but the code the reader is actually looking at does.
    var anchor = figure.querySelector('.line:not(.ctx)') || figure;
    var before = anchor.getBoundingClientRect().top;
    var expanded = figure.hasAttribute('data-expanded');
    if (expanded) figure.removeAttribute('data-expanded');
    else figure.setAttribute('data-expanded', '');
    more.setAttribute('aria-expanded', String(!expanded));
    more.textContent = expanded ? 'context' : 'less';
    window.scrollBy(0, anchor.getBoundingClientRect().top - before);
  });
})();
`;
