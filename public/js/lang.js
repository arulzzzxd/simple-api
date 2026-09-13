const translations = {
  id: {
    nav_home: "Beranda",
    nav_docs: "Dokumentasi",
    nav_profile: "Profil",
    hero_title: "Cyan Neon Rest API",
    hero_desc: "Layanan REST API cepat, stabil dengan tampilan Neon Cyan modern.",
    doc_title: "Dokumentasi Endpoint",
    profile_title: "Profil Pengguna & API Key"
  },
  en: {
    nav_home: "Home",
    nav_docs: "Documentation",
    nav_profile: "Profile",
    hero_title: "Cyan Neon Rest API",
    hero_desc: "Fast, stable REST API service with modern Neon Cyan interface.",
    doc_title: "Endpoint Documentation",
    profile_title: "User Profile & API Key"
  }
};

function changeLanguage(lang) {
  localStorage.setItem('lang', lang);
  document.querySelectorAll('[data-lang]').forEach(element => {
    const key = element.getAttribute('data-lang');
    if (translations[lang] && translations[lang][key]) {
      element.innerText = translations[lang][key];
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const currentLang = localStorage.getItem('lang') || 'id';
  changeLanguage(currentLang);
  
  const langBtn = document.getElementById('lang-toggle');
  if (langBtn) {
    langBtn.addEventListener('click', () => {
      const newLang = localStorage.getItem('lang') === 'id' ? 'en' : 'id';
      changeLanguage(newLang);
    });
  }
});
