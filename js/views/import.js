// views/import.js, Import a quiz, two ways:
//   1. From a QuizForge JSON file (the standard Discord workflow).
//   2. From ClassMarker, by pasting the output of a console scraper script.
// A ClassMarker import is converted to a quiz and opened in the editor as an
// unsaved draft, so the user can review and edit everything before saving.

import { saveQuiz, quizExists } from '../db.js';
import { importFile } from '../io.js';
import { CLASSMARKER_SCRIPT, parseClassMarker, convertClassMarker } from '../classmarker.js';
import { setPendingDraft } from '../state.js';
import { el, esc, toast, callout } from '../util.js';
import { navigate } from '../main.js';

export async function render(root, param) {
  root.appendChild(el('div', { class: 'view-header' },
    el('h1', {}, 'Import a quiz'),
    el('a', { class: 'btn ghost', href: '#/' }, '← Library')
  ));

  // Method picker (tabs).
  const panelHost = el('div', { class: 'import-panel-host' });
  const tabs = el('div', { class: 'tabs', role: 'tablist' });

  const methods = [
    { key: 'file', label: 'From JSON file', build: buildFilePanel },
    { key: 'classmarker', label: 'From ClassMarker', build: buildClassMarkerPanel }
  ];

  let active = param === 'classmarker' ? 'classmarker' : 'file';
  function selectTab(key) {
    active = key;
    tabs.querySelectorAll('[role="tab"]').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.key === key)));
    panelHost.innerHTML = '';
    panelHost.appendChild(methods.find((m) => m.key === key).build(root));
  }

  for (const m of methods) {
    tabs.appendChild(el('button', {
      class: 'tab', role: 'tab', dataset: { key: m.key },
      'aria-selected': String(m.key === active),
      onclick: () => selectTab(m.key)
    }, m.label));
  }

  root.appendChild(tabs);
  root.appendChild(panelHost);
  selectTab(active);
}

// ---------------------------------------------------------------------------
// Method 1, JSON file
// ---------------------------------------------------------------------------
function buildFilePanel(root) {
  const panel = el('section', { class: 'panel', role: 'tabpanel' });
  panel.appendChild(el('h2', {}, 'Import a QuizForge file'));
  panel.appendChild(callout({},
    'Choose a quiz ', el('strong', {}, '.json'), ' file someone shared with you. It will be ',
    el('strong', {}, 'added to your library'), '.'));

  const fileInput = el('input', {
    type: 'file', accept: '.json,application/json', class: 'visually-hidden',
    onchange: (e) => handleFile(e.target.files)
  });
  panel.appendChild(el('button', { class: 'btn primary', onclick: () => fileInput.click() }, 'Choose file…'));
  panel.appendChild(fileInput);
  return panel;
}

async function handleFile(files) {
  if (!files || files.length === 0) return;
  try {
    const { quizzes } = await importFile(files[0], quizExists);
    for (const quiz of quizzes) await saveQuiz(quiz);
    const n = quizzes.length;
    toast(`Imported ${n} quiz${n === 1 ? '' : 'zes'}.`, 'success');
    navigate('#/');
  } catch (err) {
    toast(err.message || 'Import failed.', 'error');
  }
}

// ---------------------------------------------------------------------------
// Method 2, ClassMarker
// ---------------------------------------------------------------------------
function buildClassMarkerPanel() {
  const panel = el('section', { class: 'panel', role: 'tabpanel' });
  panel.appendChild(el('h2', {}, 'Import from ClassMarker'));
  panel.appendChild(callout({},
    'Run the script on the ClassMarker ', el('strong', {}, 'results screen'),
    ', after you have answered ', el('strong', {}, 'every question'),
    ', so each correct answer is revealed.'));

  // Steps.
  const steps = el('ol', { class: 'steps' },
    el('li', {}, 'Open the ClassMarker quiz you want and answer every question to the end.'),
    el('li', {}, 'On the final results screen, where each answer is shown as correct or incorrect, open your browser’s developer tools (press ', el('kbd', {}, 'F12'), ').'),
    el('li', {}, 'Click the ', el('strong', {}, 'Console'), ' tab.'),
    el('li', {}, 'Copy the script below, paste it into the console, and press ', el('kbd', {}, 'Enter'), '.'),
    el('li', {}, 'The script copies the questions to your clipboard. Paste them into the box below.'),
    el('li', {}, 'Click ', el('strong', {}, 'Build quiz'), ', the questions open in the editor so you can review, fix, and save them.')
  );
  panel.appendChild(steps);

  // Copy script + collapsible view of exactly what is being copied.
  const copyRow = el('div', { class: 'copy-row' });
  const copyBtn = el('button', { class: 'btn primary', onclick: () => copyScript(copyBtn) }, 'Copy script');
  copyRow.appendChild(copyBtn);
  panel.appendChild(copyRow);

  const details = el('details', { class: 'script-details' });
  details.appendChild(el('summary', {}, 'View the script you are copying'));
  const pre = el('pre', { class: 'script-block' });
  pre.appendChild(el('code', {}, CLASSMARKER_SCRIPT)); // textContent, safe
  details.appendChild(pre);
  panel.appendChild(details);

  // Title + paste box.
  panel.appendChild(el('label', { class: 'field' },
    el('span', { class: 'field-label' }, 'Quiz title'),
    titleInput()
  ));

  const pasteBox = el('textarea', {
    class: 'input paste-box', rows: 8,
    placeholder: 'Paste the copied questions here (a JSON array starting with [ … )'
  });
  panel.appendChild(el('label', { class: 'field' },
    el('span', { class: 'field-label' }, 'Pasted questions'),
    pasteBox
  ));

  panel.appendChild(el('div', { class: 'editor-footer' },
    el('button', { class: 'btn primary', onclick: () => build(pasteBox, panel) }, 'Build quiz'),
    el('a', { class: 'btn ghost', href: '#/' }, 'Cancel')
  ));

  // keep a handle to the title field for build()
  panel._titleInput = panel.querySelector('input[data-role="cm-title"]');
  return panel;
}

function titleInput() {
  return el('input', {
    type: 'text', class: 'input', maxlength: 200,
    dataset: { role: 'cm-title' },
    placeholder: 'e.g. Project Management, practice exam'
  });
}

async function copyScript(btn) {
  try {
    await navigator.clipboard.writeText(CLASSMARKER_SCRIPT);
    const original = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = original; }, 1800);
  } catch {
    toast('Could not copy automatically, open “View the script” and copy it manually.', 'error');
  }
}

function build(pasteBox, panel) {
  const title = panel._titleInput ? panel._titleInput.value : '';
  try {
    const cm = parseClassMarker(pasteBox.value);
    const { quiz, dropped } = convertClassMarker(cm, title);
    setPendingDraft(quiz);
    if (dropped > 0) {
      toast(`Imported the first 50 of ${cm.length} questions (quizzes are capped at 50).`, 'info');
    } else {
      toast(`Built ${quiz.questions.length} question(s). Review and save.`, 'success');
    }
    navigate('#/editor/new');
  } catch (err) {
    toast(err.message || 'Could not build the quiz.', 'error');
  }
}
