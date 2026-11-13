import { login, signup } from '../api.js';
import { saveToken } from '../session.js';
import { el } from '../ui.js';

const feedback = document.querySelector('#account-feedback');
const loginForm = document.querySelector('#login-form');
const signupForm = document.querySelector('#signup-form');

function showFeedback(message, isError = false) {
  feedback.replaceChildren(el('p', { className: isError ? 'error-message' : 'success-message', role: isError ? 'alert' : 'status' }, message));
}

function nextPage(role) {
  const next = new URLSearchParams(window.location.search).get('next');
  if (next?.startsWith('/') && !next.startsWith('//')) {
    const target = new URL(next, window.location.origin);
    if (target.origin === window.location.origin) return target.href;
  }
  if (role === 'organizer') return './organizer.html';
  if (role === 'attendee') return './tickets.html';
  return './index.html';
}

async function submitForm(form, authenticate) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  showFeedback('Please wait while we securely sign you in…');
  try {
    const result = await authenticate();
    saveToken(result.token);
    window.location.assign(nextPage(result.user.role));
  } catch (error) {
    showFeedback(error.message, true);
  } finally {
    button.disabled = false;
  }
}

loginForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = new FormData(loginForm);
  submitForm(loginForm, () => login({
    email: values.get('email'),
    password: values.get('password'),
  }));
});

signupForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const values = new FormData(signupForm);
  submitForm(signupForm, () => signup({
    email: values.get('email'),
    password: values.get('password'),
    role: values.get('role'),
  }));
});
