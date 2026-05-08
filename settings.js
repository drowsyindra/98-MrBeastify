let extensionIsDisabled
let appearChance
let flipChance
let enableCc98
let cc98Position
let imageSources

function toggleCc98PositionOptions() {
    const cc98Options = document.getElementById('cc98PositionOptions');
    const isEnabled = document.getElementById('enableCc98').checked;
    cc98Options.classList.toggle('visible', isEnabled);
}

function getSelectedCc98Position() {
    const selectedOption = document.querySelector('input[name="cc98Position"]:checked');
    return selectedOption ? selectedOption.value : 'center';
}

function normalizeImageSources(sources) {
    const normalizedSources = Array.isArray(sources) ? sources : (sources ? [sources] : []);
    const validSources = normalizedSources.filter((source) =>
        ['mrbeast', 'nailong', 'lieqi'].includes(source)
    );

    return validSources.length > 0 ? validSources : ['mrbeast'];
}

function getSelectedImageSources() {
    const selectedOptions = Array.from(document.querySelectorAll('input[name="imageSources"]:checked'));
    return normalizeImageSources(selectedOptions.map((input) => input.value));
}

// Function to load settings from Chrome storage
function loadSettings() {
    chrome.storage.local.get({
        extensionIsDisabled: false,
        appearChance: 1.00,
        flipChance: 0.25,
        enableCc98: false,
        cc98Position: 'center',
        imageSources: ['mrbeast'],
        imageSource: 'mrbeast'
    }, function (data) {
        const normalizedImageSources = normalizeImageSources(data.imageSources ?? data.imageSource);

        document.getElementById('disableExtension').checked = !data.extensionIsDisabled;
        document.getElementById('enableCc98').checked = data.enableCc98;
        document.querySelector(`input[name="cc98Position"][value="${data.cc98Position}"]`).checked = true;
        document.querySelectorAll('input[name="imageSources"]').forEach((input) => {
            input.checked = normalizedImageSources.includes(input.value);
        });
        document.getElementById('appearChance').value = data.appearChance * 100;
        document.getElementById('flipChance').value = data.flipChance * 100;
        toggleCc98PositionOptions();
    });
}

// Function to save settings to Chrome storage
function saveSettings() {
    const data = {
        extensionIsDisabled: !document.getElementById('disableExtension').checked,
        enableCc98: document.getElementById('enableCc98').checked,
        cc98Position: getSelectedCc98Position(),
        imageSources: getSelectedImageSources(),
        appearChance: parseInt(document.getElementById('appearChance').value) / 100,
        flipChance: parseInt(document.getElementById('flipChance').value) / 100
    };

    chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
            console.error("Error saving settings:", chrome.runtime.lastError);
        } else {
            console.log("Settings saved successfully.");
        }
    });
}

function ChangeNameInHeading() {
    // Get the extension name
    let extensionName = chrome.runtime.getManifest().name;

    // Remove "youtube" (case-insensitive) from the extension name and trim
    extensionName = extensionName.replace(/youtube/i, '').trim();

    // Replace "MrBeastify" in the title with the cleaned extension name
    const titleElement = document.getElementById('extension-title');
    titleElement.textContent = titleElement.textContent.replace('TITLE', extensionName);
}

// Call loadSettings() when the page loads
document.addEventListener('DOMContentLoaded', loadSettings);

// Add input event listeners to all input fields to trigger autosave
document.getElementById('disableExtension').addEventListener('input', saveSettings);
document.getElementById('enableCc98').addEventListener('input', () => {
    toggleCc98PositionOptions();
    saveSettings();
});
document.getElementById('appearChance').addEventListener('input', saveSettings);
document.getElementById('flipChance').addEventListener('input', saveSettings);
document.querySelectorAll('input[name="cc98Position"]').forEach((input) => {
    input.addEventListener('input', saveSettings);
});
document.querySelectorAll('input[name="imageSources"]').forEach((input) => {
    input.addEventListener('input', saveSettings);
});

document.addEventListener('DOMContentLoaded', ChangeNameInHeading);
