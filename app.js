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

  const closeModal = (modal) => {
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.closest('.modal-overlay'));
    });
  });

  // Cerrar al hacer clic fuera de la tarjeta modal
  overlays.forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });
  });
});
