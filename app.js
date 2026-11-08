const API_BASE = 'https://api.x.ai/v1';
const TEXT_MODEL = 'grok-4.7';
const IMAGE_MODEL = 'grok-imagine-image-2.0';

const SYSTEM_PROMPT = `You are a thoughtful, knowledgeable literary companion. The user enjoys reading fiction and prefers to have rich context and full understanding of the story, characters, and themes before or while reading. They welcome spoilers because they enhance their appreciation.

Always give clear, detailed, spoiler-rich responses. Write in a warm, engaging style suitable for a dedicated reader. Use Markdown for structure (headings, lists, emphasis).

When asked for an overall summary, include:
- Detailed plot overview
- Main characters (with key traits and roles)
- Central themes
- Literary and cultural significance
- Brief author context
- Why the book is worth reading
- A section titled "## Key Scenes for Illustration" containing 3 short, vivid scene descriptions suitable as image generation prompts (each on its own bullet).

When asked about a chapter, cover what happens in detail, key moments and their significance, interesting language or motifs, and how the chapter fits the larger narrative. End with "## Key Scenes for Illustration" if relevant (1-2 scenes).

When explaining a quote, discuss its meaning, literary devices, character insight, thematic connections, and any relevant context.`;

let apiKey = localStorage.getItem('xai_api_key') || '';

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
});

function updateModeUI() {
  const mode = document.querySelector('input[name="mode"]:checked').value;
  document.getElementById('chapterInput').classList.toggle('hidden', mode !== 'chapter');
  document.getElementById('quoteInput').classList.toggle('hidden', mode !== 'quote');
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
  const generateImages = document.getElementById('generateImages').checked;

  if (mode === 'chapter' && !chapter) {
    alert('Please enter a chapter.');
    return;
  }
  if (mode === 'quote' && !quote) {
    alert('Please enter a quote.');
    return;
  }

  const extra = mode === 'chapter' ? chapter : mode === 'quote' ? quote.slice(0, 100) : '';
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
  } else {
    userPrompt = `Explain the following quote or passage from the book "${book}":\n\n"${quote}"`;
    titleEl.textContent = `${book} — Quote Explanation`;
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