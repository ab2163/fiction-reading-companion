const API_BASE = 'https://api.x.ai/v1';
const TEXT_MODEL = 'grok-4.7';
const IMAGE_MODEL = 'grok-imagine-image-2.0';

const SYSTEM_PROMPT = `You are a clear, friendly literary companion. The user likes reading fiction and wants useful context so they can enjoy the book more. They are fine with spoilers.

Write in simple, everyday language that an 18-year-old would easily understand. Be clear and direct.

Important formatting rules:
- Use italics (*like this*) instead of quotation marks for emphasis, informal phrases, figures of speech, or book/character names when it feels natural. Avoid speech marks.
- Do not use Markdown bullet points or numbered lists (no lines starting with -, *, or 1.). Lists remove useful margin on a phone. Instead, when you need a list of points, put a short label such as **1.** or **A.** or **•** on its own line, then write the paragraph that belongs to it underneath. This keeps every paragraph full-width.
- Use Markdown headings (## and ###) for section titles. These will be shown in a different colour.
- Keep paragraphs reasonably short.

When asked for an overall summary, include:
- A clear plot overview
- Main characters (who they are and why they matter)
- Big themes
- Why the book is important or interesting
- A bit about the author
- Why it’s worth reading
- A section titled "## Key Scenes for Illustration" with 3 short, vivid scene descriptions (each introduced by a label on its own line) that would work well as image prompts.

When asked about a chapter, explain what happens, the important moments and why they matter, and how the chapter fits into the bigger story. End with "## Key Scenes for Illustration" if it makes sense (1-2 scenes).

When explaining a quote, say what it means, why it matters for the character or the story, and any interesting ideas or feelings it brings up.

When answering a general question about the book, author, characters, psychology, emotions, or any other aspect, give a clear, thoughtful, spoiler-friendly response that helps the reader understand more deeply.`;

let apiKey = localStorage.getItem('xai_api_key') || '';
const HISTORY_KEY = 'frc_history';

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function addToHistory(entry) {
  const history = getHistory();
  const filtered = history.filter(h => h.cacheKey !== entry.cacheKey);
  filtered.unshift(entry);
  saveHistory(filtered.slice(0, 50));
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const empty = document.getElementById('historyEmpty');
  const history = getHistory();

  list.innerHTML = '';
  if (history.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const label = item.mode === 'overall'
      ? item.book
      : item.mode === 'chapter'
        ? `${item.book} — Ch. ${item.extra}`
        : item.mode === 'quote'
          ? `${item.book} — Quote`
          : `${item.book} — Q: ${item.extra.slice(0, 40)}${item.extra.length > 40 ? '…' : ''}`;
    div.innerHTML = `<div>${label}</div><div class="meta">${item.mode} · ${new Date(item.timestamp).toLocaleDateString()}</div>`;
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.className = 'remove-btn';
    removeBtn.title = 'Remove this entry and clear its cache';
    removeBtn.style.color = '#f5e6c8';
    removeBtn.style.fontSize = '1.4rem';
    removeBtn.style.fontWeight = 'bold';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Remove this from history and clear the cached response?')) {
        localStorage.removeItem(item.cacheKey);
        const updated = getHistory().filter(h => h.cacheKey !== item.cacheKey);
        saveHistory(updated);
        renderHistory();
      }
    });
    div.appendChild(removeBtn);
    
    div.addEventListener('click', () => loadFromHistory(item));
    list.appendChild(div);
  });
}

function loadFromHistory(item) {
  const cached = localStorage.getItem(item.cacheKey);
  if (!cached) {
    alert('Cached data missing for this entry.');
    return;
  }
  const data = JSON.parse(cached);
  const output = document.getElementById('output');
  const contentDiv = document.getElementById('content');
  const imagesDiv = document.getElementById('images');
  const titleEl = document.getElementById('outputTitle');

  output.classList.remove('hidden');
  imagesDiv.innerHTML = '';
  contentDiv.innerHTML = '';

  if (item.mode === 'overall') {
    titleEl.textContent = `${item.book} — Overall Context`;
  } else if (item.mode === 'chapter') {
    titleEl.textContent = `${item.book} — Chapter: ${item.extra}`;
  } else if (item.mode === 'quote') {
    titleEl.textContent = `${item.book} — Quote Explanation`;
  } else {
    titleEl.textContent = `${item.book} — Question`;
  }

  renderResponse(data, titleEl, contentDiv, imagesDiv, item.mode, item.book);
  output.scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const keyStatus = document.getElementById('keyStatus');
  if (apiKey) {
    apiKeyInput.value = '••••••••••••••••';
    keyStatus.textContent = 'Saved';
  }

  document.getElementById('saveKey').addEventListener('click', () => {
    const val = apiKeyInput.value.trim();
    if (val && !val.includes('•')) {
      apiKey = val;
      localStorage.setItem('xai_api_key', apiKey);
      apiKeyInput.value = '••••••••••••••••';
      keyStatus.textContent = 'Saved';
    }
  });

  const modeRadios = document.querySelectorAll('input[name="mode"]');
  modeRadios.forEach(r => r.addEventListener('change', updateModeUI));
  updateModeUI();

  document.getElementById('generateBtn').addEventListener('click', generate);
  renderHistory();
});

function updateModeUI() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  document.getElementById('chapterInput').classList.toggle('hidden', mode !== 'chapter');
  document.getElementById('quoteInput').classList.toggle('hidden', mode !== 'quote');
  document.getElementById('questionInput').classList.toggle('hidden', mode !== 'question');
}

function getCacheKey(book, mode, extra) {
  return `frc_${book.toLowerCase().trim()}|${mode}|${extra || ''}`;
}

async function generate() {
  if (!apiKey) {
    alert('Please enter and save your xAI API key first.');
    return;
  }

  const book = document.getElementById('bookTitle').value.trim();
  if (!book) {
    alert('Please enter a book title.');
    return;
  }

  const mode = document.querySelector('input[name="mode"]:checked').value;
  const chapter = document.getElementById('chapter').value.trim();
  const quote = document.getElementById('quote').value.trim();
  const question = document.getElementById('question').value.trim();
  const generateImages = document.getElementById('generateImages').checked;

  if (mode === 'chapter' && !chapter) {
    alert('Please enter a chapter.');
    return;
  }
  if (mode === 'quote' && !quote) {
    alert('Please enter a quote.');
    return;
  }
  if (mode === 'question' && !question) {
    alert('Please enter a question.');
    return;
  }

  const extra = mode === 'chapter' ? chapter 
    : mode === 'quote' ? quote.slice(0, 100) 
    : mode === 'question' ? question.slice(0, 120) 
    : '';
  const cacheKey = getCacheKey(book, mode, extra);
  const cached = localStorage.getItem(cacheKey);

  const output = document.getElementById('output');
  const contentDiv = document.getElementById('content');
  const imagesDiv = document.getElementById('images');
  const loading = document.getElementById('loading');
  const titleEl = document.getElementById('outputTitle');

  output.classList.remove('hidden');
  imagesDiv.innerHTML = '';
  loading.classList.remove('hidden');
  contentDiv.innerHTML = '';

  if (cached) {
    const data = JSON.parse(cached);
    addToHistory({
      cacheKey,
      book,
      mode,
      extra,
      timestamp: Date.now()
    });
    renderResponse(data, titleEl, contentDiv, imagesDiv, mode, book);
    loading.classList.add('hidden');
    return;
  }

  let userPrompt = '';
  if (mode === 'overall') {
    userPrompt = `Provide a comprehensive overall summary and context for the book "${book}".`;
    titleEl.textContent = `${book} — Overall Context`;
  } else if (mode === 'chapter') {
    userPrompt = `Provide detailed context and analysis for chapter "${chapter}" of the book "${book}".`;
    titleEl.textContent = `${book} — Chapter: ${chapter}`;
  } else if (mode === 'quote') {
    userPrompt = `Explain the following quote or passage from the book "${book}":\n\n"${quote}"`;
    titleEl.textContent = `${book} — Quote Explanation`;
  } else if (mode === 'question') {
    userPrompt = `Answer the following question about the book "${book}":\n\n${question}`;
    titleEl.textContent = `${book} — Question`;
  }

  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ];

    const res = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages,
        temperature: 0.7
      })
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API error: ${res.status} ${err}`);
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || 'No response received.';

    const data = { text, images: [] };

    if (generateImages) {
      const scenes = extractScenes(text);
      for (const scene of scenes.slice(0, 3)) {
        try {
          const imgRes = await fetch(`${API_BASE}/images/generations`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: IMAGE_MODEL,
              prompt: `Literary illustration, elegant book art style: ${scene}`,
              n: 1
            })
          });
          if (imgRes.ok) {
            const imgJson = await imgRes.json();
            const url = imgJson.data?.[0]?.url;
            if (url) data.images.push({ url, prompt: scene });
          }
        } catch (e) {
          console.warn('Image gen failed for scene:', e);
        }
      }
    }

    localStorage.setItem(cacheKey, JSON.stringify(data));

    addToHistory({
      cacheKey,
      book,
      mode,
      extra,
      timestamp: Date.now()
    });

    renderResponse(data, titleEl, contentDiv, imagesDiv, mode, book);
  } catch (err) {
    contentDiv.innerHTML = `<p style="color: #c00;">Error: ${err.message}</p><p>Check your API key and try again.</p>`;
  } finally {
    loading.classList.add('hidden');
  }
}

function extractScenes(text) {
  const match = text.match(/## Key Scenes for Illustration\s*([\s\S]*?)(?=\n##|\n#|$)/i);
  if (!match) return [];
  const lines = match[1].split('\n').map(l => l.trim()).filter(l => l.startsWith('-') || l.startsWith('*') || /^\d+\./.test(l));
  return lines.map(l => l.replace(/^[-*\d.]\s*/, '').trim()).filter(Boolean);
}

function renderResponse(data, titleEl, contentDiv, imagesDiv, mode, book) {
  contentDiv.innerHTML = marked.parse(data.text);
  imagesDiv.innerHTML = '';
  data.images.forEach(img => {
    const imgEl = document.createElement('img');
    imgEl.src = img.url;
    imgEl.alt = img.prompt;
    imgEl.title = img.prompt;
    imagesDiv.appendChild(imgEl);
  });
}