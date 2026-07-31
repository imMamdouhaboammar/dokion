/* Dokion Community Playbook Hub — Client Application Logic (Robust Modal & Event Handlers) */

let catalogData = [];
let currentCategory = "all";
let currentView = "grid";

document.addEventListener("DOMContentLoaded", async () => {
  await loadCatalog();
  setupEventListeners();
  render();
});

async function loadCatalog() {
  try {
    const res = await fetch("catalog.json");
    catalogData = await res.json();
    updateStatsHeader();
  } catch (err) {
    console.error("Failed to load catalog.json:", err);
  }
}

function updateStatsHeader() {
  const totalDownloads = catalogData.reduce((acc, p) => acc + p.stats.downloads, 0);
  const avgSuccessRate = catalogData.length
    ? (catalogData.reduce((acc, p) => acc + p.stats.successRate, 0) / catalogData.length).toFixed(1)
    : "99.1";

  const elPlaybooks = document.getElementById("stat-total-playbooks");
  const elDownloads = document.getElementById("stat-total-downloads");
  const elSuccess = document.getElementById("stat-avg-success");

  if (elPlaybooks) elPlaybooks.textContent = catalogData.length;
  if (elDownloads) elDownloads.textContent = totalDownloads.toLocaleString();
  if (elSuccess) elSuccess.textContent = `${avgSuccessRate}%`;
}

function setupEventListeners() {
  const searchInput = document.getElementById("search-input");
  const sortSelect = document.getElementById("sort-select");
  const categoryPills = document.querySelectorAll(".category-pills .pill");
  const btnGridView = document.getElementById("view-grid");
  const btnTableView = document.getElementById("view-table");
  const btnPublish = document.getElementById("btn-publish-playbook");
  const modalOverlay = document.getElementById("inspect-modal");

  if (searchInput) searchInput.addEventListener("input", () => render());
  if (sortSelect) sortSelect.addEventListener("change", () => render());

  if (btnPublish) {
    btnPublish.addEventListener("click", (e) => {
      e.preventDefault();
      openPublishModal();
    });
  }

  categoryPills.forEach((pill) => {
    pill.addEventListener("click", () => {
      categoryPills.forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      currentCategory = pill.dataset.category;
      render();
    });
  });

  if (btnGridView) {
    btnGridView.addEventListener("click", () => {
      btnGridView.classList.add("active");
      if (btnTableView) btnTableView.classList.remove("active");
      currentView = "grid";
      render();
    });
  }

  if (btnTableView) {
    btnTableView.addEventListener("click", () => {
      btnTableView.classList.add("active");
      if (btnGridView) btnGridView.classList.remove("active");
      currentView = "table";
      render();
    });
  }

  // Close modal when clicking on overlay outside modal box
  if (modalOverlay) {
    modalOverlay.addEventListener("click", (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal();
    } else if (e.key === "/" && document.activeElement !== searchInput) {
      e.preventDefault();
      if (searchInput) searchInput.focus();
    }
  });
}

function getFilteredData() {
  const searchEl = document.getElementById("search-input");
  const sortEl = document.getElementById("sort-select");

  const query = searchEl ? searchEl.value.toLowerCase().trim() : "";
  const sortBy = sortEl ? sortEl.value : "score";

  let filtered = catalogData.filter((p) => {
    const matchesCategory = currentCategory === "all" || p.category === currentCategory;
    const matchesQuery =
      !query ||
      p.id.toLowerCase().includes(query) ||
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.publisher.handle.toLowerCase().includes(query) ||
      p.tags.some((t) => t.toLowerCase().includes(query));

    return matchesCategory && matchesQuery;
  });

  // Composite Quality Score Calculation
  filtered.forEach((p) => {
    p.compositeScore =
      Math.round(
        (25 * Math.log10(p.stats.downloads + 1) +
          15 * p.stats.rating +
          40 * (p.stats.successRate / 100) +
          (p.publisher.verified ? 20 : 0)) *
          10
      ) / 10;
  });

  filtered.sort((a, b) => {
    if (sortBy === "downloads") return b.stats.downloads - a.stats.downloads;
    if (sortBy === "rating") return b.stats.rating - a.stats.rating;
    if (sortBy === "successRate") return b.stats.successRate - a.stats.successRate;
    return b.compositeScore - a.compositeScore;
  });

  return filtered;
}

function render() {
  const data = getFilteredData();
  const gridContainer = document.getElementById("playbook-grid");
  const tableContainer = document.getElementById("leaderboard-table");

  if (!gridContainer || !tableContainer) return;

  if (currentView === "grid") {
    gridContainer.style.display = "grid";
    tableContainer.style.display = "none";
    renderGrid(data, gridContainer);
  } else {
    gridContainer.style.display = "none";
    tableContainer.style.display = "table";
    renderTable(data, tableContainer);
  }
}

function renderGrid(data, container) {
  if (data.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No verified playbooks found matching filter criteria.</div>`;
    return;
  }

  container.innerHTML = data
    .map((p) => {
      const verifiedBadge = p.publisher.verified ? `<span class="verified-badge">✓ Verified</span>` : "";
      const tagsHtml = p.tags ? p.tags.slice(0, 4).map((t) => `<span class="tag-item">#${t}</span>`).join("") : "";

      return `
        <div class="playbook-card">
          <div>
            <div class="card-header">
              <div class="card-title">${p.id}</div>
              ${verifiedBadge}
            </div>
            <p class="card-description">${p.description}</p>
            <div class="tag-list">${tagsHtml}</div>
          </div>
          <div>
            <div class="card-meta">
              <span class="meta-item">⭐ ${p.stats.rating}</span>
              <span class="meta-item">📥 ${p.stats.downloads.toLocaleString()}</span>
              <span class="meta-item" style="color: var(--accent-green)">⚡ ${p.stats.successRate}% Success</span>
            </div>
            <div class="card-footer">
              <button class="btn btn-primary" onclick="copyPullCommand('${p.id}')">Copy Cmd</button>
              <button class="btn btn-secondary" onclick="openInspectModal('${p.id}')">Inspect</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderTable(data, container) {
  const tbody = container.querySelector("tbody");
  if (!tbody) return;

  tbody.innerHTML = data
    .map((p, idx) => {
      const rankClass = idx === 0 ? "rank-1" : idx === 1 ? "rank-2" : idx === 2 ? "rank-3" : "rank-other";
      const verified = p.publisher.verified ? "✅" : "";
      return `
        <tr>
          <td><span class="rank-badge ${rankClass}">${idx + 1}</span></td>
          <td><strong>${p.id}</strong> ${verified}</td>
          <td><span class="pill">${p.category}</span></td>
          <td><strong>${p.compositeScore}</strong></td>
          <td>⭐ ${p.stats.rating}</td>
          <td>${p.stats.downloads.toLocaleString()}</td>
          <td style="color: var(--accent-green); font-weight: 600;">${p.stats.successRate}%</td>
          <td>
            <button class="btn btn-secondary" style="min-height: 36px; padding: 4px 12px; font-size: 12px;" onclick="openInspectModal('${p.id}')">Inspect</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function copyPullCommand(packageId) {
  const cmd = `dokion hub pull ${packageId}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cmd);
  }
  showToast(`Copied command: "${cmd}"`);
}

function openInspectModal(packageId) {
  const p = catalogData.find((item) => item.id === packageId);
  if (!p) return;

  const modalOverlay = document.getElementById("inspect-modal");
  const modalBody = document.getElementById("modal-body");
  if (!modalOverlay || !modalBody) return;

  const stagesHtml = p.stages
    ? p.stages.map((s) => `<li><strong>${s.name}</strong> (${s.steps} steps)</li>`).join("")
    : "<li>Standard Playbook Stages</li>";

  modalBody.innerHTML = `
    <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 8px;">${p.id}</h2>
    <p style="color: var(--text-muted); margin-bottom: 16px;">${p.description}</p>
    
    <div style="display: flex; gap: 16px; font-size: 13px; color: var(--text-dim); margin-bottom: 20px; flex-wrap: wrap;">
      <span>Publisher: <strong>${p.publisher.name}</strong></span>
      <span>Category: <strong>${p.category}</strong></span>
      <span>Digest: <code>${p.digest.substring(0, 22)}...</code></span>
    </div>

    <div class="code-block">
      <span>dokion hub pull ${p.id}</span>
      <button class="btn btn-secondary" style="min-height: 36px; padding: 4px 12px; font-size: 12px;" onclick="copyPullCommand('${p.id}')">Copy</button>
    </div>

    <h4 style="font-size: 15px; font-weight: 700; margin-top: 20px; margin-bottom: 10px;">Declared Playbook Stages:</h4>
    <ul style="padding-left: 20px; color: var(--text-muted); font-size: 14px; line-height: 1.8;">
      ${stagesHtml}
    </ul>
  `;

  modalOverlay.classList.add("active");
}

function openPublishModal() {
  const modalOverlay = document.getElementById("inspect-modal");
  const modalBody = document.getElementById("modal-body");
  if (!modalOverlay || !modalBody) return;

  modalBody.innerHTML = `
    <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 8px;">Publish Your Playbook</h2>
    <p style="color: var(--text-muted); margin-bottom: 16px;">Publish your custom hardening playbook to the Dokion GitHub Native Decentralized Registry.</p>
    
    <h4 style="font-size: 15px; font-weight: 700; margin-top: 16px; margin-bottom: 8px;">Option 1: Publish via Dokion CLI</h4>
    <div class="code-block">
      <span>dokion hub publish .dokion/playbook.json --handle myusername</span>
      <button class="btn btn-secondary" style="min-height: 36px; padding: 4px 12px; font-size: 12px;" onclick="copyPublishCommand()">Copy</button>
    </div>

    <h4 style="font-size: 15px; font-weight: 700; margin-top: 20px; margin-bottom: 8px;">Option 2: Submit via Pull Request</h4>
    <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 12px;">Add your playbook definition to <code>playbooks/reference/</code> in <a href="https://github.com/imMamdouhaboammar/dokion" target="_blank" style="color: var(--accent-cyan);">imMamdouhaboammar/dokion</a> and open a Pull Request for verification.</p>
  `;

  modalOverlay.classList.add("active");
}

function copyPublishCommand() {
  const cmd = "dokion hub publish .dokion/playbook.json --handle myusername";
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cmd);
  }
  showToast("Copied publish command!");
}

function closeModal() {
  const modalOverlay = document.getElementById("inspect-modal");
  if (modalOverlay) modalOverlay.classList.remove("active");
}

function showToast(message) {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `<span>📋 ${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// Global Window Exports
window.openPublishModal = openPublishModal;
window.openInspectModal = openInspectModal;
window.closeModal = closeModal;
window.copyPullCommand = copyPullCommand;
window.copyPublishCommand = copyPublishCommand;
window.showToast = showToast;
