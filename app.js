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

      // Remover activo de todos los botones y paneles
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      // Activar el seleccionado
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
        document.body.style.overflow = 'hidden'; // Evitar scroll de fondo
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
  const selectFilesBtn = document.getElementById('select-files-btn');
  const selectFolderBtn = document.getElementById('select-folder-btn');
  
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

  let conversionQueue = []; // { file, path, status, blob, rowElement }
  let isConverting = false;

  // Evitar que el navegador abra los archivos si se arrastran fuera de la zona
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  }, false);
  window.addEventListener('drop', (e) => {
    e.preventDefault();
  }, false);

  // Zona de Drop clickeable
  dropZone.addEventListener('click', (e) => {
    // Solo disparar si no se hizo clic en los botones internos
    if (e.target !== selectFilesBtn && e.target !== selectFolderBtn) {
      fileInput.click();
    }
  });

  // Botones de Búsqueda
  selectFilesBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });
  
  selectFolderBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    folderInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    handleFileObjects(Array.from(e.target.files));
    fileInput.value = ''; // Reset
  });

  folderInput.addEventListener('change', (e) => {
    handleFileObjects(Array.from(e.target.files));
    folderInput.value = ''; // Reset
  });

  // Eventos de Drag & Drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');

    const items = e.dataTransfer.items;
    if (!items) return;

    const filesToLoad = [];
    const entries = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          entries.push(entry);
        }
      }
    }

    // Escaneo recursivo
    for (const entry of entries) {
      await scanEntry(entry, '', filesToLoad);
    }

    handleFileObjects(filesToLoad);
  });

  // Escaneo recursivo de directorios arrastrados
  async function scanEntry(entry, path, filesList) {
    if (entry.isFile) {
      const file = await new Promise(resolve => entry.file(resolve));
      filesList.push({
        file: file,
        relativePath: path ? `${path}/${file.name}` : file.name
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const entries = await new Promise((resolve) => {
        dirReader.readEntries(resolve);
      });
      for (const subEntry of entries) {
        await scanEntry(subEntry, path ? `${path}/${entry.name}` : entry.name, filesList);
      }
    }
  }

  // Normalizar archivos desde inputs
  function handleFileObjects(fileList) {
    const audioFormats = /\.(mp3|flac|wav|m4a|ogg|aac|aif|aiff)$/i;
    
    fileList.forEach(item => {
      let fileObj, relPath;
      if (item.file && item.relativePath !== undefined) {
        fileObj = item.file;
        relPath = item.relativePath;
      } else {
        fileObj = item;
        relPath = item.webkitRelativePath || item.name;
      }

      if (audioFormats.test(fileObj.name)) {
        // Evitar duplicados
        if (!conversionQueue.some(q => q.path === relPath)) {
          addFileToQueue(fileObj, relPath);
        }
      }
    });

    updateQueueUI();
  }

  // Añadir a la cola
  function addFileToQueue(file, path) {
    const queueItem = {
      file: file,
      path: path,
      status: 'queued', // queued, processing, success, error
      blob: null,
      rowElement: null
    };
    conversionQueue.push(queueItem);
  }

  // Actualizar UI
  function updateQueueUI() {
    if (conversionQueue.length > 0) {
      batchControl.classList.remove('hidden');
      filesContainer.classList.remove('hidden');
      downloadZipBtn.classList.add('hidden'); // Ocultar hasta terminar
    } else {
      batchControl.classList.add('hidden');
      filesContainer.classList.add('hidden');
    }

    filesList.innerHTML = '';
    conversionQueue.forEach((item, index) => {
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

      // Si terminó con éxito, añadir botón de descarga individual
      if (item.status === 'success' && item.blob) {
        const dlBtn = document.createElement('button');
        dlBtn.className = 'btn btn-primary glow-cyan-dim';
        dlBtn.style.padding = '4px 8px';
        dlBtn.style.fontSize = '0.75rem';
        dlBtn.style.minHeight = 'auto';
        dlBtn.style.minWidth = 'auto';
        dlBtn.style.marginTop = '0';
        dlBtn.textContent = '📥';
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

  // Limpiar cola
  clearQueueBtn.addEventListener('click', () => {
    if (isConverting) return;
    conversionQueue = [];
    updateQueueUI();
  });

  // Disparar la cola
  convertQueueBtn.addEventListener('click', async () => {
    if (isConverting || conversionQueue.length === 0) return;
    isConverting = true;
    convertQueueBtn.disabled = true;
    clearQueueBtn.disabled = true;
    downloadZipBtn.classList.add('hidden');

    const mode = convModeSelect.value;
    let completedCount = 0;
    
    // Procesamiento en lotes concurrentes (máximo 3)
    const activePromises = [];
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
      
      // Actualizar progreso general
      const progressPercent = (completedCount / conversionQueue.length) * 100;
      batchProgressBar.style.width = `${progressPercent}%`;
      batchCount.textContent = `${completedCount} / ${conversionQueue.length} archivos`;

      await processNext();
    }

    // Lanzar hilos concurrentes
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

    // Mostrar botón de ZIP si hay al menos una conversión exitosa
    if (conversionQueue.some(q => q.status === 'success')) {
      downloadZipBtn.classList.remove('hidden');
    }
  });

  // Actualizar el estado de una fila
  function updateRowStatus(item) {
    if (!item.rowElement) return;
    const badge = item.rowElement.querySelector('.file-status');
    if (badge) {
      badge.className = `file-status status-${item.status}`;
      badge.textContent = getStatusText(item.status);
    }
    
    // Si terminó con éxito y no tiene botón de descarga, añadirlo
    if (item.status === 'success' && item.blob && !item.rowElement.querySelector('button')) {
      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn btn-primary glow-cyan-dim';
      dlBtn.style.padding = '4px 8px';
      dlBtn.style.fontSize = '0.75rem';
      dlBtn.style.minHeight = 'auto';
      dlBtn.style.minWidth = 'auto';
      dlBtn.style.marginTop = '0';
      dlBtn.textContent = '📥';
      dlBtn.addEventListener('click', () => {
        triggerSingleDownload(item);
      });
      item.rowElement.appendChild(dlBtn);
    }
  }

  // Descargar archivo individual
  function triggerSingleDownload(item) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(item.blob);
    a.download = item.file.name.replace(/\.[^/.]+$/, ".wav");
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Descargar todo como ZIP preservando la estructura
  downloadZipBtn.addEventListener('click', async () => {
    downloadZipBtn.disabled = true;
    const originalText = downloadZipBtn.textContent;
    downloadZipBtn.textContent = 'Comprimiendo ZIP...';

    try {
      const zip = new JSZip();
      conversionQueue.forEach(item => {
        if (item.status === 'success' && item.blob) {
          // Reemplazar la extensión original por .wav en la ruta del ZIP
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

  // =========================================================================
  //  CORE: PROCESAMIENTO Y DECODIFICACIÓN DE AUDIO
  // =========================================================================
  async function convertAudioFile(file, mode) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // 1. Leer como ArrayBuffer
    const arrayBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });

    // 2. Decodificar el Audio de origen
    const sourceAudioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    
    // 3. Configurar OfflineAudioContext para resamplear a 44100Hz
    const targetChannels = mode === 'mono' ? 1 : 2;
    const targetSampleRate = 44100;
    const totalFrames = targetSampleRate * sourceAudioBuffer.duration;
    
    const offlineCtx = new OfflineAudioContext(targetChannels, totalFrames, targetSampleRate);
    
    const bufferSource = offlineCtx.createBufferSource();
    bufferSource.buffer = sourceAudioBuffer;
    bufferSource.connect(offlineCtx.destination);
    bufferSource.start(0);
    
    // Renderizar audio resampleado
    const renderedBuffer = await offlineCtx.startRendering();
    
    // 4. Codificar a WAV PCM de 16 bits
    const wavBlob = encodeWAV16Bit(renderedBuffer, targetChannels);
    
    // Cerrar contexto principal
    await audioCtx.close();
    
    return wavBlob;
  }

  // Codificador de WAV a 16-bit PCM
  function encodeWAV16Bit(audioBuffer, channelCount) {
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length * channelCount * 2 + 44; // 44 bytes para el header
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

    // --- RIFF Header ---
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // tamaño del archivo - 8
    setUint32(0x45564157); // "WAVE"

    // --- fmt Chunk ---
    setUint32(0x20746d66); // "fmt "
    setUint32(16);         // tamaño del chunk fmt (16 bytes para PCM)
    setUint16(1);          // Formato: 1 = PCM Lineal (sin compresión)
    setUint16(channelCount);
    setUint32(sampleRate);
    setUint32(sampleRate * channelCount * 2); // Byte Rate = sampleRate * canales * bytesPorMuestra (2)
    setUint16(channelCount * 2);              // Block Align = canales * bytesPorMuestra
    setUint16(16);                            // Bits per sample = 16 bits

    // --- data Chunk ---
    setUint32(0x61746164); // "data"
    setUint32(audioBuffer.length * channelCount * 2); // tamaño del bloque de datos

    // Mezclar canales si es necesario o copiar los canales al buffer de salida
    const channelBuffers = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channelBuffers.push(audioBuffer.getChannelData(i));
    }

    // Codificación PCM de las muestras flotantes a enteros de 16-bit
    const totalSamples = audioBuffer.length;
    for (let pos = 0; pos < totalSamples; pos++) {
      for (let ch = 0; ch < channelCount; ch++) {
        // Si el buffer origen tiene menos canales que el destino (ej. pasar de mono a estéreo)
        const channelData = channelBuffers[ch] || channelBuffers[0];
        let sample = channelData[pos];
        
        // Limitar amplitud para evitar recortes (clipping)
        if (sample > 1) sample = 1;
        else if (sample < -1) sample = -1;
        
        // Convertir Float32 (-1.0 a 1.0) a Int16 (-32768 a 32767)
        const pcmSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, pcmSample, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }
});
