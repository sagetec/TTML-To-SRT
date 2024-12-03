// converter.js

// Helper function to log messages
function log(message) {
    const logDiv = document.getElementById('log');
    logDiv.textContent += message + '\n';
    logDiv.scrollTop = logDiv.scrollHeight;
}

// Function to convert TTML to SRT
function convertTTMLtoSRT(ttmlContent) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(ttmlContent, "application/xml");

    const errors = xmlDoc.getElementsByTagName("parsererror");
    if (errors.length > 0) {
        throw new Error("Invalid TTML file.");
    }

    const srtLines = [];
    const texts = xmlDoc.getElementsByTagName("p"); // Assuming 'p' elements contain the subtitles

    for (let i = 0; i < texts.length; i++) {
        const text = texts[i];
        const begin = text.getAttribute('begin');
        const end = text.getAttribute('end');
        const dur = text.getAttribute('dur');

        // Handle cases where 'end' is not provided
        let endTime = end;
        if (!endTime && dur) {
            // Calculate end time from begin + dur
            // Simple parsing assuming format "HH:MM:SS.mmm"
            const parseTime = (timeStr) => {
                const parts = timeStr.split(':');
                const secondsParts = parts[2].split('.');
                const hours = parseInt(parts[0], 10);
                const minutes = parseInt(parts[1], 10);
                const seconds = parseInt(secondsParts[0], 10);
                const millis = parseInt(secondsParts[1] || '0', 10);
                return hours * 3600 + minutes * 60 + seconds + millis / 1000;
            };

            const beginSec = parseTime(begin);
            const durSec = parseTime(dur);
            const endSecCalc = beginSec + durSec;

            const formatTime = (sec) => {
                const hours = Math.floor(sec / 3600);
                const minutes = Math.floor((sec % 3600) / 60);
                const seconds = Math.floor(sec % 60);
                const millis = Math.floor((sec - Math.floor(sec)) * 1000);
                return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
            };

            endTime = formatTime(endSecCalc);
        }

        // Convert begin and end times to SRT format
        const convertTime = (timeStr) => {
            // TTML uses '.' as decimal separator, SRT uses ','
            return timeStr.replace('.', ',').replace('T', ' ').replace('Z', '');
        };

        const srtBegin = convertTime(begin);
        const srtEnd = convertTime(endTime);

        // Get the text content, replacing any line breaks with '\n'
        const textContent = text.textContent.trim().replace(/<br\s*\/?>/gi, '\n');

        // Append to SRT lines
        srtLines.push(`${i + 1}`);
        srtLines.push(`${srtBegin} --> ${srtEnd}`);
        srtLines.push(textContent);
        srtLines.push(''); // Empty line between subtitles
    }

    return srtLines.join('\n');
}

document.addEventListener('DOMContentLoaded', () => {
    let inputHandle;
    let outputHandle;

    const selectInputBtn = document.getElementById('selectInput');
    const selectOutputBtn = document.getElementById('selectOutput');
    const convertBtn = document.getElementById('convert');

    selectInputBtn.addEventListener('click', async () => {
        try {
            inputHandle = await window.showDirectoryPicker({
                id: 'inputFolder',
                startIn: 'documents',
                types: [{
                    description: 'TTML Files',
                    accept: {'application/xml': ['.ttml', '.xml']}
                }]
            });
            log('Input folder selected.');
            if (outputHandle) {
                convertBtn.disabled = false;
            }
        } catch (err) {
            log(`Error selecting input folder: ${err.message}`);
        }
    });

    selectOutputBtn.addEventListener('click', async () => {
        try {
            outputHandle = await window.showDirectoryPicker({
                id: 'outputFolder',
                startIn: 'documents',
                types: [{
                    description: 'SRT Files',
                    accept: {'application/octet-stream': ['.srt']}
                }]
            });
            log('Output folder selected.');
            if (inputHandle) {
                convertBtn.disabled = false;
            }
        } catch (err) {
            log(`Error selecting output folder: ${err.message}`);
        }
    });

    convertBtn.addEventListener('click', async () => {
        if (!inputHandle || !outputHandle) {
            log('Please select both input and output folders.');
            return;
        }

        try {
            log('Starting conversion...');
            for await (const entry of inputHandle.values()) {
                if (entry.kind === 'file' && (entry.name.endsWith('.ttml') || entry.name.endsWith('.xml'))) {
                    log(`Processing: ${entry.name}`);
                    const file = await entry.getFile();
                    const ttmlContent = await file.text();
                    let srtContent;
                    try {
                        srtContent = convertTTMLtoSRT(ttmlContent);
                    } catch (conversionError) {
                        log(`Error converting ${entry.name}: ${conversionError.message}`);
                        continue;
                    }

                    const srtFileName = entry.name.replace(/\.(ttml|xml)$/i, '.srt');
                    const srtFile = await outputHandle.getFileHandle(srtFileName, { create: true });
                    const writable = await srtFile.createWritable();
                    await writable.write(srtContent);
                    await writable.close();
                    log(`Saved: ${srtFileName}`);
                }
            }
            log('Conversion completed.');
        } catch (err) {
            log(`Error during conversion: ${err.message}`);
        }
    });
});
