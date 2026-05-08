const IMAGES_PATH = "images/";
const DEFAULT_IMAGE_SOURCE = "mrbeast";
const IMAGE_SOURCE_DIRECTORIES = {
    mrbeast: "mrbeast",
    nailong: "nailong",
    lieqi: "lieqi"
};
let useAlternativeImages;
let flipBlacklist;
let blacklistStatus;
const EXTENSION_NAME = chrome.runtime.getManifest().name;
const YOUTUBE_OVERLAY_ID = `${EXTENSION_NAME}-youtube-overlay`;
const CC98_OVERLAY_ID = `${EXTENSION_NAME}-cc98-overlay`;

// Config
let extensionIsDisabled = false;
let appearChance = 1.00; //%
let flipChance = 0.25; //%
let enableCc98 = false;
let cc98Position = "center";
let imageSources = [DEFAULT_IMAGE_SOURCE];

// Apply the overlay
function applyOverlay(thumbnailElement, overlayImageURL, flip = false) {
    // Create a new img element for the overlay
    const overlayImage = document.createElement("img");
    overlayImage.id = YOUTUBE_OVERLAY_ID;
    overlayImage.src = overlayImageURL;
    overlayImage.style.position = "absolute";
    overlayImage.style.top = overlayImage.style.left = "50%";
    overlayImage.style.width = "100%";
    overlayImage.style.transform = `translate(-50%, -50%) ${flip ? 'scaleX(-1)' : ''}`; // Center and flip the image
    overlayImage.style.zIndex = "0"; // Ensure overlay is on top but below the time indicator
    thumbnailElement.parentElement.insertBefore(overlayImage, thumbnailElement.nextSibling /*Makes sure the image doesn't cover any info, but still overlays the original thumbnail*/ );
};

function getCc98OverlayPosition(position) {
    switch (position) {
        case "left":
            return {
                left: "0",
                translateX: "0"
            };
        case "right":
            return {
                left: "100%",
                translateX: "-100%"
            };
        default:
            return {
                left: "50%",
                translateX: "-50%"
            };
    }
}

function applyHeightMatchedOverlay(targetElement, overlayImageURL, horizontalPosition = "center", flip = false) {
    if (!targetElement || targetElement.clientHeight === 0) {
        return;
    }

    const position = getCc98OverlayPosition(horizontalPosition);
    const overlayImage = document.createElement("img");
    overlayImage.id = CC98_OVERLAY_ID;
    overlayImage.src = overlayImageURL;
    overlayImage.style.position = "absolute";
    overlayImage.style.top = "50%";
    overlayImage.style.left = position.left;
    overlayImage.style.height = "100%";
    overlayImage.style.width = "auto";
    overlayImage.style.maxWidth = "none";
    overlayImage.style.transform = `translate(${position.translateX}, -50%) ${flip ? 'scaleX(-1)' : ''}`;
    overlayImage.style.zIndex = "1";
    overlayImage.style.pointerEvents = "none";

    const computedStyle = window.getComputedStyle(targetElement);
    if (computedStyle.position === "static") {
        targetElement.style.position = "relative";
    }

    if (computedStyle.overflow === "visible") {
        targetElement.style.overflow = "hidden";
    }

    targetElement.appendChild(overlayImage);
}

function removeOverlaysById(overlayId) {
    document.querySelectorAll(`#${CSS.escape(overlayId)}`).forEach((overlay) => overlay.remove());
}

function normalizeImageSources(sources) {
    const normalizedSources = Array.isArray(sources) ? sources : (sources ? [sources] : []);
    const validSources = normalizedSources.filter((source) => Object.prototype.hasOwnProperty.call(IMAGE_SOURCE_DIRECTORIES, source));

    return validSources.length > 0 ? validSources : [DEFAULT_IMAGE_SOURCE];
}

function getActiveImageSources() {
    return normalizeImageSources(imageSources);
}

function getAvailableImageSources() {
    return getActiveImageSources().filter((source) => (highestImageIndexBySource[source] ?? 0) > 0);
}

function getRandomActiveImageSource() {
    const activeSources = getAvailableImageSources();
    if (activeSources.length === 0) {
        return null;
    }

    const randomIndex = Math.floor(Math.random() * activeSources.length);
    return activeSources[randomIndex];
}

function getImageRelativePath(index, source = DEFAULT_IMAGE_SOURCE) {
    return `${IMAGE_SOURCE_DIRECTORIES[source]}/${index}`;
}

function FindThumbnails() {
    const imageSelectors = [
        "ytd-thumbnail a > yt-image > img.yt-core-image", // old thumbnail images
        'img.style-scope.yt-img-shadow[width="86"]', // notification images
        '.yt-thumbnail-view-model__image img', // new main thumbnail images
        'img.ytCoreImageHost' // another day, another queryselector
    ];

    const allImages = [];
    for (const selector of imageSelectors) {
        allImages.push(...Array.from(document.querySelectorAll(selector)));
    }

    // Check whether the aspect ratio matches that of a thumbnail
    const targetAspectRatio = [16 / 9, 4 / 3];
    const errorMargin = 0.02; // Allows for 4:3, since YouTube is badly coded

    var listAllThumbnails = allImages.filter(image => {
        // Check if the height is not 0 before calculating the aspect ratio
        if (image.height === 0) {
            return false;
        }

        const aspectRatio = image.width / image.height;
        let isCorrectAspectRatio = (Math.abs(aspectRatio - targetAspectRatio[0]) < errorMargin) || (Math.abs(aspectRatio - targetAspectRatio[1]) < errorMargin);
        return isCorrectAspectRatio;
    });

    // Select all images from the recommended video screen
    const videoWallImages = document.querySelectorAll(".ytp-videowall-still-image"); // Because youtube video wall images are not properly classified as images
    const cuedThumbnailOverlays = document.querySelectorAll('div.ytp-cued-thumbnail-overlay-image');
    listAllThumbnails.push(...videoWallImages, ...cuedThumbnailOverlays);
        
    return listAllThumbnails.filter(image => {
        const parent = image.parentElement;

        // Checks whether it's a video preview
        const isVideoPreview = parent.closest("#video-preview") !== null || Array.from(parent.classList).some(cls => cls.includes("ytAnimated"))

        // Checks whether it's a chapter thumbnail
        const isChapter = parent.closest("#endpoint") !== null

        // Check if thumbnails have already been processed
        const processed = Array.from(parent.children).filter(child => {
            const alreadyHasAThumbnail =
                child.id && // Child has ID
                child.id.includes(YOUTUBE_OVERLAY_ID);

            return (
                alreadyHasAThumbnail ||
                isVideoPreview ||
                isChapter
            )
        });

        return processed.length == 0;
    });
}

function findCc98Targets() {
    return Array.from(document.querySelectorAll('.focus-topic-middle, .card-topic, .mainPageListRow')).filter(target => {
        if (target.clientHeight === 0) {
            return false;
        }

        return !Array.from(target.children).some(child =>
            child.id && child.id.includes(CC98_OVERLAY_ID)
        );
    });
}

async function resolveOverlayImageChoice() {
    let flip = Math.random() < flipChance;
    const activeImageSource = getRandomActiveImageSource();
    if (!activeImageSource) {
        return null;
    }

    const imageIndex = getRandomImageFromDirectory(activeImageSource);
    let baseImagePath = getImageRelativePath(imageIndex, activeImageSource);

    if (activeImageSource === "mrbeast" && flip && flipBlacklist && flipBlacklist.includes(imageIndex)) {
        if (useAlternativeImages) {
            const newImagePath = `textFlipped/${imageIndex}`;
            if (await checkImageExistence(newImagePath)) {
                baseImagePath = newImagePath;
            }
        }

        flip = false;
    }

    return {
        baseImagePath,
        flip
    };
}

async function applyOverlayToCc98Targets() {
    if (!enableCc98) {
        return;
    }

    const cc98Targets = findCc98Targets();
    for (const targetElement of cc98Targets) {
        const overlayChoice = await resolveOverlayImageChoice();
        if (!overlayChoice) {
            continue;
        }

        const { baseImagePath, flip } = overlayChoice;

        const overlayImageURL = Math.random() < appearChance ?
            getImageURL(baseImagePath) :
            "";

        applyHeightMatchedOverlay(targetElement, overlayImageURL, cc98Position, flip);
    }
}

async function applyOverlays() {
    await Promise.all(getActiveImageSources().map((source) => getHighestImageIndex(source)));

    if (location.hostname.includes("youtube.com")) {
        await applyOverlayToThumbnails();
    }

    if (location.hostname.includes("cc98.org")) {
        await applyOverlayToCc98Targets();
    }
}

function handleConfigChange(changes) {
    const hasExtensionToggle = Object.prototype.hasOwnProperty.call(changes, "extensionIsDisabled");
    const hasAppearChance = Object.prototype.hasOwnProperty.call(changes, "appearChance");
    const hasFlipChance = Object.prototype.hasOwnProperty.call(changes, "flipChance");
    const hasCc98Toggle = Object.prototype.hasOwnProperty.call(changes, "enableCc98");
    const hasCc98Position = Object.prototype.hasOwnProperty.call(changes, "cc98Position");
    const hasImageSources = Object.prototype.hasOwnProperty.call(changes, "imageSources");
    const hasLegacyImageSource = Object.prototype.hasOwnProperty.call(changes, "imageSource");

    if (hasExtensionToggle) {
        extensionIsDisabled = changes.extensionIsDisabled.newValue;
    }

    if (hasAppearChance) {
        appearChance = changes.appearChance.newValue;
    }

    if (hasFlipChance) {
        flipChance = changes.flipChance.newValue;
    }

    if (hasCc98Toggle) {
        enableCc98 = changes.enableCc98.newValue;
    }

    if (hasCc98Position) {
        cc98Position = changes.cc98Position.newValue;
    }

    if (hasImageSources) {
        imageSources = normalizeImageSources(changes.imageSources.newValue);
    } else if (hasLegacyImageSource) {
        imageSources = normalizeImageSources(changes.imageSource.newValue);
    }

    if (extensionIsDisabled) {
        removeOverlaysById(YOUTUBE_OVERLAY_ID);
        removeOverlaysById(CC98_OVERLAY_ID);
        return;
    }

    if (hasImageSources || hasLegacyImageSource) {
        removeOverlaysById(YOUTUBE_OVERLAY_ID);
        removeOverlaysById(CC98_OVERLAY_ID);
    }

    if (location.hostname.includes("cc98.org")) {
        if ((hasCc98Toggle && !enableCc98) || hasCc98Position || hasAppearChance || hasFlipChance || hasImageSources || hasLegacyImageSource) {
            removeOverlaysById(CC98_OVERLAY_ID);
        }

        if (hasCc98Toggle && !enableCc98) {
            return;
        }
    }

    if (hasExtensionToggle || hasAppearChance || hasFlipChance || hasCc98Toggle || hasCc98Position || hasImageSources || hasLegacyImageSource) {
        applyOverlays();
    }
}

// Looks for all thumbnails and applies overlay
async function applyOverlayToThumbnails() {
    const thumbnailElements = FindThumbnails()

    // Apply overlay to each thumbnail
    for (const thumbnailElement of thumbnailElements) {
        // Apply overlay and add to processed thumbnails
        const loops = Math.random() > 0.001 ? 1 : 20; // Easter egg

        for (let i = 0; i < loops; i++) {
            const overlayChoice = await resolveOverlayImageChoice();
            if (!overlayChoice) {
                continue;
            }

            const { baseImagePath, flip } = overlayChoice;

            const overlayImageURL = Math.random() < appearChance ?
                getImageURL(baseImagePath) :
                ""; // Just set the url to "" if we don't want MrBeast to appear lol

            applyOverlay(thumbnailElement, overlayImageURL, flip);
        }
    }

}

// Get the URL of an image
function getImageURL(relativePath) {
    return chrome.runtime.getURL(`${IMAGES_PATH}${relativePath}.png`);
}

// Checks if an image exists in the image folder
async function checkImageExistence(relativePath) {
    const testedURL = getImageURL(relativePath)

    return fetch(testedURL)
        .then(() => {
            return true
        }).catch(error => {
            return false
        })
}

////////////////////////
//  BrandonXLF Magic  //
////////////////////////

// Defines the N size of last images that will not be repeated.
const size_of_non_repeat = 8
// List of the index of the last N selected images.
const lastIndexesBySource = {}

// Get a random image URL from a directory
function getRandomImageFromDirectory(source = DEFAULT_IMAGE_SOURCE) {
    const highestImageIndex = highestImageIndexBySource[source];
    if (!lastIndexesBySource[source]) {
        lastIndexesBySource[source] = Array(size_of_non_repeat).fill(-1);
    }

    const last_indexes = lastIndexesBySource[source];
    let randomIndex = -1

    // If the number of images is less than the size of the non-repeat array, reset the array
    if (!highestImageIndex || highestImageIndex <= size_of_non_repeat) {
        last_indexes.fill(-1); // Reset the array
    }

    // It selects a random index until it finds one that is not repeated
    while (last_indexes.includes(randomIndex) || randomIndex < 0) {
        randomIndex = Math.floor(Math.random() * highestImageIndex) + 1;
    }

    // When it finds the non repeating index, it eliminates the oldest value, and pushes the current index
    last_indexes.shift()
    last_indexes.push(randomIndex)

    return randomIndex
}

const highestImageIndexBySource = {};
// Gets the highest index of an image in the image folder starting from 1
async function getHighestImageIndex(source = DEFAULT_IMAGE_SOURCE) {
    if (highestImageIndexBySource[source]) {
        return highestImageIndexBySource[source];
    }

    const INITIAL_INDEX = 4;
    let i = INITIAL_INDEX;

    // Increase i until i is greater than the number of images
    while (await checkImageExistence(getImageRelativePath(i, source))) {
        i *= 2;
    }

    // Possible min and max values
    let min = i <= INITIAL_INDEX ? 1 : i / 2;
    let max = i;

    // Binary search
    while (min <= max) {
        // Find the midpoint of possible max and min
        let mid = Math.floor((min + max) / 2);

        // Check if the midpoint exists
        if (await checkImageExistence(getImageRelativePath(mid, source))) {
            // If it does, next min to check is one greater
            min = mid + 1;
        } else {
            // If it doesn't, max must be at least one less
            max = mid - 1;
        }
    }

    // Max is the size of the image array
    highestImageIndexBySource[source] = max;
    return max;
}
////////////////////////
//  BrandonXLF Magic  //
////////////////////////

async function GetFlipBlocklist() {
    try {
        const response = await fetch(chrome.runtime.getURL(`${IMAGES_PATH}flip_blacklist.json`));
        const data = await response.json();
        useAlternativeImages = data.useAlternativeImages;
        flipBlacklist = data.blacklistedImages;
        blacklistStatus = `Flip blacklist found. ${useAlternativeImages ? "Images will be substituted." : "Images won't be flipped."}`;
    } catch (error) {
        blacklistStatus = "No flip blacklist found. Proceeding without it";
    }
}

async function LoadConfig() {
    const df /* default */ = {
        extensionIsDisabled: extensionIsDisabled,
        appearChance: appearChance,
        flipChance: flipChance,
        enableCc98: enableCc98,
        cc98Position: cc98Position,
        imageSources: imageSources
    }

    try {
        const config = await new Promise((resolve, reject) => {
                chrome.storage.local.get({
                    extensionIsDisabled,
                    appearChance,
                    flipChance,
                    enableCc98,
                    cc98Position,
                    imageSources,
                    imageSource: DEFAULT_IMAGE_SOURCE
                }, (result) => {
                chrome.runtime.lastError ? // Check for errors
                    reject(chrome.runtime.lastError) : // Reject if errors
                    resolve(result) // Resolve if no errors
            });
        });

        // Initialize variables based on loaded configuration
        extensionIsDisabled = config.extensionIsDisabled ?? df.extensionIsDisabled;
        appearChance = config.appearChance ?? df.appearChance;
        flipChance = config.flipChance ?? df.flipChance;
        enableCc98 = config.enableCc98 ?? df.enableCc98;
        cc98Position = config.cc98Position ?? df.cc98Position;
        imageSources = normalizeImageSources(config.imageSources ?? config.imageSource ?? df.imageSources);

        if (Object.keys(config).length === 0 && config.constructor === Object /* config doesn't exist */ ) {
            await new Promise((resolve, reject) => {
                chrome.storage.local.set(df, () => {
                    chrome.runtime.lastError ? // Check for errors
                        reject(chrome.runtime.lastError) : // Reject if errors
                        resolve() // Resolve if no errors
                })
            })
        }
    } catch (error) {
        console.error("Guhh?? Error loading configuration:", error);
    }
}

async function Main() {
    await LoadConfig()

    if (extensionIsDisabled) {
        console.info(`${EXTENSION_NAME} is disabled.`)
        return // Exit the function if MrBeastify is disabled
    }

    await GetFlipBlocklist()
    console.info(`${EXTENSION_NAME} will now detect the amount of images. Ignore all the following errors.`)
    await Promise.all(getActiveImageSources().map((source) => getHighestImageIndex(source)))
        .then(() => {
            applyOverlays();
            setInterval(applyOverlays, 100);
            console.info(
                `${EXTENSION_NAME} Loaded Successfully. Sources: ${getActiveImageSources().join(", ")}. ${blacklistStatus}.`
            );
        })

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== "local") {
            return;
        }

        handleConfigChange(changes);
    });
}

Main()
