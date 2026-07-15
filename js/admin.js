import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from "./supabase-config.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginScreen = document.getElementById("login-screen");
const adminScreen = document.getElementById("admin-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const fileInput = document.getElementById("file-input");
const pendingPreview = document.getElementById("pending-preview");
const pendingImg = document.getElementById("pending-img");
const publishBtn = document.getElementById("publish-btn");
const grid = document.getElementById("grid");
const gridWrap = document.getElementById("grid-wrap");
const emptyState = document.getElementById("empty-state");

const COLUMNS = 3;
const GAP = 10;

let posts = []; // ordre courant, tel qu'affiché
let pendingFile = null;

function showScreen(name) {
  loginScreen.classList.toggle("active", name === "login");
  adminScreen.classList.toggle("active", name === "admin");
}

function publicUrlFor(path) {
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------- Authentification ----------

async function checkSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    showScreen("admin");
    loadPosts();
  } else {
    showScreen("login");
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = "Connexion impossible.";
    return;
  }
  showScreen("admin");
  loadPosts();
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  showScreen("login");
});

// ---------- Chargement des publications ----------

async function loadPosts() {
  const { data, error } = await supabase
    .from("posts")
    .select("id, image_path, display_order")
    .order("display_order", { ascending: true });
  if (error) {
    console.error(error);
    return;
  }
  posts = data || [];
  renderGrid();
}

// ---------- Ajout ----------

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  pendingFile = file;
  pendingImg.src = URL.createObjectURL(file);
  pendingPreview.style.display = "flex";
});

publishBtn.addEventListener("click", async () => {
  if (!pendingFile) return;
  publishBtn.disabled = true;
  publishBtn.textContent = "Publication…";

  try {
    const ext = (pendingFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, pendingFile, { cacheControl: "31536000", upsert: false });
    if (uploadError) throw uploadError;

    const maxOrder = posts.reduce((m, p) => Math.max(m, p.display_order), -1);

    const { error: insertError } = await supabase
      .from("posts")
      .insert({ image_path: path, display_order: maxOrder + 1, published: true });
    if (insertError) throw insertError;

    pendingFile = null;
    fileInput.value = "";
    pendingPreview.style.display = "none";
    await loadPosts();
  } catch (err) {
    console.error(err);
    alert("La publication a échoué. Réessaie.");
  } finally {
    publishBtn.disabled = false;
    publishBtn.textContent = "Publier";
  }
});

// ---------- Suppression ----------

async function deletePost(post) {
  const ok = window.confirm("Supprimer cette publication ?");
  if (!ok) return;
  await supabase.storage.from(STORAGE_BUCKET).remove([post.image_path]);
  await supabase.from("posts").delete().eq("id", post.id);
  await loadPosts();
}

// ---------- Grille + réorganisation (façon écran d'accueil iPhone) ----------

function tileSize() {
  const width = gridWrap.clientWidth;
  return (width - GAP * (COLUMNS - 1)) / COLUMNS;
}

function slotPosition(index, size) {
  const col = index % COLUMNS;
  const row = Math.floor(index / COLUMNS);
  return { left: col * (size + GAP), top: row * (size + GAP) };
}

function renderGrid() {
  grid.innerHTML = "";
  emptyState.style.display = posts.length === 0 ? "block" : "none";
  if (posts.length === 0) {
    grid.style.height = "0px";
    return;
  }

  const size = tileSize();
  grid.style.setProperty("--tile-size", `${size}px`);
  const rows = Math.ceil(posts.length / COLUMNS);
  grid.style.height = `${rows * size + (rows - 1) * GAP}px`;

  posts.forEach((post, index) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    const pos = slotPosition(index, size);
    tile.style.left = `${pos.left}px`;
    tile.style.top = `${pos.top}px`;

    tile._post = post;

    const img = document.createElement("img");
    img.src = publicUrlFor(post.image_path);
    img.alt = "";
    tile.appendChild(img);

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "×";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deletePost(post);
    });
    tile.appendChild(del);

    attachDrag(tile, index, size);

    grid.appendChild(tile);
  });
}

function attachDrag(tile, startIndex, size) {
  let longPressTimer = null;
  let dragging = false;
  let currentIndex = startIndex;
  let originX = 0, originY = 0;
  let pointerStartX = 0, pointerStartY = 0;

  function onPointerDown(e) {
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    longPressTimer = setTimeout(() => {
      dragging = true;
      currentIndex = posts.findIndex((p) => p === tile._post);
      const rect = tile.getBoundingClientRect();
      const gridRect = grid.getBoundingClientRect();
      originX = rect.left - gridRect.left;
      originY = rect.top - gridRect.top;
      tile.classList.add("dragging");
      tile.setPointerCapture(e.pointerId);
    }, 350);
  }

  function onPointerMove(e) {
    if (!dragging) {
      const dx = Math.abs(e.clientX - pointerStartX);
      const dy = Math.abs(e.clientY - pointerStartY);
      if (dx > 8 || dy > 8) {
        clearTimeout(longPressTimer);
      }
      return;
    }
    e.preventDefault();
    const dx = e.clientX - pointerStartX;
    const dy = e.clientY - pointerStartY;
    tile.style.left = `${originX + dx}px`;
    tile.style.top = `${originY + dy}px`;

    const centerX = originX + dx + size / 2;
    const centerY = originY + dy + size / 2;
    const col = Math.min(COLUMNS - 1, Math.max(0, Math.round(centerX / (size + GAP))));
    const rowFloat = centerY / (size + GAP);
    const row = Math.max(0, Math.round(rowFloat));
    let targetIndex = row * COLUMNS + col;
    targetIndex = Math.min(posts.length - 1, Math.max(0, targetIndex));

    if (targetIndex !== currentIndex) {
      const [moved] = posts.splice(currentIndex, 1);
      posts.splice(targetIndex, 0, moved);
      currentIndex = targetIndex;
      repositionAllExcept(tile, size);
    }
  }

  async function onPointerUp(e) {
    clearTimeout(longPressTimer);
    if (!dragging) return;
    dragging = false;
    tile.classList.remove("dragging");
    const pos = slotPosition(currentIndex, size);
    tile.style.left = `${pos.left}px`;
    tile.style.top = `${pos.top}px`;
    tile.releasePointerCapture(e.pointerId);
    await persistOrder();
  }

  tile.addEventListener("pointerdown", onPointerDown);
  tile.addEventListener("pointermove", onPointerMove);
  tile.addEventListener("pointerup", onPointerUp);
  tile.addEventListener("pointercancel", onPointerUp);
}

function repositionAllExcept(draggedTile, size) {
  const tiles = Array.from(grid.children);
  posts.forEach((post, index) => {
    const tile = tiles.find((t) => t._post === post);
    if (!tile || tile === draggedTile) return;
    const pos = slotPosition(index, size);
    tile.style.left = `${pos.left}px`;
    tile.style.top = `${pos.top}px`;
  });
}

async function persistOrder() {
  posts = posts.map((post, index) => ({ ...post, display_order: index }));
  await Promise.all(
    posts.map((p) =>
      supabase.from("posts").update({ display_order: p.display_order }).eq("id", p.id)
    )
  );
}

window.addEventListener("resize", () => renderGrid());

checkSession();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
