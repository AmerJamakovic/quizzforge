// modal.js, header modals: "About" (project explanation) and "Report Bugs"
// (contact info with monochrome icons). Accessible: role=dialog, Escape to
// close, backdrop click to close, focus moved in and restored on close.

import { el, toast } from './util.js';
import { exportQuiz } from './io.js';

const EMAIL = 'amer_jamakovic@hotmail.com';
const DISCORD = 'Ammy844#4665';

// Black-and-white inline SVG icons (inherit currentColor).
const ICONS = {
  email:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  discord:
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M19.27 5.33A16.5 16.5 0 0 0 15 4a.07.07 0 0 0-.07.03c-.18.33-.39.76-.53 1.1a15.9 15.9 0 0 0-4.8 0c-.14-.35-.35-.77-.54-1.1A.07.07 0 0 0 8.99 4 16.5 16.5 0 0 0 4.7 5.33a.06.06 0 0 0-.03.02C1.95 9.42 1.2 13.38 1.57 17.3a.07.07 0 0 0 .03.05 16.6 16.6 0 0 0 5.25 2.65.07.07 0 0 0 .07-.02c.4-.55.77-1.13 1.07-1.74a.07.07 0 0 0-.04-.1 11 11 0 0 1-1.64-.78.07.07 0 0 1-.01-.11l.33-.26a.06.06 0 0 1 .07-.01 11.8 11.8 0 0 0 10.55 0 .06.06 0 0 1 .07.01l.33.26a.07.07 0 0 1-.01.11c-.52.31-1.07.57-1.64.78a.07.07 0 0 0-.04.1c.31.6.67 1.18 1.07 1.73a.07.07 0 0 0 .07.03 16.5 16.5 0 0 0 5.26-2.65.07.07 0 0 0 .03-.05c.44-4.53-.74-8.46-3.11-11.95a.05.05 0 0 0-.03-.02ZM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12 0-1.16.84-2.11 1.89-2.11 1.06 0 1.91.96 1.89 2.11 0 1.17-.84 2.12-1.89 2.12Zm6.97 0c-1.03 0-1.89-.95-1.89-2.12 0-1.16.84-2.11 1.89-2.11 1.06 0 1.91.96 1.89 2.11 0 1.17-.83 2.12-1.89 2.12Z"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};

let lastFocused = null;

// ---------------------------------------------------------------------------
// Shared shell
// ---------------------------------------------------------------------------
function dialogShell(titleId, title, ...content) {
  const closeBtn = el('button', { class: 'modal-close', type: 'button', 'aria-label': 'Close', onclick: closeModal });
  closeBtn.innerHTML = ICONS.close;
  return el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
    closeBtn,
    el('h2', { id: titleId, class: 'modal-title' }, title),
    ...content
  );
}

function showDialog(dialog) {
  closeModal();
  lastFocused = document.activeElement;
  const overlay = el('div', {
    class: 'modal-overlay', dataset: { modal: '1' },
    onclick: (e) => { if (e.target === overlay) closeModal(); }
  }, dialog);
  document.body.appendChild(overlay);
  document.addEventListener('keydown', onKey);
  const closeBtn = dialog.querySelector('.modal-close');
  if (closeBtn) closeBtn.focus();
}

function onKey(e) {
  if (e.key === 'Escape') closeModal();
}

export function closeModal() {
  const existing = document.querySelector('.modal-overlay[data-modal]');
  if (existing) existing.remove();
  document.removeEventListener('keydown', onKey);
  if (lastFocused && typeof lastFocused.focus === 'function') {
    lastFocused.focus();
    lastFocused = null;
  }
}

// ---------------------------------------------------------------------------
// Generic yes/no confirmation
// ---------------------------------------------------------------------------
export function confirmModal({ title, message, confirmLabel = 'Yes', cancelLabel = 'No', onConfirm }) {
  const yesBtn = el('button', { class: 'btn primary', type: 'button', onclick: () => { closeModal(); if (onConfirm) onConfirm(); } }, confirmLabel);
  const noBtn = el('button', { class: 'btn', type: 'button', onclick: closeModal }, cancelLabel);
  showDialog(dialogShell('confirm-modal-title', title,
    el('p', { class: 'modal-sub' }, message),
    el('div', { class: 'modal-actions' }, yesBtn, noBtn)
  ));
  // Default focus to the safe (No) option.
  noBtn.focus();
}

// Export a quiz, but never produce an empty file, and always confirm first.
// Cancelling simply drops the modal; nothing is changed or deleted.
export function exportQuizWithConfirm(quiz) {
  const count = Array.isArray(quiz.questions) ? quiz.questions.length : 0;
  if (count === 0) {
    toast('This quiz has no questions yet. Add at least one before exporting.', 'error');
    return;
  }
  confirmModal({
    title: 'Export this quiz?',
    message: `Export “${quiz.title || 'this quiz'}” as a .json file? Your quiz stays exactly as it is.`,
    confirmLabel: 'Yes, export',
    cancelLabel: 'No',
    onConfirm: () => exportQuiz(quiz)
  });
}

// ---------------------------------------------------------------------------
// About / explanation
// ---------------------------------------------------------------------------
export function openAboutModal() {
  // Inline link that closes this modal and opens the contact one.
  const reportLink = el('button', {
    class: 'link-btn', type: 'button',
    onclick: () => { closeModal(); openReportBugsModal(); }
  }, 'Report Bugs');

  // Hyperlink to the ClassMarker import guide (preselects that tab).
  const guideLink = el('a', {
    class: 'link', href: '#/import/classmarker',
    onclick: () => closeModal()
  }, 'see the guide here');

  showDialog(dialogShell('about-modal-title', 'About QuizForge',
    el('div', { class: 'modal-body' },
      el('p', {},
        'This is a small student project, made because ClassMarker usually needs a paid subscription to use, this is a free way around that.'),
      el('p', {},
        'The whole thing runs on the community: students build the quizzes here, or bring over the ones from ClassMarker. The more people add, the better it gets for everyone.'),
      el('p', {},
        'Want to contribute? My contact info is in the ', reportLink, ' section. Reach out any time.'),
      el('p', {},
        'To import questions from ClassMarker, ', guideLink, '.'),
      el('p', { class: 'about-signoff' },
        'Have fun, study hard, and good luck on your tests.')
    )
  ));
}

// ---------------------------------------------------------------------------
// Report bugs / contact
// ---------------------------------------------------------------------------
export function openReportBugsModal() {
  showDialog(dialogShell('report-modal-title', 'Report a Bug',
    el('p', { class: 'modal-sub muted' }, 'Found something broken or have a suggestion? Reach out and I’ll take a look.'),
    el('div', { class: 'contact-list' },
      contactRow('email', 'Email', EMAIL, 'mailto:' + EMAIL),
      contactRow('discord', 'Discord', DISCORD, null)
    )
  ));
}

function contactRow(iconKey, label, value, href) {
  const icon = el('span', { class: 'contact-icon', 'aria-hidden': 'true' });
  icon.innerHTML = ICONS[iconKey];

  const valueNode = href
    ? el('a', { class: 'contact-value', href }, value)
    : el('span', { class: 'contact-value' }, value);

  const copyBtn = el('button', { class: 'btn tiny', type: 'button', onclick: () => copyValue(value, label) }, 'Copy');

  return el('div', { class: 'contact-row' },
    icon,
    el('div', { class: 'contact-text' },
      el('span', { class: 'contact-label' }, label),
      valueNode
    ),
    copyBtn
  );
}

async function copyValue(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(label + ' copied to clipboard.', 'success');
  } catch {
    toast('Could not copy automatically, select and copy it manually.', 'error');
  }
}
