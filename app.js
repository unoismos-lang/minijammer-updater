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

      // Detener cualquier audio en reproduccion al cambiar de pestaña
      if (typeof stopSlicePlayback === 'function') {
        stopSlicePlayback();
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
  const convSanitize = document.getElementById('conv-sanitize');

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

  // Sanitización de rutas y nombres para compatibilidad con MicroSD / ESP32 (FAT32)
  function sanitizeSDPath(rawPath) {
    if (!rawPath) return 'track.wav';
    
    const cleanSlashes = rawPath.replace(/\\/g, '/');
    const parts = cleanSlashes.split('/');

    const sanitizedParts = parts.map((part, index) => {
      const isFile = (index === parts.length - 1);
      let ext = '';
      let base = part;

      if (isFile && part.includes('.')) {
        const lastDot = part.lastIndexOf('.');
        base = part.substring(0, lastDot);
        ext = part.substring(lastDot);
      }

      // 1. Quitar acentos y diacríticos (á -> a, ñ -> n, etc.)
      base = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

      // 2. Reemplazar apóstrofes curvados, comillas tipográficas y guiones largos
      base = base.replace(/[’‘`´]/g, "'")
                 .replace(/[“”]/g, '')
                 .replace(/[–—]/g, '-');

      // 3. Quitar caracteres conflictivos con FAT32 / ESP32 SD
      base = base.replace(/[\\?%*:|"<>#~[\]^;!]/g, '_');

      // 4. Limpiar espacios múltiples y caracteres de control
      base = base.replace(/[\x00-\x1F\x7F]/g, '')
                 .replace(/\s+/g, ' ')
                 .trim();

      // 5. Evitar nombres vacíos o que empiecen/terminen con puntos
      base = base.replace(/^\.+|\.+$/g, '').trim();
      if (!base) base = isFile ? 'track' : 'folder';

      // 6. Limitar longitud de segmento a 50 caracteres para evitar overflow en ESP32
      if (base.length > 50) {
        base = base.substring(0, 50).trim();
      }

      return isFile ? (base + (ext.toLowerCase() === '.wav' ? '.wav' : ext)) : base;
    });

    return sanitizedParts.filter(p => p.length > 0).join('/');
  }

  function triggerSingleDownload(item) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(item.blob);
    let filename = item.file.name.replace(/\.[^/.]+$/, ".wav");
    if (!convSanitize || convSanitize.checked) {
      filename = sanitizeSDPath(filename);
    }
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  downloadZipBtn.addEventListener('click', async () => {
    downloadZipBtn.disabled = true;
    const originalText = downloadZipBtn.textContent;
    downloadZipBtn.textContent = 'Comprimiendo ZIP...';

    try {
      const zip = new JSZip();
      const shouldSanitize = !convSanitize || convSanitize.checked;

      conversionQueue.forEach(item => {
        if (item.status === 'success' && item.blob) {
          let wavPath = item.path.replace(/\.[^/.]+$/, ".wav");
          if (shouldSanitize) {
            wavPath = sanitizeSDPath(wavPath);
          }
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
  const slicerStopBtn = document.getElementById('slicer-stop-btn');
  const waveformCanvas = document.getElementById('waveform-canvas');
  const waveformLoading = document.getElementById('waveform-loading');
  const slicerAudioInfo = document.getElementById('slicer-audio-info');
  const slicerPadsGrid = document.getElementById('slicer-pads-grid');
  const slicerPadsStatus = document.getElementById('slicer-pads-status');
  const slicerQualityGlobal = document.getElementById('slicer-quality-global');
  const exportAutoadjustQuality = document.getElementById('export-autoadjust-quality');
  const exportJamBankSelect = document.getElementById('export-jam-bank');
  const exportWavsBtn = document.getElementById('export-wavs-btn');
  const exportJamBtn = document.getElementById('export-jam-btn');

  // Presets de calidad basados en la arquitectura de memoria del MiniJammer XXL (MAX_SAMPLES_PER_ASSET = 220500)
  const QUALITY_PRESETS = {
    '44k16': { id: '44k16', label: '44.1k 16b', name: 'Hi-Fi (44.1kHz 16-bit)', sampleRate: 44100, bitDepth: 16, maxSec: 5.0, maxSamples: 220500 },
    '22k16': { id: '22k16', label: '22.0k 16b', name: 'Estándar (22.05kHz 16-bit)', sampleRate: 22050, bitDepth: 16, maxSec: 10.0, maxSamples: 220500 },
    '22k8':  { id: '22k8',  label: '22.0k 8b',  name: 'Lo-Fi (22.05kHz 8-bit)', sampleRate: 22050, bitDepth: 8,  maxSec: 20.0, maxSamples: 441000 },
    '11k8':  { id: '11k8',  label: '11.0k 8b',  name: 'Vintage (11.025kHz 8-bit)', sampleRate: 11025, bitDepth: 8,  maxSec: 40.0, maxSamples: 441000 },
  };

  let globalQualityMode = '22k16'; // '22k16', '44k16', '22k8', '11k8', 'custom'
  let padQualities = Array(16).fill('22k16');

  function getRecommendedQuality(durationSec) {
    if (durationSec <= 5.0) return '44k16';
    if (durationSec <= 10.0) return '22k16';
    if (durationSec <= 20.0) return '22k8';
    return '11k8';
  }

  let slicerAudioBuffer = null;
  let slicerSlices = []; // Array de marcadores en samples: [0, s1, s2, ..., totalSamples]
  let activeAudioSources = [];
  let activePlayingSlice = -1;
  let draggingMarkerIdx = -1;
  let slicerAudioCtx = null;

  const keyMap = [
    '1', '2', '3', '4',
    'q', 'w', 'e', 'r',
    'a', 's', 'd', 'f',
    'z', 'x', 'c', 'v'
  ];

  function stopSlicePlayback() {
    activeAudioSources.forEach(src => {
      try {
        src.stop(0);
        src.disconnect();
      } catch (e) {}
    });
    activeAudioSources = [];
    activePlayingSlice = -1;
    if (slicerPadsGrid) {
      const allPads = slicerPadsGrid.querySelectorAll('.slicer-pad');
      allPads.forEach(p => p.classList.remove('playing'));
    }
  }

  if (slicerStopBtn) {
    slicerStopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      stopSlicePlayback();
    });
  }

  if (slicerQualityGlobal) {
    slicerQualityGlobal.addEventListener('change', (e) => {
      globalQualityMode = e.target.value;
      if (globalQualityMode !== 'custom') {
        padQualities.fill(globalQualityMode);
      }
      renderPadsGrid();
    });
  }

  // Atajos de teclado para tocar los 16 pads y botón Stop (Espacio / Esc)
  window.addEventListener('keydown', (e) => {
    const tabSlicer = document.getElementById('tab-slicer');
    if (!tabSlicer || !tabSlicer.classList.contains('active')) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    if (e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      stopSlicePlayback();
      return;
    }

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

  // Renderizar la matriz de 16 pads con límites de RAM y calidad
  function renderPadsGrid() {
    if (!slicerPadsGrid) return;
    slicerPadsGrid.innerHTML = '';
    const sliceCount = getSliceCount();
    const origSampleRate = slicerAudioBuffer ? slicerAudioBuffer.sampleRate : 44100;
    let warningCount = 0;

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
        const durationSec = (slicerSlices[i + 1] - slicerSlices[i]) / origSampleRate;
        const qKey = padQualities[i] || '22k16';
        const preset = QUALITY_PRESETS[qKey] || QUALITY_PRESETS['22k16'];
        const isExceeded = durationSec > (preset.maxSec + 0.05);

        if (isExceeded) {
          warningCount++;
          pad.classList.add('warning');
        }

        lenSpan.textContent = `${durationSec.toFixed(2)}s / ${preset.maxSec}s`;

        pad.appendChild(numSpan);
        pad.appendChild(keySpan);
        pad.appendChild(lenSpan);

        if (isExceeded) {
          const warnBadge = document.createElement('span');
          warnBadge.className = 'slicer-pad-warning-badge';
          warnBadge.textContent = `⚠️ Excede ${preset.maxSec}s`;
          pad.appendChild(warnBadge);

          const recKey = getRecommendedQuality(durationSec);
          const recPreset = QUALITY_PRESETS[recKey];
          const fixBtn = document.createElement('button');
          fixBtn.style.cssText = 'font-size: 0.58rem; background: rgba(255,214,0,0.15); color: #ffd600; border: 1px solid rgba(255,214,0,0.35); border-radius: 4px; padding: 1px 4px; cursor: pointer; margin-top: 2px; font-family: "JetBrains Mono", monospace; font-weight: 700;';
          fixBtn.textContent = `⚡ Usar ${recPreset.label}`;
          fixBtn.title = `Cambiar calidad a ${recPreset.name} para que quepa completo`;
          fixBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            padQualities[i] = recKey;
            globalQualityMode = 'custom';
            if (slicerQualityGlobal) slicerQualityGlobal.value = 'custom';
            renderPadsGrid();
          });
          pad.appendChild(fixBtn);
        } else {
          if (globalQualityMode === 'custom') {
            const qSelect = document.createElement('select');
            qSelect.className = 'slicer-pad-q-select';
            Object.keys(QUALITY_PRESETS).forEach(k => {
              const opt = document.createElement('option');
              opt.value = k;
              opt.textContent = QUALITY_PRESETS[k].label;
              if (k === qKey) opt.selected = true;
              qSelect.appendChild(opt);
            });
            qSelect.addEventListener('click', (ev) => ev.stopPropagation());
            qSelect.addEventListener('change', (ev) => {
              padQualities[i] = ev.target.value;
              renderPadsGrid();
            });
            pad.appendChild(qSelect);
          } else {
            const qBadge = document.createElement('span');
            qBadge.className = 'slicer-pad-q-badge';
            qBadge.textContent = preset.label;
            pad.appendChild(qBadge);
          }
        }

        pad.addEventListener('click', () => {
          playSlice(i);
        });
      } else {
        lenSpan.textContent = '--';
        pad.style.opacity = '0.35';
        pad.style.cursor = 'default';
        pad.appendChild(numSpan);
        pad.appendChild(keySpan);
        pad.appendChild(lenSpan);
      }

      slicerPadsGrid.appendChild(pad);
    }

    if (slicerPadsStatus) {
      if (warningCount > 0) {
        slicerPadsStatus.innerHTML = `<span style="color: #ff9100; font-weight: 700;">⚠️ ${warningCount} chop(s) exceden el límite de RAM</span>`;
      } else {
        slicerPadsStatus.innerHTML = `<span style="color: var(--cyan); font-weight: 600;">✓ 16 Chops listos en memoria</span>`;
      }
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

    stopSlicePlayback();

    const startSample = slicerSlices[index];
    const endSample = slicerSlices[index + 1];
    const sampleRate = slicerAudioBuffer.sampleRate;
    const startTime = startSample / sampleRate;
    const duration = Math.max(0.01, (endSample - startSample) / sampleRate);

    const source = slicerAudioCtx.createBufferSource();
    source.buffer = slicerAudioBuffer;
    source.connect(slicerAudioCtx.destination);
    source.start(0, startTime, duration);

    activeAudioSources.push(source);
    activePlayingSlice = index;

    if (slicerPadsGrid) {
      const allPads = slicerPadsGrid.querySelectorAll('.slicer-pad');
      allPads.forEach(p => p.classList.remove('playing'));
      if (allPads[index]) {
        allPads[index].classList.add('playing');
      }
    }

    source.onended = () => {
      const idx = activeAudioSources.indexOf(source);
      if (idx !== -1) activeAudioSources.splice(idx, 1);
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

  // Funciones de Resampling y Codificación WAV para MiniJammer
  async function extractAndResampleSlice(audioBuffer, startSample, endSample, targetSampleRate) {
    const origRate = audioBuffer.sampleRate;
    const sliceLen = Math.max(10, endSample - startSample);
    const numChannels = audioBuffer.numberOfChannels;
    const monoData = new Float32Array(sliceLen);

    if (numChannels === 1) {
      const ch0 = audioBuffer.getChannelData(0);
      for (let i = 0; i < sliceLen; i++) monoData[i] = ch0[startSample + i];
    } else {
      const ch0 = audioBuffer.getChannelData(0);
      const ch1 = audioBuffer.getChannelData(1);
      for (let i = 0; i < sliceLen; i++) {
        monoData[i] = (ch0[startSample + i] + ch1[startSample + i]) * 0.5;
      }
    }

    if (origRate === targetSampleRate) {
      return monoData;
    }

    const tempBuffer = slicerAudioCtx.createBuffer(1, sliceLen, origRate);
    tempBuffer.copyToChannel(monoData, 0);

    const targetLength = Math.max(1, Math.round(sliceLen * (targetSampleRate / origRate)));
    const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
      1,
      targetLength,
      targetSampleRate
    );
    const src = offlineCtx.createBufferSource();
    src.buffer = tempBuffer;
    src.connect(offlineCtx.destination);
    src.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0);
  }

  function encodeWAVPCM(float32Array, sampleRate, bitDepth) {
    const channelCount = 1;
    const bytesPerSample = bitDepth === 16 ? 2 : 1;
    const blockAlign = channelCount * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = float32Array.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    let offset = 0;
    const writeString = (s) => {
      for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
    };

    // RIFF
    writeString('RIFF');
    view.setUint32(offset, 36 + dataSize, true); offset += 4;
    writeString('WAVE');

    // fmt
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, 1, true); offset += 2; // PCM
    view.setUint16(offset, channelCount, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, byteRate, true); offset += 4;
    view.setUint16(offset, blockAlign, true); offset += 2;
    view.setUint16(offset, bitDepth, true); offset += 2;

    // data
    writeString('data');
    view.setUint32(offset, dataSize, true); offset += 4;

    const totalSamples = float32Array.length;
    if (bitDepth === 16) {
      for (let i = 0; i < totalSamples; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        const pcm = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(offset, pcm, true);
        offset += 2;
      }
    } else {
      // 8-bit PCM signed para el motor del MiniJammer
      for (let i = 0; i < totalSamples; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        const pcm8 = Math.max(-128, Math.min(127, Math.floor(s * 127)));
        view.setInt8(offset, pcm8);
        offset += 1;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  // Exportar 16 WAVs en ZIP
  if (exportWavsBtn) {
    exportWavsBtn.addEventListener('click', async () => {
      if (!slicerAudioBuffer || getSliceCount() === 0) return;
      exportWavsBtn.disabled = true;
      const origText = exportWavsBtn.textContent;
      exportWavsBtn.textContent = 'Procesando Calidad & WAVs...';

      try {
        const zip = new JSZip();
        const sliceCount = Math.min(16, getSliceCount());
        const origSampleRate = slicerAudioBuffer.sampleRate;
        const autoAdjust = exportAutoadjustQuality ? exportAutoadjustQuality.checked : true;

        for (let i = 0; i < sliceCount; i++) {
          const start = slicerSlices[i];
          const end = slicerSlices[i + 1];
          const durationSec = (end - start) / origSampleRate;

          let qKey = padQualities[i] || '22k16';
          let preset = QUALITY_PRESETS[qKey] || QUALITY_PRESETS['22k16'];

          if (autoAdjust && durationSec > preset.maxSec) {
            qKey = getRecommendedQuality(durationSec);
            preset = QUALITY_PRESETS[qKey];
          }

          let monoSamples = await extractAndResampleSlice(slicerAudioBuffer, start, end, preset.sampleRate);
          if (monoSamples.length > preset.maxSamples) {
            monoSamples = monoSamples.subarray(0, preset.maxSamples);
          }

          const wavBlob = encodeWAVPCM(monoSamples, preset.sampleRate, preset.bitDepth);
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
        console.error(err);
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

        const sliceCount = Math.min(16, getSliceCount());
        const origSampleRate = slicerAudioBuffer.sampleRate;
        const autoAdjust = exportAutoadjustQuality ? exportAutoadjustQuality.checked : true;

        // 1. Estructura binaria BankSaveData (972 bytes)
        const bankDataBuffer = new ArrayBuffer(972);
        const view = new DataView(bankDataBuffer);
        const uint8 = new Uint8Array(bankDataBuffer);

        // magic: "JAM!"
        uint8[0] = 0x4A; uint8[1] = 0x41; uint8[2] = 0x4D; uint8[3] = 0x21;
        uint8[4] = 0; // isTapeMode = false

        for (let i = 0; i < 16; i++) {
          const padOffset = 8 + (i * 60);

          if (i < sliceCount) {
            const start = slicerSlices[i];
            const end = slicerSlices[i + 1];
            const durationSec = (end - start) / origSampleRate;

            let qKey = padQualities[i] || '22k16';
            let preset = QUALITY_PRESETS[qKey] || QUALITY_PRESETS['22k16'];

            if (autoAdjust && durationSec > preset.maxSec) {
              qKey = getRecommendedQuality(durationSec);
              preset = QUALITY_PRESETS[qKey];
            }

            let monoSamples = await extractAndResampleSlice(slicerAudioBuffer, start, end, preset.sampleRate);
            if (monoSamples.length > preset.maxSamples) {
              monoSamples = monoSamples.subarray(0, preset.maxSamples);
            }

            const wavBlob = encodeWAVPCM(monoSamples, preset.sampleRate, preset.bitDepth);
            const padFilename = `PAD_${String(i + 1).padStart(2, '0')}.WAV`;
            folder.file(padFilename, wavBlob);

            const assignedPath = `/${bankFolder}/${padFilename}`;
            for (let c = 0; c < 31 && c < assignedPath.length; c++) {
              uint8[padOffset + c] = assignedPath.charCodeAt(c);
            }

            view.setUint32(padOffset + 32, 0, true);                  // startIndex
            view.setUint32(padOffset + 36, monoSamples.length, true); // endIndex
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

        view.setFloat32(968, 120.0, true); // savedBpm = 120.0
        folder.file('PROJECT.JAM', bankDataBuffer);

        // 2. sequence.bin por defecto (518 bytes)
        const seqBuffer = new ArrayBuffer(518);
        const seqView = new DataView(seqBuffer);
        seqView.setFloat32(512, 120.0, true); // bpm
        new Uint8Array(seqBuffer)[516] = 1;   // totalPages = 1
        new Uint8Array(seqBuffer)[517] = 50;  // swing = 50%
        folder.file('sequence.bin', seqBuffer);

        // 3. Descargar ZIP
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


