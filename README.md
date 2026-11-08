# Fiction Reading Companion

A simple, personal web app that uses the xAI Grok API as a spoiler-friendly companion while reading fiction.

## Features

- **Overall Summary**: Plot overview, characters, themes, cultural significance, author context, and why the book matters.
- **Chapter Analysis**: Detailed what-happens, key moments, significance, and notes for a specific chapter.
- **Quote Explanation**: Meaning, literary devices, character insight, and thematic context for any passage.
- Optional generated illustrations of key scenes (via Grok Imagine).
- Responses are cached in your browser so you only pay once per query.
- API key is stored only in your browser’s localStorage — never in the repository.

## Setup

1. Get an API key from [console.x.ai](https://console.x.ai).
2. Clone or download this repository.
3. Open `index.html` in a browser (or enable GitHub Pages on the repo).
4. Paste your API key into the Settings field and click Save Key.
5. Enter a book title, choose a mode, and click Generate.

### GitHub Pages

In the repository settings → Pages, set the source to the `main` branch (root).  
Your site will be available at `https://ab2163.github.io/fiction-reading-companion/`.

## Notes

- This is a personal tool. The API key lives only in your browser.
- Image generation is optional and can be toggled off.
- Models used: `grok-4.7` (text) and `grok-imagine-image-2.0` (images).
- Caching is local; clear your browser storage if you want to regenerate a response.

Enjoy reading with more context.