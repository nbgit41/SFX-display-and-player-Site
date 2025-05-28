/* Updated to group by subfolder and support both File System Access API and webkitdirectory fallback */

// Global variables
let dirHandle = null;
const soundEffectsDiv = document.getElementById('soundEffectsDiv');
const pickButton = document.getElementById('pickFolder');
const fileInput = document.getElementById('fileInput');

// Utility: strip extension from filename
function stripExtension(filename) {
    return filename.replace(/\.[^/.]+$/, '');
}

// Collect sounds with their relative paths
async function collectSounds(handle, fileList) {
    for await (const entry of handle.values()) {
        const entryPath = fileList.base
            ? fileList.base + '/' + entry.name
            : entry.name;

        if (entry.kind === 'file' && /\.(mp3|wav|ogg|m4a)$/i.test(entry.name)) {
            fileList.items.push({ name: entry.name, handle: entry, path: entryPath });
        } else if (entry.kind === 'directory') {
            await collectSounds(entry, { base: entryPath, items: fileList.items });
        }
    }
}

// Handle directory picker
async function onPickFolder() {
    try {
        dirHandle = await window.showDirectoryPicker();
        const flat = { base: '', items: [] };
        await collectSounds(dirHandle, flat);
        renderGroups(flat.items);
    } catch (err) {
        console.error('Directory picker failed', err);
    }
}

// Handle file-input fallback
function onFileInput(event) {
    const items = Array.from(event.target.files)
        .filter(file => /\.(mp3|wav|ogg|m4a)$/i.test(file.name))
        .map(file => ({ name: file.name, file: file, path: file.webkitRelativePath }));
    renderGroups(items);
}

// Group by top-level folder and render buttons
function renderGroups(files) {
    soundEffectsDiv.innerHTML = ''; // clear container

    // Bucket files by first path segment
    const buckets = files.reduce((acc, f) => {
        const group = f.path.split('/')[0] || 'root';
        if (!acc[group]) {
            acc[group] = [];
        }
        acc[group].push(f);
        return acc;
    }, {});

    // Render each group
    Object.entries(buckets).forEach(([groupName, groupFiles]) => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'sound-group';

        const header = document.createElement('h2');
        header.textContent = groupName;
        groupDiv.appendChild(header);

        groupFiles.forEach(f => {
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
                    audio.play();
                }
            });
            groupDiv.appendChild(btn);
        });

        soundEffectsDiv.appendChild(groupDiv);
    });
}

// Set up event listeners
pickButton.addEventListener('click', () => {
    if (window.showDirectoryPicker) {
        onPickFolder();
    } else {
        fileInput.click();
    }
});

fileInput.addEventListener('change', onFileInput);
