
// =============================
// Volume control
// =============================
const volumeSlider  = document.getElementById('slider');
let   currentVolume = parseFloat(volumeSlider?.value ?? '0.5');

if (volumeSlider) {
  volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    if (!Number.isNaN(val)) currentVolume = val;
  });
}

// =============================
// File collection utilities
// =============================
let dirHandle = null;
const soundEffectsDiv = document.getElementById('soundEffectsDiv');
const pickButton = document.getElementById('pickFolder');
const fileInput = document.getElementById('fileInput');

function stripExtension(filename) {
  return filename.replace(/\.[^/.]+$/, '');
}

// Recursively collect files from File System Access API directory handle
async function collectSounds(handle, out) {
  for await (const entry of handle.values()) {
    const entryPath = out.base ? `${out.base}/${entry.name}` : entry.name;

    if (entry.kind === 'file' && /\.(mp3|wav|ogg|m4a)$/i.test(entry.name)) {
      out.items.push({ name: entry.name, handle: entry, path: entryPath });
    } else if (entry.kind === 'directory') {
      await collectSounds(entry, { base: entryPath, items: out.items });
    }
  }
}

// Group array of files by their top-level folder (first path segment)
function groupByTopLevel(files) {
  return files.reduce((acc, f) => {
    const seg = (f.path || '').split('/')[0] || 'root';
    (acc[seg] ||= []).push(f);
    return acc;
  }, {});
}

// Render the grouped buttons
function renderGroups(files) {
  soundEffectsDiv.innerHTML = '';

  const groups = groupByTopLevel(files);

  for (const [groupName, groupFiles] of Object.entries(groups)) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'sound-group';

    const header = document.createElement('h2');
    header.textContent = groupName;
    groupDiv.appendChild(header);

    groupFiles.forEach((f) => {
      const btn = document.createElement('button');
      btn.textContent = stripExtension(f.name);
      btn.addEventListener('click', async () => {
        let file;
        if (f.file) {
          file = f.file;
        } else if (f.handle) {
          file = await f.handle.getFile();
        }

        if (file) {
          const url = URL.createObjectURL(file);
          const audio = new Audio(url);
          audio.volume = currentVolume;

          // Track active audios so we can stop them later
          activeAudios.push({ audio, url });
          if (stopButton) stopButton.style.display = 'inline-block';

          audio.play().catch(console.error);
          audio.addEventListener('ended', () => {
            URL.revokeObjectURL(url);
            activeAudios = activeAudios.filter(a => a.audio !== audio);
            if (activeAudios.length === 0 && stopButton) {
              // Optional: hide stop button when nothing is playing
              // stopButton.style.display = 'none';
            }
          }, { once: true });
        }
      });
      groupDiv.appendChild(btn);
    });

    soundEffectsDiv.appendChild(groupDiv);
  }
}

// =============================
// Event handlers
// =============================
async function onPickFolder() {
  try {
    dirHandle = await window.showDirectoryPicker();
    const flat = { base: '', items: [] };
    await collectSounds(dirHandle, flat);
    renderGroups(flat.items);
    setLastFiles(flat.items, 'directory'); // remember and show Reload
  } catch (err) {
    // User cancelled or API not available
    console.error('Directory picker failed', err);
  }
}

function onFileInput(e) {
  const items = Array.from(e.target.files)
    .filter((file) => /\.(mp3|wav|ogg|m4a)$/i.test(file.name))
    .map((file) => ({ name: file.name, file, path: file.webkitRelativePath || file.name }));
  renderGroups(items);
  setLastFiles(items, 'input'); // remember and show Reload
}

// Wire up UI
if (pickButton) {
  pickButton.addEventListener('click', () => {
    if ('showDirectoryPicker' in window) {
      onPickFolder();
    } else {
      fileInput?.click();
    }
  });
}
fileInput?.addEventListener('change', onFileInput);


// =============================
// Reload logic
// =============================
const reloadButton = document.getElementById('reloadBtn');
let lastFiles = null; // { items, sourceType }

function setLastFiles(items, sourceType) {
  lastFiles = { items, sourceType };
  if (reloadButton) reloadButton.style.display = 'inline-block';
}

reloadButton?.addEventListener('click', async () => {
  if (!lastFiles || !lastFiles.sourceType) return;

  if (lastFiles.sourceType === 'directory' && dirHandle) {
    // Re-scan the directory handle for any new/removed files
    const flat = { base: '', items: [] };
    await collectSounds(dirHandle, flat);
    renderGroups(flat.items);
    // Keep memory in sync after reload
    setLastFiles(flat.items, 'directory');
  } else if (lastFiles.sourceType === 'input') {
    // Browsers do not allow re-reading the same FileList programmatically.
    // Prompt the user to re-select to "reload".
    fileInput?.click();
  }
});


// =============================
// Stop all sounds logic
// =============================
const stopButton = document.getElementById('stopBtn');
// Track pairs so we can revoke URLs when stopping
let activeAudios = []; // [{ audio, url }]

stopButton?.addEventListener('click', () => {
  activeAudios.forEach(({ audio, url }) => {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (e) {
      // ignore
    }
    try {
      URL.revokeObjectURL(url);
    } catch (e) {
      // ignore
    }
  });
  activeAudios = [];
  // Optional: hide after stopping everything
  // stopButton.style.display = 'none';
});