// =========================================================================
//  PREVENCIÓN GLOBAL DE NAVEGACIÓN EN DRAG & DROP
// =========================================================================
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  window.addEventListener(eventName, (e) => {
    e.preventDefault();
  }, false);
  document.addEventListener(eventName, (e) => {
    e.preventDefault();
  }, false);
});

document.addEventListener('DOMContentLoaded', () => {
  // 1. Comprobación de compatibilidad con Web Serial
  const warningBanner = document.getElementById('browser-warning');
  if (!('serial' in navigator)) {
    if (warningBanner) {
      warningBanner.classList.remove('hidden');
    }
  }

  // 2. Control de pestañas
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });

  // 3. Control de Modales (Changelog / Historial)
  const changelogBtns = document.querySelectorAll('.changelog-btn, .history-icon-btn');
  const closeBtns = document.querySelectorAll('.modal-close');
  const overlays = document.querySelectorAll('.modal-overlay');

  const closeModal = (modal) => {
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  changelogBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const modalId = btn.getAttribute('data-changelog');
      const targetModal = document.getElementById(modalId);
      if (targetModal) {
        targetModal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.closest('.modal-overlay'));
    });
  });

  overlays.forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });

  // =========================================================================
  //  4. LÓGICA DEL CONVERTIDOR DE AUDIO
  // =========================================================================
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const folderInput = document.getElementById('folder-input');
  
  const batchControl = document.getElementById('batch-control');
  const batchStatus = document.getElementById('batch-status');
  const batchCount = document.getElementById('batch-count');
  const batchProgressBar = document.getElementById('batch-progress');
  
  const clearQueueBtn = document.getElementById('clear-queue-btn');
  const convertQueueBtn = document.getElementById('convert-queue-btn');
  const downloadZipBtn = document.getElementById('download-zip-btn');
  
  const filesContainer = document.getElementById('files-container');
  const filesList = document.getElementById('files-list');
  const convModeSelect = document.getElementById('conv-mode');

  if (!dropZone || !fileInput || !folderInput) {
    console.error("No se encontraron los elementos necesarios del convertidor de audio.");
    return;
  }

  let conversionQueue = [];
  let isConverting = false;

  // Escuchar inputs de archivo y carpeta
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileObjects(Array.from(e.target.files));
      fileInput.value = '';
    }
  });

  folderInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileObjects(Array.from(e.target.files));
      folderInput.value = '';
    }
  });

  // Eventos visuales de Drag & Drop sobre la zona
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'dragend'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('dragover');

    const items = e.dataTransfer.items;
    const files = e.dataTransfer.files;
    const filesToLoad = [];

    if (items && items.length > 0 && items[0].webkitGetAsEntry) {
      const entries = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) entries.push(entry);
        }
      }
      for (const entry of entries) {
        await scanEntry(entry, '', filesToLoad);
      }
    } else if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        filesToLoad.push({
          file: files[i],
          relativePath: files[i].webkitRelativePath || files[i].name
        });
      }
    }

    if (filesToLoad.length > 0) {
      handleFileObjects(filesToLoad);
    }
  }, false);

  // Escaneo recursivo de carpetas arrastradas
  async function scanEntry(entry, path, filesList) {
    if (entry.isFile) {
      const file = await new Promise((resolve) => entry.file(resolve, () => resolve(null)));
      if (file) {
        filesList.push({
          file: file,
          relativePath: path ? `${path}/${file.name}` : file.name
        });
      }
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readAllEntries = async () => {
        let allEntries = [];
        let readBatch = async () => {
          let entries = await new Promise((resolve) => {
            dirReader.readEntries(resolve, () => resolve([]));
          });
          if (entries.length > 0) {
            allEntries = allEntries.concat(entries);
            await readBatch();
          }
        };
        await readBatch();
        return allEntries;
      };

      const entries = await readAllEntries();
      for (const subEntry of entries) {
        await scanEntry(subEntry, path ? `${path}/${entry.name}` : entry.name, filesList);
      }
    }
  }

  // Filtrar y normalizar archivos de audio
  function handleFileObjects(fileList) {
    const audioFormats = /\.(mp3|flac|wav|m4a|ogg|aac|aif|aiff)$/i;
    let addedCount = 0;
    
    fileList.forEach(item => {
      let fileObj, relPath;
      if (item.file && item.relativePath !== undefined) {
        fileObj = item.file;
        relPath = item.relativePath;
      } else {
        fileObj = item;
        relPath = item.webkitRelativePath || item.name;
      }

      if (fileObj && audioFormats.test(fileObj.name)) {
        if (!conversionQueue.some(q => q.path === relPath)) {
          addFileToQueue(fileObj, relPath);
          addedCount++;
        }
      }
    });

    if (addedCount > 0 || conversionQueue.length > 0) {
      updateQueueUI();
    }
  }

  function addFileToQueue(file, path) {
    conversionQueue.push({
      file: file,
      path: path,
      status: 'queued',
      blob: null,
      rowElement: null
    });
  }

  function updateQueueUI() {
    if (conversionQueue.length > 0) {
      batchControl.classList.remove('hidden');
      filesContainer.classList.remove('hidden');
      downloadZipBtn.classList.add('hidden');
    } else {
      batchControl.classList.add('hidden');
      filesContainer.classList.add('hidden');
    }

    filesList.innerHTML = '';
    conversionQueue.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'file-row';

      const fileInfo = document.createElement('div');
      fileInfo.className = 'file-info';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'file-name';
      nameSpan.textContent = item.file.name;

      const pathSpan = document.createElement('span');
      pathSpan.className = 'file-path';
      pathSpan.textContent = item.path;

      fileInfo.appendChild(nameSpan);
      fileInfo.appendChild(pathSpan);

      const statusBadge = document.createElement('span');
      statusBadge.className = `file-status status-${item.status}`;
      statusBadge.textContent = getStatusText(item.status);

      row.appendChild(fileInfo);
      row.appendChild(statusBadge);

      if (item.status === 'success' && item.blob) {
        const dlBtn = document.createElement('button');
        dlBtn.className = 'btn btn-primary glow-cyan-dim';
        dlBtn.style.padding = '4px 8px';
        dlBtn.style.fontSize = '0.75rem';
        dlBtn.style.minHeight = 'auto';
        dlBtn.style.minWidth = 'auto';
        dlBtn.style.marginTop = '0';
        dlBtn.textContent = '📥';
        dlBtn.title = 'Descargar WAV individual';
        dlBtn.addEventListener('click', () => {
          triggerSingleDownload(item);
        });
        row.appendChild(dlBtn);
      }

      item.rowElement = row;
      filesList.appendChild(row);
    });

    batchCount.textContent = `0 / ${conversionQueue.length} archivos`;
    batchProgressBar.style.width = '0%';
    batchStatus.textContent = 'Listo para convertir';
  }

  function getStatusText(status) {
    switch (status) {
      case 'queued': return 'En Cola';
      case 'processing': return 'Procesando...';
      case 'success': return 'Listo';
      case 'error': return 'Error';
      default: return '';
    }
  }

  clearQueueBtn.addEventListener('click', () => {
    if (isConverting) return;
    conversionQueue = [];
    updateQueueUI();
  });

  // Procesamiento por lotes
  convertQueueBtn.addEventListener('click', async () => {
    if (isConverting || conversionQueue.length === 0) return;
    isConverting = true;
    convertQueueBtn.disabled = true;
    clearQueueBtn.disabled = true;
    downloadZipBtn.classList.add('hidden');

    const mode = convModeSelect.value;
    let completedCount = 0;
    const queueToProcess = [...conversionQueue];

    batchStatus.textContent = 'Convirtiendo lote de audio...';

    async function processNext() {
      if (queueToProcess.length === 0) return;
      const item = queueToProcess.shift();
      item.status = 'processing';
      updateRowStatus(item);

      try {
        const wavBlob = await convertAudioFile(item.file, mode);
        item.blob = wavBlob;
        item.status = 'success';
      } catch (err) {
        console.error(err);
        item.status = 'error';
      }

      updateRowStatus(item);
      completedCount++;
      
      const progressPercent = (completedCount / conversionQueue.length) * 100;
      batchProgressBar.style.width = `${progressPercent}%`;
      batchCount.textContent = `${completedCount} / ${conversionQueue.length} archivos`;

      await processNext();
    }

    const concurrencyLimit = Math.min(3, queueToProcess.length);
    const initialPromises = [];
    for (let i = 0; i < concurrencyLimit; i++) {
      initialPromises.push(processNext());
    }

    await Promise.all(initialPromises);

    batchStatus.textContent = 'Conversión finalizada';
    isConverting = false;
    convertQueueBtn.disabled = false;
    clearQueueBtn.disabled = false;

    if (conversionQueue.some(q => q.status === 'success')) {
      downloadZipBtn.classList.remove('hidden');
    }
  });

  function updateRowStatus(item) {
    if (!item.rowElement) return;
    const badge = item.rowElement.querySelector('.file-status');
    if (badge) {
      badge.className = `file-status status-${item.status}`;
      badge.textContent = getStatusText(item.status);
    }
    
    if (item.status === 'success' && item.blob && !item.rowElement.querySelector('button')) {
      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn btn-primary glow-cyan-dim';
      dlBtn.style.padding = '4px 8px';
      dlBtn.style.fontSize = '0.75rem';
      dlBtn.style.minHeight = 'auto';
      dlBtn.style.minWidth = 'auto';
      dlBtn.style.marginTop = '0';
      dlBtn.textContent = '📥';
      dlBtn.title = 'Descargar WAV individual';
      dlBtn.addEventListener('click', () => {
        triggerSingleDownload(item);
      });
      item.rowElement.appendChild(dlBtn);
    }
  }

  function triggerSingleDownload(item) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(item.blob);
    a.download = item.file.name.replace(/\.[^/.]+$/, ".wav");
    a.click();
    URL.revokeObjectURL(a.href);
  }

  downloadZipBtn.addEventListener('click', async () => {
    downloadZipBtn.disabled = true;
    const originalText = downloadZipBtn.textContent;
    downloadZipBtn.textContent = 'Comprimiendo ZIP...';

    try {
      const zip = new JSZip();
      conversionQueue.forEach(item => {
        if (item.status === 'success' && item.blob) {
          const wavPath = item.path.replace(/\.[^/.]+$/, ".wav");
          zip.file(wavPath, item.blob);
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = `minijammer_wavs_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert("Error al generar el archivo ZIP: " + err.message);
    }

    downloadZipBtn.textContent = originalText;
    downloadZipBtn.disabled = false;
  });

  // Decodificación y Resampleo
  async function convertAudioFile(file, mode) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });

    const sourceAudioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    const targetChannels = mode === 'mono' ? 1 : 2;
    const targetSampleRate = 44100;
    const totalFrames = targetSampleRate * sourceAudioBuffer.duration;
    
    const offlineCtx = new OfflineAudioContext(targetChannels, totalFrames, targetSampleRate);
    
    const bufferSource = offlineCtx.createBufferSource();
    bufferSource.buffer = sourceAudioBuffer;
    bufferSource.connect(offlineCtx.destination);
    bufferSource.start(0);
    
    const renderedBuffer = await offlineCtx.startRendering();
    const wavBlob = encodeWAV16Bit(renderedBuffer, targetChannels);
    await audioCtx.close();
    
    return wavBlob;
  }

  // Generador de WAV 16-bit PCM
  function encodeWAV16Bit(audioBuffer, channelCount) {
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length * channelCount * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    let offset = 0;

    const setUint32 = (data) => {
      view.setUint32(offset, data, true);
      offset += 4;
    };

    const setUint16 = (data) => {
      view.setUint16(offset, data, true);
      offset += 2;
    };

    // RIFF header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"

    // fmt chunk
    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1);          // PCM
    setUint16(channelCount);
    setUint32(sampleRate);
    setUint32(sampleRate * channelCount * 2);
    setUint16(channelCount * 2);
    setUint16(16);

    // data chunk
    setUint32(0x61746164); // "data"
    setUint32(audioBuffer.length * channelCount * 2);

    const channelBuffers = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channelBuffers.push(audioBuffer.getChannelData(i));
    }

    const totalSamples = audioBuffer.length;
    for (let pos = 0; pos < totalSamples; pos++) {
      for (let ch = 0; ch < channelCount; ch++) {
        const channelData = channelBuffers[ch] || channelBuffers[0];
        let sample = channelData[pos];
        
        if (sample > 1) sample = 1;
        else if (sample < -1) sample = -1;
        
        const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, pcmSample, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  // =========================================================================
  //  5. LÓGICA DEL AUTO-SLICER & CHOP STUDIO
  // =========================================================================
  const slicerDropZone = document.getElementById('slicer-drop-zone');
  const slicerFileInput = document.getElementById('slicer-file-input');
  const slicerEditor = document.getElementById('slicer-editor');
  const slicerModeSelect = document.getElementById('slicer-mode');
  const slicerSensitivity = document.getElementById('slicer-sensitivity');
  const slicerSensitivityVal = document.getElementById('slicer-sensitivity-val');
  const sensitivityContainer = document.getElementById('sensitivity-container');
  const slicerRechopBtn = document.getElementById('slicer-rechop-btn');
  const waveformCanvas = document.getElementById('waveform-canvas');
  const waveformLoading = document.getElementById('waveform-loading');
  const slicerAudioInfo = document.getElementById('slicer-audio-info');
  const slicerPadsGrid = document.getElementById('slicer-pads-grid');
  const exportJamBankSelect = document.getElementById('export-jam-bank');
  const exportWavsBtn = document.getElementById('export-wavs-btn');
  const exportJamBtn = document.getElementById('export-jam-btn');

  let slicerAudioBuffer = null;
  let slicerSlices = []; // Array de marcadores en samples: [0, s1, s2, ..., totalSamples]
  let activeAudioSource = null;
  let activePlayingSlice = -1;
  let draggingMarkerIdx = -1;
  let slicerAudioCtx = null;

  const keyMap = [
    '1', '2', '3', '4',
    'q', 'w', 'e', 'r',
    'a', 's', 'd', 'f',
    'z', 'x', 'c', 'v'
  ];

  // Atajos de teclado para tocar los 16 pads
  window.addEventListener('keydown', (e) => {
    const tabSlicer = document.getElementById('tab-slicer');
    if (!tabSlicer || !tabSlicer.classList.contains('active')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    const key = e.key.toLowerCase();
    const padIdx = keyMap.indexOf(key);
    if (padIdx !== -1 && padIdx < getSliceCount()) {
      e.preventDefault();
      playSlice(padIdx);
    }
  });

  // Selector de sensibilidad
  if (slicerSensitivity && slicerSensitivityVal) {
    slicerSensitivity.addEventListener('input', (e) => {
      slicerSensitivityVal.textContent = `${e.target.value}%`;
    });
  }

  if (slicerModeSelect && sensitivityContainer) {
    slicerModeSelect.addEventListener('change', () => {
      if (slicerModeSelect.value === 'transients') {
        sensitivityContainer.style.display = 'flex';
      } else {
        sensitivityContainer.style.display = 'none';
      }
      if (slicerAudioBuffer) {
        calculateSlices();
      }
    });
  }

  if (slicerRechopBtn) {
    slicerRechopBtn.addEventListener('click', () => {
      if (slicerAudioBuffer) {
        calculateSlices();
      }
    });
  }

  if (slicerFileInput) {
    slicerFileInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        await loadAudioForSlicing(e.target.files[0]);
        slicerFileInput.value = '';
      }
    });
  }

  // Drag & Drop para Slicer
  if (slicerDropZone) {
    slicerDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      slicerDropZone.classList.add('dragover');
    });

    slicerDropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      slicerDropZone.classList.remove('dragover');
    });

    slicerDropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      slicerDropZone.classList.remove('dragover');

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        await loadAudioForSlicing(files[0]);
      }
    });
  }

  async function loadAudioForSlicing(file) {
    if (!waveformLoading || !slicerEditor) return;
    waveformLoading.classList.remove('hidden');
    slicerEditor.classList.remove('hidden');

    try {
      if (!slicerAudioCtx) {
        slicerAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (slicerAudioCtx.state === 'suspended') {
        await slicerAudioCtx.resume();
      }

      const arrayBuffer = await file.arrayBuffer();
      slicerAudioBuffer = await slicerAudioCtx.decodeAudioData(arrayBuffer);

      const durationSec = slicerAudioBuffer.duration.toFixed(2);
      const sRate = (slicerAudioBuffer.sampleRate / 1000).toFixed(1);
      const ch = slicerAudioBuffer.numberOfChannels === 1 ? 'Mono' : 'Estéreo';
      if (slicerAudioInfo) {
        slicerAudioInfo.textContent = `${durationSec}s | ${sRate}kHz ${ch}`;
      }

      calculateSlices();
    } catch (err) {
      alert("Error al cargar el archivo de audio: " + err.message);
      console.error(err);
    } finally {
      waveformLoading.classList.add('hidden');
    }
  }

  function getSliceCount() {
    return Math.max(0, slicerSlices.length - 1);
  }

  function calculateSlices() {
    if (!slicerAudioBuffer || !slicerModeSelect) return;
    const totalSamples = slicerAudioBuffer.length;
    const mode = slicerModeSelect.value;

    if (mode === 'grid16' || mode === 'grid8' || mode === 'grid4') {
      const numSlices = mode === 'grid16' ? 16 : (mode === 'grid8' ? 8 : 4);
      slicerSlices = [];
      const step = totalSamples / numSlices;
      for (let i = 0; i <= numSlices; i++) {
        slicerSlices.push(Math.round(i * step));
      }
    } else {
      // Detección de Transitorios
      const sensitivity = slicerSensitivity ? parseInt(slicerSensitivity.value, 10) : 50;
      slicerSlices = detectTransients(slicerAudioBuffer, sensitivity);
    }

    renderWaveform();
    renderPadsGrid();
  }

  // Algoritmo de detección de transitorios
  function detectTransients(buffer, sensitivity) {
    const channelData = buffer.getChannelData(0);
    const sampleRate = buffer.sampleRate;
    const totalSamples = buffer.length;
    
    const blockSize = 512;
    const numBlocks = Math.floor(totalSamples / blockSize);
    const energies = new Float32Array(numBlocks);

    for (let b = 0; b < numBlocks; b++) {
      let sum = 0;
      const start = b * blockSize;
      for (let i = 0; i < blockSize; i++) {
        const val = channelData[start + i];
        sum += val * val;
      }
      energies[b] = Math.sqrt(sum / blockSize);
    }

    const onsets = [0];
    const minDistanceSamples = Math.floor(sampleRate * 0.08); // Mínimo 80ms entre cortes
    const minBlockDist = Math.floor(minDistanceSamples / blockSize);
    const thresholdFactor = 0.005 + (100 - sensitivity) * 0.0015;
    
    let lastOnsetBlock = 0;
    const detectedPeaks = [];

    for (let b = 1; b < numBlocks - 1; b++) {
      const diff = energies[b] - energies[b - 1];
      if (diff > thresholdFactor && (b - lastOnsetBlock) >= minBlockDist) {
        detectedPeaks.push({ sample: b * blockSize, strength: diff });
        lastOnsetBlock = b;
      }
    }

    if (detectedPeaks.length > 15) {
      detectedPeaks.sort((a, b) => b.strength - a.strength);
      const topPeaks = detectedPeaks.slice(0, 15);
      topPeaks.sort((a, b) => a.sample - b.sample);
      topPeaks.forEach(p => onsets.push(p.sample));
    } else {
      detectedPeaks.forEach(p => onsets.push(p.sample));
    }

    if (onsets[onsets.length - 1] !== totalSamples) {
      onsets.push(totalSamples);
    }

    if (onsets.length < 5) {
      const fallback = [];
      const step = totalSamples / 16;
      for (let i = 0; i <= 16; i++) {
        fallback.push(Math.round(i * step));
      }
      return fallback;
    }

    return onsets;
  }

  // Renderizar forma de onda en Canvas
  function renderWaveform() {
    if (!waveformCanvas || !slicerAudioBuffer) return;
    const ctx = waveformCanvas.getContext('2d');
    const rect = waveformCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    waveformCanvas.width = rect.width * dpr;
    waveformCanvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const totalSamples = slicerAudioBuffer.length;
    const channelData = slicerAudioBuffer.getChannelData(0);

    ctx.clearRect(0, 0, width, height);

    // 1. Dibujar regiones de Slices
    const sliceColors = ['rgba(0, 229, 255, 0.05)', 'rgba(255, 214, 0, 0.06)', 'rgba(186, 104, 200, 0.05)', 'rgba(255, 145, 0, 0.05)'];
    for (let i = 0; i < getSliceCount(); i++) {
      const x1 = (slicerSlices[i] / totalSamples) * width;
      const x2 = (slicerSlices[i + 1] / totalSamples) * width;
      
      ctx.fillStyle = sliceColors[i % sliceColors.length];
      ctx.fillRect(x1, 0, x2 - x1, height);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`P${String(i + 1).padStart(2, '0')}`, x1 + 4, 14);
    }

    // 2. Dibujar la Forma de Onda
    const step = Math.ceil(totalSamples / width);
    const amp = height / 2;

    ctx.beginPath();
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x++) {
      const sampleIndex = Math.floor(x * step);
      let min = 1.0;
      let max = -1.0;

      for (let j = 0; j < step && (sampleIndex + j) < totalSamples; j++) {
        const val = channelData[sampleIndex + j];
        if (val < min) min = val;
        if (val > max) max = val;
      }

      ctx.moveTo(x, amp + min * amp * 0.88);
      ctx.lineTo(x, amp + max * amp * 0.88);
    }
    ctx.stroke();

    // 3. Dibujar las líneas divisorias de corte
    for (let i = 1; i < slicerSlices.length - 1; i++) {
      const x = (slicerSlices[i] / totalSamples) * width;

      ctx.beginPath();
      ctx.strokeStyle = '#ffd600';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffd600';
      ctx.beginPath();
      ctx.arc(x, 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Renderizar la matriz de 16 pads
  function renderPadsGrid() {
    if (!slicerPadsGrid) return;
    slicerPadsGrid.innerHTML = '';
    const sliceCount = getSliceCount();
    const sampleRate = slicerAudioBuffer ? slicerAudioBuffer.sampleRate : 44100;

    for (let i = 0; i < 16; i++) {
      const pad = document.createElement('div');
      pad.className = 'slicer-pad';
      pad.dataset.pad = i;

      const hasSlice = i < sliceCount;
      const numSpan = document.createElement('span');
      numSpan.className = 'slicer-pad-num';
      numSpan.textContent = `PAD ${String(i + 1).padStart(2, '0')}`;

      const keySpan = document.createElement('span');
      keySpan.className = 'slicer-pad-key';
      keySpan.textContent = `[${keyMap[i].toUpperCase()}]`;

      const lenSpan = document.createElement('span');
      lenSpan.className = 'slicer-pad-len';

      if (hasSlice) {
        const duration = ((slicerSlices[i + 1] - slicerSlices[i]) / sampleRate).toFixed(2);
        lenSpan.textContent = `${duration}s`;
      } else {
        lenSpan.textContent = '--';
        pad.style.opacity = '0.35';
        pad.style.cursor = 'default';
      }

      pad.appendChild(numSpan);
      pad.appendChild(keySpan);
      pad.appendChild(lenSpan);

      if (hasSlice) {
        pad.addEventListener('click', () => {
          playSlice(i);
        });
      }

      slicerPadsGrid.appendChild(pad);
    }
  }

  // Reproducir un slice
  function playSlice(index) {
    if (!slicerAudioBuffer || index >= getSliceCount()) return;

    if (!slicerAudioCtx) {
      slicerAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (slicerAudioCtx.state === 'suspended') {
      slicerAudioCtx.resume();
    }

    if (activeAudioSource) {
      try {
        activeAudioSource.stop();
        activeAudioSource.disconnect();
      } catch (e) {}
    }

    const startSample = slicerSlices[index];
    const endSample = slicerSlices[index + 1];
    const sampleRate = slicerAudioBuffer.sampleRate;
    const startTime = startSample / sampleRate;
    const duration = Math.max(0.01, (endSample - startSample) / sampleRate);

    const source = slicerAudioCtx.createBufferSource();
    source.buffer = slicerAudioBuffer;
    source.connect(slicerAudioCtx.destination);
    source.start(0, startTime, duration);

    activeAudioSource = source;
    activePlayingSlice = index;

    if (slicerPadsGrid) {
      const allPads = slicerPadsGrid.querySelectorAll('.slicer-pad');
      allPads.forEach(p => p.classList.remove('playing'));
      if (allPads[index]) {
        allPads[index].classList.add('playing');
      }
    }

    source.onended = () => {
      if (activePlayingSlice === index) {
        if (slicerPadsGrid) {
          const allPads = slicerPadsGrid.querySelectorAll('.slicer-pad');
          if (allPads[index]) allPads[index].classList.remove('playing');
        }
        activePlayingSlice = -1;
      }
    };
  }

  // Interacción de Ratón en Canvas
  if (waveformCanvas) {
    waveformCanvas.addEventListener('mousedown', (e) => {
      if (!slicerAudioBuffer || slicerSlices.length < 2) return;
      const rect = waveformCanvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const totalSamples = slicerAudioBuffer.length;
      const width = rect.width;

      draggingMarkerIdx = -1;
      for (let i = 1; i < slicerSlices.length - 1; i++) {
        const lineX = (slicerSlices[i] / totalSamples) * width;
        if (Math.abs(mouseX - lineX) <= 10) {
          draggingMarkerIdx = i;
          break;
        }
      }

      if (draggingMarkerIdx === -1) {
        const clickedSample = Math.floor((mouseX / width) * totalSamples);
        for (let i = 0; i < getSliceCount(); i++) {
          if (clickedSample >= slicerSlices[i] && clickedSample < slicerSlices[i + 1]) {
            playSlice(i);
            break;
          }
        }
      }
    });
  }

  window.addEventListener('mousemove', (e) => {
    if (draggingMarkerIdx === -1 || !slicerAudioBuffer || !waveformCanvas) return;
    const rect = waveformCanvas.getBoundingClientRect();
    const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const totalSamples = slicerAudioBuffer.length;
    const newSample = Math.floor((mouseX / rect.width) * totalSamples);

    const minSample = slicerSlices[draggingMarkerIdx - 1] + 500;
    const maxSample = slicerSlices[draggingMarkerIdx + 1] - 500;

    if (newSample >= minSample && newSample <= maxSample) {
      slicerSlices[draggingMarkerIdx] = newSample;
      renderWaveform();
      renderPadsGrid();
    }
  });

  window.addEventListener('mouseup', () => {
    if (draggingMarkerIdx !== -1) {
      draggingMarkerIdx = -1;
      renderPadsGrid();
    }
  });

  window.addEventListener('resize', () => {
    if (slicerAudioBuffer) {
      renderWaveform();
    }
  });

  // Exportar 16 WAVs en ZIP
  if (exportWavsBtn) {
    exportWavsBtn.addEventListener('click', async () => {
      if (!slicerAudioBuffer || getSliceCount() === 0) return;
      exportWavsBtn.disabled = true;
      const origText = exportWavsBtn.textContent;
      exportWavsBtn.textContent = 'Generando WAVs...';

      try {
        const zip = new JSZip();
        const sliceCount = Math.min(16, getSliceCount());
        const sampleRate = slicerAudioBuffer.sampleRate;
        const chCount = slicerAudioBuffer.numberOfChannels;

        for (let i = 0; i < sliceCount; i++) {
          const start = slicerSlices[i];
          const end = slicerSlices[i + 1];
          const length = Math.max(10, end - start);

          const sliceBuffer = slicerAudioCtx.createBuffer(chCount, length, sampleRate);
          for (let ch = 0; ch < chCount; ch++) {
            const srcData = slicerAudioBuffer.getChannelData(ch);
            const destData = sliceBuffer.getChannelData(ch);
            for (let j = 0; j < length; j++) {
              destData[j] = srcData[start + j];
            }
          }

          const wavBlob = encodeWAV16Bit(sliceBuffer, chCount);
          const padName = `PAD_${String(i + 1).padStart(2, '0')}.WAV`;
          zip.file(padName, wavBlob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = `minijammer_chops_16wavs_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (err) {
        alert("Error al exportar WAVs: " + err.message);
      } finally {
        exportWavsBtn.textContent = origText;
        exportWavsBtn.disabled = false;
      }
    });
  }

  // Exportar Proyecto Completo /JAM_XX/
  if (exportJamBtn) {
    exportJamBtn.addEventListener('click', async () => {
      if (!slicerAudioBuffer || getSliceCount() === 0) return;
      exportJamBtn.disabled = true;
      const origText = exportJamBtn.textContent;
      exportJamBtn.textContent = 'Construyendo Proyecto...';

      try {
        const bankNum = exportJamBankSelect ? parseInt(exportJamBankSelect.value, 10) : 1;
        const bankFolder = `JAM_${String(bankNum).padStart(2, '0')}`;
        const zip = new JSZip();
        const folder = zip.folder(bankFolder);

        // 1. Exportar audio maestro como SAMPLE.WAV (16-bit PCM)
        const chCount = slicerAudioBuffer.numberOfChannels;
        const wavBlob = encodeWAV16Bit(slicerAudioBuffer, chCount);
        folder.file('SAMPLE.WAV', wavBlob);

        // 2. Construir la estructura binaria BankSaveData (972 bytes)
        const bankDataBuffer = new ArrayBuffer(972);
        const view = new DataView(bankDataBuffer);
        const uint8 = new Uint8Array(bankDataBuffer);

        // magic: "JAM!"
        uint8[0] = 0x4A; uint8[1] = 0x41; uint8[2] = 0x4D; uint8[3] = 0x21;
        // isTapeMode = false (offset 4)
        uint8[4] = 0;

        const sliceCount = getSliceCount();

        // Mapear los 16 pads
        for (let i = 0; i < 16; i++) {
          const padOffset = 8 + (i * 60);

          // Filename: "/JAM_XX/SAMPLE.WAV"
          const assignedPath = `/JAM_${String(bankNum).padStart(2, '0')}/SAMPLE.WAV`;
          for (let c = 0; c < 31 && c < assignedPath.length; c++) {
            uint8[padOffset + c] = assignedPath.charCodeAt(c);
          }

          if (i < sliceCount) {
            const startIdx = slicerSlices[i];
            const endIdx = slicerSlices[i + 1];

            view.setUint32(padOffset + 32, startIdx, true); // startIndex
            view.setUint32(padOffset + 36, endIdx, true);   // endIndex
          } else {
            view.setUint32(padOffset + 32, 0, true);
            view.setUint32(padOffset + 36, 0, true);
          }

          view.setFloat32(padOffset + 40, 1.0, true);  // volume = 1.0
          view.setFloat32(padOffset + 44, 1.0, true);  // pitch = 1.0
          view.setFloat32(padOffset + 48, 0.0, true);  // attack = 0.0
          view.setFloat32(padOffset + 52, 0.0, true);  // release = 0.0
          uint8[padOffset + 56] = 0;                   // playMode = 0 (OneShot)
          uint8[padOffset + 57] = 1;                   // chokeGroup = 1 (Choke mutuo para todos los chops)
        }

        // savedBpm (offset 968)
        view.setFloat32(968, 120.0, true);

        // Guardar PROJECT.JAM
        folder.file('PROJECT.JAM', bankDataBuffer);

        // 3. Crear sequence.bin por defecto (518 bytes)
        const seqBuffer = new ArrayBuffer(518);
        const seqView = new DataView(seqBuffer);
        seqView.setFloat32(512, 120.0, true); // bpm
        new Uint8Array(seqBuffer)[516] = 1;   // totalPages = 1
        new Uint8Array(seqBuffer)[517] = 50;  // swing = 50%
        folder.file('sequence.bin', seqBuffer);

        // 4. Descargar ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = `${bankFolder}_project_${Date.now()}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (err) {
        alert("Error al exportar Proyecto: " + err.message);
        console.error(err);
      } finally {
        exportJamBtn.textContent = origText;
        exportJamBtn.disabled = false;
      }
    });
  }
});

