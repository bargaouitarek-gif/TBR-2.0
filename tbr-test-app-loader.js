(() => {
  "use strict";
  const iframe = document.getElementById("tbr-app");
  if (!iframe) return;
  iframe.src = "./app-base-v830.html?test-copy=3";
})();
