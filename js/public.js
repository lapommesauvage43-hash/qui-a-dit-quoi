import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET } from "./supabase-config.js";
import { enableZoom } from "./zoom.js";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const carousel = document.getElementById("carousel");
const openingScreen = document.getElementById("opening-screen");
const SPLASH_DURATION = 2000;
const SLIDE_DURATION = 900;

function publicUrlFor(path) {
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

function buildPage(post, index, targetIndex) {
  const page = document.createElement("section");
  page.className = "page loading";

  const frame = document.createElement("div");
  frame.className = "frame";

  const img = document.createElement("img");
  img.alt = "";
  img.decoding = "async";
  img.loading = Math.abs(index - targetIndex) <= 1 ? "eager" : "lazy";
  img.src = publicUrlFor(post.image_path);
  img.addEventListener("load", () => page.classList.remove("loading"), { once: true });
  img.addEventListener("error", () => page.classList.remove("loading"), { once: true });

  frame.appendChild(img);
  page.appendChild(frame);

  const zoomHandle = enableZoom(frame, img);
  page._zoomHandle = zoomHandle;

  return page;
}

function buildClosingScreen() {
  const page = document.createElement("section");
  page.className = "page identity-screen";
  page.innerHTML = `
    <img class="mark" src="/icons/logo.png" alt="" />
    <h1><span class="accent">Bon</span> chemin.</h1>
    <div class="trail"><span></span><span></span><span></span></div>
  `;
  return page;
}

async function init() {
  // Ordre décroissant : la publication la plus récente arrive en premier
  // dans le chemin. On glisse ensuite vers la gauche pour remonter le
  // temps, jusqu'à la plus ancienne, puis l'écran de clôture.
  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, image_path, display_order")
    .eq("published", true)
    .order("display_order", { ascending: false });

  if (error) {
    // Silence : l'application n'affiche jamais de texte technique.
    // On laisse simplement l'écran d'ouverture, sans le faire glisser.
    console.error(error);
    return;
  }

  const list = posts || [];

  if (list.length === 0) {
    // Rien à montrer encore : l'écran d'ouverture reste affiché.
    return;
  }

  const targetIndex = 0; // la publication la plus récente, montrée en premier

  list.forEach((post, i) => {
    carousel.appendChild(buildPage(post, i, targetIndex));
  });
  carousel.appendChild(buildClosingScreen());

  // Positionne le carrousel sur la publication la plus récente (le début
  // du chemin tel que présenté), pendant que l'écran d'ouverture masque
  // encore tout. C'est déjà la position par défaut, on le fixe quand même
  // explicitement pour rester robuste face à une restauration de scroll
  // par le navigateur.
  requestAnimationFrame(() => {
    carousel.scrollTo({ left: 0, behavior: "auto" });
  });

  let scrollResetTimer = null;
  carousel.addEventListener("scroll", () => {
    clearTimeout(scrollResetTimer);
    scrollResetTimer = setTimeout(() => {
      carousel.querySelectorAll(".page").forEach((page) => {
        if (page._zoomHandle) page._zoomHandle.reset();
      });
    }, 150);
  });

  window.addEventListener("resize", () => {
    // Réaligne la page courante si l'orientation change.
    const current = Math.round(carousel.scrollLeft / window.innerWidth);
    carousel.scrollTo({ left: current * window.innerWidth, behavior: "auto" });
  });

  setTimeout(() => {
    openingScreen.classList.add("slide-away");
    setTimeout(() => {
      openingScreen.style.display = "none";
    }, SLIDE_DURATION);
  }, SPLASH_DURATION);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

init();
