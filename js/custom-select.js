(function () {
  'use strict';

  const enhanced = new WeakMap();

  function closeAll(except) {
    document.querySelectorAll('.custom-select.open').forEach((box) => {
      if (box !== except) {
        box.classList.remove('open');
        box.querySelector('.custom-select-trigger')?.setAttribute('aria-expanded', 'false');
      }
    });
  }

  function optionLabel(option) {
    return option?.textContent?.trim() || 'Selecione';
  }

  function selectedLabel(select) {
    if (!select.multiple) {
      return optionLabel(select.options[select.selectedIndex] || select.options[0]);
    }

    const selected = Array.from(select.selectedOptions);
    if (!selected.length) return 'Selecione...';
    if (selected.length === 1) return optionLabel(selected[0]);
    if (selected.length <= 2) return selected.map(optionLabel).join(', ');
    return `${selected.length} cursos selecionados`;
  }

  function sync(select) {
    const data = enhanced.get(select);
    if (!data) return;

    data.button.querySelector('.custom-select-label').textContent = selectedLabel(select);
    data.button.disabled = select.disabled;
    data.box.classList.toggle('disabled', select.disabled);

    data.menu.innerHTML = '';
    Array.from(select.options).forEach((option, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'custom-select-option';
      item.dataset.index = String(index);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', option.selected ? 'true' : 'false');
      item.disabled = option.disabled;
      const label = document.createElement('span');
      label.className = 'custom-select-option-label';
      label.textContent = optionLabel(option);
      item.appendChild(label);
      item.addEventListener('click', () => {
        if (option.disabled) return;
        if (select.multiple) {
          option.selected = !option.selected;
        } else {
          select.selectedIndex = index;
        }
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        sync(select);
        if (!select.multiple) {
          data.box.classList.remove('open');
          data.button.setAttribute('aria-expanded', 'false');
          data.button.focus();
        }
      });
      data.menu.appendChild(item);
    });
  }

  function enhance(select) {
    if (enhanced.has(select) || select.closest('.custom-select')) return;

    const box = document.createElement('div');
    box.className = select.multiple ? 'custom-select custom-select-multiple' : 'custom-select';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'custom-select-trigger';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    button.innerHTML = '<span class="custom-select-label"></span><span class="custom-select-arrow" aria-hidden="true"></span>';

    const menu = document.createElement('div');
    menu.className = 'custom-select-menu';
    menu.setAttribute('role', 'listbox');
    if (select.multiple) menu.setAttribute('aria-multiselectable', 'true');

    select.classList.add('native-select-hidden');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    select.insertAdjacentElement('afterend', box);
    box.append(select, button, menu);

    enhanced.set(select, { box, button, menu });

    button.addEventListener('click', () => {
      if (select.disabled) return;
      const isOpen = box.classList.contains('open');
      closeAll(box);
      box.classList.toggle('open', !isOpen);
      button.setAttribute('aria-expanded', String(!isOpen));
    });

    button.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        box.classList.remove('open');
        button.setAttribute('aria-expanded', 'false');
      }
    });

    select.addEventListener('change', () => sync(select));
    new MutationObserver(() => sync(select)).observe(select, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'selected', 'value']
    });

    sync(select);
  }

  function init() {
    document.querySelectorAll('select').forEach(enhance);
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.custom-select')) closeAll();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeAll();
    });
    document.querySelectorAll('form').forEach((form) => {
      form.addEventListener('reset', () => setTimeout(() => {
        document.querySelectorAll('select').forEach(sync);
      }, 0));
    });
  }

  window.SIGACCustomSelect = {
    refreshAll() {
      document.querySelectorAll('select').forEach((select) => {
        if (enhanced.has(select)) sync(select);
        else enhance(select);
      });
    }
  };

  document.addEventListener('DOMContentLoaded', init);
})();
