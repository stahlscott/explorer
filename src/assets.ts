/**
 * Inlined into every artifact. No external URLs and no webfonts: the document
 * has to open from file:// with the network denied and lose nothing.
 */
import { MODES } from './styles/skins.ts';

export const PAGE_SCRIPT = `
(function () {
  var root = document.documentElement;
  var STORE = 'explorer-mode';

  // Every reading surface ships in the file, behind data-skin. The markup already
  // carries the default, so a reader with scripting off still gets a designed
  // page; this only moves between them.
  var MODES = ${JSON.stringify(MODES)};

  function apply(mode) {
    root.dataset.skin = mode.skin;
    if (mode.theme) root.dataset.theme = mode.theme;
    else delete root.dataset.theme;
    if (toggle) toggle.textContent = mode.label;
  }

  var toggle = document.querySelector('.theme-toggle');
  var index = 0;

  // Read before first paint would be better, but a self-contained file has one
  // script and it runs here. The flash is one frame.
  try {
    var saved = localStorage.getItem(STORE);
    for (var i = 0; i < MODES.length; i += 1) {
      if (MODES[i].id === saved) index = i;
    }
  } catch (e) { /* private mode: start from the default */ }

  apply(MODES[index]);

  if (toggle) {
    toggle.addEventListener('click', function () {
      index = (index + 1) % MODES.length;
      var mode = MODES[index];
      apply(mode);
      try { localStorage.setItem(STORE, mode.id); } catch (e) { /* nothing to do */ }
    });
  }

  // --- section nav -------------------------------------------------------
  var navLinks = [].slice.call(document.querySelectorAll('.toc a'));
  if (navLinks.length) {
    var targets = navLinks
      .map(function (link) {
        var id = link.getAttribute('href').slice(1);
        return { link: link, heading: document.getElementById(id) };
      })
      .filter(function (entry) { return entry.heading; });

    var current = null;
    function mark() {
      // The last heading whose top has passed the reading line. Cheaper than an
      // observer per heading and correct when several share a screen.
      var line = 120;
      var found = targets[0];
      for (var i = 0; i < targets.length; i += 1) {
        if (targets[i].heading.getBoundingClientRect().top <= line) found = targets[i];
      }

      // A short final section never climbs to the reading line, because there
      // is no document left to scroll. Reaching the end means being in it.
      var remaining =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      if (remaining <= 2) found = targets[targets.length - 1];
      if (found === current) return;
      if (current) current.link.removeAttribute('aria-current');
      found.link.setAttribute('aria-current', 'true');
      current = found;
    }

    var queued = false;
    function schedule() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; mark(); });
    }

    mark();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Clicking a link scrolls, but the anchored heading sits exactly on the
    // reading line, so settle it explicitly rather than waiting for a frame.
    navLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        setTimeout(mark, 0);
      });
    });
  }

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
