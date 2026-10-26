/* ==========================================================================
   BookBack — script.js
   Full frontend + backend-integration logic, per project spec:
     1. GET /books on page load -> render book cards dynamically
     2. POST /books on form submit -> add a new listing
     3. Client-side form validation (required fields + contact number)
     4. Category filter buttons that actually show/hide rendered cards
     5. Smooth scroll / mobile navbar UX niceties

   Backend: JSON Server, expected to be running at:
     http://localhost:3000/books
   Start it with:
     npx json-server books.json --port 3000
   ========================================================================== */

'use strict';

const BOOKS_API_URL = 'http://localhost:3000/books';

// Keeps the last set of books fetched from the server, so filtering
// can happen instantly on the client without refetching.
let allBooks = [];
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', function () {
  loadBooks();
  setupFilterButtons();
  setupAddBookForm();
  setupMobileNavClose();
});

/* ==========================================================================
   1. LOAD + RENDER BOOKS (GET /books)
   ========================================================================== */

async function loadBooks() {
  setListingsStatus('Loading books...');

  try {
    const response = await fetch(BOOKS_API_URL);

    if (!response.ok) {
      throw new Error('Server responded with status ' + response.status);
    }

    const books = await response.json();
    allBooks = Array.isArray(books) ? books : [];
    renderBooks(getFilteredBooks());
  } catch (error) {
    console.error('Failed to load books:', error);
    setListingsStatus(
      'Could not load books. Make sure JSON Server is running at ' +
      BOOKS_API_URL + ' and refresh the page.'
    );
  }
}

/**
 * Renders a list of book objects into #bookListingsGrid by cloning
 * #bookCardTemplate for each one. Clears any previously rendered cards first.
 * @param {Array<Object>} books
 */
function renderBooks(books) {
  const grid = document.getElementById('bookListingsGrid');
  const template = document.getElementById('bookCardTemplate');
  if (!grid || !template) return;

  // Remove previously rendered card columns (but keep the template itself,
  // which lives outside the grid, and the status paragraph, which we
  // manage separately below).
  grid.querySelectorAll('.book-card-col').forEach(function (col) {
    col.remove();
  });

  if (!books || books.length === 0) {
    setListingsStatus('No books match this filter yet. Be the first to list one!');
    return;
  }

  setListingsStatus(''); // clear any status message

  books.forEach(function (book) {
    const clone = template.content.cloneNode(true);
    const col = clone.querySelector('.book-card-col');
    const card = clone.querySelector('.bb-book-card');

    const category = book.category || 'other';
    col.dataset.category = category;
    card.classList.add(getSpineClass(category));

    clone.querySelector('.bb-category-badge').textContent = getCategoryLabel(category);

    const statusBadge = clone.querySelector('.bb-status-badge');
    const status = (book.status || 'available').toLowerCase();
    statusBadge.textContent = status === 'exchanged' ? 'Exchanged' : 'Available';
    statusBadge.classList.add(status === 'exchanged' ? 'status-exchanged' : 'status-available');

    clone.querySelector('.book-title').textContent = book.title || 'Untitled';
    clone.querySelector('.book-author span').textContent = book.author || 'Unknown author';
    clone.querySelector('.donor-name').textContent = book.donorName || 'Anonymous';

    const contactBtn = clone.querySelector('.book-contact-btn');
    if (status === 'exchanged') {
      // Book already has a new home: don't invite people to call the donor.
      contactBtn.classList.add('disabled');
      contactBtn.setAttribute('aria-disabled', 'true');
      contactBtn.removeAttribute('href');
      contactBtn.innerHTML = '<i class="bi bi-check2-circle me-1"></i>Already exchanged';
    } else if (book.contactNumber) {
      contactBtn.href = 'tel:' + book.contactNumber;
    }

    grid.appendChild(clone);
  });
}

/** Shows (or clears, if message is empty) the status/empty/error message. */
function setListingsStatus(message) {
  const grid = document.getElementById('bookListingsGrid');
  if (!grid) return;

  let statusEl = document.getElementById('listingsStatus');

  if (!message) {
    if (statusEl) statusEl.remove();
    return;
  }

  if (!statusEl) {
    statusEl = document.createElement('p');
    statusEl.id = 'listingsStatus';
    statusEl.className = 'text-center text-muted w-100';
    grid.appendChild(statusEl);
  }
  statusEl.textContent = message;
}

/** Maps a category value to its spine color class (matches the hero shelf). */
function getSpineClass(category) {
  switch (category) {
    case 'fiction': return 'spine-fiction';
    case 'science': return 'spine-science';
    case 'entrance-prep': return 'spine-prep';
    case 'class-10': return 'spine-class';
    case 'engineering': return 'spine-engineering';
    default: return 'spine-other';
  }
}

/** Maps a category value to a human-readable label for the badge. */
function getCategoryLabel(category) {
  const labels = {
    'fiction': 'Fiction',
    'science': 'Science',
    'entrance-prep': 'Entrance Prep',
    'class-10': 'Class 10',
    'engineering': 'Engineering',
    'other': 'Other'
  };
  return labels[category] || 'Other';
}

/* ==========================================================================
   2. FILTER BUTTONS (client-side filtering of allBooks)
   ========================================================================== */

function setupFilterButtons() {
  const filterButtons = document.querySelectorAll('.bb-filter-btn');

  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      filterButtons.forEach(function (btn) { btn.classList.remove('active'); });
      button.classList.add('active');

      activeFilter = button.dataset.filter || 'all';
      renderBooks(getFilteredBooks());
    });
  });
}

/** Returns allBooks filtered by the currently active category filter. */
function getFilteredBooks() {
  if (activeFilter === 'all') return allBooks;
  return allBooks.filter(function (book) {
    return (book.category || 'other') === activeFilter;
  });
}

/* ==========================================================================
   3. ADD BOOK FORM — validation + POST /books
   ========================================================================== */

const CONTACT_NUMBER_PATTERN = /^\d{10}$/;

function setupAddBookForm() {
  const addBookForm = document.getElementById('addBookForm');
  if (!addBookForm) return;

  addBookForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    event.stopPropagation();

    if (!validateAddBookForm(addBookForm)) {
      showFormAlert('danger', 'Please fix the highlighted fields before submitting.');
      return;
    }

    const newBook = {
      title: addBookForm.bookTitle.value.trim(),
      author: addBookForm.author.value.trim(),
      category: addBookForm.category.value,
      donorName: addBookForm.donorName.value.trim(),
      contactNumber: addBookForm.contactNumber.value.trim(),
      status: 'available'
    };

    const submitBtn = addBookForm.querySelector('button[type="submit"]');
    setSubmitLoading(submitBtn, true);

    try {
      const response = await fetch(BOOKS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBook)
      });

      if (!response.ok) {
        throw new Error('Server responded with status ' + response.status);
      }

      const savedBook = await response.json();

      // Add the new book to our local list and re-render immediately,
      // so the user sees it without a full page reload.
      allBooks.unshift(savedBook);
      renderBooks(getFilteredBooks());

      showFormAlert('success', 'Your book has been listed!');
      addBookForm.reset();
      addBookForm.classList.remove('was-validated');
      clearValidationStyles(addBookForm);
    } catch (error) {
      console.error('Failed to submit book:', error);
      showFormAlert(
        'danger',
        'Could not submit your listing. Make sure JSON Server is running and try again.'
      );
    } finally {
      setSubmitLoading(submitBtn, false);
    }
  });
}

function setSubmitLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.innerHTML = isLoading
    ? '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Submitting...'
    : '<i class="bi bi-send-check me-2"></i>Submit Listing';
}

/**
 * Validates all required fields in the Add Book form and applies
 * Bootstrap's .is-valid / .is-invalid classes for visual feedback.
 * @param {HTMLFormElement} form
 * @returns {boolean} true if every field passes validation
 */
function validateAddBookForm(form) {
  let isValid = true;

  const requiredFields = form.querySelectorAll('[required]');
  requiredFields.forEach(function (field) {
    if (!field.value || field.value.trim() === '') {
      markInvalid(field);
      isValid = false;
    } else {
      markValid(field);
    }
  });

  const contactField = form.querySelector('#contactNumber');
  if (contactField && contactField.value.trim() !== '') {
    if (!CONTACT_NUMBER_PATTERN.test(contactField.value.trim())) {
      markInvalid(contactField);
      isValid = false;
    }
  }

  return isValid;
}

function markInvalid(field) {
  field.classList.add('is-invalid');
  field.classList.remove('is-valid');
}

function markValid(field) {
  field.classList.add('is-valid');
  field.classList.remove('is-invalid');
}

function clearValidationStyles(form) {
  form.querySelectorAll('.is-valid, .is-invalid').forEach(function (field) {
    field.classList.remove('is-valid', 'is-invalid');
  });
}

/**
 * Shows a Bootstrap alert inside #formAlert.
 * @param {'success'|'danger'} type
 * @param {string} message
 */
function showFormAlert(type, message) {
  const formAlert = document.getElementById('formAlert');
  if (!formAlert) return;
  formAlert.className = 'alert alert-' + type;
  formAlert.textContent = message;
  formAlert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* ==========================================================================
   4. UX: close the mobile navbar menu after clicking a nav link
   ========================================================================== */

function setupMobileNavClose() {
  const navLinks = document.querySelectorAll('.bb-nav-link');
  const navMenu = document.getElementById('bbNavMenu');

  navLinks.forEach(function (link) {
    link.addEventListener('click', function () {
      if (navMenu && navMenu.classList.contains('show')) {
        const bsCollapse = bootstrap.Collapse.getOrCreateInstance(navMenu);
        bsCollapse.hide();
      }
    });
  });
}