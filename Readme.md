# BookBack – Local Book Exchange Platform

## Project structure
```
index.html    - Homepage markup (navbar, hero, listings, form, footer)
style.css     - All custom styling
script.js     - fetch() GET/POST, dynamic rendering, filters, form validation
Books.json    - Mock database used by JSON Server
```

## Running the project

**1. Start the mock backend (JSON Server)**

You need Node.js installed. Then, from this folder, run:

```bash
npx json-server Books.json --port 3000
```

This serves your data at `http://localhost:3000/books` with:
- `GET /Books` – fetch all listings
- `POST /Books` – add a new listing

Leave this terminal running.

**2. Open the frontend**

Open `index.html` in your browser (or serve it with a simple local server,
e.g. the VS Code "Live Server" extension). It will automatically:
- Fetch and display all books from JSON Server on page load
- Let you filter books by category
- Let you submit the "Add a Book" form, which POSTs to JSON Server and
  instantly shows the new listing on the page

## Notes
- If `index.html` shows "Could not load books...", it means JSON Server
  isn't running yet, or isn't running on port 3000 — start it as above.
- Contact number validation expects exactly 10 digits (adjust the regex
  in `script.js` under `CONTACT_NUMBER_PATTERN` if you need a different
  format, e.g. with a country code).
- `Books.json` already contains 6 sample listings so the page isn't empty
  on first run — feel free to edit or clear them out.