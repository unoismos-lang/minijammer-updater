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
});
