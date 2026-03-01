<script setup lang="ts">
useHead({
  htmlAttrs: { lang: "en" },
  link: [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
    }
  ],
  script: [
    {
      // Runs before render to prevent dark-mode flash (FOUC)
      innerHTML: `(function(){try{var s=localStorage.getItem('color-mode');var p=window.matchMedia('(prefers-color-scheme: dark)').matches;if(s?s==='dark':p)document.documentElement.classList.add('dark');}catch(e){}})();`
    }
  ]
});
</script>

<template>
  <NuxtPage />
</template>

<style>
html,
body,
#__nuxt {
  margin: 0;
  padding: 0;
  width: 100%;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}
</style>
